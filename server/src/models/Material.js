import { getPool } from '../config/db.js'
import { fmtDate, fmtDateOnly } from './helpers.js'

const toApi = (row) => {
  if (!row) return null

  let site = null
  if (row.site_id) {
    site = row.site_name
      ? { _id: String(row.site_id), id: String(row.site_id), name: row.site_name, location: row.site_location || '' }
      : String(row.site_id)
  }

  let supplier = null
  if (row.supplier_id) {
    supplier = row.supplier_name
      ? { _id: String(row.supplier_id), id: String(row.supplier_id), name: row.supplier_name, companyName: row.supplier_company || '' }
      : String(row.supplier_id)
  }

  return {
    _id: String(row.id),
    id: String(row.id),
    refNumber: row.ref_number,
    purchaseDate: fmtDateOnly(row.purchase_date),
    site,
    supplier,
    materialName: row.material_name,
    category: row.category,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    totalCost: Number(row.total_cost),
    quantityUsed: Number(row.quantity_used),
    paymentStatus: row.payment_status,
    notes: row.notes || '',
    createdAt: fmtDate(row.created_at),
    updatedAt: fmtDate(row.updated_at),
  }
}

const POPULATE_SELECT = `
  m.*,
  s.name AS site_name,
  s.location AS site_location,
  sup.name AS supplier_name,
  sup.company_name AS supplier_company
`
const POPULATE_JOIN = `
  FROM materials m
  LEFT JOIN sites s ON s.id = m.site_id
  LEFT JOIN suppliers sup ON sup.id = m.supplier_id
`

export const Material = {
  async find({ search, siteId, supplierId, category, status, sort } = {}) {
    let where = 'WHERE 1=1'
    const params = []

    if (search) {
      where += ' AND (m.material_name LIKE ? OR m.ref_number LIKE ? OR s.name LIKE ? OR sup.name LIKE ?)'
      const like = `%${search}%`
      params.push(like, like, like, like)
    }

    if (siteId && siteId !== 'all') {
      where += ' AND m.site_id = ?'
      params.push(siteId)
    }

    if (supplierId) {
      where += ' AND m.supplier_id = ?'
      params.push(supplierId)
    }

    if (category && category !== 'all') {
      where += ' AND m.category = ?'
      params.push(category)
    }

    if (status && status !== 'all') {
      where += ' AND m.payment_status = ?'
      params.push(status)
    }

    let orderBy = 'ORDER BY m.purchase_date DESC, m.id DESC'
    if (sort === 'oldest') {
      orderBy = 'ORDER BY m.purchase_date ASC, m.id ASC'
    } else if (sort === 'cost_high') {
      orderBy = 'ORDER BY m.total_cost DESC'
    } else if (sort === 'cost_low') {
      orderBy = 'ORDER BY m.total_cost ASC'
    }

    const [rows] = await getPool().query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} ${where} ${orderBy}`,
      params,
    )
    return rows.map(toApi)
  },

  async findById(id) {
    const [rows] = await getPool().query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} WHERE m.id = ?`,
      [id],
    )
    return toApi(rows[0] || null)
  },

  async create(data) {
    const [result] = await getPool().query(
      `INSERT INTO materials
        (ref_number, purchase_date, site_id, supplier_id, material_name, category,
         quantity, unit, unit_price, total_cost, quantity_used, payment_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.refNumber,
        data.purchaseDate ? new Date(data.purchaseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        data.siteId || data.site,
        data.supplierId || data.supplier || null,
        data.materialName,
        data.category || 'Other',
        Number(data.quantity) || 0,
        data.unit || 'Units',
        Number(data.unitPrice) || 0,
        Number(data.totalCost) || (Number(data.quantity) * Number(data.unitPrice)) || 0,
        Number(data.quantityUsed) || 0,
        data.paymentStatus || 'Pending',
        data.notes || '',
      ],
    )
    return this.findById(result.insertId)
  },

  async update(id, data) {
    const fields = []
    const values = []

    if (data.materialName !== undefined) {
      fields.push('material_name = ?')
      values.push(data.materialName)
    }
    if (data.category !== undefined) {
      fields.push('category = ?')
      values.push(data.category)
    }
    if (data.siteId !== undefined || data.site !== undefined) {
      fields.push('site_id = ?')
      values.push(data.siteId || data.site)
    }
    if (data.supplierId !== undefined || data.supplier !== undefined) {
      fields.push('supplier_id = ?')
      values.push(data.supplierId || data.supplier || null)
    }
    if (data.quantity !== undefined) {
      fields.push('quantity = ?')
      values.push(Number(data.quantity))
    }
    if (data.unit !== undefined) {
      fields.push('unit = ?')
      values.push(data.unit)
    }
    if (data.unitPrice !== undefined) {
      fields.push('unit_price = ?')
      values.push(Number(data.unitPrice))
    }
    if (data.totalCost !== undefined) {
      fields.push('total_cost = ?')
      values.push(Number(data.totalCost))
    }
    if (data.quantityUsed !== undefined) {
      fields.push('quantity_used = ?')
      values.push(Number(data.quantityUsed))
    }
    if (data.paymentStatus !== undefined) {
      fields.push('payment_status = ?')
      values.push(data.paymentStatus)
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?')
      values.push(data.notes)
    }

    if (fields.length === 0) return this.findById(id)

    values.push(id)
    await getPool().query(
      `UPDATE materials SET ${fields.join(', ')} WHERE id = ?`,
      values,
    )
    return this.findById(id)
  },

  async delete(id) {
    const [result] = await getPool().query(
      'DELETE FROM materials WHERE id = ?',
      [id],
    )
    return result.affectedRows > 0
  },

  async count() {
    const [rows] = await getPool().query('SELECT COUNT(*) AS total FROM materials')
    return rows[0].total
  },

  async getSummary() {
    const pool = getPool()
    // 1. Total material cost across all time
    const [costRows] = await pool.query(`
      SELECT
        COALESCE(SUM(total_cost), 0) AS total_cost,
        COUNT(*) AS total_count
      FROM materials
    `)

    // 2. Purchased this current month
    const [monthRows] = await pool.query(`
      SELECT
        COALESCE(SUM(total_cost), 0) AS month_cost,
        COUNT(*) AS month_count
      FROM materials
      WHERE purchase_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    `)

    // 3. Pending supplier payments
    const [pendingRows] = await pool.query(`
      SELECT
        COALESCE(SUM(total_cost), 0) AS pending_amount,
        COUNT(DISTINCT supplier_id) AS supplier_count
      FROM materials
      WHERE payment_status IN ('Pending', 'Partial')
    `)

    // 4. Low stock items (items where (quantity - quantity_used) <= 0.2 * quantity or quantity_used >= quantity * 0.8)
    const [lowStockRows] = await pool.query(`
      SELECT COUNT(*) AS low_stock_count
      FROM materials
      WHERE (quantity - quantity_used) <= (0.2 * quantity)
    `)

    return {
      totalCost: Number(costRows[0].total_cost),
      totalCount: Number(costRows[0].total_count),
      monthCost: Number(monthRows[0].month_cost),
      monthCount: Number(monthRows[0].month_count),
      pendingAmount: Number(pendingRows[0].pending_amount),
      pendingSuppliersCount: Number(pendingRows[0].supplier_count),
      lowStockCount: Number(lowStockRows[0].low_stock_count),
    }
  },

  async generateRefNumber() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `MAT-${today}-`
    const [rows] = await getPool().query(
      'SELECT ref_number FROM materials WHERE ref_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`${prefix}%`],
    )
    let nextSeq = 1
    if (rows.length > 0) {
      const parts = rows[0].ref_number.split('-')
      const lastSeq = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastSeq)) nextSeq = lastSeq + 1
    }
    return `${prefix}${String(nextSeq).padStart(4, '0')}`
  },
}
