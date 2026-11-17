import { getPool } from '../config/db.js'

/**
 * Format a database row into a standardized Consulting record object
 */
const formatConsultingRow = (row) => {
  let paymentMethod = 'UPI'
  let note = ''
  if (row.description) {
    if (row.description.includes('[CONSULTING]')) {
      const jsonPart = row.description.replace('[CONSULTING]', '').trim()
      try {
        const parsed = JSON.parse(jsonPart)
        paymentMethod = parsed.paymentMethod || 'UPI'
        note = parsed.note || ''
      } catch {
        note = jsonPart
      }
    } else if (row.description.startsWith('{')) {
      try {
        const parsed = JSON.parse(row.description)
        paymentMethod = parsed.paymentMethod || 'UPI'
        note = parsed.note || ''
      } catch {
        note = row.description
      }
    } else {
      note = row.description
    }
  }

  const totalBudget = Number(row.total_budget || 0)
  const advanceAmount = Number(row.advance_amount || 0)
  const totalReceived = Number(row.total_received || 0)
  const pendingAmount = Math.max(0, totalBudget - totalReceived)

  const dateVal = row.start_date_str || (row.start_date ? String(row.start_date).slice(0, 10) : (row.created_at ? String(row.created_at).slice(0, 10) : ''))

  return {
    id: row.id,
    _id: String(row.id),
    siteName: row.name,
    siteOwner: row.site_owner,
    location: row.location,
    city: row.location,
    totalBudget,
    advanceAmount,
    receivedAmount: totalReceived,
    pendingAmount,
    bankAccountId: row.bank_account_id ? String(row.bank_account_id) : null,
    bankName: row.bank_name || '-',
    paymentMethod,
    note,
    date: dateVal,
    startDate: dateVal,
    createdAt: row.created_at,
    status: row.status || 'Active',
  }
}

/**
 * GET /api/consulting
 * Fetch all consulting records
 */
export const getConsultingList = async (req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(`
      SELECT 
        s.*,
        CAST(s.start_date AS CHAR) AS start_date_str,
        CAST(s.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM sites s
      LEFT JOIN bank_accounts ba ON ba.id = s.bank_account_id
      WHERE s.description LIKE '%[CONSULTING]%'
      ORDER BY s.id DESC
    `)

    const list = rows.map(formatConsultingRow)
    res.json(list)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/consulting/:id
 * Fetch single consulting record
 */
export const getConsultingById = async (req, res, next) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(`
      SELECT 
        s.*,
        CAST(s.start_date AS CHAR) AS start_date_str,
        CAST(s.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM sites s
      LEFT JOIN bank_accounts ba ON ba.id = s.bank_account_id
      WHERE s.id = ? AND s.description LIKE '%[CONSULTING]%'
      LIMIT 1
    `, [req.params.id])

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Consulting record not found' })
    }

    res.json(formatConsultingRow(rows[0]))
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/consulting
 * Create a new consulting record + credit bank balance atomically
 */
export const createConsulting = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const {
      siteName,
      siteOwner,
      location,
      city,
      totalBudget,
      advanceAmount,
      receivedAmount,
      bankAccountId,
      paymentMethod,
      note,
    } = req.body

    // 1. Validation
    const cleanSiteName = (siteName || '').trim()
    if (!cleanSiteName) {
      return res.status(400).json({ error: 'Site Name is required' })
    }

    const cleanSiteOwner = (siteOwner || '').trim()
    if (!cleanSiteOwner) {
      return res.status(400).json({ error: 'Site Owner is required' })
    }

    const cleanLocation = (location || city || '').trim()
    if (!cleanLocation) {
      return res.status(400).json({ error: 'City / Location is required' })
    }

    const numBudget = Number(totalBudget)
    if (isNaN(numBudget) || numBudget <= 0) {
      return res.status(400).json({ error: 'Total Budget must be greater than zero' })
    }

    const numAdvance = advanceAmount !== '' && advanceAmount !== undefined ? Number(advanceAmount) : 0
    if (isNaN(numAdvance) || numAdvance < 0) {
      return res.status(400).json({ error: 'Advance Amount must be a non-negative number' })
    }
    if (numAdvance > numBudget) {
      return res.status(400).json({ error: 'Advance Amount cannot exceed Total Budget' })
    }

    const numReceived = receivedAmount !== '' && receivedAmount !== undefined ? Number(receivedAmount) : numAdvance
    if (isNaN(numReceived) || numReceived < 0) {
      return res.status(400).json({ error: 'Received Amount must be a non-negative number' })
    }
    if (numReceived > numBudget) {
      return res.status(400).json({ error: 'Received Amount cannot exceed Total Budget' })
    }

    let validBankId = null
    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash'

    if (bankAccountId && !isCashAccount) {
      const [bankRows] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
        [bankAccountId]
      )
      if (bankRows.length === 0) {
        return res.status(400).json({ error: 'Selected bank account was not found or is inactive' })
      }
      validBankId = Number(bankAccountId)
    }

    if (numReceived > 0 && !validBankId && !isCashAccount) {
      return res.status(400).json({ error: 'Please select an Account for the received amount' })
    }

    const validPaymentMethod = isCashAccount
      ? 'Cash'
      : (['UPI', 'Cheque', 'Cash'].includes(paymentMethod) ? paymentMethod : (paymentMethod || 'UPI'))

    const cleanNote = (note || '').trim()
    const consultingDesc = `[CONSULTING] ${JSON.stringify({
      paymentMethod: validPaymentMethod,
      note: cleanNote,
    })}`

    const today = new Date().toISOString().slice(0, 10)

    // 2. Atomic Database Transaction
    await conn.beginTransaction()

    // Insert site
    const [siteResult] = await conn.query(`
      INSERT INTO sites
        (name, location, site_owner, contact_number, email, address,
         total_budget, advance_amount, total_received, bank_account_id,
         total_spent, status, start_date, description, budget_alert_count)
      VALUES (?, ?, ?, '-', '', '', ?, ?, ?, ?, 0, 'Active', ?, ?, 1)
    `, [
      cleanSiteName,
      cleanLocation,
      cleanSiteOwner,
      numBudget,
      numAdvance,
      numReceived,
      validBankId,
      today,
      consultingDesc,
    ])

    const siteId = siteResult.insertId

    // If money received, credit bank or record cash, and insert client_payments record
    if (numReceived > 0 && (validBankId || isCashAccount)) {
      await conn.query(`
        INSERT INTO client_payments
          (client_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'credit')
      `, [
        siteId,
        validBankId,
        numReceived,
        today,
        `Consulting - ${cleanSiteName}`,
        validPaymentMethod,
        cleanNote || 'Consulting receipt',
      ])

      if (validBankId) {
        await conn.query(`
          UPDATE bank_accounts
          SET balance = balance + ?
          WHERE id = ?
        `, [numReceived, validBankId])
      }
    }

    await conn.commit()

    // Fetch and return the newly created record
    const [newRows] = await pool.query(`
      SELECT 
        s.*,
        CAST(s.start_date AS CHAR) AS start_date_str,
        CAST(s.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM sites s
      LEFT JOIN bank_accounts ba ON ba.id = s.bank_account_id
      WHERE s.id = ?
      LIMIT 1
    `, [siteId])

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
 * Update an existing consulting record + adjust bank balance atomically
 */
export const updateConsulting = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id

    const [existingRows] = await conn.query(
      'SELECT * FROM sites WHERE id = ? AND description LIKE "%[CONSULTING]%" LIMIT 1',
      [id]
    )
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Consulting record not found' })
    }
    const existing = existingRows[0]

    const {
      siteName,
      siteOwner,
      location,
      city,
      totalBudget,
      advanceAmount,
      receivedAmount,
      bankAccountId,
      paymentMethod,
      note,
    } = req.body

    const cleanSiteName = (siteName || existing.name || '').trim()
    if (!cleanSiteName) return res.status(400).json({ error: 'Site Name is required' })

    const cleanSiteOwner = (siteOwner || existing.site_owner || '').trim()
    if (!cleanSiteOwner) return res.status(400).json({ error: 'Site Owner is required' })

    const cleanLocation = (location || city || existing.location || '').trim()
    if (!cleanLocation) return res.status(400).json({ error: 'City / Location is required' })

    const numBudget = totalBudget !== undefined ? Number(totalBudget) : Number(existing.total_budget || 0)
    if (isNaN(numBudget) || numBudget <= 0) return res.status(400).json({ error: 'Total Budget must be greater than zero' })

    const numAdvance = advanceAmount !== undefined && advanceAmount !== '' ? Number(advanceAmount) : Number(existing.advance_amount || 0)
    if (isNaN(numAdvance) || numAdvance < 0) return res.status(400).json({ error: 'Advance Amount must be a non-negative number' })
    if (numAdvance > numBudget) return res.status(400).json({ error: 'Advance Amount cannot exceed Total Budget' })

    const numReceived = receivedAmount !== undefined && receivedAmount !== '' ? Number(receivedAmount) : Number(existing.total_received || 0)
    if (isNaN(numReceived) || numReceived < 0) return res.status(400).json({ error: 'Received Amount must be a non-negative number' })
    if (numReceived > numBudget) return res.status(400).json({ error: 'Received Amount cannot exceed Total Budget' })

    let validBankId = null
    if (bankAccountId) {
      const [bankRows] = await conn.query('SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1', [bankAccountId])
      if (bankRows.length === 0) return res.status(400).json({ error: 'Selected bank account was not found' })
      validBankId = Number(bankAccountId)
    }

    if (numReceived > 0 && !validBankId) {
      return res.status(400).json({ error: 'Please select a Bank Account for the received amount' })
    }

    const validPaymentMethod = ['UPI', 'Cheque', 'Cash'].includes(paymentMethod) ? paymentMethod : (paymentMethod || 'UPI')
    const cleanNote = note !== undefined ? (note || '').trim() : ''

    const consultingDesc = `[CONSULTING] ${JSON.stringify({
      paymentMethod: validPaymentMethod,
      note: cleanNote,
    })}`

    await conn.beginTransaction()

    // Bank balance adjustments
    const oldBankId = existing.bank_account_id ? Number(existing.bank_account_id) : null
    const oldReceived = Number(existing.total_received || 0)

    if (oldBankId === validBankId) {
      // Same bank: adjust by difference only (credit direction, so +diff)
      const diff = numReceived - oldReceived
      if (diff !== 0 && validBankId) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [diff, validBankId])
      }
    } else {
      // Bank changed: reverse old credit from old bank, apply new credit to new bank
      if (oldBankId && oldReceived > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [oldReceived, oldBankId])
      }
      if (validBankId && numReceived > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [numReceived, validBankId])
      }
    }

    // Update sites row
    await conn.query(`
      UPDATE sites SET
        name = ?,
        location = ?,
        site_owner = ?,
        total_budget = ?,
        advance_amount = ?,
        total_received = ?,
        bank_account_id = ?,
        description = ?
      WHERE id = ?
    `, [
      cleanSiteName,
      cleanLocation,
      cleanSiteOwner,
      numBudget,
      numAdvance,
      numReceived,
      validBankId,
      consultingDesc,
      id,
    ])

    // Update client_payments record
    const [existingPayments] = await conn.query(
      'SELECT id FROM client_payments WHERE site_id = ? LIMIT 1',
      [id]
    )

    const today = new Date().toISOString().slice(0, 10)

    if (existingPayments.length > 0) {
      if (numReceived > 0 && validBankId) {
        await conn.query(`
          UPDATE client_payments SET
            amount = ?,
            bank_account_id = ?,
            payment_method = ?,
            reference = ?,
            title = ?
          WHERE id = ?
        `, [
          numReceived,
          validBankId,
          validPaymentMethod,
          cleanNote || 'Consulting receipt',
          `Consulting - ${cleanSiteName}`,
          existingPayments[0].id,
        ])
      } else {
        await conn.query('DELETE FROM client_payments WHERE id = ?', [existingPayments[0].id])
      }
    } else if (numReceived > 0 && validBankId) {
      await conn.query(`
        INSERT INTO client_payments
          (client_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'credit')
      `, [
        id,
        validBankId,
        numReceived,
        today,
        `Consulting - ${cleanSiteName}`,
        validPaymentMethod,
        cleanNote || 'Consulting receipt',
      ])
    }

    await conn.commit()

    const [updatedRows] = await pool.query(`
      SELECT 
        s.*,
        CAST(s.start_date AS CHAR) AS start_date_str,
        CAST(s.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM sites s
      LEFT JOIN bank_accounts ba ON ba.id = s.bank_account_id
      WHERE s.id = ?
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
 * POST /api/consulting/:id/payments
 * Record a payment for a consulting project + credit bank or cash balance atomically
 */
export const recordConsultingPayment = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id
    const { amount, bankAccountId, paymentDate, paymentMethod, remarks } = req.body

    // 1. Validate amount
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' })
    }

    // 2. Validate account
    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash'
    let validBankId = null

    if (!isCashAccount) {
      if (!bankAccountId) {
        return res.status(400).json({ error: 'Please select a Bank Account or Cash' })
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

    // 3. Begin Transaction
    await conn.beginTransaction()

    // 4. Fetch site with FOR UPDATE
    const [siteRows] = await conn.query(
      'SELECT * FROM sites WHERE id = ? AND description LIKE "%[CONSULTING]%" FOR UPDATE',
      [id]
    )
    if (siteRows.length === 0) {
      await conn.rollback()
      return res.status(404).json({ error: 'Consulting record not found' })
    }
    const site = siteRows[0]

    const totalBudget = Number(site.total_budget || 0)
    const totalReceived = Number(site.total_received || 0)
    const pendingAmount = Math.max(0, totalBudget - totalReceived)

    if (numAmount > pendingAmount) {
      await conn.rollback()
      return res.status(400).json({
        error: `Payment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed pending amount of ₹${pendingAmount.toLocaleString('en-IN')}`,
      })
    }

    const validPaymentMethod = isCashAccount
      ? 'Cash'
      : (paymentMethod || 'UPI')

    const pDate = paymentDate && String(paymentDate).trim()
      ? String(paymentDate).trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    const cleanRemarks = (remarks || '').trim() || 'Consulting payment received'

    // 5. Update site total_received
    await conn.query(
      'UPDATE sites SET total_received = total_received + ? WHERE id = ?',
      [numAmount, id]
    )

    // 6. Credit bank account if bank is selected
    if (validBankId) {
      await conn.query(
        'UPDATE bank_accounts SET balance = balance + ? WHERE id = ?',
        [numAmount, validBankId]
      )
    }

    // 7. Insert client_payments transaction record
    await conn.query(`
      INSERT INTO client_payments
        (client_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status, type)
      VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'Paid', 'credit')
    `, [
      id,
      validBankId,
      numAmount,
      pDate,
      `Consulting - ${site.name}`,
      validPaymentMethod,
      cleanRemarks,
    ])

    await conn.commit()

    // 8. Return updated consulting record
    const [updatedRows] = await pool.query(`
      SELECT 
        s.*,
        CAST(s.start_date AS CHAR) AS start_date_str,
        CAST(s.created_at AS CHAR) AS created_at_str,
        ba.bank_name,
        ba.account_number
      FROM sites s
      LEFT JOIN bank_accounts ba ON ba.id = s.bank_account_id
      WHERE s.id = ?
      LIMIT 1
    `, [id])

    res.status(200).json(formatConsultingRow(updatedRows[0]))
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

/**
 * DELETE /api/consulting/:id
 * Delete a consulting record + reverse bank balance effect atomically
 */
export const deleteConsulting = async (req, res, next) => {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const id = req.params.id

    const [existingRows] = await conn.query(
      'SELECT * FROM sites WHERE id = ? AND description LIKE "%[CONSULTING]%" LIMIT 1',
      [id]
    )
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Consulting record not found' })
    }
    const existing = existingRows[0]

    await conn.beginTransaction()

    // Fetch all client_payments for this consulting site
    const [payments] = await conn.query(
      'SELECT id, bank_account_id, amount FROM client_payments WHERE site_id = ?',
      [id]
    )

    if (payments.length > 0) {
      // Deduct each bank payment from its respective bank account
      for (const p of payments) {
        if (p.bank_account_id && Number(p.amount) > 0) {
          await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [
            Number(p.amount),
            p.bank_account_id,
          ])
        }
      }
    } else {
      // Fallback for legacy rows where no client_payments row was logged
      const bankId = existing.bank_account_id ? Number(existing.bank_account_id) : null
      const received = Number(existing.total_received || 0)
      if (bankId && received > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [received, bankId])
      }
    }

    // Delete linked client_payments
    await conn.query('DELETE FROM client_payments WHERE site_id = ?', [id])

    // Delete site row
    await conn.query('DELETE FROM sites WHERE id = ?', [id])

    await conn.commit()
    res.json({ success: true, message: 'Consulting record deleted and bank balance adjusted successfully' })
  } catch (error) {
    await conn.rollback()
    next(error)
  } finally {
    conn.release()
  }
}

