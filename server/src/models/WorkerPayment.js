import { getPool } from '../config/db.js'
import { fmtDate, fmtDateOnly } from './helpers.js'
import { calculateLiveCashSummary } from '../controllers/cashController.js'

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

    const isCashAccount = String(bankAccountId).toLowerCase() === 'cash'
    const finalBankAccountId = isCashAccount ? null : Number(bankAccountId)
    const finalPaymentMethod = isCashAccount ? 'Cash' : 'Bank Transfer'

    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      let bank = null
      let currentBalance = 0

      // 1. Verify and lock the balance (Cash or Bank)
      if (isCashAccount) {
        const cashSummary = await calculateLiveCashSummary(conn)
        currentBalance = Number(cashSummary.balance || 0)
        if (currentBalance < numAmount) {
          throw new Error(
            `Insufficient cash balance. Available: ₹${currentBalance.toLocaleString('en-IN')}, Requested: ₹${numAmount.toLocaleString('en-IN')}. Please add cash or select a bank account.`,
          )
        }
      } else {
        const [[foundBank]] = await conn.query(
          'SELECT id, bank_name, balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
          [finalBankAccountId],
        )
        bank = foundBank

        if (!bank) {
          throw new Error('Selected bank account not found or inactive.')
        }

        currentBalance = Number(bank.balance || 0)
        if (currentBalance <= 0) {
          throw new Error(`Bank account (${bank.bank_name}) has zero balance. Payment cannot proceed.`)
        }

        if (currentBalance < numAmount) {
          throw new Error(
            `Insufficient bank balance in ${bank.bank_name}. Available: ₹${currentBalance.toLocaleString('en-IN')}, Requested: ₹${numAmount.toLocaleString('en-IN')}. Please select another account or reduce amount.`,
          )
        }

        // Deduct from bank account
        await conn.query(
          'UPDATE bank_accounts SET balance = balance - ? WHERE id = ?',
          [numAmount, finalBankAccountId],
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

      // 4. Insert into worker_payments
      const [insertResult] = await conn.query(
        `INSERT INTO worker_payments
          (worker_id, site_id, bank_account_id, payment_date, amount, payment_type, payment_method, reference_id, remarks, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [workerId, finalSiteId, finalBankAccountId, formattedDate, numAmount, paymentType, finalPaymentMethod, referenceId, (remarks || '').trim(), createdBy],
      )

      // 5. Recalculate worker's total_paid in labours table
      // Total Paid = (initial advance if not in worker_payments) + (sum of worker_payments)
      const [[paySum]] = await conn.query(
        `SELECT
          COALESCE(SUM(amount), 0) AS total_extra,
          COALESCE(SUM(CASE WHEN payment_type = 'Advance Payment' AND (reference_id = CONCAT('TXN-WRK-', LPAD(worker_id, 4, '0')) OR reference_id = CONCAT('TXN-WRK-', worker_id)) THEN amount ELSE 0 END), 0) AS initial_in_payments
         FROM worker_payments WHERE worker_id = ?`,
        [workerId],
      )
      const initialAdvance = Number(worker.advance_amount || 0)
      const initialInPayments = Number(paySum.initial_in_payments || 0)
      const effectiveInitial = initialInPayments > 0 ? 0 : initialAdvance
      const newTotalPaid = effectiveInitial + Number(paySum.total_extra || 0)

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
        bankName: isCashAccount ? 'Cash' : (bank?.bank_name || 'Bank Account'),
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

    // 1. Fetch worker info including initial advance, trade, site, wages
    const [[worker]] = await pool.query(
      `SELECT l.id, l.name, l.trade, l.site_id, l.advance_amount, l.wages_earned,
              l.daily_rate, l.total_paid, l.bank_account_id, l.joining_date,
              l.remarks, l.created_at, ba.bank_name, s.name AS site_name
       FROM labours l
       LEFT JOIN bank_accounts ba ON ba.id = l.bank_account_id
       LEFT JOIN sites s ON s.id = l.site_id
       WHERE l.id = ?`,
      [workerId],
    )

    if (!worker) return []

    const totalAgreed = Number(worker.wages_earned || worker.daily_rate || 0)

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
       ORDER BY wp.payment_date ASC, wp.id ASC`,
      [workerId],
    )

    const list = []

    // Add initial advance if present and not already recorded in worker_payments
    const hasAdvanceInPayments = payments.some(
      (p) => p.payment_type === 'Advance Payment' && p.reference_id === `TXN-WRK-${String(worker.id).padStart(4, '0')}`
    )
    if (!hasAdvanceInPayments && Number(worker.advance_amount || 0) > 0) {
      list.push({
        id: `init-adv-${worker.id}`,
        isInitialAdvance: true,
        workerId: worker.id,
        workerName: worker.name,
        trade: worker.trade || '',
        siteId: worker.site_id,
        siteName: worker.site_name || '',
        paymentDate: fmtDateOnly(worker.joining_date || worker.created_at),
        rawDate: worker.joining_date || worker.created_at,
        amount: Number(worker.advance_amount),
        paymentType: 'Advance Payment',
        paymentMethod: worker.bank_account_id ? 'Bank Transfer' : 'Cash',
        bankAccountId: worker.bank_account_id,
        bankName: worker.bank_name || (worker.bank_account_id ? 'Bank Account' : null),
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
        trade: worker.trade || '',
        siteId: p.site_id || worker.site_id,
        siteName: p.site_name || worker.site_name || '',
        paymentDate: fmtDateOnly(p.payment_date),
        rawDate: p.payment_date || p.created_at,
        amount: Number(p.amount),
        paymentType: p.payment_type || 'Wage Payment',
        paymentMethod: p.payment_method || (p.bank_account_id ? 'Bank Transfer' : 'Cash'),
        bankAccountId: p.bank_account_id,
        bankName: p.bank_name || (p.bank_account_id ? 'Bank Account' : null),
        remarks: p.remarks || '',
        referenceId: p.reference_id || `TXN-WRK-PAY-${p.id}`,
        createdBy: p.created_by,
        createdAt: fmtDate(p.created_at),
      })
    }

    // Sort chronologically ASCENDING to calculate cumulative payments & pending after each payment
    list.sort((a, b) => {
      const da = new Date(a.rawDate || a.paymentDate || 0).getTime()
      const db = new Date(b.rawDate || b.paymentDate || 0).getTime()
      if (da !== db) return da - db
      // If dates are identical: initial advance always comes first
      if (a.isInitialAdvance) return -1
      if (b.isInitialAdvance) return 1
      // Use transaction creation order (createdAt or id)
      const ca = new Date(a.createdAt || 0).getTime()
      const cb = new Date(b.createdAt || 0).getTime()
      if (ca !== cb) return ca - cb
      return (Number(a.id) || 0) - (Number(b.id) || 0)
    })

    let cumulativePaid = 0
    for (const item of list) {
      cumulativePaid += Number(item.amount || 0)
      item.totalAgreedAmount = totalAgreed
      item.cumulativePaid = cumulativePaid
      item.pendingAfter = Math.max(0, totalAgreed - cumulativePaid)
    }

    // Now sort chronologically DESCENDING (latest payment date first) as required
    list.sort((a, b) => {
      const da = new Date(a.rawDate || a.paymentDate || 0).getTime()
      const db = new Date(b.rawDate || b.paymentDate || 0).getTime()
      if (da !== db) return db - da // Latest date first
      // If dates are identical: latest created transaction comes first
      if (a.isInitialAdvance) return 1
      if (b.isInitialAdvance) return -1
      const ca = new Date(a.createdAt || 0).getTime()
      const cb = new Date(b.createdAt || 0).getTime()
      if (ca !== cb) return cb - ca
      return (Number(b.id) || 0) - (Number(a.id) || 0)
    })
    return list
  },

  // Get complete payment history across all workers
  async getAllPayments() {
    const pool = getPool()

    // 1. Fetch all workers from labours with sites and banks
    const [workers] = await pool.query(`
      SELECT l.id, l.name, l.phone, l.trade, l.site_id, l.advance_amount,
             l.total_paid, l.wages_earned, l.daily_rate, l.joining_date,
             l.bank_account_id, l.payment_type, l.remarks, l.created_at,
             ba.bank_name, s.name AS site_name
      FROM labours l
      LEFT JOIN bank_accounts ba ON ba.id = l.bank_account_id
      LEFT JOIN sites s ON s.id = l.site_id
    `)

    const workerMap = {}
    for (const w of workers) {
      workerMap[w.id] = w
    }

    // 2. Fetch all recorded payments from worker_payments
    const [payments] = await pool.query(`
      SELECT wp.id, wp.worker_id, wp.site_id, wp.bank_account_id, wp.payment_date,
             wp.amount, wp.payment_type, wp.payment_method, wp.reference_id,
             wp.remarks, wp.created_by, wp.created_at,
             ba.bank_name, s.name AS site_name
      FROM worker_payments wp
      LEFT JOIN bank_accounts ba ON ba.id = wp.bank_account_id
      LEFT JOIN sites s ON s.id = wp.site_id
      ORDER BY wp.payment_date DESC, wp.id DESC
    `)

    const list = []

    // Add initial advance for any worker with advance_amount > 0 and not already recorded in worker_payments
    const advanceWorkerIds = new Set(
      payments
        .filter((p) => p.payment_type === 'Advance Payment' && p.reference_id === `TXN-WRK-${String(p.worker_id).padStart(4, '0')}`)
        .map((p) => p.worker_id)
    )
    for (const w of workers) {
      const adv = Number(w.advance_amount || 0)
      if (adv > 0 && !advanceWorkerIds.has(w.id)) {
        const totalAmount = Number(w.wages_earned || w.daily_rate || 0)
        const totalPaid = Number(w.total_paid || 0)
        const pending = Math.max(0, totalAmount - totalPaid)
        list.push({
          id: `init-adv-${w.id}`,
          isInitialAdvance: true,
          workerId: w.id,
          workerName: w.name,
          workerPhone: w.phone,
          trade: w.trade,
          siteId: w.site_id,
          siteName: w.site_name || '',
          date: fmtDateOnly(w.joining_date || w.created_at),
          paymentDate: fmtDateOnly(w.joining_date || w.created_at),
          rawDate: w.joining_date || w.created_at,
          amount: adv,
          advance: adv,
          totalAmount,
          totalPaid,
          pending,
          type: 'Paid',
          paymentType: 'Advance Payment',
          method: w.bank_account_id ? 'Bank Transfer' : 'Cash',
          paymentMethod: w.bank_account_id ? 'Bank Transfer' : 'Cash',
          bankAccountId: w.bank_account_id,
          bankName: w.bank_name || 'Bank Account',
          remarks: w.remarks || 'Advance payment',
          remark: w.remarks || 'Advance payment',
          referenceId: `TXN-WRK-${String(w.id).padStart(4, '0')}`,
          createdBy: 'Admin',
          createdAt: fmtDate(w.created_at),
        })
      }
    }

    // Add all records from worker_payments
    for (const p of payments) {
      const w = workerMap[p.worker_id]
      const totalAmount = Number(w?.wages_earned || w?.daily_rate || 0)
      const totalPaid = Number(w?.total_paid || 0)
      const pending = Math.max(0, totalAmount - totalPaid)
      list.push({
        id: p.id,
        isInitialAdvance: false,
        workerId: p.worker_id,
        workerName: w ? w.name : 'Unknown Worker',
        workerPhone: w ? w.phone : '',
        trade: w ? w.trade : '',
        siteId: p.site_id || w?.site_id,
        siteName: p.site_name || w?.site_name || '',
        date: fmtDateOnly(p.payment_date),
        paymentDate: fmtDateOnly(p.payment_date),
        rawDate: p.payment_date,
        amount: Number(p.amount),
        advance: Number(p.amount),
        totalAmount,
        totalPaid,
        pending,
        type: 'Paid',
        paymentType: p.payment_type || 'Wage Payment',
        method: p.payment_method || 'Bank Transfer',
        paymentMethod: p.payment_method || 'Bank Transfer',
        bankAccountId: p.bank_account_id,
        bankName: p.bank_name || 'Bank Account',
        remarks: p.remarks || '',
        remark: p.remarks || '',
        referenceId: p.reference_id || `TXN-WRK-PAY-${p.id}`,
        createdBy: p.created_by,
        createdAt: fmtDate(p.created_at),
      })
    }

    // Calculate per-worker running cumulative and pending after each payment
    const paymentsByWorker = {}
    for (const item of list) {
      if (!paymentsByWorker[item.workerId]) paymentsByWorker[item.workerId] = []
      paymentsByWorker[item.workerId].push(item)
    }

    for (const wId of Object.keys(paymentsByWorker)) {
      const wList = paymentsByWorker[wId]
      wList.sort((a, b) => {
        const da = new Date(a.rawDate || a.paymentDate || 0).getTime()
        const db = new Date(b.rawDate || b.paymentDate || 0).getTime()
        if (da !== db) return da - db
        if (a.isInitialAdvance) return -1
        if (b.isInitialAdvance) return 1
        const ca = new Date(a.createdAt || 0).getTime()
        const cb = new Date(b.createdAt || 0).getTime()
        if (ca !== cb) return ca - cb
        return (Number(a.id) || 0) - (Number(b.id) || 0)
      })

      const totalAmt = Number(wList[0]?.totalAmount || 0)
      let cum = 0
      for (const item of wList) {
        cum += Number(item.amount || 0)
        item.cumulativePaid = cum
        item.pendingAfter = Math.max(0, totalAmt - cum)
        item.pending = item.pendingAfter
      }
    }

    list.sort((a, b) => {
      const da = new Date(a.rawDate || a.paymentDate || 0).getTime()
      const db = new Date(b.rawDate || b.paymentDate || 0).getTime()
      if (da !== db) return db - da
      if (a.isInitialAdvance) return 1
      if (b.isInitialAdvance) return -1
      const ca = new Date(a.createdAt || 0).getTime()
      const cb = new Date(b.createdAt || 0).getTime()
      if (ca !== cb) return cb - ca
      return (Number(b.id) || 0) - (Number(a.id) || 0)
    })
    return list
  },

  // Update a payment and adjust bank deduction accordingly
  async updatePayment(id, { amount, paymentDate, paymentType, bankAccountId, remarks }) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      if (typeof id === 'string' && id.startsWith('init-adv-')) {
        const workerId = Number(id.replace('init-adv-', ''))
        const [[worker]] = await conn.query(
          'SELECT id, advance_amount, bank_account_id, total_paid FROM labours WHERE id = ? FOR UPDATE',
          [workerId],
        )
        if (!worker) throw new Error('Worker record not found.')
        const oldAmount = Number(worker.advance_amount || 0)
        const oldBankId = worker.bank_account_id
        const newAmount = amount !== undefined ? Number(amount) : oldAmount
        const newBankId = bankAccountId ? Number(bankAccountId) : oldBankId
        const newDate = paymentDate ? new Date(paymentDate).toISOString().slice(0, 10) : undefined

        if (isNaN(newAmount) || newAmount <= 0) {
          throw new Error('Payment amount must be greater than zero.')
        }

        // Adjust bank balances
        if (oldBankId === newBankId) {
          const diff = newAmount - oldAmount
          if (diff !== 0 && newBankId) {
            const [[bank]] = await conn.query('SELECT balance, bank_name FROM bank_accounts WHERE id = ? FOR UPDATE', [newBankId])
            if (!bank) throw new Error('Bank account not found.')
            if (diff > 0 && Number(bank.balance) < diff) {
              throw new Error(`Insufficient balance in ${bank.bank_name}.`)
            }
            await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [diff, newBankId])
          }
        } else {
          if (oldBankId && oldAmount > 0) {
            await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [oldAmount, oldBankId])
          }
          if (newBankId) {
            const [[newBank]] = await conn.query('SELECT balance, bank_name FROM bank_accounts WHERE id = ? FOR UPDATE', [newBankId])
            if (!newBank) throw new Error('New bank account not found.')
            if (Number(newBank.balance) < newAmount) {
              throw new Error(`Insufficient balance in ${newBank.bank_name}.`)
            }
            await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [newAmount, newBankId])
          }
        }

        // Recalculate total_paid
        const [[paySum]] = await conn.query(
          'SELECT COALESCE(SUM(amount), 0) AS total_extra FROM worker_payments WHERE worker_id = ?',
          [workerId],
        )
        const newTotalPaid = newAmount + Number(paySum?.total_extra || 0)

        const updates = ['advance_amount = ?', 'bank_account_id = ?', 'total_paid = ?']
        const params = [newAmount, newBankId || null, newTotalPaid]
        if (newDate) {
          updates.push('joining_date = ?')
          params.push(newDate)
        }
        if (remarks !== undefined) {
          updates.push('remarks = ?')
          params.push(remarks)
        }
        params.push(workerId)
        await conn.query(`UPDATE labours SET ${updates.join(', ')} WHERE id = ?`, params)

        // Keep linked worker_payments record in sync if one exists for this initial advance
        const [[linkedPayment]] = await conn.query(
          `SELECT id FROM worker_payments 
           WHERE worker_id = ? AND payment_type = 'Advance Payment' 
             AND (reference_id = CONCAT('TXN-WRK-', LPAD(worker_id, 4, '0')) OR reference_id = CONCAT('TXN-WRK-', worker_id))
           LIMIT 1`,
          [workerId]
        )
        if (linkedPayment) {
          await conn.query(
            `UPDATE worker_payments
             SET bank_account_id = ?, amount = ?, payment_date = COALESCE(?, payment_date), remarks = COALESCE(?, remarks), updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [newBankId || null, newAmount, newDate || null, remarks !== undefined ? remarks : null, linkedPayment.id]
          )
        }

        await conn.commit()
        return { id, amount: newAmount, paymentDate: newDate, bankAccountId: newBankId }
      }

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
        `SELECT
          COALESCE(SUM(amount), 0) AS total_extra,
          COALESCE(SUM(CASE WHEN payment_type = 'Advance Payment' AND (reference_id = CONCAT('TXN-WRK-', LPAD(worker_id, 4, '0')) OR reference_id = CONCAT('TXN-WRK-', worker_id)) THEN amount ELSE 0 END), 0) AS initial_in_payments
         FROM worker_payments WHERE worker_id = ?`,
        [existing.worker_id],
      )
      const initialAdvance = Number(worker?.advance_amount || 0)
      const initialInPayments = Number(paySum?.initial_in_payments || 0)
      const effectiveInitial = initialInPayments > 0 ? 0 : initialAdvance
      const newTotalPaid = effectiveInitial + Number(paySum?.total_extra || 0)
      await conn.query('UPDATE labours SET total_paid = ? WHERE id = ?', [newTotalPaid, existing.worker_id])

      // If this was an advance payment linked to labour's initial advance, sync labours.advance_amount
      if (existing.payment_type === 'Advance Payment' && (existing.reference_id === `TXN-WRK-${String(existing.worker_id).padStart(4, '0')}` || existing.reference_id === `TXN-WRK-${existing.worker_id}`)) {
        await conn.query('UPDATE labours SET advance_amount = ?, bank_account_id = ? WHERE id = ?', [newAmount, newBankId || null, existing.worker_id])
      }

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

      if (typeof id === 'string' && id.startsWith('init-adv-')) {
        const workerId = Number(id.replace('init-adv-', ''))
        const [[worker]] = await conn.query(
          'SELECT id, advance_amount, bank_account_id, total_paid FROM labours WHERE id = ? FOR UPDATE',
          [workerId],
        )
        if (!worker) throw new Error('Worker record not found.')
        const numAmount = Number(worker.advance_amount || 0)
        if (worker.bank_account_id && numAmount > 0) {
          await conn.query(
            'UPDATE bank_accounts SET balance = balance + ? WHERE id = ?',
            [numAmount, worker.bank_account_id],
          )
        }
        const newTotalPaid = Math.max(0, Number(worker.total_paid || 0) - numAmount)
        await conn.query(
          'UPDATE labours SET advance_amount = 0, total_paid = ? WHERE id = ?',
          [newTotalPaid, workerId],
        )
        await conn.commit()
        return { id, reversedAmount: numAmount, workerId }
      }

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
        `SELECT
          COALESCE(SUM(amount), 0) AS total_extra,
          COALESCE(SUM(CASE WHEN payment_type = 'Advance Payment' AND (reference_id = CONCAT('TXN-WRK-', LPAD(worker_id, 4, '0')) OR reference_id = CONCAT('TXN-WRK-', worker_id)) THEN amount ELSE 0 END), 0) AS initial_in_payments
         FROM worker_payments WHERE worker_id = ?`,
        [payment.worker_id],
      )
      const initialAdvance = Number(worker?.advance_amount || 0)
      const initialInPayments = Number(paySum?.initial_in_payments || 0)
      const effectiveInitial = initialInPayments > 0 ? 0 : initialAdvance
      const newTotalPaid = effectiveInitial + Number(paySum?.total_extra || 0)

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

