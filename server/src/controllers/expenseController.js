import { Expense } from '../models/Expense.js'
import { Material, isQualifyingMaterialPurchase } from '../models/Material.js'
import { getPool } from '../config/db.js'
import { calculateLiveCashSummary } from './cashController.js'

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

    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash' || String(paymentMethod || '').toLowerCase() === 'cash'
    const finalBankAccountId = isCashAccount ? null : (bankAccountId ? Number(bankAccountId) : null)
    const finalPaymentMethod = isCashAccount ? 'Cash' : (paymentMethod || 'Bank Transfer')

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

      // Validate and deduct balance (Cash or Bank)
      if (parsedPaid > 0) {
        if (isCashAccount) {
          const cashSummary = await calculateLiveCashSummary(conn)
          if (cashSummary.balance < parsedPaid) {
            await conn.rollback()
            conn.release()
            return res.status(400).json({
              error: `Insufficient cash balance. Available cash: ₹${cashSummary.balance.toLocaleString('en-IN')}, Requested: ₹${parsedPaid.toLocaleString('en-IN')}.`,
            })
          }
        } else if (finalBankAccountId) {
          const [[bankRow]] = await conn.query(
            'SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
            [finalBankAccountId]
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
          await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [parsedPaid, finalBankAccountId])
        }
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
          finalPaymentMethod,
          remark || '',
          expenseStatus,
          shouldApplyToMaterial ? 1 : 0,
          finalBankAccountId,
        ],
      )

      await conn.query(
        'UPDATE sites SET total_spent = total_spent + ? WHERE id = ?',
        [calculatedAmount, site],
      )

      if (parsedPaid > 0) {
        await conn.query(
          `INSERT INTO expense_payments
            (expense_id, site_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            site,
            supplier || null,
            finalBankAccountId,
            parsedPaid,
            expenseDate,
            finalPaymentMethod,
            remark || '',
            'Initial Expense Payment',
          ],
        )
      }

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

      await conn.query('DELETE FROM expense_payments WHERE expense_id = ?', [req.params.id])
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

export const recordExpensePayment = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const expenseId = req.params.id
    const {
      amount,
      paymentDate,
      paymentMethod,
      bankAccountId,
      reference,
      notes,
    } = req.body

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero.' })
    }

    if (!bankAccountId) {
      return res.status(400).json({ error: 'Please select a bank account.' })
    }

    await conn.beginTransaction()

    // 1. Fetch expense with row lock
    const [[expense]] = await conn.query(
      'SELECT * FROM expenses WHERE id = ? FOR UPDATE',
      [expenseId],
    )
    if (!expense) {
      await conn.rollback()
      conn.release()
      return res.status(404).json({ error: 'Expense not found.' })
    }

    const currentTotal = Number(expense.amount) || 0
    const currentPaid = Number(expense.paid_amount) || 0
    const currentPending = Number(
      expense.pending_amount !== undefined && expense.pending_amount !== null
        ? expense.pending_amount
        : Math.max(0, currentTotal - currentPaid)
    )

    if (currentPending <= 0) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'This expense is already fully paid.' })
    }

    if (numAmount > currentPending) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({
        error: `Payment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed remaining pending amount of ₹${currentPending.toLocaleString('en-IN')}.`,
      })
    }

    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash' || String(paymentMethod || '').toLowerCase() === 'cash'
    const finalBankAccountId = isCashAccount ? null : (bankAccountId ? Number(bankAccountId) : null)
    const finalPaymentMethod = isCashAccount ? 'Cash' : (paymentMethod || 'Bank Transfer')

    // 2. Validate balance and deduct (Cash or Bank)
    if (isCashAccount) {
      const cashSummary = await calculateLiveCashSummary(conn)
      if (cashSummary.balance < numAmount) {
        await conn.rollback()
        conn.release()
        return res.status(400).json({
          error: `Insufficient cash balance. Available: ₹${cashSummary.balance.toLocaleString('en-IN')}, Requested: ₹${numAmount.toLocaleString('en-IN')}.`,
        })
      }
    } else {
      const [[bank]] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
        [finalBankAccountId],
      )
      if (!bank) {
        await conn.rollback()
        conn.release()
        return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
      }

      const currentBankBalance = Number(bank.balance) || 0
      if (currentBankBalance < numAmount) {
        await conn.rollback()
        conn.release()
        return res.status(400).json({
          error: `Insufficient bank balance in ${bank.bank_name}. Available: ₹${currentBankBalance.toLocaleString('en-IN')}, Requested: ₹${numAmount.toLocaleString('en-IN')}.`,
        })
      }

      // Deduct from bank account
      await conn.query(
        'UPDATE bank_accounts SET balance = balance - ? WHERE id = ?',
        [numAmount, finalBankAccountId],
      )
    }

    // 4. Update expense paid_amount, pending_amount, status
    const newPaid = Number((currentPaid + numAmount).toFixed(2))
    const newPending = Number(Math.max(0, currentTotal - newPaid).toFixed(2))
    const newStatus = newPending <= 0 ? 'Paid' : 'Partial'

    await conn.query(
      'UPDATE expenses SET paid_amount = ?, pending_amount = ?, status = ?, bank_account_id = ? WHERE id = ?',
      [newPaid, newPending, newStatus, finalBankAccountId, expenseId],
    )

    // 5. If linked to material, update material paid amount
    if (expense.applied_to_material || expense.material_id) {
      await conn.query(
        'UPDATE materials SET paid_amount = paid_amount + ? WHERE id = ? OR (site_id = ? AND category = ?)',
        [numAmount, expense.material_id || 0, expense.site_id, expense.category],
      )
    }

    // 6. Record payment in expense_payments
    const pDate = paymentDate
      ? new Date(paymentDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    await conn.query(
      `INSERT INTO expense_payments
        (expense_id, site_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expenseId,
        expense.site_id,
        expense.supplier_id || null,
        finalBankAccountId,
        numAmount,
        pDate,
        finalPaymentMethod,
        reference || '',
        notes || 'Expense partial payment',
      ],
    )

    await conn.commit()
    conn.release()

    const updated = await Expense.findById(expenseId)
    return res.json({ success: true, message: 'Expense payment recorded successfully', expense: updated })
  } catch (error) {
    await conn.rollback()
    conn.release()
    next(error)
  }
}

export const getExpensePayments = async (req, res, next) => {
  try {
    const expenseId = req.params.id
    const pool = getPool()

    const [rows] = await pool.query(
      `SELECT 
         ep.id,
         ep.expense_id,
         ep.site_id,
         ep.supplier_id,
         ep.bank_account_id,
         ep.amount,
         CAST(ep.payment_date AS CHAR) AS payment_date_str,
         CAST(ep.created_at AS CHAR) AS created_at_str,
         ep.payment_date,
         ep.payment_method,
         ep.reference,
         ep.notes,
         ep.created_at,
         ba.bank_name,
         ba.account_number
       FROM expense_payments ep
       LEFT JOIN bank_accounts ba ON ba.id = ep.bank_account_id
       WHERE ep.expense_id = ?
       ORDER BY ep.payment_date ASC, ep.id ASC`,
      [expenseId],
    )

    if (rows.length === 0) {
      const expense = await Expense.findById(expenseId)
      if (expense && Number(expense.paidAmount) > 0) {
        return res.json([
          {
            id: `initial-${expense._id}`,
            _id: `initial-${expense._id}`,
            expenseId: String(expense._id),
            siteId: expense.site?._id || expense.site || null,
            supplierId: expense.supplier?._id || expense.supplier || null,
            bankAccountId: expense.bankAccountId || null,
            amount: Number(expense.paidAmount),
            paymentDate: expense.date,
            paymentDateStr: expense.date,
            paymentType: 'Debit',
            paymentMethod: expense.paymentMethod || 'Bank Transfer',
            reference: expense.remark || '-',
            notes: 'Initial Expense Payment',
            bankName: expense.bankAccount?.bankName || '',
            accountNumber: expense.bankAccount?.accountNumber || '',
            createdAt: expense.createdAt,
          },
        ])
      }
      return res.json([])
    }

    const payments = rows.map((r) => {
      const dateVal = r.payment_date_str || (r.payment_date ? String(r.payment_date).slice(0, 10) : '')
      return {
        id: r.id,
        _id: String(r.id),
        expenseId: String(r.expense_id),
        siteId: String(r.site_id),
        supplierId: r.supplier_id ? String(r.supplier_id) : null,
        bankAccountId: r.bank_account_id ? String(r.bank_account_id) : null,
        amount: Number(r.amount) || 0,
        paymentDate: dateVal,
        paymentDateStr: dateVal,
        paymentType: 'Debit',
        paymentMethod: r.payment_method || 'Bank Transfer',
        reference: r.reference || r.notes || '-',
        notes: r.notes || '',
        bankName: r.bank_name || '',
        accountNumber: r.account_number || '',
        createdAt: r.created_at_str || r.created_at,
      }
    })

    return res.json(payments)
  } catch (error) {
    next(error)
  }
}

