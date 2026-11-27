import { getPool } from '../config/db.js'

/**
 * Retrieves the persistent cash account configuration (active status & manual balance) from settings
 */
export async function getCashAccountConfig(db) {
  try {
    const [rows] = await db.query("SELECT value_json FROM settings WHERE key_name = 'cash_account'")
    if (rows.length > 0) {
      const parsed = typeof rows[0].value_json === 'string' ? JSON.parse(rows[0].value_json) : rows[0].value_json
      if (parsed) {
        return {
          is_active: parsed.is_active !== undefined ? Boolean(parsed.is_active) : true,
          balance: parsed.balance !== undefined && parsed.balance !== null ? Number(parsed.balance) : null,
        }
      }
    }
  } catch (err) {
    // ignore
  }
  return { is_active: true, balance: null }
}

/**
 * Calculates live cash financial summary across the system:
 * In: cash table + client payments received in cash
 * Out: expense payments in cash + worker payments in cash + worker advances in cash + client payment debits in cash
 */
export async function calculateLiveCashSummary(db) {
  const cashConfig = await getCashAccountConfig(db)

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
  const calculatedBalance = Number((totalIn - totalOut).toFixed(2))
  const balance = cashConfig.balance !== null ? cashConfig.balance : calculatedBalance

  return {
    balance,
    isActive: cashConfig.is_active !== false,
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

    const pool = getPool()

    // Count existing active cash accounts to assign tag and code
    const [cashRows] = await pool.query(
      "SELECT id FROM bank_accounts WHERE is_active = 1 AND (account_number = 'CASH' OR LOWER(bank_name) LIKE '%cash%')"
    )
    const count = cashRows.length
    const tag = count === 0 ? 'CASH ACCOUNT' : `CASH ACCOUNT #${String(count + 1).padStart(2, '0')}`
    const code = count === 0 ? 'CASH' : `C${count + 1}`
    const cleanDesc = (!description || description === 'Cash Added')
      ? (count === 0 ? 'Cash in Hand' : `Cash in Hand #${count + 1}`)
      : description.trim()

    // Create a NEW cash account - DO NOT add cash in existing cash account!
    const [result] = await pool.query(
      `INSERT INTO bank_accounts
        (account_number, account_number_tag, bank_name, account_holder_name, ifsc_code, account_code, balance, credit, accent_color, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      ['CASH', tag, cleanDesc, 'Cash Account', '', code, numAmount, 0, '#10B981']
    )

    res.status(201).json({
      success: true,
      message: 'New cash account created successfully',
      record: {
        id: result.insertId,
        _id: String(result.insertId),
        bankName: cleanDesc,
        balance: numAmount,
        isCash: true,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/cash/account
 * Directly update the cash account balance without creating a transaction or "Cash Added" entry
 */
export const updateCashAccount = async (req, res, next) => {
  try {
    const { id, balance, amount } = req.body
    const targetBalance = balance !== undefined ? balance : amount
    const numBalance = Number(targetBalance)
    if (targetBalance === undefined || targetBalance === null || isNaN(numBalance) || numBalance < 0) {
      return res.status(400).json({ error: 'Please enter a valid cash amount (0 or positive)' })
    }

    const pool = getPool()
    const targetId = id || req.query?.id || req.params?.id

    if (targetId && targetId !== 'cash' && targetId !== 'account') {
      await pool.query('UPDATE bank_accounts SET balance = ? WHERE id = ?', [numBalance, targetId])
    } else {
      const [rows] = await pool.query(
        "SELECT id FROM bank_accounts WHERE is_active = 1 AND (account_number = 'CASH' OR LOWER(bank_name) LIKE '%cash%') ORDER BY id ASC LIMIT 1"
      )
      if (rows.length > 0) {
        await pool.query('UPDATE bank_accounts SET balance = ? WHERE id = ?', [numBalance, rows[0].id])
      } else {
        await pool.query(
          `INSERT INTO bank_accounts
            (account_number, account_number_tag, bank_name, account_holder_name, ifsc_code, account_code, balance, credit, accent_color, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          ['CASH', 'CASH ACCOUNT', 'Cash in Hand', 'Cash Account', '', 'CASH', numBalance, 0, '#10B981']
        )
      }
    }

    res.json({
      success: true,
      message: 'Cash account balance updated successfully',
      balance: numBalance,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/cash/account
 * Completely delete the cash account
 */
export const deleteCashAccount = async (req, res, next) => {
  try {
    const pool = getPool()
    const targetId = req.query?.id || req.body?.id || req.params?.id

    if (targetId && targetId !== 'cash' && targetId !== 'account') {
      await pool.query('UPDATE bank_accounts SET is_active = 0 WHERE id = ?', [targetId])
    } else {
      await pool.query(
        "UPDATE bank_accounts SET is_active = 0 WHERE account_number = 'CASH' OR LOWER(bank_name) LIKE '%cash%'"
      )
      await pool.query(
        `INSERT INTO settings (key_name, value_json)
         VALUES ('cash_account', ?)
         ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
        [JSON.stringify({ is_active: false, balance: 0, deleted_at: new Date().toISOString() })]
      )
    }

    res.json({
      success: true,
      message: 'Cash account deleted successfully',
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
    if (id === 'account' || id === 'cash') {
      return updateCashAccount(req, res, next)
    }
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
    if (id === 'account' || id === 'cash') {
      return deleteCashAccount(req, res, next)
    }
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

