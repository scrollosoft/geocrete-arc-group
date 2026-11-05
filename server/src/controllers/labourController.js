import { getPool } from '../config/db.js'
import { Labour } from '../models/Labour.js'
import { Site } from '../models/Site.js'

export const getLabour = async (req, res, next) => {
  try {
    const { search, siteId, trade } = req.query
    const workers = await Labour.find({ search, siteId, trade })
    const summary = await Labour.sumAll()

    res.json({ workers, summary })
  } catch (error) {
    next(error)
  }
}

export const createLabour = async (req, res, next) => {
  let conn = null
  try {
    const {
      name,
      phone,
      trade,
      otherTrade,
      site,
      joiningDate,
      dailyRate,
      advancePayment,
      advanceAmount,
      bankAccountId,
      address,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Worker Full Name is required.' })
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone Number is required.' })
    }

    const finalTrade = trade === 'Other' ? (otherTrade || '').trim() : (trade || '').trim()
    if (!finalTrade) {
      return res.status(400).json({ error: 'Worker Trade / Role is required.' })
    }

    if (!site) {
      return res.status(400).json({ error: 'Construction Site is required.' })
    }

    // Verify site exists
    const siteDoc = await Site.findById(site)
    if (!siteDoc) {
      return res.status(400).json({ error: 'Selected Construction Site does not exist.' })
    }

    if (!dailyRate || Number(dailyRate) <= 0) {
      return res.status(400).json({ error: 'Daily Wage must be greater than zero.' })
    }

    // Validate Advance Payment
    const rawAdvance = advanceAmount !== undefined && advanceAmount !== '' ? advanceAmount : advancePayment
    const parsedAdvance = rawAdvance !== undefined && rawAdvance !== '' ? Number(rawAdvance) : 0

    if (isNaN(parsedAdvance) || parsedAdvance < 0) {
      return res.status(400).json({ error: 'Advance payment must be a valid, non-negative number.' })
    }

    if (parsedAdvance > 0 && !bankAccountId) {
      return res.status(400).json({ error: 'Please select a bank account for advance payment.' })
    }

    conn = await getPool().getConnection()
    await conn.beginTransaction()

    // Validate and deduct bank balance if advance payment > 0
    if (parsedAdvance > 0 && bankAccountId) {
      const [[bankRow]] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
        [bankAccountId],
      )

      if (!bankRow) {
        await conn.rollback()
        conn.release()
        conn = null
        return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
      }

      const bankBalance = Number(bankRow.balance || 0)
      if (bankBalance < parsedAdvance) {
        await conn.rollback()
        conn.release()
        conn = null
        return res.status(400).json({
          error: 'Insufficient bank balance. Please select another account or reduce the advance amount.',
        })
      }

      await conn.query(
        'UPDATE bank_accounts SET balance = balance - ? WHERE id = ?',
        [parsedAdvance, bankAccountId],
      )
    }

    const worker = await Labour.create(
      {
        name: name.trim(),
        phone: phone.trim(),
        trade: finalTrade,
        site: siteDoc._id,
        joiningDate: joiningDate ? new Date(joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        dailyRate: Number(dailyRate),
        advanceAmount: parsedAdvance,
        bankAccountId: parsedAdvance > 0 ? Number(bankAccountId) : null,
        totalPaid: parsedAdvance,
        wagesEarned: 0,
        paymentType: 'Daily',
        status: 'Active',
        address: address ? address.trim() : '',
        remarks: parsedAdvance > 0 ? `Advance payment of ₹${parsedAdvance.toLocaleString('en-IN')}` : '',
      },
      conn,
    )

    await conn.commit()
    conn.release()
    conn = null

    res.status(201).json(worker)
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback()
      } catch { }
      conn.release()
    }
    next(error)
  }
}

export const updateLabour = async (req, res, next) => {
  let conn = null
  try {
    const { id } = req.params
    const {
      name,
      phone,
      trade,
      dailyRate,
      wagesEarned,
      totalPaid,
      address,
      remarks,
      additionalAdvance,
      additionalAdvanceAmount,
      bankAccountId,
    } = req.body

    const existingWorker = await Labour.findById(id)
    if (!existingWorker) {
      return res.status(404).json({ error: 'Worker not found' })
    }

    const rawAdditionalAdvance = additionalAdvance !== undefined && additionalAdvance !== ''
      ? additionalAdvance
      : additionalAdvanceAmount
    const numAdditionalAdvance = rawAdditionalAdvance !== undefined && rawAdditionalAdvance !== ''
      ? Number(rawAdditionalAdvance)
      : 0

    if (isNaN(numAdditionalAdvance) || numAdditionalAdvance < 0) {
      return res.status(400).json({ error: 'Additional advance amount must be a valid, non-negative number.' })
    }

    if (numAdditionalAdvance > 0 && !bankAccountId) {
      return res.status(400).json({ error: 'Please select a bank account for the additional advance payment.' })
    }

    conn = await getPool().getConnection()
    await conn.beginTransaction()

    // 1. If additional advance entered, validate bank balance and deduct
    if (numAdditionalAdvance > 0) {
      const [[bankRow]] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
        [bankAccountId],
      )

      if (!bankRow) {
        await conn.rollback()
        conn.release()
        conn = null
        return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
      }

      const currentBalance = Number(bankRow.balance || 0)
      if (currentBalance < numAdditionalAdvance) {
        await conn.rollback()
        conn.release()
        conn = null
        return res.status(400).json({
          error: `Insufficient bank balance in ${bankRow.bank_name}. Available: ₹${currentBalance.toLocaleString('en-IN')}, Requested: ₹${numAdditionalAdvance.toLocaleString('en-IN')}. Please select another account or reduce the advance amount.`,
        })
      }

      // Deduct from bank
      await conn.query(
        'UPDATE bank_accounts SET balance = balance - ? WHERE id = ?',
        [numAdditionalAdvance, bankAccountId],
      )

      // Create separate new advance payment record in worker_payments
      const formattedDate = new Date().toISOString().slice(0, 10)
      const referenceId = `TXN-WRK-ADV-${Date.now().toString().slice(-6)}`
      const advRemarks = `Additional Advance Payment of ₹${numAdditionalAdvance.toLocaleString('en-IN')}`

      await conn.query(
        `INSERT INTO worker_payments
          (worker_id, site_id, bank_account_id, payment_date, amount, payment_type, payment_method, reference_id, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, 'Advance Payment', 'Bank Transfer', ?, ?, 'Admin')`,
        [id, existingWorker.site?._id || existingWorker.site || null, bankAccountId, formattedDate, numAdditionalAdvance, referenceId, advRemarks],
      )
    }

    // 2. Recalculate worker's total_paid in labours table
    // Total Paid = (initial advance) + (sum of worker_payments)
    const [[paySum]] = await conn.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_extra FROM worker_payments WHERE worker_id = ?',
      [id],
    )
    const calculatedPaid = Number(existingWorker.advanceAmount || 0) + Number(paySum.total_extra || 0)
    const newTotalPaid = numAdditionalAdvance > 0
      ? Math.max(calculatedPaid, Number(existingWorker.totalPaid || 0) + numAdditionalAdvance)
      : (totalPaid !== undefined ? Number(totalPaid) : Number(existingWorker.totalPaid || 0))

    // 3. Update worker details in labours table
    const updateData = {
      name: name !== undefined ? name.trim() : undefined,
      phone: phone !== undefined ? phone.trim() : undefined,
      trade: trade !== undefined ? trade.trim() : undefined,
      dailyRate: dailyRate !== undefined ? Number(dailyRate) : undefined,
      wagesEarned: wagesEarned !== undefined ? Number(wagesEarned) : undefined,
      totalPaid: newTotalPaid,
      address: address !== undefined ? address.trim() : undefined,
      remarks: remarks !== undefined ? remarks.trim() : undefined,
    }

    // Remove undefined keys
    Object.keys(updateData).forEach((k) => updateData[k] === undefined && delete updateData[k])

    const updatedWorker = await Labour.update(id, updateData, conn)

    await conn.commit()
    conn.release()
    conn = null

    res.json(updatedWorker)
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback()
      } catch {}
      conn.release()
    }
    next(error)
  }
}

export const deleteLabour = async (req, res, next) => {
  try {
    const worker = await Labour.delete(req.params.id)
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' })
    }
    res.json({ message: 'Worker deleted successfully' })
  } catch (error) {
    next(error)
  }
}
