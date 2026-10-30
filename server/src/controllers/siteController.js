import { Site } from '../models/Site.js'
import { Expense } from '../models/Expense.js'
import { getPool } from '../config/db.js'

export const getSites = async (req, res, next) => {
  try {
    const { search, status, sort } = req.query
    const sites = await Site.find({ search, status, sort })
    res.json(sites)
  } catch (error) {
    next(error)
  }
}

export const getSiteById = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.id)
    if (!site) {
      return res.status(404).json({ error: 'Site not found' })
    }
    res.json(site)
  } catch (error) {
    next(error)
  }
}

export const createSite = async (req, res, next) => {
  const pool = getPool()
  const connection = await pool.getConnection()
  try {
    const {
      name,
      location,
      siteOwner,
      contactNumber,
      phone,
      email,
      address,
      totalBudget,
      projectValue,
      advanceAmount,
      totalReceived,
      bankAccountId,
      startDate,
      expectedCompletionDate,
      status,
      description,
    } = req.body

    // 1. Required field validations
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Site name is required' })
    }
    if (!siteOwner || !siteOwner.trim()) {
      return res.status(400).json({ error: 'Site owner / client name is required' })
    }
    const finalContact = (contactNumber || phone || '').trim()
    if (!finalContact) {
      return res.status(400).json({ error: 'Contact number is required' })
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Site location is required' })
    }

    // Optional email validation
    const trimmedEmail = (email || '').trim().toLowerCase()
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email address format' })
      }
    }

    // Dates validation
    const cleanStartDate = startDate
      ? new Date(startDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    const cleanCompletionDate = expectedCompletionDate
      ? new Date(expectedCompletionDate).toISOString().slice(0, 10)
      : null

    if (cleanCompletionDate && cleanCompletionDate < cleanStartDate) {
      return res.status(400).json({ error: 'Expected completion date cannot be earlier than start date' })
    }

    // Financial validation
    const rawVal = projectValue !== undefined ? projectValue : totalBudget
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return res.status(400).json({ error: 'Project value is required' })
    }
    const projectVal = Number(rawVal)
    if (isNaN(projectVal) || projectVal < 0) {
      return res.status(400).json({ error: 'Project value must be a non-negative number' })
    }

    const adv = advanceAmount !== undefined && advanceAmount !== '' ? Number(advanceAmount) : 0
    if (isNaN(adv) || adv < 0) {
      return res.status(400).json({ error: 'Advance amount must be a non-negative number' })
    }
    if (adv > projectVal) {
      return res.status(400).json({ error: 'Advance amount cannot exceed total project value' })
    }

    const totReceived = totalReceived !== undefined && totalReceived !== '' ? Number(totalReceived) : 0
    if (isNaN(totReceived) || totReceived < 0) {
      return res.status(400).json({ error: 'Total received must be a non-negative number' })
    }
    if (totReceived > projectVal) {
      return res.status(400).json({ error: 'Total received cannot exceed total project value' })
    }

    // Bank account validation
    let validBankId = null
    if (bankAccountId) {
      const [bankRows] = await connection.query(
        'SELECT id FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
        [bankAccountId]
      )
      if (bankRows.length === 0) {
        return res.status(400).json({ error: 'Selected bank account was not found or is inactive' })
      }
      validBankId = Number(bankAccountId)
    }

    if (totReceived > 0 && !validBankId) {
      return res.status(400).json({ error: 'Bank account selection is required when payment is received' })
    }

    // Begin atomic database transaction
    await connection.beginTransaction()

    // 1. Insert into sites table
    const [siteResult] = await connection.query(
      `INSERT INTO sites
        (name, location, site_owner, contact_number, email, address,
         total_budget, advance_amount, total_received, bank_account_id,
         total_spent, status, start_date, expected_completion_date, description, budget_alert_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1)`,
      [
        name.trim(),
        location.trim(),
        siteOwner.trim(),
        finalContact,
        trimmedEmail,
        (address || '').trim(),
        projectVal,
        adv,
        totReceived,
        validBankId,
        status || 'Active',
        cleanStartDate,
        cleanCompletionDate,
        description || '',
      ]
    )
    const siteId = siteResult.insertId

    // 2. Associate with site_owners table (reuse existing owner if same name or phone, or create new)
    let ownerId = null
    const [existingOwners] = await connection.query(
      `SELECT id FROM site_owners
       WHERE is_active = 1 AND (LOWER(TRIM(name)) = LOWER(TRIM(?)) OR (phone != '' AND phone = ?))
       LIMIT 1`,
      [siteOwner.trim(), finalContact]
    )

    if (existingOwners.length > 0) {
      ownerId = existingOwners[0].id
      await connection.query(
        `UPDATE site_owners SET
          site_id = ?,
          project_value = project_value + ?,
          advance_amount = advance_amount + ?,
          total_received = total_received + ?,
          phone = CASE WHEN phone = '' THEN ? ELSE phone END,
          email = CASE WHEN email = '' THEN ? ELSE email END,
          address = CASE WHEN address = '' THEN ? ELSE address END
         WHERE id = ?`,
        [
          siteId,
          projectVal,
          adv,
          totReceived,
          finalContact,
          trimmedEmail,
          (address || '').trim(),
          ownerId,
        ]
      )
    } else {
      const [ownerResult] = await connection.query(
        `INSERT INTO site_owners
          (name, phone, email, address, site_id, project_value, advance_amount, total_received, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'On schedule', ?)`,
        [
          siteOwner.trim(),
          finalContact,
          trimmedEmail,
          (address || '').trim(),
          siteId,
          projectVal,
          adv,
          totReceived,
          description || '',
        ]
      )
      ownerId = ownerResult.insertId
    }

    // 3. If totalReceived > 0, record payment in client_payments & update bank balance
    if (totReceived > 0 && validBankId) {
      await connection.query(
        `INSERT INTO client_payments
          (client_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status)
         VALUES (?, ?, ?, ?, ?, 'Initial client payment', 'Bank transfer', 'Initial payment receipt', 'Paid')`,
        [ownerId, siteId, validBankId, totReceived, cleanStartDate]
      )

      await connection.query(
        `UPDATE bank_accounts SET balance = balance + ? WHERE id = ?`,
        [totReceived, validBankId]
      )
    }

    await connection.commit()

    const createdSite = await Site.findById(siteId)
    res.status(201).json(createdSite)
  } catch (error) {
    await connection.rollback()
    next(error)
  } finally {
    connection.release()
  }
}

export const updateSite = async (req, res, next) => {
  const pool = getPool()
  const connection = await pool.getConnection()
  try {
    const siteId = req.params.id

    const {
      name,
      location,
      siteOwner,
      contactNumber,
      email,
      address,
      totalBudget,
      projectValue,
      advanceAmount,
      bankAccountId,
      startDate,
      expectedCompletionDate,
      status,
      description,
      additionalReceived,
    } = req.body

    // --- Validation ---
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Site name is required' })
    }
    if (!siteOwner || !siteOwner.trim()) {
      return res.status(400).json({ error: 'Site owner / client name is required' })
    }
    const finalContact = (contactNumber || '').trim()
    if (!finalContact) {
      return res.status(400).json({ error: 'Contact number is required' })
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Site location is required' })
    }

    // Optional email
    const trimmedEmail = (email || '').trim().toLowerCase()
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email address format' })
      }
    }

    // Dates
    const cleanStartDate = startDate ? new Date(startDate).toISOString().slice(0, 10) : null
    const cleanCompletionDate = expectedCompletionDate
      ? new Date(expectedCompletionDate).toISOString().slice(0, 10)
      : null
    if (cleanStartDate && cleanCompletionDate && cleanCompletionDate < cleanStartDate) {
      return res.status(400).json({ error: 'Expected completion date cannot be earlier than start date' })
    }

    // Financial
    const rawVal = projectValue !== undefined ? projectValue : totalBudget
    const projectVal = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : null
    if (projectVal === null || isNaN(projectVal) || projectVal < 0) {
      return res.status(400).json({ error: 'Project value must be a non-negative number' })
    }

    const adv =
      advanceAmount !== undefined && advanceAmount !== '' ? Number(advanceAmount) : 0
    if (isNaN(adv) || adv < 0) {
      return res.status(400).json({ error: 'Advance amount must be a non-negative number' })
    }
    if (adv > projectVal) {
      return res.status(400).json({ error: 'Advance amount cannot exceed total project value' })
    }

    const addlReceived =
      additionalReceived !== undefined && additionalReceived !== '' ? Number(additionalReceived) : 0
    if (isNaN(addlReceived) || addlReceived < 0) {
      return res.status(400).json({ error: 'Additional received amount must be a non-negative number' })
    }

    // Bank required only if additional payment
    let validBankId = null
    if (bankAccountId) {
      const [bankRows] = await connection.query(
        'SELECT id FROM bank_accounts WHERE id = ? AND is_active = 1 LIMIT 1',
        [bankAccountId]
      )
      if (bankRows.length === 0) {
        return res.status(400).json({ error: 'Selected bank account was not found or is inactive' })
      }
      validBankId = Number(bankAccountId)
    }
    if (addlReceived > 0 && !validBankId) {
      return res.status(400).json({ error: 'Bank account selection is required when recording a payment' })
    }

    // --- Atomic transaction ---
    await connection.beginTransaction()

    // 1. Update sites row (total_received is NOT touched here — only via payment records)
    await connection.query(
      `UPDATE sites SET
        name = ?,
        location = ?,
        site_owner = ?,
        contact_number = ?,
        email = ?,
        address = ?,
        total_budget = ?,
        advance_amount = ?,
        bank_account_id = ?,
        start_date = ?,
        expected_completion_date = ?,
        status = ?,
        description = ?
       WHERE id = ?`,
      [
        name.trim(),
        location.trim(),
        siteOwner.trim(),
        finalContact,
        trimmedEmail,
        (address || '').trim(),
        projectVal,
        adv,
        validBankId,
        cleanStartDate,
        cleanCompletionDate,
        status || 'Active',
        description || '',
        siteId,
      ]
    )

    // 2. If additional payment, record it atomically
    if (addlReceived > 0 && validBankId) {
      const paymentDate = new Date().toISOString().slice(0, 10)

      // Find the linked site_owner for this site
      const [ownerRows] = await connection.query(
        'SELECT id FROM site_owners WHERE site_id = ? LIMIT 1',
        [siteId]
      )
      const ownerId = ownerRows.length > 0 ? ownerRows[0].id : null

      // Insert payment record
      await connection.query(
        `INSERT INTO client_payments
          (client_id, site_id, bank_account_id, amount, payment_date, title, payment_method, reference, status)
         VALUES (?, ?, ?, ?, ?, 'Additional payment received', 'Bank transfer', 'Reference verified', 'Paid')`,
        [ownerId, siteId, validBankId, addlReceived, paymentDate]
      )

      // Update bank balance
      await connection.query(
        'UPDATE bank_accounts SET balance = balance + ? WHERE id = ?',
        [addlReceived, validBankId]
      )

      // Update cumulative total_received on sites
      await connection.query(
        'UPDATE sites SET total_received = total_received + ? WHERE id = ?',
        [addlReceived, siteId]
      )

      // Update site_owners total_received if linked
      if (ownerId) {
        await connection.query(
          'UPDATE site_owners SET total_received = total_received + ? WHERE id = ?',
          [addlReceived, ownerId]
        )
      }
    }

    await connection.commit()

    const updatedSite = await Site.findById(siteId)
    if (!updatedSite) {
      return res.status(404).json({ error: 'Site not found after update' })
    }
    res.json(updatedSite)
  } catch (error) {
    await connection.rollback()
    next(error)
  } finally {
    connection.release()
  }
}

export const deleteSite = async (req, res, next) => {
  try {
    const expenseCount = await Expense.countBySite(req.params.id)
    if (expenseCount > 0) {
      return res.status(400).json({
        error: `Cannot delete site because it has ${expenseCount} associated expense record(s).`,
      })
    }

    const site = await Site.delete(req.params.id)
    if (!site) {
      return res.status(404).json({ error: 'Site not found' })
    }
    res.json({ message: 'Site deleted successfully' })
  } catch (error) {
    next(error)
  }
}

export const getSitePayments = async (req, res, next) => {
  try {
    const siteId = req.params.id
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT 
         cp.id,
         cp.client_id,
         cp.site_id,
         cp.bank_account_id,
         cp.amount,
         CAST(cp.payment_date AS CHAR) AS payment_date_str,
         CAST(cp.created_at AS CHAR) AS created_at_str,
         cp.payment_date,
         cp.title,
         cp.payment_method,
         cp.reference,
         cp.status,
         cp.created_at,
         COALESCE(so.name, s.site_owner) AS client_name,
         ba.bank_name,
         ba.account_number
       FROM client_payments cp
       INNER JOIN sites s ON s.id = cp.site_id
       LEFT JOIN site_owners so ON so.id = cp.client_id
       LEFT JOIN bank_accounts ba ON ba.id = cp.bank_account_id
       WHERE cp.site_id = ?
       ORDER BY cp.payment_date DESC, cp.id DESC`,
      [siteId]
    )

    const payments = rows.map((r) => {
      const dateVal = r.payment_date_str || (r.payment_date ? String(r.payment_date).slice(0, 10) : '')
      return {
        id: r.id,
        _id: String(r.id),
        siteId: r.site_id,
        clientId: r.client_id,
        clientName: r.client_name || 'Client',
        amount: Number(r.amount || 0),
        paymentDate: dateVal,
        paymentMethod: r.payment_method || 'Bank transfer',
        bankName: r.bank_name || 'Bank Transfer',
        accountNumber: r.account_number || '',
        reference: r.reference || '',
        title: r.title || 'Client Payment',
        remark: r.reference || r.title || '',
        status: r.status || 'Paid',
        createdAt: r.created_at_str || r.created_at,
      }
    })

    res.json(payments)
  } catch (error) {
    next(error)
  }
}
