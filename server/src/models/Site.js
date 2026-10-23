import { getPool } from '../config/db.js'
import { withId, fmtDate, fmtDateOnly } from './helpers.js'

const toApi = (row) => {
  if (!row) return null
  const totalBudget = Number(row.total_budget)
  const totalSpent  = Number(row.total_spent)
  return {
    ...withId(row),
    name:                    row.name,
    location:                row.location,
    siteOwner:               row.site_owner,
    totalBudget,
    totalSpent,
    status:                  row.status,
    startDate:               fmtDateOnly(row.start_date),
    expectedCompletionDate:  fmtDateOnly(row.expected_completion_date),
    description:             row.description || '',
    budgetAlertCount:        Number(row.budget_alert_count),
    remainingBudget:         Math.max(0, totalBudget - totalSpent),
    budgetUtilization:       totalBudget > 0 ? Number(((totalSpent / totalBudget) * 100).toFixed(1)) : 0,
    createdAt:               fmtDate(row.created_at),
    updatedAt:               fmtDate(row.updated_at),
    // remove raw snake_case
    site_owner: undefined, total_budget: undefined, total_spent: undefined,
    start_date: undefined, expected_completion_date: undefined,
    budget_alert_count: undefined, created_at: undefined, updated_at: undefined,
  }
}

export const Site = {
  async find({ search, status, sort } = {}) {
    let sql = 'SELECT * FROM sites WHERE 1=1'
    const params = []

    if (status && status !== 'all') {
      sql += ' AND status = ?'
      params.push(status)
    }

    if (search) {
      sql += ' AND (name LIKE ? OR location LIKE ? OR site_owner LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like)
    }

    const sortMap = {
      oldest: 'created_at ASC',
      name:   'name ASC',
      budget: 'total_budget DESC',
    }
    sql += ` ORDER BY ${sortMap[sort] || 'created_at DESC'}`

    const [rows] = await getPool().query(sql, params)
    return rows.map(toApi)
  },

  async findById(id) {
    const [rows] = await getPool().query('SELECT * FROM sites WHERE id = ?', [id])
    return toApi(rows[0] || null)
  },

  async findAll({ limit } = {}) {
    let sql = 'SELECT * FROM sites ORDER BY created_at DESC'
    if (limit) sql += ` LIMIT ${Number(limit)}`
    const [rows] = await getPool().query(sql)
    return rows.map(toApi)
  },

  async findActive() {
    const [rows] = await getPool().query("SELECT * FROM sites WHERE status = 'Active'")
    return rows.map(toApi)
  },

  async create(data) {
    const [result] = await getPool().query(
      `INSERT INTO sites
        (name, location, site_owner, total_budget, total_spent, status,
         start_date, expected_completion_date, description, budget_alert_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.location,
        data.siteOwner,
        Number(data.totalBudget) || 0,
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
      totalBudget:             'total_budget',
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
        if (apiKey === 'totalBudget' || apiKey === 'totalSpent' || apiKey === 'budgetAlertCount') val = Number(val)
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
