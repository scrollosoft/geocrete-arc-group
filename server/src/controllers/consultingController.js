import { getPool } from '../config/db.js'

/**
 * Format a database row from the consultings table
 */
export const formatConsultingRow = (row) => {
  const totalAmount = Number(row.total_amount || 0)
  const receivedAmount = Number(row.received_amount || 0)
  const pendingAmount = Math.max(0, Number((totalAmount - receivedAmount).toFixed(2)))
  const dateVal = row.date_str || (row.date ? String(row.date).slice(0, 10) : '')

  const isCash = !row.bank_account_id || String(row.bank_account_id) === 'cash' || String(row.payment_mode || '').toLowerCase() === 'cash'
  const bankAccountId = isCash ? 'cash' : (row.bank_account_id ? String(row.bank_account_id) : null)
  const bankName = isCash ? 'Cash' : (row.bank_name || '-')

  return {
    id: row.id,
    _id: String(row.id),
    date: dateVal,
    ownerName: row.owner_name || '',
    mobileNumber: row.mobile_number || '',
    totalAmount,
    receivedAmount,
    pendingAmount,
    paymentMode: row.payment_mode || 'UPI',
    bankAccountId,
    bankName,
    remark: row.remark || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Clean and validate a 10-digit Indian mobile number
 */
export const validateIndianMobile = (phone) => {
  if (!phone) return null
  const cleaned = String(phone).replace(/\D/g, '')
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned
  }
  if (cleaned.length === 11 && cleaned.startsWith('0') && /^[6-9]\d{9}$/.test(cleaned.slice(1))) {
    return cleaned.slice(1)
  }
  if (cleaned.length === 12 && cleaned.startsWith('91') && /^[6-9]\d{9}$/.test(cleaned.slice(2))) {
    return cleaned.slice(2)
  }
  return null
}

/**
 * GET /api/consulting
 * Fetch all consulting records from the separate consultings table
 */
export const getConsultingList = async (req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(`
      SELECT 
        c.*,
        CAST(c.date AS CHAR) AS date_str,
        CAST(c.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM consultings c
      LEFT JOIN bank_accounts ba ON ba.id = c.bank_account_id
      ORDER BY c.date DESC, c.id DESC
    `)

    const list = rows.map(formatConsultingRow)
    res.json(list)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/consulting/:id
 * Fetch single consulting record with payment history
 */
export const getConsultingById = async (req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(`
      SELECT 
        c.*,
        CAST(c.date AS CHAR) AS date_str,
        CAST(c.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM consultings c
      LEFT JOIN bank_accounts ba ON ba.id = c.bank_account_id
      WHERE c.id = ?
      LIMIT 1
    `, [req.params.id])

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Consulting record not found' })
    }

    const record = formatConsultingRow(rows[0])

    const [payments] = await pool.query(`
      SELECT 
        cp.*,
        CAST(cp.payment_date AS CHAR) AS payment_date_str,
        CAST(cp.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM consulting_payments cp
      LEFT JOIN bank_accounts ba ON ba.id = cp.bank_account_id
      WHERE cp.consulting_id = ?
      ORDER BY cp.payment_date DESC, cp.id DESC
    `, [req.params.id])

    record.payments = payments.map((p) => ({
      id: p.id,
      consultingId: p.consulting_id,
      amount: Number(p.amount || 0),
      paymentDate: p.payment_date_str || (p.payment_date ? String(p.payment_date).slice(0, 10) : ''),
      paymentMode: p.payment_mode,
      bankAccountId: p.bank_account_id ? String(p.bank_account_id) : (p.payment_mode === 'Cash' ? 'cash' : null),
      bankName: p.payment_mode === 'Cash' || !p.bank_account_id ? 'Cash' : (p.bank_name || '-'),
      reference: p.reference || '',
      remark: p.remark || '',
      createdAt: p.created_at,
    }))

    res.json(record)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/consulting
 * Create a new consulting record + credit bank/cash account atomically
 */
export const createConsulting = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const {
      date,
      ownerName,
      mobileNumber,
      totalAmount,
      receivedAmount,
      bankAccountId,
      paymentMode,
      remark,
    } = req.body

    // 1. Validations
    const cleanDate = date
      ? new Date(date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    const cleanOwnerName = (ownerName || '').trim()
    if (!cleanOwnerName) {
      return res.status(400).json({ error: 'Owner Name is required' })
    }

    const validMobile = validateIndianMobile(mobileNumber)
    if (!validMobile) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number' })
    }

    const numTotal = Number(totalAmount)
    if (isNaN(numTotal) || numTotal <= 0) {
      return res.status(400).json({ error: 'Total Amount must be greater than zero' })
    }

    const numReceived = receivedAmount !== '' && receivedAmount !== undefined ? Number(receivedAmount) : 0
    if (isNaN(numReceived) || numReceived < 0) {
      return res.status(400).json({ error: 'Received Amount must be a valid non-negative number' })
    }
    if (numReceived > numTotal) {
      return res.status(400).json({ error: 'Received Amount cannot exceed Total Amount' })
    }

    const validPaymentMode = paymentMode || 'UPI'
    const isCashAccount = validPaymentMode === 'Cash' || String(bankAccountId || '').toLowerCase() === 'cash'

    let validBankId = null
    if (!isCashAccount && bankAccountId) {
      const [bankRows] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
        [bankAccountId]
      )
      if (bankRows.length === 0) {
        return res.status(400).json({ error: 'Selected bank account not found or inactive' })
      }
      validBankId = Number(bankAccountId)
    }

    if (numReceived > 0 && !isCashAccount && !validBankId) {
      return res.status(400).json({ error: 'Please select a Bank Account for the received payment' })
    }

    const cleanRemark = (remark || '').trim()

    // 2. Atomic Database Transaction
    await conn.beginTransaction()

    // Insert into separate consultings table
    const [result] = await conn.query(`
      INSERT INTO consultings
        (date, owner_name, mobile_number, total_amount, received_amount, payment_mode, bank_account_id, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanDate,
      cleanOwnerName,
      validMobile,
      numTotal,
      numReceived,
      validPaymentMode,
      validBankId,
      cleanRemark,
    ])

    const consultingId = result.insertId

    // If initial received amount > 0, credit bank or cash and create transaction entries
    if (numReceived > 0) {
      if (validBankId) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [numReceived, validBankId])
      }

      // Record in consulting_payments table
      await conn.query(`
        INSERT INTO consulting_payments
          (consulting_id, amount, payment_date, payment_mode, bank_account_id, reference, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        consultingId,
        numReceived,
        cleanDate,
        validPaymentMode,
        validBankId,
        `CONSULTING-REF-${consultingId}`,
        cleanRemark || 'Initial Consulting Payment',
      ])

      // Record in client_payments table for universal Transaction History & Cash/Bank ledger
      await conn.query(`
        INSERT INTO client_payments
          (consulting_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'Paid', 'credit')
      `, [
        consultingId,
        validBankId,
        numReceived,
        cleanDate,
        `Consulting - ${cleanOwnerName}`,
        validPaymentMode,
        `CONSULTING-REF-${consultingId}`,
      ])
    }

    await conn.commit()

    // Fetch and return created record
    const [newRows] = await pool.query(`
      SELECT 
        c.*,
        CAST(c.date AS CHAR) AS date_str,
        CAST(c.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM consultings c
      LEFT JOIN bank_accounts ba ON ba.id = c.bank_account_id
      WHERE c.id = ?
      LIMIT 1
    `, [consultingId])

    res.status(201).json(formatConsultingRow(newRows[0]))
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

/**
 * PUT /api/consulting/:id
 * Update an existing consulting record
 */
export const updateConsulting = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id

    const [existingRows] = await conn.query('SELECT * FROM consultings WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Consulting record not found' })
    }
    const existing = existingRows[0]

    const {
      date,
      ownerName,
      mobileNumber,
      totalAmount,
      receivedAmount,
      paymentMode,
      bankAccountId,
      remark,
    } = req.body

    const cleanDate = date ? new Date(date).toISOString().slice(0, 10) : existing.date
    const cleanOwnerName = ownerName !== undefined ? (ownerName || '').trim() : existing.owner_name
    if (!cleanOwnerName) {
      return res.status(400).json({ error: 'Owner Name is required' })
    }

    let cleanMobile = existing.mobile_number
    if (mobileNumber !== undefined) {
      const validMob = validateIndianMobile(mobileNumber)
      if (!validMob) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number' })
      }
      cleanMobile = validMob
    }

    const numTotal = totalAmount !== undefined ? Number(totalAmount) : Number(existing.total_amount)
    if (isNaN(numTotal) || numTotal <= 0) {
      return res.status(400).json({ error: 'Total Amount must be greater than zero' })
    }

    const numReceived = receivedAmount !== undefined && receivedAmount !== ''
      ? Number(receivedAmount)
      : Number(existing.received_amount || 0)
    if (isNaN(numReceived) || numReceived < 0) {
      return res.status(400).json({ error: 'Received Amount must be a valid non-negative number' })
    }
    if (numReceived > numTotal) {
      return res.status(400).json({
        error: `Received Amount cannot exceed Total Amount (₹${numTotal.toLocaleString('en-IN')})`,
      })
    }

    const validPaymentMode = paymentMode !== undefined ? paymentMode : existing.payment_mode
    const isCashAccount = validPaymentMode === 'Cash' || String(bankAccountId || '').toLowerCase() === 'cash'

    let validBankId = null
    if (!isCashAccount) {
      const targetBank = bankAccountId !== undefined ? bankAccountId : existing.bank_account_id
      if (targetBank) {
        const [bankRows] = await conn.query(
          'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
          [targetBank]
        )
        if (bankRows.length === 0) {
          return res.status(400).json({ error: 'Selected bank account not found or inactive' })
        }
        validBankId = Number(targetBank)
      }
    }

    if (numReceived > 0 && !isCashAccount && !validBankId) {
      return res.status(400).json({ error: 'Please select a Bank Account for the received payment' })
    }

    const cleanRemark = remark !== undefined ? (remark || '').trim() : existing.remark

    await conn.beginTransaction()

    // 1. Revert previous bank credits linked to this consulting record
    const [linkedPayments] = await conn.query(
      'SELECT * FROM consulting_payments WHERE consulting_id = ?',
      [id]
    )
    for (const p of linkedPayments) {
      if (p.bank_account_id && Number(p.amount) > 0) {
        await conn.query(
          'UPDATE bank_accounts SET balance = balance - ? WHERE id = ?',
          [p.amount, p.bank_account_id]
        )
      }
    }

    // 2. Remove old linked payment records from consulting_payments and client_payments
    await conn.query('DELETE FROM client_payments WHERE consulting_id = ?', [id])
    await conn.query('DELETE FROM consulting_payments WHERE consulting_id = ?', [id])

    // 3. Update consultings record
    await conn.query(`
      UPDATE consultings
      SET date = ?, owner_name = ?, mobile_number = ?, total_amount = ?, received_amount = ?, payment_mode = ?, bank_account_id = ?, remark = ?
      WHERE id = ?
    `, [
      cleanDate,
      cleanOwnerName,
      cleanMobile,
      numTotal,
      numReceived,
      validPaymentMode,
      validBankId,
      cleanRemark,
      id,
    ])

    // 4. If numReceived > 0, credit the selected bank (or cash) and insert fresh payment records
    if (numReceived > 0) {
      if (validBankId) {
        await conn.query(
          'UPDATE bank_accounts SET balance = balance + ? WHERE id = ?',
          [numReceived, validBankId]
        )
      }

      await conn.query(`
        INSERT INTO consulting_payments
          (consulting_id, amount, payment_date, payment_mode, bank_account_id, reference, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        numReceived,
        cleanDate,
        validPaymentMode,
        validBankId,
        `CONSULTING-REF-${id}`,
        cleanRemark || 'Consulting Payment Received',
      ])

      await conn.query(`
        INSERT INTO client_payments
          (consulting_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'Paid', 'credit')
      `, [
        id,
        validBankId,
        numReceived,
        cleanDate,
        `Consulting - ${cleanOwnerName}`,
        validPaymentMode,
        `CONSULTING-REF-${id}`,
      ])
    }

    await conn.commit()

    const [updatedRows] = await pool.query(`
      SELECT 
        c.*,
        CAST(c.date AS CHAR) AS date_str,
        CAST(c.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM consultings c
      LEFT JOIN bank_accounts ba ON ba.id = c.bank_account_id
      WHERE c.id = ?
      LIMIT 1
    `, [id])

    res.json(formatConsultingRow(updatedRows[0]))
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

/**
 * DELETE /api/consulting/:id
 * Delete consulting record and reverse related account credits
 */
export const deleteConsulting = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id

    const [existingRows] = await conn.query('SELECT * FROM consultings WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Consulting record not found' })
    }

    await conn.beginTransaction()

    // 1. Fetch all linked payments to reverse bank balance
    const [linkedPayments] = await conn.query('SELECT * FROM consulting_payments WHERE consulting_id = ?', [id])
    for (const p of linkedPayments) {
      if (p.bank_account_id && Number(p.amount) > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [p.amount, p.bank_account_id])
      }
    }

    // 2. Delete linked client_payments and consulting_payments
    await conn.query('DELETE FROM client_payments WHERE consulting_id = ?', [id])
    await conn.query('DELETE FROM consulting_payments WHERE consulting_id = ?', [id])

    // 3. Delete consulting record
    await conn.query('DELETE FROM consultings WHERE id = ?', [id])

    await conn.commit()
    res.json({ success: true, message: 'Consulting record deleted successfully' })
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

/**
 * POST /api/consulting/:id/payments
 * Record a partial/remaining payment for a consulting record
 */
export const recordConsultingPayment = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id

    const [existingRows] = await conn.query('SELECT * FROM consultings WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Consulting record not found' })
    }
    const consulting = existingRows[0]

    const {
      amount,
      paymentDate,
      paymentMode,
      bankAccountId,
      remarks,
    } = req.body

    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' })
    }

    const totalAmount = Number(consulting.total_amount || 0)
    const currentReceived = Number(consulting.received_amount || 0)
    const pendingAmount = Math.max(0, Number((totalAmount - currentReceived).toFixed(2)))

    if (numAmount > pendingAmount) {
      return res.status(400).json({
        error: `Payment amount cannot exceed pending amount of ₹${pendingAmount.toLocaleString('en-IN')}`,
      })
    }

    const validPaymentMode = paymentMode || 'UPI'
    const isCashAccount = validPaymentMode === 'Cash' || String(bankAccountId || '').toLowerCase() === 'cash'

    let validBankId = null
    if (!isCashAccount) {
      if (!bankAccountId) {
        return res.status(400).json({ error: 'Please select a Bank Account for this payment' })
      }
      const [bankRows] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
        [bankAccountId]
      )
      if (bankRows.length === 0) {
        return res.status(400).json({ error: 'Selected bank account was not found or is inactive' })
      }
      validBankId = Number(bankAccountId)
    }

    const cleanDate = paymentDate
      ? new Date(paymentDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    const cleanRemarks = (remarks || '').trim()

    // Atomic transaction
    await conn.beginTransaction()

    // 1. Update consulting received_amount
    const newTotalReceived = Number((currentReceived + numAmount).toFixed(2))
    await conn.query('UPDATE consultings SET received_amount = ? WHERE id = ?', [newTotalReceived, id])

    // 2. Credit bank if bank payment
    if (validBankId) {
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [numAmount, validBankId])
    }

    // 3. Insert consulting_payments
    const [cpRes] = await conn.query(`
      INSERT INTO consulting_payments
        (consulting_id, amount, payment_date, payment_mode, bank_account_id, reference, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      numAmount,
      cleanDate,
      validPaymentMode,
      validBankId,
      `CONSULTING-REF-${id}`,
      cleanRemarks || 'Consulting Payment Received',
    ])

    // 4. Insert into client_payments for universal Transaction History & Cash/Bank ledger
    await conn.query(`
      INSERT INTO client_payments
        (consulting_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'Paid', 'credit')
    `, [
      id,
      validBankId,
      numAmount,
      cleanDate,
      `Consulting - ${consulting.owner_name}`,
      validPaymentMode,
      `CONSULTING-REF-${id}`,
    ])

    await conn.commit()

    const [updatedRows] = await pool.query(`
      SELECT 
        c.*,
        CAST(c.date AS CHAR) AS date_str,
        CAST(c.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM consultings c
      LEFT JOIN bank_accounts ba ON ba.id = c.bank_account_id
      WHERE c.id = ?
      LIMIT 1
    `, [id])

    const updatedRecord = formatConsultingRow(updatedRows[0])

    res.json({
      success: true,
      message: `Payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully!`,
      consulting: updatedRecord,
      payment: {
        id: cpRes.insertId,
        consultingId: Number(id),
        amount: numAmount,
        paymentDate: cleanDate,
        paymentMode: validPaymentMode,
        bankAccountId: validBankId,
        previousReceived: currentReceived,
        newTotalReceived,
        remainingPending: Math.max(0, Number((totalAmount - newTotalReceived).toFixed(2))),
      },
    })
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

/**
 * GET /api/consulting/:id/payments
 * Fetch payment transactions for a consulting record
 */
export const getConsultingPayments = async (req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(`
      SELECT 
        cp.*,
        CAST(cp.payment_date AS CHAR) AS payment_date_str,
        CAST(cp.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM consulting_payments cp
      LEFT JOIN bank_accounts ba ON ba.id = cp.bank_account_id
      WHERE cp.consulting_id = ?
      ORDER BY cp.payment_date DESC, cp.id DESC
    `, [req.params.id])

    const payments = rows.map((p) => ({
      id: p.id,
      consultingId: p.consulting_id,
      amount: Number(p.amount || 0),
      paymentDate: p.payment_date_str || (p.payment_date ? String(p.payment_date).slice(0, 10) : ''),
      paymentMode: p.payment_mode,
      bankAccountId: p.bank_account_id ? String(p.bank_account_id) : (p.payment_mode === 'Cash' ? 'cash' : null),
      bankName: p.payment_mode === 'Cash' || !p.bank_account_id ? 'Cash' : (p.bank_name || '-'),
      reference: p.reference || '',
      remark: p.remark || '',
      createdAt: p.created_at,
    }))

    res.json(payments)
  } catch (error) {
    next(error)
  }
}
