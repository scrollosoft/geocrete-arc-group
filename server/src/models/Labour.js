import { getPool } from '../config/db.js'
import { fmtDate, fmtDateOnly } from './helpers.js'

const toApi = (row) => {
  if (!row) return null
  const wagesEarned = Number(row.wages_earned)
  const totalPaid   = Number(row.total_paid)

  // Build the site sub-object
  let site = null
  if (row.site_id) {
    site = row.site_name
      ? { _id: String(row.site_id), id: String(row.site_id), name: row.site_name, location: row.site_location || '' }
      : String(row.site_id)
  }

  return {
    _id:         String(row.id),
    id:          String(row.id),
    name:        row.name,
    phone:       row.phone,
    trade:       row.trade,
    site,
    dailyRate:   Number(row.daily_rate),
    wagesEarned,
    totalPaid,
    outstanding: Math.max(0, wagesEarned - totalPaid),
    joiningDate: fmtDateOnly(row.joining_date),
    paymentType: row.payment_type,
    address:     row.address || '',
    remarks:     row.remarks || '',
    status:      row.status,
    createdAt:   fmtDate(row.created_at),
    updatedAt:   fmtDate(row.updated_at),
  }
}

const POPULATE_SELECT = `l.*, s.name AS site_name, s.location AS site_location`
const POPULATE_JOIN   = `FROM labours l LEFT JOIN sites s ON s.id = l.site_id`

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

  async findById(id) {
    const [rows] = await getPool().query(
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

  async create(data) {
    const [result] = await getPool().query(
      `INSERT INTO labours
        (name, phone, trade, site_id, daily_rate, wages_earned, total_paid,
         joining_date, payment_type, address, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.phone || '+91234567892',
        data.trade || 'Mason',
        data.site || data.siteId || null,
        Number(data.dailyRate) || 1000,
        Number(data.wagesEarned) || 0,
        Number(data.totalPaid)   || 0,
        data.joiningDate ? new Date(data.joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        data.paymentType || 'Daily',
        data.address || '',
        data.remarks || '',
        data.status || 'Active',
      ],
    )
    return this.findById(result.insertId)
  },

  async update(id, data) {
    const existing = await this.findById(id)
    if (!existing) return null

    const colMap = {
      name:        'name',
      phone:       'phone',
      trade:       'trade',
      site:        'site_id',
      dailyRate:   'daily_rate',
      wagesEarned: 'wages_earned',
      totalPaid:   'total_paid',
      joiningDate: 'joining_date',
      paymentType: 'payment_type',
      address:     'address',
      remarks:     'remarks',
      status:      'status',
    }

    const sets = []
    const params = []
    for (const [apiKey, col] of Object.entries(colMap)) {
      if (data[apiKey] !== undefined) {
        sets.push(`${col} = ?`)
        let val = data[apiKey]
        if (['dailyRate','wagesEarned','totalPaid'].includes(apiKey)) val = Number(val)
        if (apiKey === 'joiningDate') val = val ? new Date(val).toISOString().slice(0, 10) : null
        if (apiKey === 'site' && !val) val = null
        params.push(val)
      }
    }

    if (sets.length === 0) return existing
    params.push(id)
    await getPool().query(`UPDATE labours SET ${sets.join(', ')} WHERE id = ?`, params)
    return this.findById(id)
  },

  async delete(id) {
    const existing = await this.findById(id)
    if (!existing) return null
    await getPool().query('DELETE FROM labours WHERE id = ?', [id])
    return existing
  },

  async sumAll() {
    const [rows] = await getPool().query(
      `SELECT
         COUNT(*)                        AS total_workers,
         COALESCE(SUM(wages_earned), 0)  AS wages_earned,
         COALESCE(SUM(total_paid), 0)    AS total_paid
       FROM labours`,
    )
    const wagesEarned = Number(rows[0].wages_earned)
    const totalPaid   = Number(rows[0].total_paid)
    return {
      totalWorkers: Number(rows[0].total_workers),
      wagesEarned,
      totalPaid,
      outstanding: Math.max(0, wagesEarned - totalPaid),
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
