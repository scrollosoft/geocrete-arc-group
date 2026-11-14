import { getPool } from '../config/db.js'

/**
 * Calculates live cash financial summary across the system:
 * In: cash table + client payments received in cash
 * Out: expense payments in cash + worker payments in cash + worker advances in cash + client payment debits in cash
 */
export async function calculateLiveCashSummary(db) {
  // 1. Total Cash Added directly to cash table
  const [[cashAddedRow]] = await db.query(
    'SELECT COALESCE(SUM(amount), 0) AS total_added FROM cash'
  )
  const totalCashAdded = Number(cashAddedRow?.total_added || 0)

  // 2. Total Cash Received from Client / Other / Consulting payments (credit)
  const [[clientCashInRow]] = await db.query(`
    SELECT COALESCE(SUM(amount), 0) AS total_in 
    FROM client_payments 
    WHERE (bank_account_id IS NULL OR bank_account_id = 0)
      AND (LOWER(payment_method) = 'cash' OR LOWER(payment_method) LIKE '%cash%')
      AND (type = 'credit' OR type IS NULL)
  `)
  const totalClientCashIn = Number(clientCashInRow?.total_in || 0)

  // Total In
  const totalIn = Number((totalCashAdded + totalClientCashIn).toFixed(2))

  // 3. Total Cash Out from Expenses
  const [[expenseCashOutRow]] = await db.query(`
    SELECT COALESCE(SUM(amount), 0) AS total_out
    FROM expense_payments
    WHERE (bank_account_id IS NULL OR bank_account_id = 0)
      AND (LOWER(payment_method) = 'cash' OR LOWER(payment_method) LIKE '%cash%')
  `)
  const totalExpenseCashOut = Number(expenseCashOutRow?.total_out || 0)

  // 4. Total Cash Out from Worker Payments
  const [[workerCashOutRow]] = await db.query(`
    SELECT COALESCE(SUM(amount), 0) AS total_out
    FROM worker_payments
    WHERE (bank_account_id IS NULL OR bank_account_id = 0)
      AND (LOWER(payment_method) = 'cash' OR LOWER(payment_method) LIKE '%cash%')
  `)
  const totalWorkerCashOut = Number(workerCashOutRow?.total_out || 0)

  // 5. Total Cash Out from Labour initial advances
  const [[labourAdvanceCashOutRow]] = await db.query(`
    SELECT COALESCE(SUM(advance_amount), 0) AS total_out
    FROM labours
    WHERE (bank_account_id IS NULL OR bank_account_id = 0)
      AND advance_amount > 0
      AND (LOWER(remarks) LIKE '%cash%' OR status = 'Cash')
  `)
  const totalLabourAdvanceCashOut = Number(labourAdvanceCashOutRow?.total_out || 0)

  // 6. Total Cash Out from Client payments where type = 'debit'
  const [[clientCashDebitRow]] = await db.query(`
    SELECT COALESCE(SUM(amount), 0) AS total_out
    FROM client_payments
    WHERE (bank_account_id IS NULL OR bank_account_id = 0)
      AND (LOWER(payment_method) = 'cash' OR LOWER(payment_method) LIKE '%cash%')
      AND type = 'debit'
  `)
  const totalClientCashDebit = Number(clientCashDebitRow?.total_out || 0)

  const totalOut = Number((totalExpenseCashOut + totalWorkerCashOut + totalLabourAdvanceCashOut + totalClientCashDebit).toFixed(2))
  const balance = Number((totalIn - totalOut).toFixed(2))

  return {
    balance,
    totalIn,
    totalOut,
    totalCashAdded,
    totalClientCashIn,
    totalExpenseCashOut,
    totalWorkerCashOut,
    totalLabourAdvanceCashOut,
    totalClientCashDebit,
  }
}

/**
 * GET /api/cash
 * List all cash records along with live balance and summary
 */
export const getCashRecords = async (req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(`
      SELECT 
        id,
        CAST(date AS CHAR) AS date,
        amount,
        description,
        created_at,
        updated_at
      FROM cash
      ORDER BY date DESC, id DESC
    `)

    const summary = await calculateLiveCashSummary(pool)

    res.json({
      success: true,
      balance: summary.balance,
      totalIn: summary.totalIn,
      totalOut: summary.totalOut,
      summary,
      records: rows.map((r) => ({
        id: r.id,
        _id: String(r.id),
        date: r.date,
        amount: Number(r.amount),
        description: r.description || 'Cash Added',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/cash
 * Add cash record
 */
export const addCash = async (req, res, next) => {
  try {
    const { date, amount, description } = req.body

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid cash amount greater than zero' })
    }

    const cleanDate = date
      ? new Date(date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    const cleanDesc = (description || '').trim() || 'Cash Added'

    const pool = getPool()
    const [result] = await pool.query(
      'INSERT INTO cash (date, amount, description) VALUES (?, ?, ?)',
      [cleanDate, numAmount, cleanDesc]
    )

    const summary = await calculateLiveCashSummary(pool)

    res.status(201).json({
      success: true,
      message: 'Cash added successfully',
      record: {
        id: result.insertId,
        _id: String(result.insertId),
        date: cleanDate,
        amount: numAmount,
        description: cleanDesc,
      },
      balance: summary.balance,
      summary,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/cash/:id
 * Update cash record (date and/or amount)
 */
export const updateCash = async (req, res, next) => {
  try {
    const { id } = req.params
    const { date, amount, description } = req.body

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid cash amount greater than zero' })
    }

    const pool = getPool()
    const [[existing]] = await pool.query('SELECT * FROM cash WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ error: 'Cash record not found' })
    }

    const oldAmount = Number(existing.amount)
    const diff = numAmount - oldAmount

    // Check if lowering this cash entry would drive available balance below zero
    const currentSummary = await calculateLiveCashSummary(pool)
    if (currentSummary.balance + diff < 0) {
      return res.status(400).json({
        error: `Cannot reduce cash amount to ₹${numAmount.toLocaleString('en-IN')}. Current available balance is ₹${currentSummary.balance.toLocaleString('en-IN')}.`,
      })
    }

    const cleanDate = date
      ? new Date(date).toISOString().slice(0, 10)
      : existing.date
    const cleanDesc = description !== undefined ? description.trim() : existing.description

    await pool.query(
      'UPDATE cash SET date = ?, amount = ?, description = ? WHERE id = ?',
      [cleanDate, numAmount, cleanDesc, id]
    )

    const updatedSummary = await calculateLiveCashSummary(pool)

    res.json({
      success: true,
      message: 'Cash record updated successfully',
      record: {
        id: Number(id),
        _id: String(id),
        date: cleanDate,
        amount: numAmount,
        description: cleanDesc,
      },
      balance: updatedSummary.balance,
      summary: updatedSummary,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/cash/:id
 * Delete a cash record with safety validation
 */
export const deleteCash = async (req, res, next) => {
  try {
    const { id } = req.params
    const pool = getPool()

    const [[existing]] = await pool.query('SELECT * FROM cash WHERE id = ?', [id])
    if (!existing) {
      return res.status(404).json({ error: 'Cash record not found' })
    }

    const oldAmount = Number(existing.amount)
    const currentSummary = await calculateLiveCashSummary(pool)

    if (currentSummary.balance - oldAmount < 0) {
      return res.status(400).json({
        error: `Cannot delete cash entry of ₹${oldAmount.toLocaleString('en-IN')}. Remaining available cash balance would become negative (₹${(currentSummary.balance - oldAmount).toLocaleString('en-IN')}).`,
      })
    }

    await pool.query('DELETE FROM cash WHERE id = ?', [id])

    const updatedSummary = await calculateLiveCashSummary(pool)

    res.json({
      success: true,
      message: 'Cash record deleted successfully',
      balance: updatedSummary.balance,
      summary: updatedSummary,
    })
  } catch (error) {
    next(error)
  }
}

