import { getPool } from '../config/db.js'
import { Labour } from '../models/Labour.js'
import { Site } from '../models/Site.js'
import { calculateLiveCashSummary } from './cashController.js'

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
      totalAmount,
      advancePayment,
      advanceAmount,
      bankAccountId,
      address,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Worker Full Name is required.' })
    }

    const finalPhone = (phone && String(phone).trim()) ? String(phone).trim() : 'N/A'

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

    const rawAmount = totalAmount !== undefined && totalAmount !== '' ? totalAmount : dailyRate
    const parsedTotalAmount = Number(rawAmount)
    if (!rawAmount || isNaN(parsedTotalAmount) || parsedTotalAmount <= 0) {
      return res.status(400).json({ error: 'Total Amount must be greater than zero.' })
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

    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash'
    const finalBankAccountId = isCashAccount ? null : (bankAccountId ? Number(bankAccountId) : null)

    conn = await getPool().getConnection()
    await conn.beginTransaction()

    // Validate and deduct balance if advance payment > 0
    if (parsedAdvance > 0) {
      if (isCashAccount) {
        const cashSummary = await calculateLiveCashSummary(conn)
        if (cashSummary.balance < parsedAdvance) {
          await conn.rollback()
          conn.release()
          conn = null
          return res.status(400).json({
            error: `Insufficient cash balance. Available cash: ₹${cashSummary.balance.toLocaleString('en-IN')}, Requested: ₹${parsedAdvance.toLocaleString('en-IN')}.`,
          })
        }
      } else if (finalBankAccountId) {
        const [[bankRow]] = await conn.query(
          'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
          [finalBankAccountId],
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
          [parsedAdvance, finalBankAccountId],
        )
      }
    }

    const worker = await Labour.create(
      {
        name: name.trim(),
        phone: finalPhone,
        trade: finalTrade,
        site: siteDoc._id,
        joiningDate: joiningDate ? new Date(joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        dailyRate: parsedTotalAmount,
        totalAmount: parsedTotalAmount,
        advanceAmount: parsedAdvance,
        bankAccountId: parsedAdvance > 0 ? finalBankAccountId : null,
        totalPaid: parsedAdvance,
        wagesEarned: parsedTotalAmount,
        paymentType: 'Daily',
        status: 'Active',
        address: address ? address.trim() : '',
        remarks: parsedAdvance > 0 ? (isCashAccount ? `Advance payment of ₹${parsedAdvance.toLocaleString('en-IN')} (Paid via Cash)` : `Advance payment of ₹${parsedAdvance.toLocaleString('en-IN')}`) : '',
      },
      conn,
    )

    if (parsedAdvance > 0 && (finalBankAccountId || isCashAccount)) {
      const workerId = worker.id || worker._id
      const formattedDate = joiningDate ? new Date(joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      const referenceId = `TXN-WRK-${String(workerId).padStart(4, '0')}`
      const advRemarks = parsedAdvance > 0 ? (isCashAccount ? `Advance payment of ₹${parsedAdvance.toLocaleString('en-IN')} (Paid via Cash)` : `Advance payment of ₹${parsedAdvance.toLocaleString('en-IN')}`) : ''
      await conn.query(
        `INSERT INTO worker_payments
          (worker_id, site_id, bank_account_id, payment_date, amount, payment_type, payment_method, reference_id, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, 'Advance Payment', ?, ?, ?, 'Admin')`,
        [workerId, siteDoc._id, finalBankAccountId, formattedDate, parsedAdvance, isCashAccount ? 'Cash' : 'Bank Transfer', referenceId, advRemarks],
      )
    }

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
    // Total Paid = (initial advance if not in worker_payments) + (sum of worker_payments)
    const [[paySum]] = await conn.query(
      `SELECT
        COALESCE(SUM(amount), 0) AS total_extra,
        COALESCE(SUM(CASE WHEN payment_type = 'Advance Payment' AND (reference_id = CONCAT('TXN-WRK-', LPAD(worker_id, 4, '0')) OR reference_id = CONCAT('TXN-WRK-', worker_id)) THEN amount ELSE 0 END), 0) AS initial_in_payments
       FROM worker_payments WHERE worker_id = ?`,
      [id],
    )
    const initialAdvance = Number(existingWorker.advanceAmount || 0)
    const initialInPayments = Number(paySum.initial_in_payments || 0)
    const effectiveInitial = initialInPayments > 0 ? 0 : initialAdvance
    const calculatedPaid = effectiveInitial + Number(paySum.total_extra || 0)
    const newTotalPaid = numAdditionalAdvance > 0
      ? calculatedPaid
      : (totalPaid !== undefined ? Number(totalPaid) : calculatedPaid)

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
