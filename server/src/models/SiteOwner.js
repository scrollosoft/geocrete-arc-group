import { getPool } from '../config/db.js'
import { withId, fmtDate } from './helpers.js'

const toApi = (row) => {
  if (!row) return null
  return {
    ...withId(row),
    name:           row.name,
    phone:          row.phone,
    email:          row.email,
    address:        row.address,
    siteId:         row.site_id ? String(row.site_id) : null,
    siteName:       row.site_name || null,
    projectValue:   Number(row.project_value   || 0),
    advanceAmount:  Number(row.advance_amount  || 0),
    totalReceived:  Number(row.total_received  || 0),
    receivable:     Number(row.receivable      || 0),
    status:         row.status || 'On schedule',
    notes:          row.notes || '',
    isActive:       Boolean(row.is_active),
    createdAt:      fmtDate(row.created_at),
    updatedAt:      fmtDate(row.updated_at),
    site_id: undefined, site_name: undefined,
    project_value: undefined, advance_amount: undefined,
    total_received: undefined, is_active: undefined,
    created_at: undefined, updated_at: undefined,
  }
}

export const SiteOwner = {
  async find({ search } = {}) {
    let sql = `
      SELECT so.*, s.name AS site_name,
        GREATEST(so.project_value - so.total_received, 0) AS receivable
      FROM site_owners so
      LEFT JOIN sites s ON s.id = so.site_id
      WHERE so.is_active = 1
    `
    const params = []
    if (search) {
      sql += ' AND (so.name LIKE ? OR s.name LIKE ? OR so.phone LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }
    sql += ' ORDER BY so.created_at DESC'
    const [rows] = await getPool().query(sql, params)
    return rows.map(toApi)
  },

  async getSummary() {
    const pool = getPool()
    const [[countRow]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM site_owners WHERE is_active = 1'
    )
    const [[sumRow]] = await pool.query(`
      SELECT
        COALESCE(SUM(project_value), 0) AS total_project,
        COALESCE(SUM(total_received), 0) AS total_received,
        COALESCE(SUM(GREATEST(project_value - total_received, 0)), 0) AS balance
      FROM site_owners WHERE is_active = 1
    `)
    return {
      count:         Number(countRow.cnt),
      totalProject:  Number(sumRow.total_project),
      totalReceived: Number(sumRow.total_received),
      balance:       Number(sumRow.balance),
    }
  },

  async findById(id) {
    const [rows] = await getPool().query(`
      SELECT so.*, s.name AS site_name,
        GREATEST(so.project_value - so.total_received, 0) AS receivable
      FROM site_owners so
      LEFT JOIN sites s ON s.id = so.site_id
      WHERE so.id = ?
    `, [id])
    return toApi(rows[0] || null)
  },

  async create(data) {
    const pool = getPool()
    const [result] = await pool.query(`
      INSERT INTO site_owners
        (name, phone, email, address, site_id, project_value, advance_amount, total_received, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.name,
      data.phone       || '',
      (data.email      || '').toLowerCase(),
      data.address     || '',
      data.siteId      || null,
      Number(data.projectValue  || 0),
      Number(data.advanceAmount || 0),
      Number(data.totalReceived || 0),
      data.status      || 'On schedule',
      data.notes       || '',
    ])
    return this.findById(result.insertId)
  },

  async update(id, data) {
    const existing = await this.findById(id)
    if (!existing) return null
    const colMap = {
      name: 'name', phone: 'phone', email: 'email', address: 'address',
      siteId: 'site_id', projectValue: 'project_value', advanceAmount: 'advance_amount',
      totalReceived: 'total_received', status: 'status', notes: 'notes', isActive: 'is_active',
    }
    const sets = [], params = []
    for (const [apiKey, col] of Object.entries(colMap)) {
      if (data[apiKey] !== undefined) {
        sets.push(`${col} = ?`)
        let val = data[apiKey]
        if (apiKey === 'isActive') val = val ? 1 : 0
        if (apiKey === 'email') val = (val || '').toLowerCase()
        params.push(val)
      }
    }
    if (sets.length === 0) return existing
    params.push(id)
    await getPool().query(`UPDATE site_owners SET ${sets.join(', ')} WHERE id = ?`, params)
    return this.findById(id)
  },

  async delete(id) {
    const existing = await this.findById(id)
    if (!existing) return null
    await getPool().query('DELETE FROM site_owners WHERE id = ?', [id])
    return existing
  },

  async getPayments(clientId) {
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT * FROM client_payments WHERE client_id = ? ORDER BY payment_date DESC, id DESC`,
      [clientId]
    )
    return rows.map((r) => ({
      ...withId(r),
      clientId: r.client_id,
      siteId: r.site_id,
      amount: Number(r.amount || 0),
      paymentDate: fmtDate(r.payment_date),
      title: r.title,
      paymentMethod: r.payment_method,
      reference: r.reference,
      status: r.status,
      createdAt: fmtDate(r.created_at),
    }))
  },

  async recordPayment(clientId, data) {
    const pool = getPool()
    const amount = Number(data.amount || 0)
    const date = data.paymentDate || new Date().toISOString().slice(0, 10)
    const title = data.title || 'Project milestone payment'
    const method = data.paymentMethod || 'Bank transfer'
    const ref = data.reference || 'Reference verified'
    const siteId = data.siteId || null

    await pool.query(
      `INSERT INTO client_payments (client_id, site_id, amount, payment_date, title, payment_method, reference, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Paid')`,
      [clientId, siteId, amount, date, title, method, ref]
    )

    await pool.query(
      `UPDATE site_owners SET total_received = total_received + ? WHERE id = ?`,
      [amount, clientId]
    )

    return this.findById(clientId)
  },
}
