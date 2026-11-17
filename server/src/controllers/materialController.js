import { Material } from '../models/Material.js'
import { Site } from '../models/Site.js'
import { Supplier } from '../models/Supplier.js'
import { getPool } from '../config/db.js'
import { calculateLiveCashSummary } from './cashController.js'

// Helper: insert a mirrored row into expenses after a purchase is saved
async function insertExpenseForPurchase({ materialId, purchaseDate, siteId, supplierId, category, quantity, unit, unitPrice, totalCost, paidAmount, paymentMethod, notes, paymentStatus, bankAccountId }, externalConn) {
  const conn = externalConn || getPool()
  const amount = Number(totalCost) || 0
  const paid = Number(paidAmount) || 0
  const pending = Math.max(0, amount - paid)
  const status = paymentStatus === 'Paid' ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'
  const dateVal = purchaseDate
    ? (typeof purchaseDate === 'string' ? purchaseDate.slice(0, 10) : new Date(purchaseDate).toISOString().slice(0, 10))
    : new Date().toISOString().slice(0, 10)
  const [expResult] = await conn.query(
    `INSERT INTO expenses
       (material_id, date, site_id, supplier_id, category, quantity, unit, rate_per_unit, amount, paid_amount, pending_amount, payment_method, remark, status, applied_to_material, bank_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      materialId || null,
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
      bankAccountId || null,
    ]
  )
  if (paid > 0 && expResult.insertId) {
    await conn.query(
      `INSERT INTO expense_payments
        (expense_id, site_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expResult.insertId,
        siteId,
        supplierId || null,
        bankAccountId || null,
        paid,
        dateVal,
        paymentMethod || 'Bank transfer',
        notes || '',
        'Material Purchase Payment',
      ]
    )
  }
}

export const getMaterials = async (req, res, next) => {
  try {
    const { search, siteId, category, status, sort, grouped } = req.query
    // When grouped=false, return individual (date-wise) records instead of aggregated groups
    const materials = grouped === 'false'
      ? await Material.find({ search, siteId, category, status, sort })
      : await Material.findGrouped({ search, siteId, category, status, sort })
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
    const bankAccountId = req.body.bankAccountId || req.body.bankAccount || null

    const isCashAccount = String(bankAccountId || '').toLowerCase() === 'cash' || String(req.body.paymentMethod || '').toLowerCase() === 'cash'
    const finalBankAccountId = isCashAccount ? null : (bankAccountId ? Number(bankAccountId) : null)
    const finalPaymentMethod = isCashAccount ? 'Cash' : (req.body.paymentMethod || 'Bank Transfer')

    // If multiple items submitted
    if (Array.isArray(items) && items.length > 0) {
      let totalPaidAll = 0
      for (const it of items) {
        const itCost = it.totalCost !== undefined && it.totalCost !== null && !isNaN(Number(it.totalCost))
          ? Number(it.totalCost)
          : (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)
        const itPaid = it.paidAmount !== undefined ? Number(it.paidAmount) : (paymentStatus === 'Paid' ? itCost : 0)
        totalPaidAll += itPaid
      }

      if (totalPaidAll > 0 && !bankAccountId) {
        return res.status(400).json({ error: 'Please select a bank account.' })
      }

      const conn = await getPool().getConnection()
      try {
        await conn.beginTransaction()

        if (totalPaidAll > 0) {
          if (isCashAccount) {
            const cashSummary = await calculateLiveCashSummary(conn)
            if (cashSummary.balance < totalPaidAll) {
              await conn.rollback(); conn.release()
              return res.status(400).json({
                error: `Insufficient cash balance. Available balance: ₹${cashSummary.balance.toLocaleString('en-IN')}, Requested: ₹${totalPaidAll.toLocaleString('en-IN')}.`,
              })
            }
          } else if (finalBankAccountId) {
            const [[bankRow]] = await conn.query(
              'SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
              [finalBankAccountId]
            )
            if (!bankRow) {
              await conn.rollback(); conn.release()
              return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
            }
            const bankBalance = Number(bankRow.balance)
            if (bankBalance <= 0) {
              await conn.rollback(); conn.release()
              return res.status(400).json({ error: 'This bank account has zero balance. Please select another bank account.' })
            }
            if (bankBalance < totalPaidAll) {
              await conn.rollback(); conn.release()
              return res.status(400).json({ error: `Insufficient bank balance. Available balance: ₹${bankBalance.toLocaleString('en-IN')}.` })
            }
            await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [totalPaidAll, finalBankAccountId])
          }
        }

        const created = []
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          if (!it.materialName || !it.materialName.trim()) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: `Item #${i + 1}: Material Name is required.` })
          }
          const qty = Number(it.quantity)
          if (isNaN(qty) || qty <= 0) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: `Item #${i + 1}: Quantity must be greater than zero.` })
          }
          const price = it.unitPrice !== undefined && it.unitPrice !== null && !isNaN(Number(it.unitPrice)) ? Number(it.unitPrice) : 0
          if (price < 0) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: `Item #${i + 1}: Unit price cannot be negative.` })
          }

          const itemRef = items.length === 1 ? baseRefNumber : `${baseRefNumber}-${i + 1}`
          const itemCost = it.totalCost !== undefined && it.totalCost !== null && !isNaN(Number(it.totalCost)) ? Number(it.totalCost) : qty * price
          const itPaid = it.paidAmount !== undefined ? Number(it.paidAmount) : (paymentStatus === 'Paid' ? itemCost : 0)

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
            paidAmount: itPaid,
            quantityUsed: Number(it.quantityUsed) || 0,
            paymentStatus: paymentStatus || 'Pending',
            notes: notes || it.notes || '',
            bankAccountId: itPaid > 0 ? finalBankAccountId : null,
          }, conn)
          created.push(row)

          // Mirror into expenses table
          await insertExpenseForPurchase({
            materialId: row?.id,
            purchaseDate,
            siteId: targetSiteId,
            supplierId: targetSupplierId,
            category: it.category || 'Other',
            quantity: qty,
            unit: it.unit || 'Units',
            unitPrice: price,
            totalCost: itemCost,
            paidAmount: itPaid,
            paymentMethod: finalPaymentMethod,
            notes: notes || it.notes || '',
            paymentStatus: paymentStatus || 'Pending',
            bankAccountId: itPaid > 0 ? finalBankAccountId : null,
          }, conn)
        }

        await conn.commit()
        conn.release()
        return res.status(201).json({ success: true, count: created.length, materials: created })
      } catch (err) {
        await conn.rollback()
        conn.release()
        throw err
      }
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

    if (numPaid > 0 && !bankAccountId) {
      return res.status(400).json({ error: 'Please select a bank account.' })
    }

    const calculatedStatus = paymentStatus || (calculatedCost > 0 && numPaid >= calculatedCost ? 'Paid' : numPaid > 0 ? 'Partial' : 'Pending')

    const conn = await getPool().getConnection()
    try {
      await conn.beginTransaction()

      if (numPaid > 0) {
        if (isCashAccount) {
          const cashSummary = await calculateLiveCashSummary(conn)
          if (cashSummary.balance < numPaid) {
            await conn.rollback(); conn.release()
            return res.status(400).json({
              error: `Insufficient cash balance. Available balance: ₹${cashSummary.balance.toLocaleString('en-IN')}, Requested: ₹${numPaid.toLocaleString('en-IN')}.`,
            })
          }
        } else if (finalBankAccountId) {
          const [[bankRow]] = await conn.query(
            'SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE',
            [finalBankAccountId]
          )
          if (!bankRow) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
          }
          const bankBalance = Number(bankRow.balance)
          if (bankBalance <= 0) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: 'This bank account has zero balance. Please select another bank account.' })
          }
          if (bankBalance < numPaid) {
            await conn.rollback(); conn.release()
            return res.status(400).json({ error: `Insufficient bank balance. Available balance: ₹${bankBalance.toLocaleString('en-IN')}.` })
          }
          await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [numPaid, finalBankAccountId])
        }
      }

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
        paymentMethod: finalPaymentMethod,
        notes: (notes || req.body.remark || '').trim(),
        bankAccountId: numPaid > 0 ? finalBankAccountId : null,
      }, conn)

      // Mirror into expenses table
      await insertExpenseForPurchase({
        materialId: material?.id,
        purchaseDate,
        siteId: targetSiteId,
        supplierId: targetSupplierId,
        category: category || req.body.category || 'Other',
        quantity: qty,
        unit: unit || 'Units',
        unitPrice: price,
        totalCost: calculatedCost,
        paidAmount: numPaid,
        paymentMethod: finalPaymentMethod,
        notes: (notes || req.body.remark || '').trim(),
        paymentStatus: calculatedStatus,
        bankAccountId: numPaid > 0 ? finalBankAccountId : null,
      }, conn)

      await conn.commit()
      conn.release()
      res.status(201).json(material)
    } catch (err) {
      await conn.rollback()
      conn.release()
      throw err
    }
  } catch (error) {
    next(error)
  }
}

export const updateMaterial = async (req, res, next) => {
  const rawId = req.params.id
  let cleanId = rawId
  let isExpense = false

  if (typeof cleanId === 'string') {
    if (cleanId.startsWith('grp-exp-')) {
      cleanId = cleanId.replace('grp-exp-', '')
      isExpense = true
    } else if (cleanId.startsWith('grp-')) {
      cleanId = cleanId.replace('grp-', '')
    }
  }

  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    let existingMat = null
    let existingExp = null

    if (isExpense) {
      const [[exp]] = await conn.query('SELECT * FROM expenses WHERE id = ? FOR UPDATE', [cleanId])
      existingExp = exp
    } else {
      const [[mat]] = await conn.query('SELECT * FROM materials WHERE id = ? FOR UPDATE', [cleanId])
      existingMat = mat
      if (!existingMat) {
        // Fallback: check if cleanId exists in expenses table
        const [[exp]] = await conn.query('SELECT * FROM expenses WHERE id = ? FOR UPDATE', [cleanId])
        if (exp) {
          existingExp = exp
          isExpense = true
        }
      }
    }

    if (!existingMat && !existingExp) {
      await conn.rollback()
      conn.release()
      return res.status(404).json({ error: 'Material purchase record not found.' })
    }

    // Previous values
    const oldPaid = Number(existingMat ? existingMat.paid_amount : existingExp.paid_amount) || 0
    const oldBankAccountId = (existingMat ? existingMat.bank_account_id : existingExp.bank_account_id)
      ? String(existingMat ? existingMat.bank_account_id : existingExp.bank_account_id)
      : null
    const oldSiteId = existingMat ? existingMat.site_id : existingExp.site_id
    const oldSupplierId = (existingMat ? existingMat.supplier_id : existingExp.supplier_id) || null
    const oldCategory = existingMat ? existingMat.category : existingExp.category

    // Incoming inputs & fallbacks
    const purchaseDate = req.body.purchaseDate
      ? (typeof req.body.purchaseDate === 'string' ? req.body.purchaseDate.slice(0, 10) : new Date(req.body.purchaseDate).toISOString().slice(0, 10))
      : (existingMat ? existingMat.purchase_date : existingExp.date)

    const siteId = req.body.siteId || req.body.site || oldSiteId
    if (!siteId) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Construction site is required.' })
    }

    const [[siteDoc]] = await conn.query('SELECT id FROM sites WHERE id = ?', [siteId])
    if (!siteDoc) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Selected Construction Site does not exist.' })
    }

    const supplierId = req.body.supplierId !== undefined
      ? (req.body.supplierId || null)
      : (req.body.supplier !== undefined ? (req.body.supplier || null) : oldSupplierId)

    if (supplierId) {
      const [[supDoc]] = await conn.query('SELECT id FROM suppliers WHERE id = ?', [supplierId])
      if (!supDoc) {
        await conn.rollback()
        conn.release()
        return res.status(400).json({ error: 'Selected Supplier does not exist.' })
      }
    }

    const materialName = (req.body.materialName || req.body.material || req.body.category || oldCategory || '').trim()
    if (!materialName) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Material name is required.' })
    }

    const quantity = req.body.quantity !== undefined
      ? Number(req.body.quantity)
      : Number(existingMat ? existingMat.quantity : existingExp.quantity)
    if (isNaN(quantity) || quantity <= 0) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Quantity must be greater than zero.' })
    }

    const unit = req.body.unit || (existingMat ? existingMat.unit : existingExp.unit) || 'Units'

    const ratePerUnit = req.body.ratePerUnit !== undefined && req.body.ratePerUnit !== null
      ? Number(req.body.ratePerUnit)
      : (req.body.unitPrice !== undefined && req.body.unitPrice !== null
        ? Number(req.body.unitPrice)
        : Number(existingMat ? existingMat.unit_price : existingExp.rate_per_unit) || 0)
    if (isNaN(ratePerUnit) || ratePerUnit < 0) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Rate per unit cannot be negative.' })
    }

    // Total Amount = Quantity * Rate Per Unit
    const calculatedTotal = Number((quantity * ratePerUnit).toFixed(2))
    const totalCost = req.body.totalAmount !== undefined && req.body.totalAmount !== null && !isNaN(Number(req.body.totalAmount))
      ? Number(req.body.totalAmount)
      : (req.body.totalCost !== undefined && req.body.totalCost !== null && !isNaN(Number(req.body.totalCost))
        ? Number(req.body.totalCost)
        : calculatedTotal)

    const numPaid = req.body.paidAmount !== undefined && req.body.paidAmount !== null && req.body.paidAmount !== ''
      ? Number(req.body.paidAmount)
      : oldPaid
    if (isNaN(numPaid) || numPaid < 0) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Paid amount cannot be negative.' })
    }
    if (numPaid > totalCost) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Paid amount cannot exceed total amount.' })
    }

    const bankAccountId = numPaid > 0
      ? (req.body.bankAccountId !== undefined ? (req.body.bankAccountId || null) : (req.body.bankAccount !== undefined ? (req.body.bankAccount || null) : oldBankAccountId))
      : null
    if (numPaid > 0 && !bankAccountId) {
      await conn.rollback()
      conn.release()
      return res.status(400).json({ error: 'Please select a bank account.' })
    }

    // Payment Status: calculated automatically
    const calculatedStatus = totalCost > 0 && numPaid >= totalCost
      ? 'Paid'
      : numPaid > 0
        ? 'Partial'
        : 'Pending'

    const paymentMethod = req.body.paymentMethod || req.body.payment_method || (existingMat ? existingMat.payment_method : existingExp.payment_method) || 'Bank Transfer'
    const notes = (req.body.notes !== undefined ? req.body.notes : (req.body.remark !== undefined ? req.body.remark : (existingMat ? existingMat.notes : existingExp.remark) || '')).trim()

    const refId = existingMat?.ref_number || (existingExp?.remark ? existingExp.remark : (`MAT-${cleanId}`))
    const targetRefundBankId = bankAccountId || oldBankAccountId

    // --- BANK BALANCE MANAGEMENT (SAME AS EXPENSE EDIT FORM) ---
    if (String(bankAccountId || '') !== String(oldBankAccountId || '')) {
      // Bank account changed — refund old bank, deduct new bank
      if (oldBankAccountId && oldPaid > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [oldPaid, oldBankAccountId])
      }
      if (bankAccountId && numPaid > 0) {
        const [[newBankRow]] = await conn.query('SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE', [bankAccountId])
        if (!newBankRow) {
          await conn.rollback(); conn.release()
          return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
        }
        const bal = Number(newBankRow.balance || 0)
        if (bal < numPaid) {
          await conn.rollback(); conn.release()
          return res.status(400).json({ error: `Insufficient bank balance in selected account. Available balance: ₹${bal.toLocaleString('en-IN')}.` })
        }
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [numPaid, bankAccountId])
      }
    } else if (bankAccountId) {
      // Same bank account — adjust only the difference
      const diff = Number((numPaid - oldPaid).toFixed(2))
      if (diff > 0) {
        const [[bankRow]] = await conn.query('SELECT balance FROM bank_accounts WHERE id = ? AND is_active = 1 FOR UPDATE', [bankAccountId])
        if (!bankRow) {
          await conn.rollback(); conn.release()
          return res.status(400).json({ error: 'Selected bank account not found or inactive.' })
        }
        const bal = Number(bankRow.balance || 0)
        if (bal < diff) {
          await conn.rollback(); conn.release()
          return res.status(400).json({ error: `Insufficient bank balance in selected account. Available balance: ₹${bal.toLocaleString('en-IN')}.` })
        }
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [diff, bankAccountId])
      } else if (diff < 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [Math.abs(diff), bankAccountId])
      }
    }

    const pendingAmount = Math.max(0, Number((totalCost - numPaid).toFixed(2)))

    // --- UPDATE DATABASE RECORDS ---
    if (existingMat) {
      try {
        await conn.query(
          `UPDATE materials SET
            purchase_date = ?,
            site_id = ?,
            supplier_id = ?,
            bank_account_id = ?,
            category = ?,
            quantity = ?,
            unit = ?,
            unit_price = ?,
            total_cost = ?,
            paid_amount = ?,
            payment_status = ?,
            payment_method = ?,
            notes = ?
           WHERE id = ?`,
          [
            purchaseDate,
            siteId,
            supplierId,
            bankAccountId,
            materialName,
            quantity,
            unit,
            ratePerUnit,
            totalCost,
            numPaid,
            calculatedStatus,
            paymentMethod,
            notes,
            existingMat.id,
          ],
        )
      } catch (matErr) {
        if (matErr.message && matErr.message.includes('payment_method')) {
          try {
            await conn.query(
              `ALTER TABLE materials ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer' AFTER payment_status`,
            )
            await conn.query(
              `UPDATE materials SET
                purchase_date = ?,
                site_id = ?,
                supplier_id = ?,
                bank_account_id = ?,
                category = ?,
                quantity = ?,
                unit = ?,
                unit_price = ?,
                total_cost = ?,
                paid_amount = ?,
                payment_status = ?,
                payment_method = ?,
                notes = ?
               WHERE id = ?`,
              [
                purchaseDate,
                siteId,
                supplierId,
                bankAccountId,
                materialName,
                quantity,
                unit,
                ratePerUnit,
                totalCost,
                numPaid,
                calculatedStatus,
                paymentMethod,
                notes,
                existingMat.id,
              ],
            )
          } catch {
            await conn.query(
              `UPDATE materials SET
                purchase_date = ?,
                site_id = ?,
                supplier_id = ?,
                bank_account_id = ?,
                category = ?,
                quantity = ?,
                unit = ?,
                unit_price = ?,
                total_cost = ?,
                paid_amount = ?,
                payment_status = ?,
                notes = ?
               WHERE id = ?`,
              [
                purchaseDate,
                siteId,
                supplierId,
                bankAccountId,
                materialName,
                quantity,
                unit,
                ratePerUnit,
                totalCost,
                numPaid,
                calculatedStatus,
                notes,
                existingMat.id,
              ],
            )
          }
        } else {
          throw matErr
        }
      }

      // Sync linked expenses record so Payments page and Transaction History stay 100% in sync
      const [[matchedExp]] = await conn.query(
        `SELECT id FROM expenses
         WHERE material_id = ?
            OR (applied_to_material = 1 AND site_id = ? AND LOWER(TRIM(category)) = LOWER(TRIM(?)))
         ORDER BY (material_id = ?) DESC, id DESC
         LIMIT 1`,
        [existingMat.id, oldSiteId, oldCategory, existingMat.id]
      )

      if (matchedExp) {
        await conn.query(
          `UPDATE expenses SET
            material_id = ?,
            date = ?,
            site_id = ?,
            supplier_id = ?,
            bank_account_id = ?,
            category = ?,
            quantity = ?,
            unit = ?,
            rate_per_unit = ?,
            amount = ?,
            paid_amount = ?,
            pending_amount = ?,
            payment_method = ?,
            remark = ?,
            status = ?
           WHERE id = ?`,
          [
            existingMat.id,
            purchaseDate,
            siteId,
            supplierId,
            bankAccountId,
            materialName,
            quantity,
            unit,
            ratePerUnit,
            totalCost,
            numPaid,
            pendingAmount,
            paymentMethod,
            notes,
            calculatedStatus,
            matchedExp.id,
          ]
        )

        // Keep expense_payments in sync with updated material payment
        if (numPaid > 0) {
          const [mPay] = await conn.query('SELECT id FROM expense_payments WHERE expense_id = ? ORDER BY id ASC LIMIT 1', [matchedExp.id])
          if (mPay.length > 0) {
            await conn.query(
              'UPDATE expense_payments SET amount = ?, bank_account_id = ?, site_id = ?, supplier_id = ?, payment_date = ?, payment_method = ? WHERE id = ?',
              [numPaid, bankAccountId, siteId, supplierId || null, purchaseDate, paymentMethod, mPay[0].id]
            )
          } else {
            await conn.query(
              `INSERT INTO expense_payments
                (expense_id, site_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                matchedExp.id,
                siteId,
                supplierId || null,
                bankAccountId,
                numPaid,
                purchaseDate,
                paymentMethod,
                notes || '',
                'Material Purchase Payment',
              ]
            )
          }
        } else {
          await conn.query('DELETE FROM expense_payments WHERE expense_id = ?', [matchedExp.id])
        }
      } else {
        await insertExpenseForPurchase({
          materialId: existingMat.id,
          purchaseDate,
          siteId,
          supplierId,
          category: materialName,
          quantity,
          unit,
          unitPrice: ratePerUnit,
          totalCost,
          paidAmount: numPaid,
          paymentMethod,
          notes,
          paymentStatus: calculatedStatus,
          bankAccountId,
        }, conn)
      }
    } else if (existingExp) {
      await conn.query(
        `UPDATE expenses SET
          date = ?,
          site_id = ?,
          supplier_id = ?,
          bank_account_id = ?,
          category = ?,
          quantity = ?,
          unit = ?,
          rate_per_unit = ?,
          amount = ?,
          paid_amount = ?,
          pending_amount = ?,
          payment_method = ?,
          remark = ?,
          status = ?
         WHERE id = ?`,
        [
          purchaseDate,
          siteId,
          supplierId,
          bankAccountId,
          materialName,
          quantity,
          unit,
          ratePerUnit,
          totalCost,
          numPaid,
          pendingAmount,
          paymentMethod,
          notes,
          calculatedStatus,
          existingExp.id,
        ]
      )

      // Keep expense_payments in sync when editing directly from expense record
      if (numPaid > 0) {
        const [mPay] = await conn.query('SELECT id FROM expense_payments WHERE expense_id = ? ORDER BY id ASC LIMIT 1', [existingExp.id])
        if (mPay.length > 0) {
          await conn.query(
            'UPDATE expense_payments SET amount = ?, bank_account_id = ?, site_id = ?, supplier_id = ?, payment_date = ?, payment_method = ? WHERE id = ?',
            [numPaid, bankAccountId, siteId, supplierId || null, purchaseDate, paymentMethod, mPay[0].id]
          )
        } else {
          await conn.query(
            `INSERT INTO expense_payments
              (expense_id, site_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              existingExp.id,
              siteId,
              supplierId || null,
              bankAccountId,
              numPaid,
              purchaseDate,
              paymentMethod,
              notes || '',
              'Material Purchase Payment',
            ]
          )
        }
      } else {
        await conn.query('DELETE FROM expense_payments WHERE expense_id = ?', [existingExp.id])
      }
    }

    await conn.commit()
    conn.release()

    const updated = await Material.findById(cleanId)
    res.json(updated || { id: cleanId, success: true })
  } catch (error) {
    await conn.rollback()
    conn.release()
    next(error)
  }
}

export const deleteMaterial = async (req, res, next) => {
  const rawId = req.params.id
  let cleanId = rawId
  let isExpense = false

  if (typeof cleanId === 'string') {
    if (cleanId.startsWith('grp-exp-')) {
      cleanId = cleanId.replace('grp-exp-', '')
      isExpense = true
    } else if (cleanId.startsWith('grp-')) {
      cleanId = cleanId.replace('grp-', '')
    }
  }

  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    if (isExpense) {
      const [[existingExp]] = await conn.query('SELECT * FROM expenses WHERE id = ? FOR UPDATE', [cleanId])
      if (!existingExp) {
        await conn.rollback(); conn.release()
        return res.status(404).json({ error: 'Expense record not found' })
      }
      if (existingExp.bank_account_id && Number(existingExp.paid_amount || 0) > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [Number(existingExp.paid_amount), existingExp.bank_account_id])
      }
      await conn.query('DELETE FROM expenses WHERE id = ?', [cleanId])
    } else {
      const [[existingMat]] = await conn.query('SELECT * FROM materials WHERE id = ? FOR UPDATE', [cleanId])
      if (!existingMat) {
        await conn.rollback(); conn.release()
        return res.status(404).json({ error: 'Material record not found' })
      }
      if (existingMat.bank_account_id && Number(existingMat.paid_amount || 0) > 0) {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [Number(existingMat.paid_amount), existingMat.bank_account_id])
      }
      // Delete mirrored expense row as well
      await conn.query('DELETE FROM expenses WHERE material_id = ? OR (applied_to_material = 1 AND site_id = ? AND LOWER(TRIM(category)) = LOWER(TRIM(?)))', [cleanId, existingMat.site_id, existingMat.category])
      await conn.query('DELETE FROM materials WHERE id = ?', [cleanId])
    }

    await conn.commit()
    conn.release()
    res.json({ success: true, message: 'Material record deleted' })
  } catch (error) {
    await conn.rollback()
    conn.release()
    next(error)
  }
}
