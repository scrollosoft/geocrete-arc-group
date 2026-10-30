import { Expense } from '../models/Expense.js'
import { Site } from '../models/Site.js'
import { Material, isQualifyingMaterialPurchase } from '../models/Material.js'
import { getPool } from '../config/db.js'

export const getExpenses = async (req, res, next) => {
  try {
    const { siteId, category, startDate, endDate, search, limit, skip } = req.query
    const { expenses, totalCount } = await Expense.find({
      siteId,
      category,
      startDate,
      endDate,
      search,
      limit: limit ? Number(limit) : undefined,
      skip:  skip  ? Number(skip)  : undefined,
    })
    res.json({ expenses, totalCount })
  } catch (error) {
    next(error)
  }
}

export const getExpenseById = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' })
    }
    res.json(expense)
  } catch (error) {
    next(error)
  }
}

export const createExpense = async (req, res, next) => {
  try {
    const {
      date,
      site,
      supplier,
      category,
      quantity,
      unit,
      ratePerUnit,
      paidAmount,
      bankAccountId,
      paymentMethod,
      paymentStatus,
      status,
      remark,
    } = req.body

    if (!site) {
      return res.status(400).json({ error: 'Construction site is required' })
    }

    const numQuantity = Number(quantity)
    const numRate     = Number(ratePerUnit)

    if (isNaN(numQuantity) || numQuantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity greater than 0 is required' })
    }

    if (isNaN(numRate) || numRate < 0) {
      return res.status(400).json({ error: 'Valid rate per unit is required' })
    }

    const calculatedAmount  = Number((numQuantity * numRate).toFixed(2))
    const parsedPaid        = Number(paidAmount) || 0

    if (parsedPaid < 0) {
      return res.status(400).json({ error: 'Paid amount cannot be negative' })
    }

    if (parsedPaid > calculatedAmount) {
      return res.status(400).json({ error: 'Paid amount cannot exceed total amount' })
    }

    // Bank account validation
    if (parsedPaid > 0 && !bankAccountId) {
      return res.status(400).json({ error: 'Please select a bank account.' })
    }

    const calculatedPending = Number((calculatedAmount - parsedPaid).toFixed(2))

    const expenseCategory = category || 'Material'
    // Backend calculates payment status automatically from calculated total and actual paid amount
    const expenseStatus =
      calculatedAmount > 0 && parsedPaid >= calculatedAmount
        ? 'Paid'
        : parsedPaid > 0
          ? 'Partial'
          : 'Pending'
    const shouldApplyToMaterial = isQualifyingMaterialPurchase(expenseCategory, expenseCategory)

    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()

      // Validate and deduct bank balance
      if (bankAccountId && parsedPaid > 0) {
        const [[bankRow]] = await conn.query(
          'SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
          [bankAccountId]
        )
        if (!bankRow) {
          await conn.rollback()
          conn.release()
          return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
        }
        const bankBalance = Number(bankRow.balance)
        if (bankBalance <= 0) {
          await conn.rollback()
          conn.release()
          return res.status(400).json({ error: 'This bank account has zero balance. Please select another bank account.' })
        }
        if (bankBalance < parsedPaid) {
          await conn.rollback()
          conn.release()
          return res.status(400).json({ error: `Insufficient bank balance. Available balance: ₹${bankBalance.toLocaleString('en-IN')}.` })
        }
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [parsedPaid, bankAccountId])
      }

      const expenseDate = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

      const [result] = await conn.query(
        `INSERT INTO expenses
          (date, site_id, supplier_id, category,
           quantity, unit, rate_per_unit, amount, paid_amount, pending_amount,
           payment_method, remark, status, applied_to_material, bank_account_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          expenseDate,
          site,
          supplier || null,
          expenseCategory,
          numQuantity,
          unit || 'Units',
          numRate,
          calculatedAmount,
          parsedPaid,
          calculatedPending,
          paymentMethod || 'Bank Transfer',
          remark || '',
          expenseStatus,
          shouldApplyToMaterial ? 1 : 0,
          bankAccountId || null,
        ],
      )

      await conn.query(
        'UPDATE sites SET total_spent = total_spent + ? WHERE id = ?',
        [calculatedAmount, site],
      )

      if (shouldApplyToMaterial) {
        await Material.applyExpensePurchase(conn, {
          materialName: expenseCategory,
          siteId: site,
          supplierId: supplier || null,
          quantity: numQuantity,
          unit: unit || 'Units',
          ratePerUnit: numRate,
          amount: calculatedAmount,
          paidAmount: parsedPaid,
          purchaseDate: expenseDate,
          category: expenseCategory,
          notes: remark || '',
        })
      }

      await conn.commit()
      conn.release()

      const expense = await Expense.findById(result.insertId)
      res.status(201).json(expense)
    } catch (err) {
      await conn.rollback()
      conn.release()
      throw err
    }
  } catch (error) {
    next(error)
  }
}

export const updateExpense = async (req, res, next) => {
  try {
    const existingExpense = await Expense.findById(req.params.id)
    if (!existingExpense) {
      return res.status(404).json({ error: 'Expense not found' })
    }

    const oldAmount = existingExpense.amount
    const oldSiteId = existingExpense.site?._id || existingExpense.site
    const oldSupplierId = existingExpense.supplier?._id || existingExpense.supplier || null
    const oldCategory = existingExpense.category || 'Material'
    const oldQuantity = existingExpense.quantity
    const oldPaid = existingExpense.paidAmount
    const oldBankAccountId = existingExpense.bankAccountId || null
    const wasApplied = Boolean(existingExpense.appliedToMaterial)

    const quantity    = req.body.quantity    !== undefined ? Number(req.body.quantity)    : existingExpense.quantity
    const ratePerUnit = req.body.ratePerUnit !== undefined ? Number(req.body.ratePerUnit) : existingExpense.ratePerUnit
    const paidAmount  = req.body.paidAmount  !== undefined ? Number(req.body.paidAmount)  : existingExpense.paidAmount
    const newBankAccountId = req.body.bankAccountId !== undefined ? (req.body.bankAccountId || null) : oldBankAccountId

    const newAmount  = Number((quantity * ratePerUnit).toFixed(2))
    const newPending = Math.max(0, Number((newAmount - paidAmount).toFixed(2)))
    const newCategory = req.body.category !== undefined ? req.body.category : oldCategory
    const newSiteId = req.body.site !== undefined ? req.body.site : oldSiteId
    const newSupplierId = req.body.supplier !== undefined ? (req.body.supplier || null) : oldSupplierId
    const newUnit = req.body.unit !== undefined ? req.body.unit : existingExpense.unit
    const newDate = req.body.date !== undefined ? req.body.date : existingExpense.date
    const shouldApply = isQualifyingMaterialPurchase(newCategory, newCategory)

    // Backend calculates payment status automatically from calculated total and actual paid amount
    const newStatus =
      newAmount > 0 && paidAmount >= newAmount
        ? 'Paid'
        : paidAmount > 0
          ? 'Partial'
          : 'Pending'

    const updateData = {
      ...req.body,
      quantity,
      ratePerUnit,
      amount:        newAmount,
      paidAmount,
      pendingAmount: newPending,
      status:        newStatus,
      appliedToMaterial: shouldApply ? 1 : 0,
      bankAccountId: newBankAccountId,
    }

    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()

      // Handle bank balance adjustments for edit
      if (String(newBankAccountId || '') !== String(oldBankAccountId || '')) {
        // Bank account changed — refund old, deduct new
        if (oldBankAccountId && oldPaid > 0) {
          await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [oldPaid, oldBankAccountId])
        }
        if (newBankAccountId && paidAmount > 0) {
          const [[bankRow]] = await conn.query(
            'SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
            [newBankAccountId]
          )
          if (!bankRow) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
          }
          const bankBalance = Number(bankRow.balance)
          if (bankBalance <= 0) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: 'This bank account has zero balance. Please select another bank account.' })
          }
          if (bankBalance < paidAmount) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: `Insufficient bank balance. Available balance: ₹${bankBalance.toLocaleString('en-IN')}.` })
          }
          await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [paidAmount, newBankAccountId])
        }
      } else if (newBankAccountId) {
        // Same bank — adjust only the difference
        const diff = paidAmount - oldPaid
        if (diff > 0) {
          const [[bankRow]] = await conn.query(
            'SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
            [newBankAccountId]
          )
          if (!bankRow) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
          }
          const bankBalance = Number(bankRow.balance)
          if (bankBalance < diff) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: `Insufficient bank balance. Available balance: ₹${bankBalance.toLocaleString('en-IN')}.` })
          }
          await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [diff, newBankAccountId])
        } else if (diff < 0) {
          await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [Math.abs(diff), newBankAccountId])
        }
      }

      if (wasApplied) {
        await Material.reverseExpensePurchase(conn, {
          materialName: oldCategory,
          siteId: oldSiteId,
          supplierId: oldSupplierId,
          quantity: oldQuantity,
          amount: oldAmount,
          paidAmount: oldPaid,
        })
      }

      // Build dynamic UPDATE for expenses
      const colMap = {
        date: 'date', site: 'site_id', supplier: 'supplier_id',
        category: 'category',
        quantity: 'quantity', unit: 'unit', ratePerUnit: 'rate_per_unit',
        amount: 'amount', paidAmount: 'paid_amount', pendingAmount: 'pending_amount',
        paymentMethod: 'payment_method', remark: 'remark', status: 'status',
        appliedToMaterial: 'applied_to_material',
        bankAccountId: 'bank_account_id',
      }
      const sets = []
      const params = []
      for (const [apiKey, col] of Object.entries(colMap)) {
        if (updateData[apiKey] !== undefined) {
          sets.push(`${col} = ?`)
          let val = updateData[apiKey]
          if (apiKey === 'date') val = new Date(val).toISOString().slice(0, 10)
          if (['quantity','ratePerUnit','amount','paidAmount','pendingAmount','appliedToMaterial'].includes(apiKey)) val = Number(val)
          if ((apiKey === 'supplier' || apiKey === 'bankAccountId') && !val) val = null
          params.push(val)
        }
      }
      if (sets.length > 0) {
        params.push(req.params.id)
        await conn.query(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, params)
      }

      // Adjust site totalSpent
      if (String(newSiteId) === String(oldSiteId)) {
        const diff = newAmount - oldAmount
        if (diff !== 0) {
          await conn.query('UPDATE sites SET total_spent = total_spent + ? WHERE id = ?', [diff, oldSiteId])
        }
      } else {
        await conn.query('UPDATE sites SET total_spent = total_spent - ? WHERE id = ?', [oldAmount, oldSiteId])
        await conn.query('UPDATE sites SET total_spent = total_spent + ? WHERE id = ?', [newAmount, newSiteId])
      }

      if (shouldApply) {
        await Material.applyExpensePurchase(conn, {
          materialName: newCategory,
          siteId: newSiteId,
          supplierId: newSupplierId,
          quantity,
          unit: newUnit || 'Units',
          ratePerUnit,
          amount: newAmount,
          paidAmount,
          purchaseDate: newDate,
          category: newCategory,
          notes: existingExpense.remark || '',
        })
      }

      await conn.commit()
      conn.release()

      const updatedExpense = await Expense.findById(req.params.id)
      res.json(updatedExpense)
    } catch (err) {
      await conn.rollback()
      conn.release()
      throw err
    }
  } catch (error) {
    next(error)
  }
}

export const deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' })
    }

    const siteId = expense.site?._id || expense.site
    const supplierId = expense.supplier?._id || expense.supplier || null

    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()

      if (expense.appliedToMaterial) {
        await Material.reverseExpensePurchase(conn, {
          materialName: expense.category,
          siteId,
          supplierId,
          quantity: expense.quantity,
          amount: expense.amount,
          paidAmount: expense.paidAmount,
        })
      }

      await conn.query('DELETE FROM expenses WHERE id = ?', [req.params.id])
      await conn.query('UPDATE sites SET total_spent = total_spent - ? WHERE id = ?', [expense.amount, siteId])

      if (expense.bankAccountId && expense.paidAmount > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [expense.paidAmount, expense.bankAccountId])
      }
      await conn.commit()
      conn.release()
    } catch (err) {
      await conn.rollback()
      conn.release()
      throw err
    }

    res.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    next(error)
  }
}
