import { getPool } from '../config/db.js'

/**
 * Format a database row into a standardized Other transaction object
 */
const formatOtherTransactionRow = (row) => {
  const isDebit = row.type === 'debit'
  const dateVal = row.payment_date_str || (row.payment_date ? String(row.payment_date).slice(0, 10) : (row.created_at ? String(row.created_at).slice(0, 10) : ''))

  return {
    id: row.id,
    _id: String(row.id),
    date: dateVal,
    amount: Number(row.amount || 0),
    bankAccountId: row.bank_account_id ? String(row.bank_account_id) : null,
    bankName: row.bank_name || '-',
    accountNumber: row.account_number || '',
    paymentMethod: row.payment_method || 'UPI',
    paymentType: isDebit ? 'Send' : 'Receive',
    type: row.type || (isDebit ? 'debit' : 'credit'),
    note: row.reference || '',
    title: row.title || (isDebit ? 'Other - Send' : 'Other - Receive'),
    createdAt: row.created_at,
  }
}

/**
 * GET /api/other-transactions
 * List all Other transactions
 */
export const getOtherTransactions = async (req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(`
      SELECT 
        cp.*,
        CAST(cp.payment_date AS CHAR) AS payment_date_str,
        CAST(cp.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM client_payments cp
      LEFT JOIN bank_accounts ba ON ba.id = cp.bank_account_id
      WHERE cp.title LIKE 'Other%' OR cp.title LIKE 'Other -%'
      ORDER BY cp.payment_date DESC, cp.id DESC
    `)

    res.json(rows.map(formatOtherTransactionRow))
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/other-transactions
 * Create a new Other transaction (Send or Receive)
 */
export const createOtherTransaction = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const {
      date,
      amount,
      bankAccountId,
      paymentMethod,
      paymentType,
      note,
    } = req.body

    const cleanDate = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount greater than zero' })
    }

    if (!bankAccountId) {
      return res.status(400).json({ error: 'Please select a Bank Account' })
    }

    const [bankRows] = await conn.query(
      'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
      [bankAccountId]
    )
    if (bankRows.length === 0) {
      return res.status(400).json({ error: 'Selected bank account was not found or is inactive' })
    }
    const bank = bankRows[0]
    const bankBalance = Number(bank.balance || 0)

    const isSend = (paymentType || '').toLowerCase() === 'send'
    const isReceive = (paymentType || '').toLowerCase() === 'receive'

    if (!isSend && !isReceive) {
      return res.status(400).json({ error: 'Payment Type must be either Send or Receive' })
    }

    // Check available balance for Send
    if (isSend && bankBalance < numAmount) {
      return res.status(400).json({
        error: `Insufficient bank balance in ${bank.bank_name}. Available: ₹${Math.round(bankBalance).toLocaleString('en-IN')}, Requested: ₹${Math.round(numAmount).toLocaleString('en-IN')}`,
      })
    }

    const validPaymentMethod = ['UPI', 'Cheque', 'Cash'].includes(paymentMethod)
      ? paymentMethod
      : (paymentMethod || 'UPI')
    const cleanNote = (note || '').trim()

    const txnType = isSend ? 'debit' : 'credit'
    const txnTitle = isSend ? 'Other - Send' : 'Other - Receive'

    await conn.beginTransaction()

    // 1. Insert transaction into client_payments
    const [result] = await conn.query(`
      INSERT INTO client_payments
        (client_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
      VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, 'Paid', ?)
    `, [
      bankAccountId,
      numAmount,
      cleanDate,
      txnTitle,
      validPaymentMethod,
      cleanNote,
      txnType,
    ])

    const newId = result.insertId

    // 2. Adjust bank balance
    if (isSend) {
      await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [numAmount, bankAccountId])
    } else {
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [numAmount, bankAccountId])
    }

    await conn.commit()

    const [newRows] = await pool.query(`
      SELECT 
        cp.*,
        CAST(cp.payment_date AS CHAR) AS payment_date_str,
        CAST(cp.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM client_payments cp
      LEFT JOIN bank_accounts ba ON ba.id = cp.bank_account_id
      WHERE cp.id = ?
      LIMIT 1
    `, [newId])

    res.status(201).json(formatOtherTransactionRow(newRows[0]))
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

/**
 * PUT /api/other-transactions/:id
 * Update an existing Other transaction with correct balance reversal and adjustment
 */
export const updateOtherTransaction = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id

    const [existingRows] = await conn.query(
      'SELECT * FROM client_payments WHERE id = ? AND (title LIKE "Other%" OR title LIKE "Other -%") LIMIT 1',
      [id]
    )
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Transaction record not found' })
    }
    const existing = existingRows[0]

    const {
      date,
      amount,
      bankAccountId,
      paymentMethod,
      paymentType,
      note,
    } = req.body

    const cleanDate = date ? new Date(date).toISOString().slice(0, 10) : String(existing.payment_date).slice(0, 10)
    const numAmount = amount !== undefined ? Number(amount) : Number(existing.amount || 0)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount greater than zero' })
    }

    const targetBankId = bankAccountId || existing.bank_account_id
    if (!targetBankId) {
      return res.status(400).json({ error: 'Please select a Bank Account' })
    }

    const [bankRows] = await conn.query(
      'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
      [targetBankId]
    )
    if (bankRows.length === 0) {
      return res.status(400).json({ error: 'Selected bank account was not found' })
    }
    const targetBank = bankRows[0]

    const newIsSend = paymentType ? paymentType.toLowerCase() === 'send' : existing.type === 'debit'
    const newIsReceive = paymentType ? paymentType.toLowerCase() === 'receive' : existing.type === 'credit'
    if (!newIsSend && !newIsReceive) {
      return res.status(400).json({ error: 'Payment Type must be either Send or Receive' })
    }

    const oldIsSend = existing.type === 'debit'
    const oldAmount = Number(existing.amount || 0)
    const oldBankId = existing.bank_account_id

    // Check available balance if new is Send
    let availableInTarget = Number(targetBank.balance || 0)
    // If the old transaction was on the same bank, compute balance after reversal:
    if (Number(oldBankId) === Number(targetBankId)) {
      availableInTarget = oldIsSend ? (availableInTarget + oldAmount) : (availableInTarget - oldAmount)
    }
    if (newIsSend && availableInTarget < numAmount) {
      return res.status(400).json({
        error: `Insufficient bank balance in ${targetBank.bank_name}. Available after adjustment: ₹${Math.round(availableInTarget).toLocaleString('en-IN')}, Requested: ₹${Math.round(numAmount).toLocaleString('en-IN')}`,
      })
    }

    const validPaymentMethod = ['UPI', 'Cheque', 'Cash'].includes(paymentMethod)
      ? paymentMethod
      : (paymentMethod || existing.payment_method || 'UPI')
    const cleanNote = note !== undefined ? (note || '').trim() : (existing.reference || '')

    const newType = newIsSend ? 'debit' : 'credit'
    const newTitle = newIsSend ? 'Other - Send' : 'Other - Receive'

    await conn.beginTransaction()

    // 1. Reverse old transaction effect
    if (oldIsSend) {
      // old was debit (money was subtracted), so add it back
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [oldAmount, oldBankId])
    } else {
      // old was credit (money was added), so subtract it
      await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [oldAmount, oldBankId])
    }

    // 2. Apply new transaction effect
    if (newIsSend) {
      // new is debit (money is subtracted)
      await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [numAmount, targetBankId])
    } else {
      // new is credit (money is added)
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [numAmount, targetBankId])
    }

    // 3. Update client_payments record
    await conn.query(`
      UPDATE client_payments SET
        amount = ?,
        bank_account_id = ?,
        payment_date = ?,
        title = ?,
        payment_method = ?,
        reference = ?,
        type = ?
      WHERE id = ?
    `, [
      numAmount,
      targetBankId,
      cleanDate,
      newTitle,
      validPaymentMethod,
      cleanNote,
      newType,
      id,
    ])

    await conn.commit()

    const [updatedRows] = await pool.query(`
      SELECT 
        cp.*,
        CAST(cp.payment_date AS CHAR) AS payment_date_str,
        CAST(cp.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM client_payments cp
      LEFT JOIN bank_accounts ba ON ba.id = cp.bank_account_id
      WHERE cp.id = ?
      LIMIT 1
    `, [id])

    res.json(formatOtherTransactionRow(updatedRows[0]))
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

/**
 * DELETE /api/other-transactions/:id
 * Delete an Other transaction and reverse bank balance effect
 */
export const deleteOtherTransaction = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id

    const [existingRows] = await conn.query(
      'SELECT * FROM client_payments WHERE id = ? AND (title LIKE "Other%" OR title LIKE "Other -%") LIMIT 1',
      [id]
    )
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Transaction record not found' })
    }
    const existing = existingRows[0]
    const amount = Number(existing.amount || 0)
    const bankId = existing.bank_account_id
    const isSend = existing.type === 'debit'

    await conn.beginTransaction()

    // Reverse bank balance effect
    if (bankId && amount > 0) {
      if (isSend) {
        // Was debit, restore to bank
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [amount, bankId])
      } else {
        // Was credit, deduct from bank
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [amount, bankId])
      }
    }

    // Delete record from client_payments
    await conn.query('DELETE FROM client_payments WHERE id = ?', [id])

    await conn.commit()
    res.json({ success: true, message: 'Transaction deleted and bank balance adjusted successfully' })
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

