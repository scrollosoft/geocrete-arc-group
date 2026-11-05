import { getPool } from '../config/db.js'
import { fmtDate, fmtDateOnly } from './helpers.js'

const toApi = (row) => {
  if (!row) return null

  const dailyRate = Number(row.daily_rate || 0)
  const attendanceUnits = Number(row.attendance_units || 0)
  const attendanceEarned = Number(row.attendance_earned || 0)
  const recordWagesEarned = Number(row.wages_earned || 0)

  // Total Earned Wages = Attendance Units * Daily Wage (or record wages if attendance not yet marked)
  const wagesEarned = attendanceEarned > 0 ? attendanceEarned : recordWagesEarned

  const initialAdvance = Number(row.advance_amount || 0)
  const extraAdvances = Number(row.extra_advances || 0)
  const advancePaid = initialAdvance + extraAdvances
  const otherPayments = Number(row.other_payments || 0)

  // Total Paid = Existing Advance Payments + Additional Worker Payments + Other Wage Payments
  const totalPaid = Math.max(
    advancePaid + otherPayments,
    Number(row.total_paid || 0)
  )

  // Outstanding Amount = max(0, Total Earned Wages - Total Paid)
  const outstanding = Math.max(0, wagesEarned - totalPaid)

  // Advance Credit = max(0, Total Paid - Total Earned Wages)
  const advanceCredit = Math.max(0, totalPaid - wagesEarned)

  // Payment Status: Pending / Partially Paid / Fully Paid
  let paymentStatus = 'Pending'
  if (wagesEarned > 0) {
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

  // Build the site sub-object
  let site = null
  if (row.site_id) {
    site = row.site_name
      ? { _id: String(row.site_id), id: String(row.site_id), name: row.site_name, location: row.site_location || '' }
      : String(row.site_id)
  }

  return {
    _id:             String(row.id),
    id:              String(row.id),
    name:            row.name,
    phone:           row.phone,
    trade:           row.trade,
    site,
    siteName:        row.site_name || '',
    dailyRate,
    presentDays:     Number(row.present_days || 0),
    halfDays:        Number(row.half_days || 0),
    absentDays:      Number(row.absent_days || 0),
    leaveDays:       Number(row.leave_days || 0),
    attendanceUnits,
    wagesEarned,
    advancePaid,
    otherPayments,
    totalPaid,
    advanceAmount:   initialAdvance,
    outstanding,
    advanceCredit,
    paymentStatus,
    bankAccountId:   row.bank_account_id ? Number(row.bank_account_id) : null,
    bankName:        row.bank_name || null,
    joiningDate:     fmtDateOnly(row.joining_date),
    paymentType:     row.payment_type,
    address:         row.address || '',
    remarks:         row.remarks || '',
    status:          row.status,
    createdAt:       fmtDate(row.created_at),
    updatedAt:       fmtDate(row.updated_at),
  }
}

const POPULATE_SELECT = `
  l.*,
  s.name AS site_name,
  s.location AS site_location,
  b.bank_name AS bank_name,
  COALESCE(att.present_days, 0) AS present_days,
  COALESCE(att.half_days, 0) AS half_days,
  COALESCE(att.absent_days, 0) AS absent_days,
  COALESCE(att.leave_days, 0) AS leave_days,
  COALESCE(att.total_units, 0) AS attendance_units,
  COALESCE(att.total_earned, 0) AS attendance_earned,
  COALESCE(pay.extra_advances, 0) AS extra_advances,
  COALESCE(pay.other_payments, 0) AS other_payments
`

const POPULATE_JOIN = `
  FROM labours l
  LEFT JOIN sites s ON s.id = l.site_id
  LEFT JOIN bank_accounts b ON b.id = l.bank_account_id
  LEFT JOIN (
    SELECT 
      worker_id,
      SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present_days,
      SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) AS half_days,
      SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) AS absent_days,
      SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) AS leave_days,
      SUM(units) AS total_units,
      SUM(earned_wage) AS total_earned
    FROM worker_attendances
    GROUP BY worker_id
  ) att ON att.worker_id = l.id
  LEFT JOIN (
    SELECT
      worker_id,
      SUM(CASE WHEN payment_type = 'Advance Payment' THEN amount ELSE 0 END) AS extra_advances,
      SUM(CASE WHEN payment_type != 'Advance Payment' THEN amount ELSE 0 END) AS other_payments
    FROM worker_payments
    GROUP BY worker_id
  ) pay ON pay.worker_id = l.id
`

export const Labour = {
  async find({ search, siteId, trade } = {}) {
    let where = 'WHERE 1=1'
    const params = []

    if (search) {
      where += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.trade LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    if (siteId && siteId !== 'all') {
      where += ' AND l.site_id = ?'
      params.push(siteId)
    }

    if (trade && trade !== 'all') {
      where += ' AND l.trade = ?'
      params.push(trade)
    }

    const [rows] = await getPool().query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} ${where} ORDER BY l.created_at DESC`,
      params,
    )
    return rows.map(toApi)
  },

  async findById(id, externalConn = null) {
    const conn = externalConn || getPool()
    const [rows] = await conn.query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} WHERE l.id = ?`,
      [id],
    )
    return toApi(rows[0] || null)
  },

  async findAll() {
    const [rows] = await getPool().query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} ORDER BY l.created_at DESC`,
    )
    return rows.map(toApi)
  },

  async create(data, externalConn = null) {
    const conn = externalConn || getPool()
    const advance = Number(data.advanceAmount) || 0
    const totalPaid = data.totalPaid !== undefined ? Number(data.totalPaid) : advance
    const [result] = await conn.query(
      `INSERT INTO labours
        (name, phone, trade, site_id, daily_rate, wages_earned, total_paid,
         advance_amount, bank_account_id,
         joining_date, payment_type, address, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.phone || '',
        data.trade || '',
        data.site || data.siteId || null,
        Number(data.dailyRate) || 0,
        Number(data.wagesEarned) || 0,
        totalPaid,
        advance,
        data.bankAccountId ? Number(data.bankAccountId) : null,
        data.joiningDate ? new Date(data.joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        data.paymentType || 'Daily',
        data.address || '',
        data.remarks || '',
        data.status || 'Active',
      ],
    )
    return this.findById(result.insertId, conn)
  },

  async update(id, data, externalConn = null) {
    const conn = externalConn || getPool()
    const existing = await this.findById(id, conn)
    if (!existing) return null

    const colMap = {
      name:          'name',
      phone:         'phone',
      trade:         'trade',
      site:          'site_id',
      dailyRate:     'daily_rate',
      wagesEarned:   'wages_earned',
      totalPaid:     'total_paid',
      advanceAmount: 'advance_amount',
      bankAccountId: 'bank_account_id',
      joiningDate:   'joining_date',
      paymentType:   'payment_type',
      address:       'address',
      remarks:       'remarks',
      status:        'status',
    }

    const sets = []
    const params = []
    for (const [apiKey, col] of Object.entries(colMap)) {
      if (data[apiKey] !== undefined) {
        sets.push(`${col} = ?`)
        let val = data[apiKey]
        if (['dailyRate','wagesEarned','totalPaid','advanceAmount'].includes(apiKey)) val = Number(val)
        if (apiKey === 'joiningDate') val = val ? new Date(val).toISOString().slice(0, 10) : null
        if (['site','bankAccountId'].includes(apiKey) && !val) val = null
        params.push(val)
      }
    }

    if (sets.length === 0) return existing
    params.push(id)
    await conn.query(`UPDATE labours SET ${sets.join(', ')} WHERE id = ?`, params)
    return this.findById(id, conn)
  },

  async delete(id) {
    const existing = await this.findById(id)
    if (!existing) return null
    await getPool().query('DELETE FROM labours WHERE id = ?', [id])
    return existing
  },

  async sumAll() {
    const workers = await this.findAll()
    const totalWorkers = workers.length
    const wagesEarned = workers.reduce((acc, w) => acc + (w.wagesEarned || 0), 0)
    const totalPaid = workers.reduce((acc, w) => acc + (w.totalPaid || 0), 0)
    const outstanding = workers.reduce((acc, w) => acc + (w.outstanding || 0), 0)
    const advanceCredit = workers.reduce((acc, w) => acc + (w.advanceCredit || 0), 0)
    return {
      totalWorkers,
      wagesEarned,
      totalPaid,
      outstanding,
      advanceCredit,
    }
  },

  async count() {
    const [rows] = await getPool().query('SELECT COUNT(*) AS cnt FROM labours')
    return rows[0].cnt
  },

  async deleteAll() {
    await getPool().query('DELETE FROM labours')
  },

  async insertMany(records) {
    const inserted = []
    for (const r of records) {
      inserted.push(await this.create(r))
    }
    return inserted
  },
}
