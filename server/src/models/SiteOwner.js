import { getPool } from '../config/db.js'
import { withId, fmtDate } from './helpers.js'

// Map a site row directly from the sites database table into the API shape
const toApiFromSite = (row) => {
  if (!row) return null
  const id = String(row.site_id || row.id)
  const budget = Number(row.total_budget || 0)
  const advance = Number(row.advance_amount || 0)
  const received = Number(row.total_received || 0)
  const receivable = Math.max(0, budget - received)

  return {
    _id: id,
    id,
    name:          row.site_owner || '',
    phone:         row.contact_number || '',
    email:         row.email || '',
    address:       row.address || '',
    siteId:        id,
    siteName:      row.name || row.site_name || '',
    projectValue:  budget,
    advanceAmount: advance,
    totalReceived: received,
    receivable:    receivable,
    status:        row.status || 'Active',
    notes:         row.description || '',
    isActive:      true,
    createdAt:     fmtDate(row.created_at),
  }
}

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
    // Read directly from the sites database table
    let sql = `
      SELECT
        s.id          AS site_id,
        s.id          AS id,
        s.name        AS site_name,
        s.name,
        s.site_owner,
        s.contact_number,
        s.email,
        s.address,
        s.total_budget,
        s.advance_amount,
        s.total_received,
        s.status,
        s.description,
        s.created_at
      FROM sites s
    `
    const params = []
    if (search) {
      sql += ` WHERE (
        LOWER(s.name) LIKE ? OR
        LOWER(s.site_owner) LIKE ? OR
        s.contact_number LIKE ? OR
        s.email LIKE ?
      )`
      const like = `%${search.toLowerCase()}%`
      params.push(like, like, like, like)
    }
    sql += ' ORDER BY s.id DESC'
    const [rows] = await getPool().query(sql, params)
    return rows.map(toApiFromSite)
  },

  async getSummary() {
    const pool = getPool()
    const [[countRow]] = await pool.query('SELECT COUNT(*) AS cnt FROM sites')
    const [[sumRow]] = await pool.query(`
      SELECT
        COALESCE(SUM(total_budget), 0) AS total_project,
        COALESCE(SUM(total_received), 0) AS total_received,
        COALESCE(SUM(GREATEST(total_budget - total_received, 0)), 0) AS balance
      FROM sites
    `)
    return {
      count:         Number(countRow.cnt),
      totalProject:  Number(sumRow.total_project),
      totalReceived: Number(sumRow.total_received),
      balance:       Number(sumRow.balance),
    }
  },

  async findById(id) {
    const cleanId = String(id).replace(/^site-/, '')
    const [rows] = await getPool().query(`
      SELECT
        s.id AS site_id,
        s.id,
        s.name AS site_name,
        s.name,
        s.site_owner,
        s.contact_number,
        s.email,
        s.address,
        s.total_budget,
        s.advance_amount,
        s.total_received,
        s.status,
        s.description,
        s.created_at
      FROM sites s
      WHERE s.id = ?
    `, [cleanId])
    if (rows.length > 0) {
      return toApiFromSite(rows[0])
    }
    const [soRows] = await getPool().query(`
      SELECT so.*, s.name AS site_name,
        GREATEST(so.project_value - so.total_received, 0) AS receivable
      FROM site_owners so
      LEFT JOIN sites s ON s.id = so.site_id
      WHERE so.id = ?
    `, [id])
    return toApi(soRows[0] || null)
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
    const cleanId = String(clientId).replace(/^site-/, '')
    const [rows] = await pool.query(
      `SELECT * FROM client_payments WHERE client_id = ? OR site_id = ? ORDER BY payment_date DESC, id DESC`,
      [clientId, cleanId]
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
