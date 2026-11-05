import { getPool } from '../config/db.js'
import { fmtDate, fmtDateOnly } from './helpers.js'

export const WorkerPayment = {
  // Create an additional wage payment, advance, or settlement
  async createPayment({
    workerId,
    siteId,
    bankAccountId,
    amount,
    paymentDate,
    paymentType = 'Wage Payment', // 'Advance Payment', 'Wage Payment', 'Final Settlement'
    remarks = '',
    createdBy = 'Admin',
  }) {
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.')
    }

    if (!bankAccountId) {
      throw new Error('Bank selection is mandatory.')
    }

    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // 1. Verify and lock the bank account
      const [[bank]] = await conn.query(
        'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
        [bankAccountId],
      )

      if (!bank) {
        throw new Error('Selected bank account not found or inactive.')
      }

      const currentBalance = Number(bank.balance || 0)
      if (currentBalance <= 0) {
        throw new Error(`Bank account (${bank.bank_name}) has zero balance. Payment cannot proceed.`)
      }

      if (currentBalance < numAmount) {
        throw new Error(
          `Insufficient bank balance in ${bank.bank_name}. Available: ₹${currentBalance.toLocaleString('en-IN')}, Requested: ₹${numAmount.toLocaleString('en-IN')}. Please select another account or reduce amount.`,
        )
      }

      // 2. Verify worker
      const [[worker]] = await conn.query(
        'SELECT id, name, site_id, advance_amount, total_paid, wages_earned FROM labours WHERE id = ? FOR UPDATE',
        [workerId],
      )

      if (!worker) {
        throw new Error(`Worker with ID ${workerId} not found.`)
      }

      const finalSiteId = (siteId && !isNaN(Number(siteId)) && Number(siteId) > 0)
        ? Number(siteId)
        : (worker.site_id ? Number(worker.site_id) : null)
      const formattedDate = paymentDate ? new Date(paymentDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
      const referenceId = `TXN-WRK-${Date.now().toString().slice(-6)}`

      // 3. Deduct from bank account
      await conn.query(
        'UPDATE bank_accounts SET balance = balance - ? WHERE id = ?',
        [numAmount, bankAccountId],
      )

      // 4. Insert into worker_payments
      const [insertResult] = await conn.query(
        `INSERT INTO worker_payments
          (worker_id, site_id, bank_account_id, payment_date, amount, payment_type, payment_method, reference_id, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'Bank Transfer', ?, ?, ?)`,
        [workerId, finalSiteId, bankAccountId, formattedDate, numAmount, paymentType, referenceId, (remarks || '').trim(), createdBy],
      )

      // 5. Recalculate worker's total_paid in labours table
      // Total Paid = (initial advance) + (sum of worker_payments)
      const [[paySum]] = await conn.query(
        'SELECT COALESCE(SUM(amount), 0) AS total_extra FROM worker_payments WHERE worker_id = ?',
        [workerId],
      )
      const newTotalPaid = Number(worker.advance_amount || 0) + Number(paySum.total_extra || 0)

      await conn.query(
        'UPDATE labours SET total_paid = ? WHERE id = ?',
        [newTotalPaid, workerId],
      )

      await conn.commit()

      return {
        id: insertResult.insertId,
        workerId,
        workerName: worker.name,
        siteId: finalSiteId,
        bankAccountId,
        bankName: bank.bank_name,
        amount: numAmount,
        paymentDate: formattedDate,
        paymentType,
        referenceId,
        remarks: remarks || '',
        newBankBalance: currentBalance - numAmount,
        newTotalPaid,
      }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },

  // Get complete payment history for a specific worker
  async getPaymentsByWorker(workerId) {
    const pool = getPool()

    // 1. Fetch worker info including initial advance
    const [[worker]] = await pool.query(
      `SELECT l.id, l.name, l.advance_amount, l.bank_account_id, l.joining_date,
              l.remarks, l.created_at, ba.bank_name
       FROM labours l
       LEFT JOIN bank_accounts ba ON ba.id = l.bank_account_id
       WHERE l.id = ?`,
      [workerId],
    )

    if (!worker) return []

    // 2. Fetch additional payments from worker_payments
    const [payments] = await pool.query(
      `SELECT wp.id, wp.worker_id, wp.site_id, wp.bank_account_id, wp.payment_date,
              wp.amount, wp.payment_type, wp.payment_method, wp.reference_id,
              wp.remarks, wp.created_by, wp.created_at,
              ba.bank_name, s.name AS site_name
       FROM worker_payments wp
       LEFT JOIN bank_accounts ba ON ba.id = wp.bank_account_id
       LEFT JOIN sites s ON s.id = wp.site_id
       WHERE wp.worker_id = ?
       ORDER BY wp.payment_date DESC, wp.id DESC`,
      [workerId],
    )

    const list = []

    // Add initial advance if present
    if (Number(worker.advance_amount || 0) > 0) {
      list.push({
        id: `init-adv-${worker.id}`,
        isInitialAdvance: true,
        workerId: worker.id,
        workerName: worker.name,
        paymentDate: fmtDateOnly(worker.joining_date || worker.created_at),
        amount: Number(worker.advance_amount),
        paymentType: 'Advance Payment',
        paymentMethod: 'Bank Transfer',
        bankAccountId: worker.bank_account_id,
        bankName: worker.bank_name || 'Bank Account',
        remarks: worker.remarks || 'Initial Advance on Joining',
        referenceId: `TXN-WRK-${String(worker.id).padStart(4, '0')}`,
        createdAt: fmtDate(worker.created_at),
      })
    }

    // Add all subsequent payments
    for (const p of payments) {
      list.push({
        id: p.id,
        isInitialAdvance: false,
        workerId: p.worker_id,
        workerName: worker.name,
        siteId: p.site_id,
        siteName: p.site_name,
        paymentDate: fmtDateOnly(p.payment_date),
        amount: Number(p.amount),
        paymentType: p.payment_type,
        paymentMethod: p.payment_method || 'Bank Transfer',
        bankAccountId: p.bank_account_id,
        bankName: p.bank_name || 'Bank Account',
        remarks: p.remarks || '',
        referenceId: p.reference_id || `TXN-WRK-PAY-${p.id}`,
        createdBy: p.created_by,
        createdAt: fmtDate(p.created_at),
      })
    }

    // Sort all chronologically descending
    list.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
    return list
  },

  // Update a payment and adjust bank deduction accordingly
  async updatePayment(id, { amount, paymentDate, paymentType, bankAccountId, remarks }) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [[existing]] = await conn.query(
        'SELECT * FROM worker_payments WHERE id = ? FOR UPDATE',
        [id],
      )
      if (!existing) {
        throw new Error('Payment record not found.')
      }

      const oldAmount = Number(existing.amount || 0)
      const oldBankId = existing.bank_account_id
      const newAmount = amount !== undefined ? Number(amount) : oldAmount
      const newBankId = bankAccountId ? Number(bankAccountId) : oldBankId
      const newDate = paymentDate ? new Date(paymentDate).toISOString().slice(0, 10) : existing.payment_date
      const newType = paymentType || existing.payment_type
      const newRemarks = remarks !== undefined ? (remarks || '').trim() : existing.remarks

      if (isNaN(newAmount) || newAmount <= 0) {
        throw new Error('Payment amount must be greater than zero.')
      }

      // Handle bank balance adjustments
      if (oldBankId === newBankId) {
        const diff = newAmount - oldAmount
        if (diff !== 0) {
          const [[bank]] = await conn.query('SELECT balance, bank_name FROM bank_accounts WHERE id = ? FOR UPDATE', [newBankId])
          if (!bank) throw new Error('Bank account not found.')
          if (diff > 0 && Number(bank.balance) < diff) {
            throw new Error(`Insufficient balance in ${bank.bank_name}.`)
          }
          await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [diff, newBankId])
        }
      } else {
        // Reverse old bank deduction
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [oldAmount, oldBankId])
        // Verify and deduct from new bank
        const [[newBank]] = await conn.query('SELECT balance, bank_name FROM bank_accounts WHERE id = ? FOR UPDATE', [newBankId])
        if (!newBank) throw new Error('New bank account not found.')
        if (Number(newBank.balance) < newAmount) {
          throw new Error(`Insufficient balance in ${newBank.bank_name}.`)
        }
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [newAmount, newBankId])
      }

      // Update worker_payments table
      await conn.query(
        `UPDATE worker_payments
         SET bank_account_id = ?, amount = ?, payment_date = ?, payment_type = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newBankId, newAmount, newDate, newType, newRemarks, id],
      )

      // Recalculate worker's total_paid in labours table
      const [[worker]] = await conn.query('SELECT id, advance_amount FROM labours WHERE id = ?', [existing.worker_id])
      const [[paySum]] = await conn.query(
        'SELECT COALESCE(SUM(amount), 0) AS total_extra FROM worker_payments WHERE worker_id = ?',
        [existing.worker_id],
      )
      const newTotalPaid = Number(worker?.advance_amount || 0) + Number(paySum?.total_extra || 0)
      await conn.query('UPDATE labours SET total_paid = ? WHERE id = ?', [newTotalPaid, existing.worker_id])

      await conn.commit()
      return { id, amount: newAmount, paymentDate: newDate, paymentType: newType, bankAccountId: newBankId, remarks: newRemarks }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },

  // Delete a payment and reverse its bank deduction
  async deletePayment(id) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [[payment]] = await conn.query(
        'SELECT * FROM worker_payments WHERE id = ? FOR UPDATE',
        [id],
      )

      if (!payment) {
        throw new Error('Payment record not found.')
      }

      const numAmount = Number(payment.amount || 0)

      // 1. Reverse the bank deduction (add back money to bank account)
      if (payment.bank_account_id && numAmount > 0) {
        await conn.query(
          'UPDATE bank_accounts SET balance = balance + ? WHERE id = ?',
          [numAmount, payment.bank_account_id],
        )
      }

      // 2. Delete payment record
      await conn.query('DELETE FROM worker_payments WHERE id = ?', [id])

      // 3. Recalculate worker's total_paid in labours table
      const [[worker]] = await conn.query(
        'SELECT id, advance_amount FROM labours WHERE id = ?',
        [payment.worker_id],
      )
      const [[paySum]] = await conn.query(
        'SELECT COALESCE(SUM(amount), 0) AS total_extra FROM worker_payments WHERE worker_id = ?',
        [payment.worker_id],
      )
      const newTotalPaid = Number(worker?.advance_amount || 0) + Number(paySum?.total_extra || 0)

      await conn.query(
        'UPDATE labours SET total_paid = ? WHERE id = ?',
        [newTotalPaid, payment.worker_id],
      )

      await conn.commit()
      return { id, reversedAmount: numAmount, bankAccountId: payment.bank_account_id }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },
}

