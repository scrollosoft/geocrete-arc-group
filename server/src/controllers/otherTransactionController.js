import { getPool } from '../config/db.js'
import { calculateLiveCashSummary } from './cashController.js'

/**
 * Format a database row into a standardized Other transaction object
 */
const formatOtherTransactionRow = (row) => {
  const isDebit = row.type === 'debit'
  const dateVal = row.payment_date_str || (row.payment_date ? String(row.payment_date).slice(0, 10) : (row.created_at ? String(row.created_at).slice(0, 10) : ''))

  // Extract ledger name from title: "Other - Send - LedgerName" or "Other - Receive - LedgerName"
  const rawTitle = row.title || ''
  const baseTitle = isDebit ? 'Other - Send' : 'Other - Receive'
  let ledgerName = ''
  if (rawTitle.startsWith(baseTitle + ' - ')) {
    ledgerName = rawTitle.slice((baseTitle + ' - ').length).trim()
  }

  const isCash = !row.bank_account_id || String(row.payment_method || '').toLowerCase() === 'cash'

  return {
    id: row.id,
    _id: String(row.id),
    date: dateVal,
    amount: Number(row.amount || 0),
    bankAccountId: row.bank_account_id ? String(row.bank_account_id) : (isCash ? 'cash' : null),
    bankName: row.bank_name || (isCash ? 'Cash' : '-'),
    accountNumber: row.account_number || (isCash ? 'CASH' : ''),
    paymentMethod: row.payment_method || (isCash ? 'Cash' : 'UPI'),
    paymentType: isDebit ? 'Send' : 'Receive',
    type: row.type || (isDebit ? 'debit' : 'credit'),
    note: row.reference || '',
    title: rawTitle || baseTitle,
    ledgerName,
    createdAt: row.created_at,
    isCash,
  }
}

/**
 * Helper to persist a unique ledger name in settings
 */
const persistLedgerName = async (connOrPool, ledgerName) => {
  const clean = (ledgerName || '').trim()
  if (!clean) return
  try {
    const [rows] = await connOrPool.query(
      "SELECT value_json FROM settings WHERE key_name = 'other_ledgers'"
    )
    let list = []
    if (rows.length > 0) {
      const val = rows[0].value_json
      list = Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : [])
    }
    if (!list.some((item) => String(item).toLowerCase() === clean.toLowerCase())) {
      list.push(clean)
      await connOrPool.query(
        `INSERT INTO settings (key_name, value_json)
         VALUES ('other_ledgers', ?)
         ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
        [JSON.stringify(list)]
      )
    }
  } catch {
    // ignore
  }
}

/**
 * GET /api/other-transactions/ledgers
 * Return all distinct ledger names from transactions and settings
 */
export const getOtherLedgers = async (_req, res, next) => {
  try {
    const pool = getPool()
    let saved = []
    try {
      const [settingsRows] = await pool.query(
        "SELECT value_json FROM settings WHERE key_name = 'other_ledgers'"
      )
      if (settingsRows.length > 0) {
        const val = settingsRows[0].value_json
        saved = Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : [])
      }
    } catch {
      // ignore
    }

    const [rows] = await pool.query(`
      SELECT DISTINCT title FROM client_payments WHERE title LIKE 'Other%' OR title LIKE 'Other -%'
    `)
    const fromTxns = rows.map((r) => {
      const title = r.title || ''
      if (title.startsWith('Other - Send - ')) return title.slice('Other - Send - '.length).trim()
      if (title.startsWith('Other - Receive - ')) return title.slice('Other - Receive - '.length).trim()
      return ''
    }).filter(Boolean)

    const set = new Set()
    for (const item of [...saved, ...fromTxns]) {
      const trimmed = String(item || '').trim()
      if (trimmed) set.add(trimmed)
    }

    const list = Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    res.json(list)
  } catch (error) {
    next(error)
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
      ledgerName,
      note,
    } = req.body

    const cleanDate = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount greater than zero' })
    }

    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash' || String(paymentMethod || '').toLowerCase() === 'cash'

    if (!bankAccountId && !isCashAccount) {
      return res.status(400).json({ error: 'Please select an Account' })
    }

    let bank = null
    let bankBalance = 0

    if (!isCashAccount) {
      const [bankRows] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
        [bankAccountId]
      )
      if (bankRows.length === 0) {
        return res.status(400).json({ error: 'Selected bank account was not found or is inactive' })
      }
      bank = bankRows[0]
      bankBalance = Number(bank.balance || 0)
    }

    const isSend = (paymentType || '').toLowerCase() === 'send'
    const isReceive = (paymentType || '').toLowerCase() === 'receive'

    if (!isSend && !isReceive) {
      return res.status(400).json({ error: 'Payment Type must be either Send or Receive' })
    }

    // Check available balance for Send
    if (isSend) {
      if (isCashAccount) {
        const cashSummary = await calculateLiveCashSummary(conn)
        if (cashSummary.balance < numAmount) {
          return res.status(400).json({
            error: `Insufficient cash balance. Available: ₹${cashSummary.balance.toLocaleString('en-IN')}, Requested: ₹${numAmount.toLocaleString('en-IN')}`,
          })
        }
      } else if (bankBalance < numAmount) {
        return res.status(400).json({
          error: `Insufficient bank balance in ${bank.bank_name}. Available: ₹${Math.round(bankBalance).toLocaleString('en-IN')}, Requested: ₹${Math.round(numAmount).toLocaleString('en-IN')}`,
        })
      }
    }

    const validPaymentMethod = isCashAccount
      ? 'Cash'
      : (['UPI', 'Cheque', 'Cash'].includes(paymentMethod) ? paymentMethod : (paymentMethod || 'UPI'))
    const cleanNote = (note || '').trim()
    const cleanLedger = (ledgerName || '').trim()

    const txnType = isSend ? 'debit' : 'credit'
    const baseTxnTitle = isSend ? 'Other - Send' : 'Other - Receive'
    const txnTitle = cleanLedger ? `${baseTxnTitle} - ${cleanLedger}` : baseTxnTitle

    await conn.beginTransaction()

    if (cleanLedger) {
      await persistLedgerName(conn, cleanLedger)
    }

    // 1. Insert transaction into client_payments
    const [result] = await conn.query(`
      INSERT INTO client_payments
        (client_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
      VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, 'Paid', ?)
    `, [
      isCashAccount ? null : Number(bankAccountId),
      numAmount,
      cleanDate,
      txnTitle,
      validPaymentMethod,
      cleanNote,
      txnType,
    ])

    const newId = result.insertId

    // 2. Adjust bank balance if bank used
    if (!isCashAccount) {
      if (isSend) {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [numAmount, bankAccountId])
      } else {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [numAmount, bankAccountId])
      }
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
      ledgerName,
      note,
    } = req.body

    const cleanDate = date ? new Date(date).toISOString().slice(0, 10) : String(existing.payment_date).slice(0, 10)
    const numAmount = amount !== undefined ? Number(amount) : Number(existing.amount || 0)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid amount greater than zero' })
    }

    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash' || String(paymentMethod || '').toLowerCase() === 'cash' || (!bankAccountId && !existing.bank_account_id)
    const targetBankId = isCashAccount ? null : (bankAccountId ? Number(bankAccountId) : existing.bank_account_id)
    if (!isCashAccount && !targetBankId) {
      return res.status(400).json({ error: 'Please select a Bank Account' })
    }

    let targetBank = null
    if (!isCashAccount) {
      const [bankRows] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
        [targetBankId]
      )
      if (bankRows.length === 0) {
        return res.status(400).json({ error: 'Selected bank account was not found' })
      }
      targetBank = bankRows[0]
    }

    const newIsSend = paymentType ? paymentType.toLowerCase() === 'send' : existing.type === 'debit'
    const newIsReceive = paymentType ? paymentType.toLowerCase() === 'receive' : existing.type === 'credit'
    if (!newIsSend && !newIsReceive) {
      return res.status(400).json({ error: 'Payment Type must be either Send or Receive' })
    }

    const oldIsSend = existing.type === 'debit'
    const oldAmount = Number(existing.amount || 0)
    const oldBankId = existing.bank_account_id

    // Check available balance if new is Send
    if (!isCashAccount && targetBank) {
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
    }

    const validPaymentMethod = isCashAccount
      ? 'Cash'
      : (['UPI', 'Cheque', 'Cash'].includes(paymentMethod) ? paymentMethod : (paymentMethod || existing.payment_method || 'UPI'))
    const cleanNote = note !== undefined ? (note || '').trim() : (existing.reference || '')

    const cleanLedger = ledgerName !== undefined
      ? (ledgerName || '').trim()
      : (() => {
          const rawTitle = existing.title || ''
          const oldBase = oldIsSend ? 'Other - Send' : 'Other - Receive'
          if (rawTitle.startsWith(oldBase + ' - ')) {
            return rawTitle.slice((oldBase + ' - ').length).trim()
          }
          return ''
        })()

    const newType = newIsSend ? 'debit' : 'credit'
    const baseTxnTitle = newIsSend ? 'Other - Send' : 'Other - Receive'
    const newTitle = cleanLedger ? `${baseTxnTitle} - ${cleanLedger}` : baseTxnTitle

    await conn.beginTransaction()

    if (cleanLedger) {
      await persistLedgerName(conn, cleanLedger)
    }

    // 1. Reverse old transaction effect on bank_accounts
    if (oldBankId) {
      if (oldIsSend) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [oldAmount, oldBankId])
      } else {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [oldAmount, oldBankId])
      }
    }

    // 2. Apply new transaction effect on bank_accounts
    if (!isCashAccount && targetBankId) {
      if (newIsSend) {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [numAmount, targetBankId])
      } else {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [numAmount, targetBankId])
      }
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
      isCashAccount ? null : targetBankId,
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

