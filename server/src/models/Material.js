import { getPool } from '../config/db.js'
import { fmtDate, fmtDateOnly } from './helpers.js'

const NON_MATERIAL_CATEGORIES = ['labour', 'equipment', 'transport', 'fuel', 'utilities']

/** True when an expense should update Materials (genuine material purchase). */
export const isQualifyingMaterialPurchase = (category, material) => {
  const target = material || category
  if (!target || !String(target).trim()) return false
  const cat = String(category || target).trim().toLowerCase()
  if (NON_MATERIAL_CATEGORIES.includes(cat)) return false
  return true
}

const paymentStatusFromAmounts = (totalCost, paidAmount) => {
  const cost = Number(totalCost) || 0
  const paid = Number(paidAmount) || 0
  if (cost > 0 && paid >= cost) return 'Paid'
  if (paid > 0) return 'Partial'
  return 'Pending'
}

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

  const totalCost = Number(row.total_cost || 0)
  const paidAmount = row.paid_amount !== undefined && row.paid_amount !== null
    ? Number(row.paid_amount)
    : (row.payment_status === 'Paid' ? totalCost : 0)
  const outstandingAmount = Math.max(0, totalCost - paidAmount)
  const quantity = Number(row.quantity || 0)
  const quantityUsed = Number(row.quantity_used || 0)
  const remainingStock = Math.max(0, Number((quantity - quantityUsed).toFixed(4)))

  return {
    _id: String(row.id),
    id: String(row.id),
    refNumber: row.ref_number,
    purchaseDate: fmtDateOnly(row.purchase_date),
    site,
    supplier,
    materialName: row.category,
    category: row.category,
    quantity,
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    ratePerUnit: Number(row.unit_price),
    totalCost,
    amount: totalCost,
    paidAmount,
    outstandingAmount,
    quantityUsed,
    remainingStock,
    bankAccountId: row.bank_account_id ? String(row.bank_account_id) : null,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || 'Bank Transfer',
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
      where += ' AND (m.category LIKE ? OR m.ref_number LIKE ? OR s.name LIKE ? OR sup.name LIKE ?)'
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

  async findGrouped({ search, siteId, category, status, sort } = {}) {
    const materials = await this.find({ search, siteId, category })

    const pool = getPool()
    // Only merge expenses not yet applied into materials (avoids double-counting)
    let expSql = `
      SELECT e.*, s.name as site_name, s.location as site_location, sup.name as supplier_name, sup.company_name as supplier_company
      FROM expenses e
      LEFT JOIN sites s ON s.id = e.site_id
      LEFT JOIN suppliers sup ON sup.id = e.supplier_id
      WHERE e.category IS NOT NULL AND TRIM(e.category) != ''
        AND COALESCE(e.applied_to_material, 0) = 0
        AND LOWER(e.category) NOT IN ('labour', 'equipment', 'transport', 'fuel', 'utilities')
    `
    const expParams = []
    if (siteId && siteId !== 'all') {
      expSql += ' AND e.site_id = ?'
      expParams.push(siteId)
    }
    if (search) {
      expSql += ' AND (e.category LIKE ? OR s.name LIKE ? OR sup.name LIKE ?)'
      const lk = `%${search}%`
      expParams.push(lk, lk, lk)
    }
    const [expRows] = await pool.query(expSql, expParams)

    const groups = new Map()
    const makeKey = (matName, sId, supId) => {
      const cleanMat = String(matName || '').trim().toLowerCase()
      return `${cleanMat}__site_${sId || '0'}__sup_${supId || '0'}`
    }

    for (const m of materials) {
      const sId = m.site?._id || m.site?.id || m.siteId || '0'
      const supId = m.supplier?._id || m.supplier?.id || m.supplierId || '0'
      const key = makeKey(m.materialName, sId, supId)

      if (!groups.has(key)) {
        groups.set(key, {
          _id: `grp-${m.id}`,
          id: `grp-${m.id}`,
          refNumber: m.refNumber,
          materialName: m.materialName,
          category: m.category || 'Raw Material',
          unit: m.unit || 'Units',
          unitPrice: m.unitPrice || 0,
          ratePerUnit: m.unitPrice || 0,
          site: m.site,
          supplier: m.supplier,
          quantity: 0,
          totalCost: 0,
          paidAmount: 0,
          quantityUsed: 0,
          purchaseDate: m.purchaseDate,
        })
      }
      const g = groups.get(key)
      g.quantity += Number(m.quantity || 0)
      g.totalCost += Number(m.totalCost || 0)
      g.paidAmount += Number(m.paidAmount || 0)
      g.quantityUsed += Number(m.quantityUsed || 0)
      if (m.purchaseDate && (!g.purchaseDate || new Date(m.purchaseDate) > new Date(g.purchaseDate))) {
        g.purchaseDate = m.purchaseDate
      }
    }

    for (const e of expRows) {
      const sId = String(e.site_id || '0')
      const supId = String(e.supplier_id || '0')
      const key = makeKey(e.category, sId, supId)

      if (!groups.has(key)) {
        groups.set(key, {
          _id: `grp-exp-${e.id}`,
          id: `grp-exp-${e.id}`,
          refNumber: `EXP-${e.id}`,
          materialName: (e.category || '').trim(),
          category: e.category || 'Raw Material',
          unit: e.unit || 'Units',
          unitPrice: Number(e.rate_per_unit || 0),
          ratePerUnit: Number(e.rate_per_unit || 0),
          site: { _id: String(e.site_id), id: String(e.site_id), name: e.site_name || '', location: e.site_location || '' },
          supplier: e.supplier_id ? { _id: String(e.supplier_id), id: String(e.supplier_id), name: e.supplier_name || '', companyName: e.supplier_company || '' } : null,
          quantity: 0,
          totalCost: 0,
          paidAmount: 0,
          quantityUsed: 0,
          purchaseDate: fmtDateOnly(e.date),
        })
      }
      const g = groups.get(key)
      g.quantity += Number(e.quantity || 0)
      g.totalCost += Number(e.amount || 0)
      g.paidAmount += Number(e.paid_amount || 0)
      const eDate = fmtDateOnly(e.date)
      if (eDate && (!g.purchaseDate || new Date(eDate) > new Date(g.purchaseDate))) {
        g.purchaseDate = eDate
      }
    }

    let result = Array.from(groups.values()).map((g) => {
      const totalCost = Number(g.totalCost.toFixed(2))
      const paidAmount = Number(g.paidAmount.toFixed(2))
      const outstandingAmount = Math.max(0, Number((totalCost - paidAmount).toFixed(2)))
      const quantity = Number(g.quantity.toFixed(4))
      const quantityUsed = Number(g.quantityUsed.toFixed(4))
      const remainingStock = Math.max(0, Number((quantity - quantityUsed).toFixed(4)))
      const paymentStatus = (outstandingAmount === 0 && totalCost > 0)
        ? 'Paid'
        : paidAmount > 0 ? 'Partial' : 'Pending'

      const unitPrice = quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : (g.unitPrice || 0)

      return {
        ...g,
        quantity,
        unitPrice,
        ratePerUnit: unitPrice,
        totalCost,
        amount: totalCost,
        paidAmount,
        outstandingAmount,
        quantityUsed,
        remainingStock,
        paymentStatus,
      }
    })

    if (status && status !== 'all' && status !== 'All Status') {
      result = result.filter((r) => r.paymentStatus === status)
    }

    if (sort === 'oldest') {
      result.sort((a, b) => new Date(a.purchaseDate || 0) - new Date(b.purchaseDate || 0))
    } else if (sort === 'cost_high') {
      result.sort((a, b) => b.totalCost - a.totalCost)
    } else if (sort === 'cost_low') {
      result.sort((a, b) => a.totalCost - b.totalCost)
    } else {
      result.sort((a, b) => new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0))
    }

    return result
  },

  async findById(id) {
    let cleanId = id
    if (typeof cleanId === 'string' && cleanId.startsWith('grp-')) {
      cleanId = cleanId.replace(/^grp-(exp-)?/, '')
    }
    const [rows] = await getPool().query(
      `SELECT ${POPULATE_SELECT} ${POPULATE_JOIN} WHERE m.id = ?`,
      [cleanId],
    )
    return toApi(rows[0] || null)
  },

  /**
   * Fetch complete date-wise purchase history for a material, site, and supplier.
   */
  async getPurchaseHistory({ materialId, materialName, siteId, supplierId } = {}) {
    const pool = getPool()
    let targetName = materialName
    let targetSiteId = siteId
    let targetSupplierId = supplierId

    if (materialId) {
      let cleanId = materialId
      if (typeof cleanId === 'string' && cleanId.startsWith('grp-')) {
        cleanId = cleanId.replace(/^grp-(exp-)?/, '')
      }
      if (cleanId && !isNaN(Number(cleanId))) {
        const [matRows] = await pool.query(
          `SELECT category, site_id, supplier_id FROM materials WHERE id = ?`,
          [cleanId]
        )
        if (matRows[0]) {
          if (!targetName) targetName = matRows[0].category
          if (!targetSiteId) targetSiteId = matRows[0].site_id
          if (targetSupplierId === undefined) targetSupplierId = matRows[0].supplier_id
        } else {
          const [expRows] = await pool.query(
            `SELECT category, site_id, supplier_id FROM expenses WHERE id = ?`,
            [cleanId]
          )
          if (expRows[0]) {
            if (!targetName) targetName = expRows[0].category
            if (!targetSiteId) targetSiteId = expRows[0].site_id
            if (targetSupplierId === undefined) targetSupplierId = expRows[0].supplier_id
          }
        }
      }
    }

    if (!targetName) {
      return { history: [], summary: { totalQuantity: 0, totalCost: 0, totalPaid: 0, totalOutstanding: 0, paymentStatus: 'Pending', transactionCount: 0 } }
    }

    let matSql = `
      SELECT 
        m.id,
        m.ref_number,
        m.purchase_date,
        m.site_id,
        m.supplier_id,
        m.category,
        m.quantity,
        m.unit,
        m.unit_price,
        m.total_cost,
        m.paid_amount,
        m.quantity_used,
        m.payment_status,
        m.payment_method,
        m.notes,
        s.name AS site_name,
        s.location AS site_location,
        sup.name AS supplier_name,
        sup.company_name AS supplier_company
      FROM materials m
      LEFT JOIN sites s ON s.id = m.site_id
      LEFT JOIN suppliers sup ON sup.id = m.supplier_id
      WHERE LOWER(TRIM(m.category)) = LOWER(TRIM(?))
    `
    const matParams = [targetName]
    if (targetSiteId && targetSiteId !== 'all') {
      matSql += ' AND m.site_id = ?'
      matParams.push(targetSiteId)
    }
    if (targetSupplierId && targetSupplierId !== 'all') {
      matSql += ' AND m.supplier_id = ?'
      matParams.push(targetSupplierId)
    } else if (targetSupplierId === null || targetSupplierId === 'null') {
      matSql += ' AND m.supplier_id IS NULL'
    }

    const [matRows] = await pool.query(matSql, matParams)

    // Also include any unapplied material expenses with matching category & site & supplier
    let expSql = `
      SELECT 
        e.id,
        e.date AS purchase_date,
        e.site_id,
        e.supplier_id,
        e.category,
        e.quantity,
        e.unit,
        e.rate_per_unit AS unit_price,
        e.amount AS total_cost,
        e.paid_amount,
        0 AS quantity_used,
        e.status AS payment_status,
        e.payment_method,
        e.remark AS notes,
        s.name AS site_name,
        s.location AS site_location,
        sup.name AS supplier_name,
        sup.company_name AS supplier_company
      FROM expenses e
      LEFT JOIN sites s ON s.id = e.site_id
      LEFT JOIN suppliers sup ON sup.id = e.supplier_id
      WHERE LOWER(TRIM(e.category)) = LOWER(TRIM(?))
        AND COALESCE(e.applied_to_material, 0) = 0
    `
    const expParams = [targetName]
    if (targetSiteId && targetSiteId !== 'all') {
      expSql += ' AND e.site_id = ?'
      expParams.push(targetSiteId)
    }
    if (targetSupplierId && targetSupplierId !== 'all') {
      expSql += ' AND e.supplier_id = ?'
      expParams.push(targetSupplierId)
    } else if (targetSupplierId === null || targetSupplierId === 'null') {
      expSql += ' AND e.supplier_id IS NULL'
    }

    const [expRows] = await pool.query(expSql, expParams)

    const allTx = []

    for (const r of matRows) {
      const qty = Number(r.quantity || 0)
      const totalAmount = Number(r.total_cost || 0)
      const paidAmount = Number(r.paid_amount !== undefined && r.paid_amount !== null ? r.paid_amount : (r.payment_status === 'Paid' ? totalAmount : 0))
      const outstandingAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)))
      const paymentStatus = (totalAmount > 0 && outstandingAmount === 0) ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Pending')
      const ratePerUnit = Number(r.unit_price) || (qty > 0 ? Number((totalAmount / qty).toFixed(2)) : 0)

      allTx.push({
        id: String(r.id),
        source: 'material',
        refNumber: r.ref_number || `MAT-${r.id}`,
        purchaseDate: fmtDateOnly(r.purchase_date),
        materialName: r.category,
        category: r.category,
        site: {
          _id: String(r.site_id),
          id: String(r.site_id),
          name: r.site_name || '',
          location: r.site_location || '',
        },
        supplier: r.supplier_id ? {
          _id: String(r.supplier_id),
          id: String(r.supplier_id),
          name: r.supplier_name || '',
          companyName: r.supplier_company || '',
        } : null,
        quantity: qty,
        unit: r.unit || 'Units',
        ratePerUnit,
        totalAmount,
        paidAmount,
        outstandingAmount,
        paymentStatus,
        paymentMethod: r.payment_method || 'Bank Transfer',
        notes: r.notes || '',
      })
    }

    for (const r of expRows) {
      const qty = Number(r.quantity || 0)
      const totalAmount = Number(r.total_cost || 0)
      const paidAmount = Number(r.paid_amount || 0)
      const outstandingAmount = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)))
      const paymentStatus = (totalAmount > 0 && outstandingAmount === 0) ? 'Paid' : (paidAmount > 0 ? 'Partial' : 'Pending')
      const ratePerUnit = Number(r.unit_price) || (qty > 0 ? Number((totalAmount / qty).toFixed(2)) : 0)

      allTx.push({
        id: `exp-${r.id}`,
        source: 'expense',
        refNumber: `EXP-${r.id}`,
        purchaseDate: fmtDateOnly(r.purchase_date),
        materialName: r.category,
        category: r.category,
        site: {
          _id: String(r.site_id),
          id: String(r.site_id),
          name: r.site_name || '',
          location: r.site_location || '',
        },
        supplier: r.supplier_id ? {
          _id: String(r.supplier_id),
          id: String(r.supplier_id),
          name: r.supplier_name || '',
          companyName: r.supplier_company || '',
        } : null,
        quantity: qty,
        unit: r.unit || 'Units',
        ratePerUnit,
        totalAmount,
        paidAmount,
        outstandingAmount,
        paymentStatus,
        paymentMethod: r.payment_method || 'Bank Transfer',
        notes: r.notes || '',
      })
    }

    // Chronological order: newest purchase first
    allTx.sort((a, b) => {
      const dateDiff = new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0)
      if (dateDiff !== 0) return dateDiff
      const idA = parseInt(a.id.replace(/\D/g, ''), 10) || 0
      const idB = parseInt(b.id.replace(/\D/g, ''), 10) || 0
      return idB - idA
    })

    const totalQuantity = Number(allTx.reduce((sum, t) => sum + t.quantity, 0).toFixed(4))
    const totalCost = Number(allTx.reduce((sum, t) => sum + t.totalAmount, 0).toFixed(2))
    const totalPaid = Number(allTx.reduce((sum, t) => sum + t.paidAmount, 0).toFixed(2))
    const totalOutstanding = Math.max(0, Number((totalCost - totalPaid).toFixed(2)))
    const paymentStatus = (totalCost > 0 && totalOutstanding === 0)
      ? 'Paid'
      : totalPaid > 0 ? 'Partial' : 'Pending'

    return {
      history: allTx,
      summary: {
        totalQuantity,
        totalCost,
        totalPaid,
        totalOutstanding,
        paymentStatus,
        transactionCount: allTx.length,
      },
    }
  },

  /**
   * Find all Materials rows for Material + Site + Supplier (case-insensitive name).
   */
  async findMatches(conn, { materialName, siteId, supplierId }) {
    const db = conn || getPool()
    let sql = `
      SELECT id, quantity, total_cost, paid_amount, quantity_used, unit, unit_price, payment_status, purchase_date
      FROM materials
      WHERE LOWER(TRIM(category)) = LOWER(TRIM(?))
        AND site_id = ?
    `
    const params = [materialName, siteId]
    if (supplierId) {
      sql += ' AND supplier_id = ?'
      params.push(supplierId)
    } else {
      sql += ' AND supplier_id IS NULL'
    }
    sql += ' ORDER BY id ASC'
    const [rows] = await db.query(sql, params)
    return rows
  },

  async findMatchForExpense(conn, key) {
    const rows = await this.findMatches(conn, key)
    return rows[0] || null
  },

  /**
   * Merge duplicate Material + Site + Supplier rows into the oldest one.
   * Preserves quantity_used (summed). Remaining stock = purchased − used.
   */
  async consolidateMatches(conn, { materialName, siteId, supplierId }) {
    const rows = await this.findMatches(conn, { materialName, siteId, supplierId })
    if (rows.length <= 1) return rows[0] || null

    const primary = rows[0]
    let quantity = 0
    let totalCost = 0
    let paidAmount = 0
    let quantityUsed = 0
    let latestDate = primary.purchase_date

    for (const row of rows) {
      quantity += Number(row.quantity || 0)
      totalCost += Number(row.total_cost || 0)
      paidAmount += Number(row.paid_amount || 0)
      quantityUsed += Number(row.quantity_used || 0)
      if (row.purchase_date && (!latestDate || new Date(row.purchase_date) > new Date(latestDate))) {
        latestDate = row.purchase_date
      }
    }

    paidAmount = Math.min(totalCost, Math.max(0, paidAmount))
    quantityUsed = Math.min(quantity, Math.max(0, quantityUsed))
    const status = paymentStatusFromAmounts(totalCost, paidAmount)
    const unitPrice = quantity > 0 ? Number((totalCost / quantity).toFixed(2)) : 0

    await conn.query(
      `UPDATE materials
       SET quantity = ?, total_cost = ?, paid_amount = ?, quantity_used = ?,
           unit_price = ?, payment_status = ?, purchase_date = ?
       WHERE id = ?`,
      [
        quantity,
        totalCost,
        paidAmount,
        quantityUsed,
        unitPrice,
        status,
        latestDate ? new Date(latestDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        primary.id,
      ],
    )

    const duplicateIds = rows.slice(1).map((r) => r.id)
    if (duplicateIds.length > 0) {
      await conn.query(`DELETE FROM materials WHERE id IN (?)`, [duplicateIds])
    }

    return {
      id: primary.id,
      quantity,
      total_cost: totalCost,
      paid_amount: paidAmount,
      quantity_used: quantityUsed,
      unit: primary.unit,
      unit_price: unitPrice,
      payment_status: status,
      purchase_date: latestDate,
    }
  },

  /**
   * Apply a qualifying material-purchase expense onto the matching Materials row.
   * Updates Purchased Quantity (+ expense qty), Purchase Cost, Paid Amount, Outstanding,
   * preserves actual Used Quantity, and updates Remaining Stock (= purchased - used).
   */
  async applyExpensePurchase(conn, data) {
    const {
      materialName,
      siteId,
      supplierId,
      quantity,
      unit,
      ratePerUnit,
      amount,
      paidAmount,
      purchaseDate,
      category,
      notes,
    } = data

    const qty = Number(quantity) || 0
    const cost = Number(amount) || 0
    const paid = Math.min(cost, Math.max(0, Number(paidAmount) || 0))
    const existing = await this.consolidateMatches(conn, { materialName, siteId, supplierId })

    if (existing) {
      const newQuantity = Number(existing.quantity || 0) + qty
      const newCost = Number(existing.total_cost || 0) + cost
      const newPaid = Math.min(newCost, Number(existing.paid_amount || 0) + paid)
      const existingUsed = Number(existing.quantity_used || 0)
      const status = paymentStatusFromAmounts(newCost, newPaid)
      const unitPrice = newQuantity > 0
        ? Number((newCost / newQuantity).toFixed(2))
        : Number(ratePerUnit) || Number(existing.unit_price) || 0

      await conn.query(
        `UPDATE materials
         SET quantity = ?, total_cost = ?, paid_amount = ?, quantity_used = ?,
             unit_price = ?, payment_status = ?, unit = COALESCE(NULLIF(?, ''), unit),
             purchase_date = GREATEST(purchase_date, ?)
         WHERE id = ?`,
        [
          newQuantity,
          newCost,
          newPaid,
          existingUsed,
          unitPrice,
          status,
          unit || '',
          purchaseDate ? new Date(purchaseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          existing.id,
        ],
      )
      return existing.id
    }

    const refNumber = await this.generateRefNumber()
    const status = paymentStatusFromAmounts(cost, paid)
    const unitPrice = qty > 0 ? Number((cost / qty).toFixed(2)) : Number(ratePerUnit) || 0

    const [result] = await conn.query(
      `INSERT INTO materials
        (ref_number, purchase_date, site_id, supplier_id, category,
         quantity, unit, unit_price, total_cost, paid_amount, quantity_used, payment_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        refNumber,
        purchaseDate ? new Date(purchaseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        siteId,
        supplierId || null,
        String(materialName || category || 'Material').trim(),
        qty,
        unit || 'Units',
        unitPrice,
        cost,
        paid,
        0,
        status,
        notes || '',
      ],
    )
    return result.insertId
  },

  /**
   * Save a purchase into materials table as its own transaction record (never overwrite existing).
   */
  async upsertPurchase(data, externalConn) {
    const conn = externalConn || (await getPool().getConnection())
    const shouldManageTransaction = !externalConn
    try {
      if (shouldManageTransaction) await conn.beginTransaction()
      const materialName = String(data.materialName || data.category || '').trim()
      const siteId = data.siteId || data.site
      const supplierId = data.supplierId || data.supplier || null
      const bankAccountId = data.bankAccountId || data.bankAccount ? Number(data.bankAccountId || data.bankAccount) : null
      const qty = Number(data.quantity) || 0
      const cost = Number(data.totalCost) || (qty * Number(data.unitPrice || 0)) || 0
      let paid = 0
      if (data.paidAmount !== undefined && data.paidAmount !== null) {
        paid = Number(data.paidAmount)
      } else if (data.paymentStatus === 'Paid') {
        paid = cost
      }
      paid = Math.min(cost, Math.max(0, paid))
      const addUsed = Number(data.quantityUsed) || 0

      const purchaseDate = data.purchaseDate
        ? (typeof data.purchaseDate === 'string' ? data.purchaseDate.slice(0, 10) : new Date(data.purchaseDate).toISOString().slice(0, 10))
        : new Date().toISOString().slice(0, 10)

      const refNumber = data.refNumber || (await this.generateRefNumber())
      const status = paymentStatusFromAmounts(cost, paid)
      const paymentMethod = data.paymentMethod || data.payment_method || 'Bank Transfer'
      const [result] = await conn.query(
        `INSERT INTO materials
          (ref_number, purchase_date, site_id, supplier_id, bank_account_id, category,
           quantity, unit, unit_price, total_cost, paid_amount, quantity_used, payment_status, payment_method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          refNumber,
          purchaseDate,
          siteId,
          supplierId || null,
          bankAccountId,
          materialName || data.category || 'Other',
          qty,
          data.unit || 'Units',
          Number(data.unitPrice) || (qty > 0 ? Number((cost / qty).toFixed(2)) : 0),
          cost,
          paid,
          addUsed,
          status,
          paymentMethod,
          data.notes || '',
        ],
      )
      if (shouldManageTransaction) await conn.commit()
      return this.findById(result.insertId)
    } catch (err) {
      if (shouldManageTransaction) await conn.rollback()
      throw err
    } finally {
      if (shouldManageTransaction) conn.release()
    }
  },

  /**
   * Reverse a previously applied material-purchase expense from the matching Materials row.
   * Does NOT change Purchased Quantity. Reverses cost/paid/used only.
   * Remaining Stock = purchased − used after reverse.
   */
  async reverseExpensePurchase(conn, data) {
    const { materialName, siteId, supplierId, quantity, amount, paidAmount } = data
    const existing = await this.consolidateMatches(conn, { materialName, siteId, supplierId })
    if (!existing) return null

    const qty = Number(quantity) || 0
    const cost = Number(amount) || 0
    const paid = Math.min(cost, Math.max(0, Number(paidAmount) || 0))

    const purchasedQty = Number(existing.quantity || 0)
    const newUsed = Math.max(0, Number(existing.quantity_used || 0) - qty)
    const newCost = Math.max(0, Number(existing.total_cost || 0) - cost)
    const newPaid = Math.min(newCost, Math.max(0, Number(existing.paid_amount || 0) - paid))
    const status = paymentStatusFromAmounts(newCost, newPaid)
    const unitPrice = purchasedQty > 0 ? Number((newCost / purchasedQty).toFixed(2)) : 0

    await conn.query(
      `UPDATE materials
       SET total_cost = ?, paid_amount = ?, quantity_used = ?,
           unit_price = ?, payment_status = ?
       WHERE id = ?`,
      [newCost, newPaid, newUsed, unitPrice, status, existing.id],
    )
    return existing.id
  },

  /**
   * Sync Used Quantity from applied material expenses so Remaining Stock is correct
   * for rows created before used-on-expense was enabled.
   */
  async syncUsedQuantityFromExpenses() {
    const pool = getPool()
    const [result] = await pool.query(`
      UPDATE materials m
      SET quantity_used = LEAST(
        m.quantity,
        (
          SELECT COALESCE(SUM(e.quantity), 0)
          FROM expenses e
          WHERE COALESCE(e.applied_to_material, 0) = 1
            AND LOWER(TRIM(e.category)) = LOWER(TRIM(m.category))
            AND e.site_id = m.site_id
            AND (
              (e.supplier_id IS NULL AND m.supplier_id IS NULL)
              OR e.supplier_id = m.supplier_id
            )
        )
      )
      WHERE EXISTS (
        SELECT 1 FROM expenses e
        WHERE COALESCE(e.applied_to_material, 0) = 1
          AND LOWER(TRIM(e.category)) = LOWER(TRIM(m.category))
          AND e.site_id = m.site_id
          AND (
            (e.supplier_id IS NULL AND m.supplier_id IS NULL)
            OR e.supplier_id = m.supplier_id
          )
      )
    `)
    const changed = result.affectedRows || 0
    if (changed > 0) {
      console.log(`Synced Used Quantity on ${changed} materials row(s) from applied expenses`)
    }
    return changed
  },

  /**
   * Merge any duplicate Material + Site + Supplier summary rows left by older inserts.
   */
  async consolidateAllDuplicates() {
    // Preserves individual purchase records for date-wise purchase history
    return 0
  },

  /**
   * One-time / startup backfill: apply any qualifying expenses not yet synced into materials.
   */
  async backfillUnappliedMaterialExpenses() {
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT id, date, site_id, supplier_id, category,
              quantity, unit, rate_per_unit, amount, paid_amount, remark
       FROM expenses
       WHERE COALESCE(applied_to_material, 0) = 0
         AND category IS NOT NULL AND TRIM(category) != ''
         AND LOWER(category) NOT IN ('labour', 'equipment', 'transport', 'fuel', 'utilities')
       ORDER BY id ASC`,
    )

    let applied = 0
    for (const e of rows) {
      if (!isQualifyingMaterialPurchase(e.category, e.category)) continue
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        await this.applyExpensePurchase(conn, {
          materialName: e.category,
          siteId: e.site_id,
          supplierId: e.supplier_id,
          quantity: e.quantity,
          unit: e.unit,
          ratePerUnit: e.rate_per_unit,
          amount: e.amount,
          paidAmount: e.paid_amount,
          purchaseDate: e.date,
          category: e.category,
          notes: e.remark || '',
        })
        await conn.query('UPDATE expenses SET applied_to_material = 1 WHERE id = ?', [e.id])
        await conn.commit()
        applied++
      } catch (err) {
        await conn.rollback()
        console.error(`Failed to backfill expense #${e.id} into materials:`, err.message)
      } finally {
        conn.release()
      }
    }
    if (applied > 0) {
      console.log(`Backfilled ${applied} material expense(s) into Materials table`)
    }
    return applied
  },

  async create(data) {
    const totalCost = Number(data.totalCost) || (Number(data.quantity) * Number(data.unitPrice)) || 0
    let paidAmount = 0
    if (data.paidAmount !== undefined && data.paidAmount !== null) {
      paidAmount = Number(data.paidAmount)
    } else if (data.paymentStatus === 'Paid') {
      paidAmount = totalCost
    }

    const [result] = await getPool().query(
      `INSERT INTO materials
        (ref_number, purchase_date, site_id, supplier_id, category,
         quantity, unit, unit_price, total_cost, paid_amount, quantity_used, payment_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.refNumber,
        data.purchaseDate ? new Date(data.purchaseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        data.siteId || data.site,
        data.supplierId || data.supplier || null,
        data.category || data.materialName || 'Other',
        Number(data.quantity) || 0,
        data.unit || 'Units',
        Number(data.unitPrice) || 0,
        totalCost,
        paidAmount,
        Number(data.quantityUsed) || 0,
        data.paymentStatus || 'Pending',
        data.notes || '',
      ],
    )
    return this.findById(result.insertId)
  },

  async update(id, data) {
    let cleanId = id
    let isExpense = false
    if (typeof cleanId === 'string') {
      if (cleanId.startsWith('grp-exp-')) {
        cleanId = cleanId.replace('grp-exp-', '')
        isExpense = true
      } else if (cleanId.startsWith('grp-')) {
        cleanId = cleanId.replace('grp-', '')
      }
    }

    if (isExpense) {
      const expFields = []
      const expVals = []
      if (data.category !== undefined || data.materialName !== undefined) {
        expFields.push('category = ?')
        expVals.push(data.category !== undefined ? data.category : data.materialName)
      }
      if (data.quantity !== undefined) { expFields.push('quantity = ?'); expVals.push(Number(data.quantity)) }
      if (data.unit !== undefined) { expFields.push('unit = ?'); expVals.push(data.unit) }
      if (data.unitPrice !== undefined) { expFields.push('rate_per_unit = ?'); expVals.push(Number(data.unitPrice)) }
      if (data.totalCost !== undefined) { expFields.push('amount = ?'); expVals.push(Number(data.totalCost)) }
      if (data.paidAmount !== undefined) { expFields.push('paid_amount = ?'); expVals.push(Number(data.paidAmount)) }
      if (data.paymentStatus !== undefined) { expFields.push('status = ?'); expVals.push(data.paymentStatus) }
      if (data.notes !== undefined) { expFields.push('remark = ?'); expVals.push(data.notes) }
      if (expFields.length > 0) {
        expVals.push(cleanId)
        await getPool().query(`UPDATE expenses SET ${expFields.join(', ')} WHERE id = ?`, expVals)
      }
      return { id, success: true }
    }

    const fields = []
    const values = []

    if (data.category !== undefined) {
      fields.push('category = ?')
      values.push(data.category)
    } else if (data.materialName !== undefined) {
      fields.push('category = ?')
      values.push(data.materialName)
    }
    if (data.siteId !== undefined || data.site !== undefined) {
      const sId = data.siteId || data.site
      if (sId) {
        fields.push('site_id = ?')
        values.push(sId)
      }
    }
    if (data.supplierId !== undefined || data.supplier !== undefined) {
      const supId = data.supplierId || data.supplier || null
      fields.push('supplier_id = ?')
      values.push(supId)
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
    if (data.paidAmount !== undefined || data.paid_amount !== undefined) {
      fields.push('paid_amount = ?')
      values.push(Number(data.paidAmount !== undefined ? data.paidAmount : data.paid_amount))
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

    if (fields.length === 0) return this.findById(cleanId)

    values.push(cleanId)
    await getPool().query(
      `UPDATE materials SET ${fields.join(', ')} WHERE id = ?`,
      values,
    )
    return this.findById(cleanId)
  },

  async delete(id) {
    let cleanId = id
    let isExpense = false
    if (typeof cleanId === 'string') {
      if (cleanId.startsWith('grp-exp-')) {
        cleanId = cleanId.replace('grp-exp-', '')
        isExpense = true
      } else if (cleanId.startsWith('grp-')) {
        cleanId = cleanId.replace('grp-', '')
      }
    }
    if (isExpense) {
      const [res] = await getPool().query('DELETE FROM expenses WHERE id = ?', [cleanId])
      return res.affectedRows > 0
    }
    const [result] = await getPool().query(
      'DELETE FROM materials WHERE id = ?',
      [cleanId],
    )
    return result.affectedRows > 0
  },

  async count() {
    const [rows] = await getPool().query('SELECT COUNT(*) AS total FROM materials')
    return rows[0].total
  },

  async getGroupedSummary({ siteId } = {}) {
    const list = await this.findGrouped({ siteId })
    let totalCost = 0
    let pendingAmount = 0
    let lowStockCount = 0
    const supSet = new Set()

    for (const item of list) {
      totalCost += item.totalCost
      pendingAmount += item.outstandingAmount
      if (item.outstandingAmount > 0 && item.supplier?.id) {
        supSet.add(item.supplier.id)
      }
      if (item.remainingStock <= (0.2 * item.quantity)) {
        lowStockCount++
      }
    }

    const monthPrefix = new Date().toISOString().slice(0, 7)
    const monthItems = list.filter((item) => (item.purchaseDate || '').startsWith(monthPrefix))
    const monthCost = monthItems.reduce((acc, it) => acc + it.totalCost, 0)

    return {
      totalCost,
      totalCount: list.length,
      monthCost,
      monthCount: monthItems.length,
      pendingAmount,
      pendingSuppliersCount: supSet.size,
      lowStockCount,
    }
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
        COALESCE(SUM(total_cost - COALESCE(paid_amount, 0)), 0) AS pending_amount,
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
