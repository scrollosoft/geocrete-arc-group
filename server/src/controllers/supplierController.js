import { Supplier } from '../models/Supplier.js'
import { Material } from '../models/Material.js'
import { getPool } from '../config/db.js'

export const getSuppliers = async (req, res, next) => {
  try {
    const { search, stats } = req.query
    if (stats === 'true' || stats === true) {
      const suppliers = await Supplier.findWithStats({ search })
      const summary = await Supplier.getSummary()
      return res.json({ suppliers, summary })
    }
    const suppliers = await Supplier.find({ search })
    res.json(suppliers)
  } catch (error) {
    next(error)
  }
}

export const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }
    res.json(supplier)
  } catch (error) {
    next(error)
  }
}

export const createSupplier = async (req, res, next) => {
  try {
    const {
      name,
      companyName,
      contactPerson,
      phone,
      email,
      address,
      categories,
      paymentTerms,
      status,
      isActive,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier / Company name is required' })
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Contact number is required' })
    }
    if (!categories || (Array.isArray(categories) && categories.length === 0)) {
      return res.status(400).json({ error: 'At least one supplier category is required' })
    }

    // Check for duplicate supplier name
    const existing = await Supplier.findByName(name.trim())
    if (existing) {
      return res.status(409).json({ error: `A supplier named "${name.trim()}" already exists` })
    }

    // Format categories
    const formattedCategories = Array.isArray(categories)
      ? categories.filter(Boolean).join(', ')
      : String(categories || '').trim()

    const isSupplierActive =
      isActive !== undefined
        ? Boolean(isActive)
        : status
        ? status.toLowerCase() === 'active'
        : true

    const supplier = await Supplier.create({
      name: name.trim(),
      companyName: (companyName || name).trim(),
      contactPerson: (contactPerson || '').trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      address: (address || '').trim(),
      categories: formattedCategories,
      paymentTerms: paymentTerms || 'Immediate',
      isActive: isSupplierActive,
    })

    res.status(201).json(supplier)
  } catch (error) {
    next(error)
  }
}

export const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.update(req.params.id, req.body)
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }
    res.json(supplier)
  } catch (error) {
    next(error)
  }
}

export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.delete(req.params.id)
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }
    res.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    next(error)
  }
}

export const getSupplierPurchases = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' })
    }

    // Optional siteId filter — passed when viewing from a site-specific context
    const { siteId } = req.query

    // Fetch materials for this supplier (optionally filtered by site)
    const materials = await Material.find({ supplierId: req.params.id, siteId: siteId || undefined })

    // Fetch expenses linked to this supplier (optionally filtered by site)
    const pool = getPool()
    // Skip expenses already folded into materials to avoid double-counting purchase totals
    let expQuery = `SELECT e.*, s.name as site_name FROM expenses e LEFT JOIN sites s ON s.id = e.site_id WHERE e.supplier_id = ? AND COALESCE(e.applied_to_material, 0) = 0`
    const expParams = [req.params.id]
    if (siteId) {
      expQuery += ` AND e.site_id = ?`
      expParams.push(siteId)
    }
    expQuery += ` ORDER BY e.date DESC`
    const [expRows] = await pool.query(expQuery, expParams)

    const expensePurchases = expRows.map((e) => ({
      _id: `exp-${e.id}`,
      id: `exp-${e.id}`,
      rawId: e.id,
      isExpense: true,
      refNumber: `EXP-${new Date(e.date).toISOString().slice(0, 10).replace(/-/g, '')}-${String(e.id).padStart(4, '0')}`,
      purchaseDate: e.date ? new Date(e.date).toLocaleDateString('en-GB') : null,
      site: e.site_name ? { name: e.site_name } : null,
      materialName: e.category || 'Equipment / Services',
      category: e.category || 'General',
      totalCost: Number(e.amount || 0),
      paidAmount: Number(e.paid_amount || 0),
      paymentStatus: (e.status === 'Paid' || Number(e.paid_amount || 0) >= Number(e.amount || 0))
        ? 'Paid'
        : Number(e.paid_amount || 0) > 0 ? 'Partial' : 'Pending',
    }))

    const allPurchases = [...materials, ...expensePurchases]

    let totalPurchase = 0
    let totalPaid = 0
    let outstanding = 0
    for (const p of allPurchases) {
      const cost = Number(p.totalCost || 0)
      totalPurchase += cost

      const rawPaid = p.isExpense
        ? Number(p.paidAmount || 0)
        : Number(p.paidAmount !== undefined && p.paidAmount !== null ? p.paidAmount : (p.paymentStatus === 'Paid' ? cost : 0))

      const rowPaid = Math.min(cost, Math.max(0, rawPaid))
      const rowOutstanding = Math.max(0, cost - rowPaid)

      totalPaid += rowPaid
      outstanding += rowOutstanding
    }

    res.json({
      supplier,
      purchases: allPurchases,
      summary: { totalPurchase, totalPaid, outstanding },
    })
  } catch (error) {
    next(error)
  }
}

export const recordPayment = async (req, res, next) => {
  try {
    const { materialId, amount } = req.body
    if (!materialId) {
      return res.status(400).json({ error: 'materialId is required' })
    }

    if (String(materialId).startsWith('exp-')) {
      const expId = String(materialId).replace('exp-', '')
      const pool = getPool()
      await pool.query(
        `UPDATE expenses SET status = 'Paid', paid_amount = amount, pending_amount = 0 WHERE id = ?`,
        [expId]
      )
      return res.json({ success: true, message: 'Expense payment marked as paid' })
    }

    const material = await Material.findById(materialId)
    if (!material) {
      return res.status(404).json({ error: 'Purchase record not found' })
    }
    // Mark as paid and update paid_amount to full total_cost
    const pool = getPool()
    await pool.query(
      `UPDATE materials SET payment_status = 'Paid', paid_amount = total_cost WHERE id = ?`,
      [materialId]
    )
    const updated = await Material.findById(materialId)
    res.json({ success: true, material: updated })
  } catch (error) {
    next(error)
  }
}
