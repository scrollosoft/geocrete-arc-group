import { Expense } from '../models/Expense.js'
import { Site } from '../models/Site.js'
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
      material,
      category,
      description,
      quantity,
      unit,
      ratePerUnit,
      paidAmount,
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

    const calculatedPending = Number((calculatedAmount - parsedPaid).toFixed(2))
    const finalDescription  = description || (material ? `${material} – ${numQuantity} ${unit || ''}`.trim() : 'Material Purchase')

    // Use a transaction so expense insert + site totalSpent update are atomic
    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()

      const [result] = await conn.query(
        `INSERT INTO expenses
          (date, site_id, supplier_id, material, category, description,
           quantity, unit, rate_per_unit, amount, paid_amount, pending_amount,
           payment_method, remark, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          site,
          supplier || null,
          material || '',
          category || 'Material',
          finalDescription,
          numQuantity,
          unit || 'Units',
          numRate,
          calculatedAmount,
          parsedPaid,
          calculatedPending,
          paymentMethod || 'Bank Transfer',
          remark || '',
          calculatedPending === 0 ? 'Paid' : parsedPaid > 0 ? 'Partial' : 'Pending',
        ],
      )

      await conn.query(
        'UPDATE sites SET total_spent = total_spent + ? WHERE id = ?',
        [calculatedAmount, site],
      )

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

    const quantity    = req.body.quantity    !== undefined ? Number(req.body.quantity)    : existingExpense.quantity
    const ratePerUnit = req.body.ratePerUnit !== undefined ? Number(req.body.ratePerUnit) : existingExpense.ratePerUnit
    const paidAmount  = req.body.paidAmount  !== undefined ? Number(req.body.paidAmount)  : existingExpense.paidAmount

    const newAmount  = Number((quantity * ratePerUnit).toFixed(2))
    const newPending = Math.max(0, Number((newAmount - paidAmount).toFixed(2)))

    const updateData = {
      ...req.body,
      quantity,
      ratePerUnit,
      amount:        newAmount,
      paidAmount,
      pendingAmount: newPending,
      status:        newPending === 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending',
    }

    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()

      // Build dynamic UPDATE for expenses
      const colMap = {
        date: 'date', site: 'site_id', supplier: 'supplier_id',
        material: 'material', category: 'category', description: 'description',
        quantity: 'quantity', unit: 'unit', ratePerUnit: 'rate_per_unit',
        amount: 'amount', paidAmount: 'paid_amount', pendingAmount: 'pending_amount',
        paymentMethod: 'payment_method', remark: 'remark', status: 'status',
      }
      const sets = []
      const params = []
      for (const [apiKey, col] of Object.entries(colMap)) {
        if (updateData[apiKey] !== undefined) {
          sets.push(`${col} = ?`)
          let val = updateData[apiKey]
          if (apiKey === 'date') val = new Date(val).toISOString().slice(0, 10)
          if (['quantity','ratePerUnit','amount','paidAmount','pendingAmount'].includes(apiKey)) val = Number(val)
          if (apiKey === 'supplier' && !val) val = null
          params.push(val)
        }
      }
      if (sets.length > 0) {
        params.push(req.params.id)
        await conn.query(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, params)
      }

      // Adjust site totalSpent
      const newSiteId = String(req.body.site || oldSiteId)
      if (newSiteId === String(oldSiteId)) {
        const diff = newAmount - oldAmount
        if (diff !== 0) {
          await conn.query('UPDATE sites SET total_spent = total_spent + ? WHERE id = ?', [diff, oldSiteId])
        }
      } else {
        await conn.query('UPDATE sites SET total_spent = total_spent - ? WHERE id = ?', [oldAmount, oldSiteId])
        await conn.query('UPDATE sites SET total_spent = total_spent + ? WHERE id = ?', [newAmount, newSiteId])
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

    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('DELETE FROM expenses WHERE id = ?', [req.params.id])
      await conn.query('UPDATE sites SET total_spent = total_spent - ? WHERE id = ?', [expense.amount, siteId])
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
