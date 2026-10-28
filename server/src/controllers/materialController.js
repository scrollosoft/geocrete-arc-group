import { Material } from '../models/Material.js'
import { Site } from '../models/Site.js'
import { Supplier } from '../models/Supplier.js'
import { getPool } from '../config/db.js'

// Helper: insert a mirrored row into expenses after a purchase is saved
async function insertExpenseForPurchase({ purchaseDate, siteId, supplierId, category, quantity, unit, unitPrice, totalCost, paidAmount, paymentMethod, notes, paymentStatus }) {
  const pool = getPool()
  const amount = Number(totalCost) || 0
  const paid = Number(paidAmount) || 0
  const pending = Math.max(0, amount - paid)
  const status = paymentStatus === 'Paid' ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'
  const dateVal = purchaseDate
    ? (typeof purchaseDate === 'string' ? purchaseDate.slice(0, 10) : new Date(purchaseDate).toISOString().slice(0, 10))
    : new Date().toISOString().slice(0, 10)
  await pool.query(
    `INSERT INTO expenses
       (date, site_id, supplier_id, category, quantity, unit, rate_per_unit, amount, paid_amount, pending_amount, payment_method, remark, status, applied_to_material)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      dateVal,
      siteId,
      supplierId || null,
      category || 'Other',
      Number(quantity) || 0,
      unit || 'Units',
      Number(unitPrice) || 0,
      amount,
      paid,
      pending,
      paymentMethod || 'Bank Transfer',
      notes || '',
      status,
    ]
  )
}

export const getMaterials = async (req, res, next) => {
  try {
    const { search, siteId, category, status, sort } = req.query
    const materials = await Material.findGrouped({ search, siteId, category, status, sort })
    const summary = await Material.getGroupedSummary({ siteId })

    res.json({ materials, summary })
  } catch (error) {
    next(error)
  }
}

export const getMaterialSummary = async (req, res, next) => {
  try {
    const { siteId } = req.query
    const summary = await Material.getGroupedSummary({ siteId })
    res.json(summary)
  } catch (error) {
    next(error)
  }
}

export const getMaterialById = async (req, res, next) => {
  try {
    const material = await Material.findById(req.params.id)
    if (!material) {
      return res.status(404).json({ error: 'Material record not found' })
    }
    res.json(material)
  } catch (error) {
    next(error)
  }
}

export const getMaterialHistory = async (req, res, next) => {
  try {
    const { id } = req.params
    const { materialName, siteId, supplierId } = req.query
    const result = await Material.getPurchaseHistory({
      materialId: id,
      materialName,
      siteId,
      supplierId,
    })
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export const getNextRef = async (_req, res, next) => {
  try {
    const nextRef = await Material.generateRefNumber()
    res.json({ refNumber: nextRef })
  } catch (error) {
    next(error)
  }
}

export const createMaterial = async (req, res, next) => {
  try {
    const {
      refNumber,
      purchaseDate,
      site,
      siteId,
      supplier,
      supplierId,
      items,
      // Single item fields
      materialName,
      category,
      quantity,
      unit,
      unitPrice,
      totalCost,
      quantityUsed,
      paymentStatus,
      notes,
    } = req.body

    const targetSiteId = site || siteId
    if (!targetSiteId) {
      return res.status(400).json({ error: 'Construction Site is required.' })
    }

    // Verify site exists
    const siteDoc = await Site.findById(targetSiteId)
    if (!siteDoc) {
      return res.status(400).json({ error: 'Selected Construction Site does not exist.' })
    }

    const targetSupplierId = supplier || supplierId || null
    if (targetSupplierId) {
      const supplierDoc = await Supplier.findById(targetSupplierId)
      if (!supplierDoc) {
        return res.status(400).json({ error: 'Selected Supplier does not exist.' })
      }
    }

    const baseRefNumber = refNumber || (await Material.generateRefNumber())

    // If multiple items submitted
    if (Array.isArray(items) && items.length > 0) {
      const created = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (!it.materialName || !it.materialName.trim()) {
          return res.status(400).json({ error: `Item #${i + 1}: Material Name is required.` })
        }
        const qty = Number(it.quantity)
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ error: `Item #${i + 1}: Quantity must be greater than zero.` })
        }
        const price = it.unitPrice !== undefined && it.unitPrice !== null && !isNaN(Number(it.unitPrice)) ? Number(it.unitPrice) : 0
        if (price < 0) {
          return res.status(400).json({ error: `Item #${i + 1}: Unit price cannot be negative.` })
        }

        const itemRef = items.length === 1 ? baseRefNumber : `${baseRefNumber}-${i + 1}`
        const itemCost = it.totalCost !== undefined && it.totalCost !== null && !isNaN(Number(it.totalCost)) ? Number(it.totalCost) : qty * price
        const row = await Material.upsertPurchase({
          refNumber: itemRef,
          purchaseDate,
          siteId: targetSiteId,
          supplierId: targetSupplierId,
          materialName: it.materialName.trim(),
          category: it.category || 'Other',
          quantity: qty,
          unit: it.unit || 'Units',
          unitPrice: price,
          totalCost: itemCost,
          paidAmount: it.paidAmount !== undefined ? Number(it.paidAmount) : (paymentStatus === 'Paid' ? itemCost : 0),
          quantityUsed: Number(it.quantityUsed) || 0,
          paymentStatus: paymentStatus || 'Pending',
          notes: notes || it.notes || '',
        })
        created.push(row)
        // Mirror into expenses table
        await insertExpenseForPurchase({
          purchaseDate,
          siteId: targetSiteId,
          supplierId: targetSupplierId,
          category: it.category || 'Other',
          quantity: qty,
          unit: it.unit || 'Units',
          unitPrice: price,
          totalCost: itemCost,
          paidAmount: it.paidAmount !== undefined ? Number(it.paidAmount) : (paymentStatus === 'Paid' ? itemCost : 0),
          paymentMethod: req.body.paymentMethod || 'Bank Transfer',
          notes: notes || it.notes || '',
          paymentStatus: paymentStatus || 'Pending',
        })
      }
      return res.status(201).json({ success: true, count: created.length, materials: created })
    }

    // Single item creation
    const targetMaterialName = (materialName || req.body.material || '').trim()
    if (!targetMaterialName) {
      return res.status(400).json({ error: 'Material Name is required.' })
    }
    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero.' })
    }
    const price = (unitPrice !== undefined && unitPrice !== null && !isNaN(Number(unitPrice)))
      ? Number(unitPrice)
      : (req.body.ratePerUnit !== undefined && req.body.ratePerUnit !== null && !isNaN(Number(req.body.ratePerUnit)))
        ? Number(req.body.ratePerUnit)
        : 0
    if (price < 0) {
      return res.status(400).json({ error: 'Unit price cannot be negative.' })
    }

    const calculatedCost = (totalCost !== undefined && totalCost !== null && !isNaN(Number(totalCost)))
      ? Number(totalCost)
      : (req.body.totalAmount !== undefined && req.body.totalAmount !== null && !isNaN(Number(req.body.totalAmount)))
        ? Number(req.body.totalAmount)
        : Number((qty * price).toFixed(2))

    const numPaid = (req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== '' && !isNaN(Number(req.body.paidAmount)))
      ? Number(req.body.paidAmount)
      : (paymentStatus === 'Paid' ? calculatedCost : 0)

    if (numPaid < 0) {
      return res.status(400).json({ error: 'Paid amount cannot be negative.' })
    }
    if (numPaid > calculatedCost) {
      return res.status(400).json({ error: 'Paid amount cannot exceed total amount.' })
    }

    const calculatedStatus = paymentStatus || (calculatedCost > 0 && numPaid >= calculatedCost ? 'Paid' : numPaid > 0 ? 'Partial' : 'Pending')

    const material = await Material.upsertPurchase({
      refNumber: baseRefNumber,
      purchaseDate,
      siteId: targetSiteId,
      supplierId: targetSupplierId,
      materialName: targetMaterialName,
      category: category || req.body.category || 'Other',
      quantity: qty,
      unit: unit || 'Units',
      unitPrice: price,
      totalCost: calculatedCost,
      paidAmount: numPaid,
      quantityUsed: Number(quantityUsed) || 0,
      paymentStatus: calculatedStatus,
      paymentMethod: req.body.paymentMethod || req.body.payment_method || 'Bank Transfer',
      notes: (notes || req.body.remark || '').trim(),
    })

    // Mirror into expenses table
    await insertExpenseForPurchase({
      purchaseDate,
      siteId: targetSiteId,
      supplierId: targetSupplierId,
      category: category || req.body.category || 'Other',
      quantity: qty,
      unit: unit || 'Units',
      unitPrice: price,
      totalCost: calculatedCost,
      paidAmount: numPaid,
      paymentMethod: req.body.paymentMethod || req.body.payment_method || 'Bank Transfer',
      notes: (notes || req.body.remark || '').trim(),
      paymentStatus: calculatedStatus,
    })

    res.status(201).json(material)
  } catch (error) {
    next(error)
  }
}

export const updateMaterial = async (req, res, next) => {
  try {
    const updated = await Material.update(req.params.id, req.body)
    if (!updated) {
      return res.status(404).json({ error: 'Material record not found' })
    }
    res.json(updated)
  } catch (error) {
    next(error)
  }
}

export const deleteMaterial = async (req, res, next) => {
  try {
    const success = await Material.delete(req.params.id)
    if (!success) {
      return res.status(404).json({ error: 'Material record not found' })
    }
    res.json({ success: true, message: 'Material record deleted' })
  } catch (error) {
    next(error)
  }
}
