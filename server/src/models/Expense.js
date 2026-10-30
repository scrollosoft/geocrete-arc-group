import { getPool } from '../config/db.js'
import { withId, fmtDate, fmtDateOnly } from './helpers.js'

/**
 * Convert a raw SQL expense row (with optional JOIN columns for site/supplier)
 * into the API shape the frontend expects.
 * We explicitly pick only the keys we want so JOIN alias columns never leak.
 */
const toApi = (row) => {
  if (!row) return null

  // Build the site sub-object
  let site = null
  if (row.site_id) {
    site = row.site_name
      ? { _id: String(row.site_id), id: String(row.site_id), name: row.site_name, location: row.site_location || '' }
      : String(row.site_id)
  }

  // Build the supplier sub-object
  let supplier = null
  if (row.supplier_id) {
    supplier = row.supplier_name
      ? { _id: String(row.supplier_id), id: String(row.supplier_id), name: row.supplier_name, companyName: row.supplier_company_name || '' }
      : String(row.supplier_id)
  }

  return {
    _id:           String(row.id),
    id:            String(row.id),
    date:          fmtDateOnly(row.date),
    site,
    supplier,
    bankAccountId: row.bank_account_id ? String(row.bank_account_id) : null,
    category:      row.category || 'Material',
    quantity:      Number(row.quantity),
    unit:          row.unit || 'Units',
    ratePerUnit:   Number(row.rate_per_unit),
    amount:        Number(row.amount),
    paidAmount:    Number(row.paid_amount),
    pendingAmount: Number(row.pending_amount),
    paymentMethod: row.payment_method || 'Bank Transfer',
    remark:        row.remark || '',
    status:        row.status,
    paymentStatus: row.status === 'Pending' ? 'Unpaid' : row.status,
    appliedToMaterial: Boolean(row.applied_to_material),
    createdAt:     fmtDate(row.created_at),
    updatedAt:     fmtDate(row.updated_at),
  }
}

const POPULATE_SELECT = `
  e.*,
  s.name        AS site_name,
  s.location    AS site_location,
  sup.name      AS supplier_name,
  sup.company_name AS supplier_company_name
`

const POPULATE_JOIN = `
  FROM expenses e
  LEFT JOIN sites     s   ON s.id   = e.site_id
  LEFT JOIN suppliers sup ON sup.id = e.supplier_id
`

export const Expense = {
  async find({ siteId, category, startDate, endDate, search, limit, skip } = {}) {
    let where = 'WHERE 1=1'
    const params = []

    if (siteId && siteId !== 'all') {
      where += ' AND e.site_id = ?'
      params.push(siteId)
    }

    if (category && category !== 'all') {
      where += ' AND e.category = ?'
      params.push(category)
    }

    if (startDate) {
      where += ' AND e.date >= ?'
      params.push(new Date(startDate).toISOString().slice(0, 10))
    }

    if (endDate) {
      where += ' AND e.date <= ?'
      params.push(new Date(endDate).toISOString().slice(0, 10))
    }

    if (search) {
      where += ' AND (e.category LIKE ? OR e.remark LIKE ?)'
      const like = `%${search}%`
      params.push(like, like)
    }

    const orderSql = ' ORDER BY e.date DESC, e.created_at DESC'

    // count query
    const [countRows] = await getPool().query(
      `SELECT COUNT(*) AS cnt ${POPULATE_JOIN} ${where}`,
      params,
    )
    const totalCount = countRows[0].cnt

    // data query
    let dataSql = `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} ${where} ${orderSql}`
    const dataParams = [...params]
    if (skip)  { dataSql += ' LIMIT 18446744073709551615 OFFSET ?' ; dataParams.push(Number(skip)) }
    if (limit) { dataSql  = `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} ${where} ${orderSql} LIMIT ?` ; dataParams.push(Number(limit)) }
    if (skip && limit) {
      dataSql = `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} ${where} ${orderSql} LIMIT ? OFFSET ?`
      dataParams.splice(params.length) // reset extra params
      dataParams.push(...params, Number(limit), Number(skip))
    }

    const [rows] = await getPool().query(dataSql, dataParams)
    return { expenses: rows.map(toApi), totalCount }
  },

  async findById(id) {
    const [rows] = await getPool().query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} WHERE e.id = ?`,
      [id],
    )
    return toApi(rows[0] || null)
  },

  async findAll() {
    const [rows] = await getPool().query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} ORDER BY e.date DESC, e.created_at DESC`,
    )
    return rows.map(toApi)
  },

  async create(data) {
    const rawStatus = data.paymentStatus || data.status
    let status = data.status || 'Completed'
    if (rawStatus) {
      if (rawStatus === 'Unpaid' || rawStatus === 'Pending') status = 'Pending'
      else if (rawStatus === 'Partial') status = 'Partial'
      else if (rawStatus === 'Paid') status = 'Paid'
      else status = rawStatus
    }

    const [result] = await getPool().query(
      `INSERT INTO expenses
        (date, site_id, supplier_id, bank_account_id, category,
         quantity, unit, rate_per_unit, amount, paid_amount, pending_amount,
         payment_method, remark, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.date ? new Date(data.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        data.site || data.siteId,
        data.supplier || data.supplierId || null,
        data.bankAccountId || data.bankAccount || null,
        data.category || 'Material',
        Number(data.quantity) || 0,
        data.unit || 'Units',
        Number(data.ratePerUnit) || 0,
        Number(data.amount) || 0,
        Number(data.paidAmount) || 0,
        Number(data.pendingAmount) || 0,
        data.paymentMethod || 'Bank Transfer',
        data.remark || '',
        status,
      ],
    )
    return this.findById(result.insertId)
  },

  async update(id, data) {
    const existing = await this.findById(id)
    if (!existing) return null

    const colMap = {
      date:          'date',
      site:          'site_id',
      supplier:      'supplier_id',
      bankAccountId: 'bank_account_id',
      bankAccount:   'bank_account_id',
      category:      'category',
      quantity:      'quantity',
      unit:          'unit',
      ratePerUnit:   'rate_per_unit',
      amount:        'amount',
      paidAmount:    'paid_amount',
      pendingAmount: 'pending_amount',
      paymentMethod: 'payment_method',
      remark:        'remark',
      status:        'status',
      paymentStatus: 'status',
    }

    const sets = []
    const params = []
    for (const [apiKey, col] of Object.entries(colMap)) {
      if (data[apiKey] !== undefined) {
        sets.push(`${col} = ?`)
        let val = data[apiKey]
        if (apiKey === 'date') val = new Date(val).toISOString().slice(0, 10)
        if (['quantity','ratePerUnit','amount','paidAmount','pendingAmount'].includes(apiKey)) val = Number(val)
        if (apiKey === 'supplier' && !val) val = null
        if ((apiKey === 'status' || apiKey === 'paymentStatus') && (val === 'Unpaid' || val === 'Pending')) val = 'Pending'
        params.push(val)
      }
    }

    if (sets.length === 0) return existing
    params.push(id)
    await getPool().query(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, params)
    return this.findById(id)
  },

  async delete(id) {
    const existing = await this.findById(id)
    if (!existing) return null
    await getPool().query('DELETE FROM expenses WHERE id = ?', [id])
    return existing
  },

  async sumAll() {
    const [rows] = await getPool().query(
      `SELECT
         COALESCE(SUM(amount), 0)         AS total_amount,
         COALESCE(SUM(paid_amount), 0)    AS total_paid,
         COALESCE(SUM(pending_amount), 0) AS total_pending
       FROM expenses`,
    )
    return {
      totalExpenseAmount: Number(rows[0].total_amount),
      totalPaidAmount:    Number(rows[0].total_paid),
      totalPendingAmount: Number(rows[0].total_pending),
    }
  },

  async countBySite(siteId) {
    const [rows] = await getPool().query(
      'SELECT COUNT(*) AS cnt FROM expenses WHERE site_id = ?',
      [siteId],
    )
    return rows[0].cnt
  },

  async count() {
    const [rows] = await getPool().query('SELECT COUNT(*) AS cnt FROM expenses')
    return rows[0].cnt
  },

  async deleteAll() {
    await getPool().query('DELETE FROM expenses')
  },

  async insertMany(records) {
    const inserted = []
    for (const r of records) {
      inserted.push(await this.create(r))
    }
    return inserted
  },
}
