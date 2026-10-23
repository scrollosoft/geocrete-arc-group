import { Material } from '../models/Material.js'
import { Site } from '../models/Site.js'
import { Supplier } from '../models/Supplier.js'

export const getMaterials = async (req, res, next) => {
  try {
    const { search, siteId, category, status, sort } = req.query
    const materials = await Material.find({ search, siteId, category, status, sort })
    const summary = await Material.getSummary()

    res.json({ materials, summary })
  } catch (error) {
    next(error)
  }
}

export const getMaterialSummary = async (_req, res, next) => {
  try {
    const summary = await Material.getSummary()
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
        const price = Number(it.unitPrice)
        if (isNaN(price) || price < 0) {
          return res.status(400).json({ error: `Item #${i + 1}: Unit price cannot be negative.` })
        }

        const itemRef = items.length === 1 ? baseRefNumber : `${baseRefNumber}-${i + 1}`
        const row = await Material.create({
          refNumber: itemRef,
          purchaseDate,
          siteId: targetSiteId,
          supplierId: targetSupplierId,
          materialName: it.materialName.trim(),
          category: it.category || 'Other',
          quantity: qty,
          unit: it.unit || 'Units',
          unitPrice: price,
          totalCost: qty * price,
          quantityUsed: Number(it.quantityUsed) || 0,
          paymentStatus: paymentStatus || 'Pending',
          notes: notes || it.notes || '',
        })
        created.push(row)
      }
      return res.status(201).json({ success: true, count: created.length, materials: created })
    }

    // Single item creation
    if (!materialName || !materialName.trim()) {
      return res.status(400).json({ error: 'Material Name is required.' })
    }
    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than zero.' })
    }
    const price = Number(unitPrice)
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Unit price cannot be negative.' })
    }

    const material = await Material.create({
      refNumber: baseRefNumber,
      purchaseDate,
      siteId: targetSiteId,
      supplierId: targetSupplierId,
      materialName: materialName.trim(),
      category: category || 'Other',
      quantity: qty,
      unit: unit || 'Units',
      unitPrice: price,
      totalCost: totalCost ? Number(totalCost) : qty * price,
      quantityUsed: Number(quantityUsed) || 0,
      paymentStatus: paymentStatus || 'Pending',
      notes: notes ? notes.trim() : '',
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
