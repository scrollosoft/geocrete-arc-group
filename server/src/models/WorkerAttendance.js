import { getPool } from '../config/db.js'
import { fmtDate, fmtDateOnly } from './helpers.js'

export const WorkerAttendance = {
  // Mark or update daily attendance for a site
  async recordAttendance({ siteId, attendanceDate, records = [], markedBy = 'Admin' }) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const formattedDate = new Date(attendanceDate).toISOString().slice(0, 10)
      const results = []

      for (const rec of records) {
        const workerId = Number(rec.workerId || rec.id)
        const status = rec.status // 'Present', 'Half Day', 'Absent', 'Leave'
        if (!workerId || !status) continue

        // Validate worker exists and is active
        const [[worker]] = await conn.query(
          'SELECT id, name, daily_rate, joining_date, status, site_id FROM labours WHERE id = ?',
          [workerId],
        )
        if (!worker || worker.status !== 'Active') {
          continue
        }

        // Validate attendance date >= worker's joining date (worker-wise validation)
        const joiningDateStr = worker.joining_date ? new Date(worker.joining_date).toISOString().slice(0, 10) : null
        if (joiningDateStr && formattedDate < joiningDateStr) {
          // Do not save attendance for workers who joined after the selected date
          continue
        }

        // Calculate attendance units and earned wage
        let units = 0.0
        if (status === 'Present') units = 1.0
        else if (status === 'Half Day') units = 0.5
        else if (status === 'Absent' || status === 'Leave') units = 0.0

        const dailyWage = Number(worker.daily_rate || 0)
        const earnedWage = units * dailyWage
        const remarks = (rec.remarks || '').trim()

        // Upsert attendance record for this worker, site, and date
        await conn.query(
          `INSERT INTO worker_attendances
            (worker_id, site_id, attendance_date, status, units, daily_wage, earned_wage, remarks, marked_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            units = VALUES(units),
            daily_wage = VALUES(daily_wage),
            earned_wage = VALUES(earned_wage),
            remarks = VALUES(remarks),
            marked_by = VALUES(marked_by),
            updated_at = CURRENT_TIMESTAMP`,
          [workerId, siteId, formattedDate, status, units, dailyWage, earnedWage, remarks, markedBy],
        )

        // Recalculate worker's total earned wages from all actual attendance records
        const [[sumRow]] = await conn.query(
          'SELECT COALESCE(SUM(earned_wage), 0) AS total_earned FROM worker_attendances WHERE worker_id = ?',
          [workerId],
        )
        const totalWagesEarned = Number(sumRow.total_earned || 0)

        // Update wages_earned in labours table
        await conn.query(
          'UPDATE labours SET wages_earned = ? WHERE id = ?',
          [totalWagesEarned, workerId],
        )

        results.push({
          workerId,
          workerName: worker.name,
          date: formattedDate,
          status,
          units,
          earnedWage,
          totalWagesEarned,
        })
      }

      await conn.commit()
      return results
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },

  // Get daily attendance for a specific site and date
  async getByDateAndSite(siteId, date) {
    const formattedDate = new Date(date).toISOString().slice(0, 10)
    const pool = getPool()

    // 1. Fetch active workers assigned to this site whose joining_date <= formattedDate
    const [workers] = await pool.query(
      `SELECT l.id, l.name, l.phone, l.trade, l.daily_rate, l.joining_date, l.status,
              s.name AS site_name
       FROM labours l
       LEFT JOIN sites s ON s.id = l.site_id
       WHERE l.site_id = ? 
         AND l.status = 'Active'
         AND (l.joining_date IS NULL OR l.joining_date <= ?)
       ORDER BY l.name ASC`,
      [siteId, formattedDate],
    )

    // 2. Fetch existing attendance records for this site and date
    const [attendances] = await pool.query(
      `SELECT wa.id, wa.worker_id, wa.site_id, wa.attendance_date, wa.status,
              wa.units, wa.daily_wage, wa.earned_wage, wa.remarks, wa.marked_by,
              wa.created_at, wa.updated_at
       FROM worker_attendances wa
       WHERE wa.site_id = ? AND wa.attendance_date = ?`,
      [siteId, formattedDate],
    )

    const attMap = new Map()
    for (const a of attendances) {
      attMap.set(Number(a.worker_id), a)
    }

    // Merge: Include all assigned workers, showing attendance status or 'Not Marked'
    return workers.map((w) => {
      const att = attMap.get(Number(w.id))
      return {
        workerId: w.id,
        name: w.name,
        phone: w.phone,
        trade: w.trade,
        dailyRate: Number(w.daily_rate),
        joiningDate: fmtDateOnly(w.joining_date),
        siteName: w.site_name,
        attendanceId: att ? att.id : null,
        status: att ? att.status : 'Pending', // 'Present', 'Half Day', 'Absent', 'Leave', or 'Pending' (Not Marked)
        units: att ? Number(att.units) : 0,
        earnedWage: att ? Number(att.earned_wage) : 0,
        remarks: att ? att.remarks || '' : '',
        markedBy: att ? att.marked_by : null,
        markedAt: att ? fmtDate(att.updated_at || att.created_at) : null,
        isMarked: Boolean(att),
      }
    })
  },

  // Get monthly attendance summary for all workers or a specific worker
  async getMonthlySummary({ siteId, month, year, workerId }) {
    const pool = getPool()

    const m = month ? Number(month) : new Date().getMonth() + 1
    const y = year ? Number(year) : new Date().getFullYear()

    let where = 'WHERE 1=1'
    const params = []

    if (siteId && siteId !== 'all' && siteId !== 'All Sites') {
      where += ' AND l.site_id = ?'
      params.push(siteId)
    }

    if (workerId && workerId !== 'all') {
      where += ' AND l.id = ?'
      params.push(workerId)
    }

    // Fetch matching workers
    const [workers] = await pool.query(
      `SELECT l.id, l.name, l.phone, l.trade, l.daily_rate, l.joining_date,
              l.advance_amount, l.total_paid, l.wages_earned, l.status,
              l.site_id, s.name AS site_name
       FROM labours l
       LEFT JOIN sites s ON s.id = l.site_id
       ${where}
       ORDER BY l.name ASC`,
      params,
    )

    // Calculate days in the selected month
    const totalDaysInMonth = new Date(y, m, 0).getDate()
    const now = new Date()
    const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m
    const daysUpToNow = isCurrentMonth ? now.getDate() : totalDaysInMonth

    const workerSummaries = []

    for (const w of workers) {
      // 1. Fetch attendance records for this worker in this month & year
      const [attRows] = await pool.query(
        `SELECT status, units, daily_wage, earned_wage, attendance_date
         FROM worker_attendances
         WHERE worker_id = ? AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`,
        [w.id, m, y],
      )

      let presentDays = 0
      let halfDays = 0
      let absentDays = 0
      let leaveDays = 0
      let totalUnits = 0.0
      let monthlyEarnedWages = 0.0

      for (const a of attRows) {
        if (a.status === 'Present') presentDays++
        else if (a.status === 'Half Day') halfDays++
        else if (a.status === 'Absent') absentDays++
        else if (a.status === 'Leave') leaveDays++

        totalUnits += Number(a.units || 0)
        monthlyEarnedWages += Number(a.earned_wage || 0)
      }

      const markedDays = presentDays + halfDays + absentDays + leaveDays
      const pendingDays = Math.max(0, daysUpToNow - markedDays)

      // 2. Fetch lifetime earned wages (from all attendance records)
      const [[lifetimeAttRow]] = await pool.query(
        'SELECT COALESCE(SUM(earned_wage), 0) AS total_earned FROM worker_attendances WHERE worker_id = ?',
        [w.id],
      )
      // If there are attendance records, use sum of earned_wage; otherwise preserve existing w.wages_earned
      const lifetimeAttendanceEarned = Number(lifetimeAttRow.total_earned || 0)
      const totalEarnedWages = lifetimeAttendanceEarned > 0 ? lifetimeAttendanceEarned : Number(w.wages_earned || 0)

      // 3. Fetch all payments made to this worker from worker_payments
      const [paymentRows] = await pool.query(
        'SELECT id, amount, payment_type, payment_date FROM worker_payments WHERE worker_id = ?',
        [w.id],
      )

      const initialAdvance = Number(w.advance_amount || 0)
      let additionalAdvance = 0.0
      let otherWagePayments = 0.0

      for (const p of paymentRows) {
        const amt = Number(p.amount || 0)
        if (p.payment_type === 'Advance Payment') {
          additionalAdvance += amt
        } else {
          otherWagePayments += amt
        }
      }

      const totalAdvancePaid = initialAdvance + additionalAdvance
      const totalOtherPayments = otherWagePayments
      const totalPaid = totalAdvancePaid + totalOtherPayments

      // 4. Calculate Outstanding and Advance Credit
      // Formula: Outstanding = max(0, Total Earned Wages - Total Paid)
      // Advance Credit = max(0, Total Paid - Total Earned Wages)
      const outstanding = Math.max(0, totalEarnedWages - totalPaid)
      const advanceCredit = Math.max(0, totalPaid - totalEarnedWages)

      // 5. Payment Status
      let paymentStatus = 'Pending'
      if (totalEarnedWages > 0) {
        if (outstanding === 0) {
          paymentStatus = 'Fully Paid'
        } else if (totalPaid > 0) {
          paymentStatus = 'Partially Paid'
        } else {
          paymentStatus = 'Pending'
        }
      } else {
        paymentStatus = totalPaid > 0 ? 'Advance Paid' : 'Pending'
      }

      workerSummaries.push({
        workerId: w.id,
        workerName: w.name,
        phone: w.phone,
        trade: w.trade,
        siteId: w.site_id,
        siteName: w.site_name || 'N/A',
        dailyWage: Number(w.daily_rate),
        month: m,
        year: y,
        presentDays,
        halfDays,
        absentDays,
        leaveDays,
        pendingDays,
        attendanceUnits: Number(totalUnits.toFixed(1)),
        monthlyEarnedWages,
        totalEarnedWages,
        advancePaid: totalAdvancePaid,
        otherPayments: totalOtherPayments,
        totalPaid,
        outstanding,
        advanceCredit,
        paymentStatus,
      })
    }

    return workerSummaries
  },

  // Get date-wise attendance list for a specific worker
  async getWorkerAttendanceHistory(workerId) {
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT wa.id, wa.worker_id, wa.site_id, wa.attendance_date, wa.status,
              wa.units, wa.daily_wage, wa.earned_wage, wa.remarks, wa.marked_by,
              wa.created_at, wa.updated_at,
              s.name AS site_name
       FROM worker_attendances wa
       LEFT JOIN sites s ON s.id = wa.site_id
       WHERE wa.worker_id = ?
       ORDER BY wa.attendance_date DESC, wa.id DESC`,
      [workerId],
    )

    return rows.map((r) => ({
      id: r.id,
      workerId: r.worker_id,
      siteId: r.site_id,
      siteName: r.site_name || 'N/A',
      attendanceDate: fmtDateOnly(r.attendance_date),
      status: r.status,
      units: Number(r.units),
      dailyWage: Number(r.daily_wage),
      earnedWage: Number(r.earned_wage),
      remarks: r.remarks || '',
      markedBy: r.marked_by,
      markedAt: fmtDate(r.updated_at || r.created_at),
    }))
  },

  // Update a single attendance record
  async updateAttendance(id, { status, remarks, markedBy = 'Admin' }) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [[existing]] = await conn.query('SELECT * FROM worker_attendances WHERE id = ?', [id])
      if (!existing) {
        throw new Error('Attendance record not found.')
      }

      let units = 0.0
      if (status === 'Present') units = 1.0
      else if (status === 'Half Day') units = 0.5
      else if (status === 'Absent' || status === 'Leave') units = 0.0

      const dailyWage = Number(existing.daily_wage || 0)
      const earnedWage = units * dailyWage

      await conn.query(
        `UPDATE worker_attendances
         SET status = ?, units = ?, earned_wage = ?, remarks = ?, marked_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, units, earnedWage, (remarks || '').trim(), markedBy, id],
      )

      // Recalculate worker's total wages_earned in labours
      const [[sumRow]] = await conn.query(
        'SELECT COALESCE(SUM(earned_wage), 0) AS total_earned FROM worker_attendances WHERE worker_id = ?',
        [existing.worker_id],
      )
      await conn.query('UPDATE labours SET wages_earned = ? WHERE id = ?', [
        Number(sumRow.total_earned || 0),
        existing.worker_id,
      ])

      await conn.commit()
      return { id, status, units, earnedWage, remarks }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },

  // Delete an attendance record
  async deleteAttendance(id) {
    const pool = getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const [[existing]] = await conn.query('SELECT * FROM worker_attendances WHERE id = ?', [id])
      if (!existing) {
        throw new Error('Attendance record not found.')
      }

      await conn.query('DELETE FROM worker_attendances WHERE id = ?', [id])

      // Recalculate worker's total wages_earned in labours
      const [[sumRow]] = await conn.query(
        'SELECT COALESCE(SUM(earned_wage), 0) AS total_earned FROM worker_attendances WHERE worker_id = ?',
        [existing.worker_id],
      )
      await conn.query('UPDATE labours SET wages_earned = ? WHERE id = ?', [
        Number(sumRow.total_earned || 0),
        existing.worker_id,
      ])

      await conn.commit()
      return existing
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },
}

