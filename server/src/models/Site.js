import { getPool } from '../config/db.js'
import { withId, fmtDate, fmtDateOnly } from './helpers.js'

const toApi = (row) => {
  if (!row) return null
  const totalBudget = Number(row.total_budget || 0)
  const totalSpent  = Number(row.total_spent || 0)
  const advanceAmount = Number(row.advance_amount || 0)
  const totalReceived = Number(
    row.actual_received !== undefined
      ? row.actual_received
      : (row.total_received || 0)
  )
  const balanceReceivable = Math.max(0, totalBudget - totalReceived)

  return {
    ...withId(row),
    name:                    row.name,
    location:                row.location,
    siteOwner:               row.site_owner,
    contactNumber:           row.contact_number || '',
    email:                   row.email || '',
    address:                 row.address || '',
    totalBudget,
    projectValue:            totalBudget,
    totalSpent,
    advanceAmount,
    totalReceived,
    balanceReceivable,
    bankAccountId:           row.bank_account_id ? String(row.bank_account_id) : null,
    status:                  row.status,
    startDate:               fmtDateOnly(row.start_date),
    expectedCompletionDate:  fmtDateOnly(row.expected_completion_date),
    description:             row.description || '',
    budgetAlertCount:        Number(row.budget_alert_count || 1),
    remainingBudget:         Math.max(0, totalBudget - totalSpent),
    budgetUtilization:       totalBudget > 0 ? Number(((totalSpent / totalBudget) * 100).toFixed(1)) : 0,
    createdAt:               fmtDate(row.created_at),
    updatedAt:               fmtDate(row.updated_at),
    // remove raw snake_case
    site_owner: undefined, contact_number: undefined, advance_amount: undefined,
    total_received: undefined, actual_received: undefined, bank_account_id: undefined,
    total_budget: undefined, total_spent: undefined,
    start_date: undefined, expected_completion_date: undefined,
    budget_alert_count: undefined, created_at: undefined, updated_at: undefined,
  }
}

export const Site = {
  async find({ search, status, sort } = {}) {
    let sql = `
      SELECT s.*,
        GREATEST(
          COALESCE((SELECT SUM(amount) FROM client_payments WHERE site_id = s.id), 0),
          COALESCE(s.total_received, 0)
        ) AS actual_received
      FROM sites s
      WHERE 1=1
    `
    const params = []

    if (status && status !== 'all') {
      sql += ' AND s.status = ?'
      params.push(status)
    }

    if (search) {
      sql += ' AND (s.name LIKE ? OR s.location LIKE ? OR s.site_owner LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    const sortMap = {
      oldest: 's.created_at ASC',
      name:   's.name ASC',
      budget: 's.total_budget DESC',
    }
    sql += ` ORDER BY ${sortMap[sort] || 's.created_at DESC'}`

    const [rows] = await getPool().query(sql, params)
    return rows.map(toApi)
  },

  async findById(id) {
    const [rows] = await getPool().query(`
      SELECT s.*,
        GREATEST(
          COALESCE((SELECT SUM(amount) FROM client_payments WHERE site_id = s.id), 0),
          COALESCE(s.total_received, 0)
        ) AS actual_received
      FROM sites s
      WHERE s.id = ?
    `, [id])
    return toApi(rows[0] || null)
  },

  async findAll({ limit } = {}) {
    let sql = `
      SELECT s.*,
        GREATEST(
          COALESCE((SELECT SUM(amount) FROM client_payments WHERE site_id = s.id), 0),
          COALESCE(s.total_received, 0)
        ) AS actual_received
      FROM sites s
      ORDER BY s.created_at DESC
    `
    if (limit) sql += ` LIMIT ${Number(limit)}`
    const [rows] = await getPool().query(sql)
    return rows.map(toApi)
  },

  async findActive() {
    const [rows] = await getPool().query(`
      SELECT s.*,
        GREATEST(
          COALESCE((SELECT SUM(amount) FROM client_payments WHERE site_id = s.id), 0),
          COALESCE(s.total_received, 0)
        ) AS actual_received
      FROM sites s
      WHERE s.status = 'Active'
    `)
    return rows.map(toApi)
  },

  async create(data) {
    const totalBudget = Number(data.totalBudget !== undefined ? data.totalBudget : (data.projectValue || 0))
    const [result] = await getPool().query(
      `INSERT INTO sites
        (name, location, site_owner, contact_number, email, address,
         total_budget, advance_amount, total_received, bank_account_id,
         total_spent, status, start_date, expected_completion_date, description, budget_alert_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.location,
        data.siteOwner,
        data.contactNumber || data.phone || '',
        (data.email || '').toLowerCase(),
        data.address || '',
        totalBudget,
        Number(data.advanceAmount || 0),
        Number(data.totalReceived || 0),
        data.bankAccountId ? Number(data.bankAccountId) : null,
        Number(data.totalSpent)  || 0,
        data.status || 'Active',
        data.startDate ? new Date(data.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        data.expectedCompletionDate ? new Date(data.expectedCompletionDate).toISOString().slice(0, 10) : null,
        data.description || '',
        data.budgetAlertCount !== undefined ? Number(data.budgetAlertCount) : 1,
      ],
    )
    return this.findById(result.insertId)
  },

  async update(id, data) {
    const existing = await this.findById(id)
    if (!existing) return null

    // Build dynamic SET clause for only provided fields
    const colMap = {
      name:                    'name',
      location:                'location',
      siteOwner:               'site_owner',
      contactNumber:           'contact_number',
      email:                   'email',
      address:                 'address',
      totalBudget:             'total_budget',
      projectValue:            'total_budget',
      advanceAmount:           'advance_amount',
      totalReceived:           'total_received',
      bankAccountId:           'bank_account_id',
      totalSpent:              'total_spent',
      status:                  'status',
      startDate:               'start_date',
      expectedCompletionDate:  'expected_completion_date',
      description:             'description',
      budgetAlertCount:        'budget_alert_count',
    }

    const sets = []
    const params = []
    for (const [apiKey, col] of Object.entries(colMap)) {
      if (data[apiKey] !== undefined) {
        sets.push(`${col} = ?`)
        let val = data[apiKey]
        if (['totalBudget', 'projectValue', 'totalSpent', 'budgetAlertCount', 'advanceAmount', 'totalReceived'].includes(apiKey)) {
          val = Number(val)
        }
        if (apiKey === 'bankAccountId') {
          val = val ? Number(val) : null
        }
        if (apiKey === 'email') {
          val = (val || '').toLowerCase()
        }
        if (apiKey === 'startDate' || apiKey === 'expectedCompletionDate') {
          val = val ? new Date(val).toISOString().slice(0, 10) : null
        }
        params.push(val)
      }
    }

    if (sets.length === 0) return existing

    params.push(id)
    await getPool().query(`UPDATE sites SET ${sets.join(', ')} WHERE id = ?`, params)
    return this.findById(id)
  },

  async incrementTotalSpent(id, amount) {
    await getPool().query(
      'UPDATE sites SET total_spent = total_spent + ? WHERE id = ?',
      [amount, id],
    )
  },

  async delete(id) {
    const existing = await this.findById(id)
    if (!existing) return null
    await getPool().query('DELETE FROM sites WHERE id = ?', [id])
    return existing
  },

  async count() {
    const [rows] = await getPool().query('SELECT COUNT(*) AS cnt FROM sites')
    return rows[0].cnt
  },

  async deleteAll() {
    await getPool().query('DELETE FROM sites')
  },

  async insertMany(records) {
    const inserted = []
    for (const r of records) {
      inserted.push(await this.create(r))
    }
    return inserted
  },
}
