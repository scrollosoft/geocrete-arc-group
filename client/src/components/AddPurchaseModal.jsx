import React, { useState, useEffect, useMemo } from 'react'
import { X, Package } from 'lucide-react'
import { materialService } from '../services/materialService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

const MATERIALS = [
  'Cement',
  'Structural steel',
  'Bricks & Blocks',
  'River Sand',
  'Aggregates',
  'Ready-Mix Concrete',
  'Masonry labour',
  'Excavator rental',
  'Plumbing Supplies',
  'Electrical Cables',
]

const UNITS = [
  'Bags',
  'Tons',
  'Units',
  'Kg',
  'Pieces',
  'Cubic Feet',
  'Cubic Meter',
  'Meter',
  'Liter',
  'Days',
  'Hours',
  'Trips',
  'Sq.Ft',
  'Other',
]

const PAYMENT_METHODS = [
  'Bank Transfer',
  'UPI',
  'Cheque',
  'Cash',
]

const getCategoryForMaterial = (mat = '') => {
  const m = String(mat).toLowerCase()
  if (m.includes('cement')) return 'Cement'
  if (m.includes('steel')) return 'Steel'
  if (m.includes('brick') || m.includes('block')) return 'Bricks'
  if (m.includes('sand')) return 'Sand'
  if (m.includes('aggregate')) return 'Aggregate'
  if (m.includes('electric')) return 'Electrical Materials'
  if (m.includes('plumb')) return 'Plumbing Materials'
  return 'Other'
}

export default function AddPurchaseModal({
  isOpen,
  onClose,
  sites = [],
  suppliers = [],
  bankAccounts = [],
  onPurchaseCreated,
  showNotification,
}) {
  const [refNumber, setRefNumber] = useState('')
  const [formData, setFormData] = useState({
    purchaseDate: getTodayString(),
    siteId: '',
    supplierId: '',
    material: 'Cement',
    quantity: '',
    unit: 'Bags',
    ratePerUnit: '',
    paymentMethod: 'Bank Transfer',
    bankAccountId: '',
    paidAmount: '',
    remark: '',
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  // Derived: Total Amount = Quantity × Rate Per Unit
  const totalAmount = (() => {
    const q = Number(formData.quantity)
    const r = Number(formData.ratePerUnit)
    return q > 0 && r >= 0 ? Number((q * r).toFixed(2)) : 0
  })()

  // Derived: Payment Status calculated automatically from Total Amount and Paid Amount
  const paymentStatus = (() => {
    const paid = Number(formData.paidAmount) || 0
    if (totalAmount > 0 && paid >= totalAmount) return 'Paid'
    if (paid > 0) return 'Partial'
    return 'Pending'
  })()

  // Load next ref number and default site on open
  useEffect(() => {
    if (isOpen) {
      setServerError('')
      setErrors({})
      if (sites.length > 0 && !formData.siteId) {
        setFormData((prev) => ({ ...prev, siteId: sites[0]._id || sites[0].id }))
      }
      materialService.getNextRef()
        .then((res) => {
          if (res?.refNumber) setRefNumber(res.refNumber)
        })
        .catch(() => {
          const fallback = `MAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`
          setRefNumber(fallback)
        })
    }
  }, [isOpen, sites])

  // Derive the list of materials to show based on selected supplier's categories
  const materialOptions = useMemo(() => {
    if (!formData.supplierId) return MATERIALS
    const selectedSupplier = suppliers.find(
      (s) => String(s._id || s.id) === String(formData.supplierId)
    )
    if (!selectedSupplier?.categories) return MATERIALS
    const supplierCats = selectedSupplier.categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    if (supplierCats.length === 0) return MATERIALS
    const filtered = MATERIALS.filter((m) => supplierCats.includes(m))
    return filtered.length > 0 ? filtered : supplierCats
  }, [formData.supplierId, suppliers])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }
      // When supplier changes, clear material if it's no longer in that supplier's categories
      if (name === 'supplierId') {
        const newSupplier = suppliers.find(
          (s) => String(s._id || s.id) === String(value)
        )
        const cats = newSupplier?.categories
          ? newSupplier.categories.split(',').map((c) => c.trim()).filter(Boolean)
          : []
        const allFiltered = MATERIALS.filter((m) => cats.includes(m))
        const available = allFiltered.length > 0 ? allFiltered : (cats.length > 0 ? cats : MATERIALS)
        if (prev.material && !available.includes(prev.material)) {
          updated.material = ''
        }
      }
      return updated
    })
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    if (serverError) setServerError('')
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.purchaseDate) {
      newErrors.purchaseDate = 'Purchase date is required.'
    }
    if (!formData.siteId) {
      newErrors.siteId = 'Construction site is required.'
    }
    if (!formData.material) {
      newErrors.material = 'Material is required.'
    }

    const q = Number(formData.quantity)
    if (!formData.quantity || isNaN(q) || q <= 0) {
      newErrors.quantity = 'Please enter a valid quantity greater than 0.'
    }

    const r = Number(formData.ratePerUnit)
    if (formData.ratePerUnit === '' || isNaN(r) || r < 0) {
      newErrors.ratePerUnit = 'Please enter a valid rate per unit.'
    }

    if (formData.paidAmount !== '' && formData.paidAmount !== undefined) {
      const p = Number(formData.paidAmount)
      if (isNaN(p) || p < 0) {
        newErrors.paidAmount = 'Paid amount cannot be negative.'
      } else if (p > totalAmount) {
        newErrors.paidAmount = 'Paid amount cannot exceed total amount.'
      } else if (p > 0) {
        if (!formData.bankAccountId) {
          newErrors.bankAccountId = 'Please select a bank account.'
        } else {
          const selectedBank = bankAccounts.find(
            (b) => String(b._id || b.id) === String(formData.bankAccountId)
          )
          if (selectedBank) {
            const bal = Number(selectedBank.balance || 0)
            if (bal <= 0) {
              newErrors.bankAccountId = 'This bank account has zero balance. Please select another bank account.'
            } else if (bal < p) {
              newErrors.bankAccountId = `Insufficient bank balance. Available balance: ₹${bal.toLocaleString('en-IN')}.`
            }
          }
        }
      }
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      const firstMsg = Object.values(newErrors)[0]
      setServerError(firstMsg)
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    if (!validate()) return

    const numQuantity = Number(formData.quantity)
    const numRate = Number(formData.ratePerUnit)
    const computedTotal = Number((numQuantity * numRate).toFixed(2))
    const numPaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
      ? Number(formData.paidAmount)
      : 0

    if (numPaid < 0) {
      setServerError('Paid amount cannot be negative.')
      return
    }

    if (numPaid > computedTotal) {
      setServerError('Paid amount cannot exceed total amount.')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        refNumber,
        purchaseDate: formData.purchaseDate,
        siteId: formData.siteId,
        supplierId: formData.supplierId || null,
        category: formData.material,
        materialName: formData.material,
        quantity: numQuantity,
        unit: formData.unit,
        ratePerUnit: numRate,
        unitPrice: numRate,
        totalAmount: computedTotal,
        totalCost: computedTotal,
        paidAmount: numPaid,
        bankAccountId: numPaid > 0 ? (formData.bankAccountId || undefined) : undefined,
        paymentStatus,
        paymentMethod: formData.paymentMethod,
        remark: formData.remark,
        notes: formData.remark,
      }

      const result = await materialService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Purchase "${refNumber}" saved successfully!`,
        })
      }

      setFormData({
        purchaseDate: getTodayString(),
        siteId: sites.length > 0 ? (sites[0]._id || sites[0].id) : '',
        supplierId: '',
        material: 'Cement',
        quantity: '',
        unit: 'Bags',
        ratePerUnit: '',
        paymentMethod: 'Bank Transfer',
        bankAccountId: '',
        paidAmount: '',
        remark: '',
      })
      setErrors({})

      if (onPurchaseCreated) {
        onPurchaseCreated(result)
      }

      onClose()
    } catch (err) {
      const msg = err.message || 'Failed to record purchase. Please check inputs.'
      setServerError(msg)
      if (showNotification) {
        showNotification({
          type: 'error',
          message: msg,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ width: '820px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge" style={{ backgroundColor: '#E0F2FE', color: '#0284C7' }}>
              <Package size={20} />
            </div>
            <div>
              <h3 className="modal-title">Add Purchase</h3>
              <p className="modal-subtitle">Record a material purchase and assign it to a construction site.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {serverError && (
          <div className="form-alert form-alert-error" style={{ margin: '16px 24px 0 24px' }}>
            {serverError}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-grid">
            {/* 1. Purchase Reference Number */}
            <div className="form-group">
              <label className="form-label labour-form-label">Purchase Reference #</label>
              <input
                type="text"
                className="form-input"
                style={{ backgroundColor: '#F8FAFC', fontWeight: 600, color: '#334155' }}
                value={refNumber}
                readOnly
                tabIndex={-1}
              />
            </div>

            {/* 2. Purchase Date * */}
            <div className="form-group">
              <label className="form-label labour-form-label">Purchase Date *</label>
              <input
                type="date"
                name="purchaseDate"
                className={`form-input ${errors.purchaseDate ? 'input-error' : ''}`}
                value={formData.purchaseDate}
                onChange={handleChange}
              />
              {errors.purchaseDate && <span className="field-error-msg">{errors.purchaseDate}</span>}
            </div>

            {/* 3. Construction Site * */}
            <div className="form-group">
              <label className="form-label labour-form-label">Construction Site *</label>
              <select
                name="siteId"
                className={`form-select ${errors.siteId ? 'input-error' : ''}`}
                value={formData.siteId}
                onChange={handleChange}
              >
                <option value="">Select a Site</option>
                {sites.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.siteId && <span className="field-error-msg">{errors.siteId}</span>}
            </div>

            {/* 4. Supplier */}
            <div className="form-group">
              <label className="form-label labour-form-label">Supplier</label>
              <select
                name="supplierId"
                className="form-select"
                value={formData.supplierId}
                onChange={handleChange}
              >
                <option value="">Select a Supplier (Optional)</option>
                {suppliers.map((sup) => (
                  <option key={sup._id || sup.id} value={sup._id || sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Material * */}
            <div className="form-group">
              <label className="form-label labour-form-label">Material *</label>
              <select
                name="material"
                className={`form-select ${errors.material ? 'input-error' : ''}`}
                value={formData.material}
                onChange={handleChange}
              >
                <option value="">-- Select material --</option>
                {materialOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {errors.material && <span className="field-error-msg">{errors.material}</span>}
            </div>

            {/* 6. Quantity * */}
            <div className="form-group">
              <label className="form-label labour-form-label">Quantity *</label>
              <input
                type="number"
                name="quantity"
                className={`form-input ${errors.quantity ? 'input-error' : ''}`}
                placeholder="0"
                min="0.01"
                step="any"
                value={formData.quantity}
                onChange={handleChange}
              />
              {errors.quantity && <span className="field-error-msg">{errors.quantity}</span>}
            </div>

            {/* 7. Unit */}
            <div className="form-group">
              <label className="form-label labour-form-label">Unit</label>
              <select
                name="unit"
                className="form-select"
                value={formData.unit}
                onChange={handleChange}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* 8. Rate Per Unit (₹) * */}
            <div className="form-group">
              <label className="form-label labour-form-label">Rate Per Unit (₹) *</label>
              <div className="input-with-prefix">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  name="ratePerUnit"
                  className={`form-input with-prefix ${errors.ratePerUnit ? 'input-error' : ''}`}
                  placeholder="0"
                  min="0"
                  step="any"
                  value={formData.ratePerUnit}
                  onChange={handleChange}
                />
              </div>
              {errors.ratePerUnit && <span className="field-error-msg">{errors.ratePerUnit}</span>}
            </div>

            {/* 9. Payment Method */}
            <div className="form-group">
              <label className="form-label labour-form-label">Payment Method</label>
              <select
                name="paymentMethod"
                className="form-select"
                value={formData.paymentMethod}
                onChange={handleChange}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>

            {/* 10. Bank Account */}
            <div className="form-group">
              <label className="form-label labour-form-label">Bank Account</label>
              <select
                name="bankAccountId"
                className={`form-select ${errors.bankAccountId ? 'input-error' : ''}`}
                value={formData.bankAccountId}
                onChange={handleChange}
              >
                <option value="">Select Bank Account</option>
                {bankAccounts.map((b) => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.bankName} (₹{Number(b.balance || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
              {errors.bankAccountId && <span className="field-error-msg">{errors.bankAccountId}</span>}
            </div>

            {/* 11. Total Amount (₹) - Read-only calculated */}
            <div className="form-group">
              <label className="form-label labour-form-label">Total Amount (₹)</label>
              <div className="input-with-prefix">
                <span className="input-prefix">₹</span>
                <input
                  type="text"
                  className="form-input with-prefix"
                  style={{ backgroundColor: '#F8FAFC', fontWeight: 600, color: '#334155' }}
                  value={totalAmount > 0 ? totalAmount.toLocaleString('en-IN') : '0'}
                  readOnly
                  tabIndex={-1}
                  aria-label="Total Amount calculated automatically"
                />
              </div>
            </div>

            {/* 12. Paid Amount (₹) */}
            <div className="form-group">
              <label className="form-label labour-form-label">Paid Amount (₹)</label>
              <div className="input-with-prefix">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  name="paidAmount"
                  className={`form-input with-prefix ${errors.paidAmount ? 'input-error' : ''}`}
                  placeholder="0"
                  min="0"
                  max={totalAmount > 0 ? totalAmount : undefined}
                  step="any"
                  value={formData.paidAmount}
                  onChange={handleChange}
                />
              </div>
              {errors.paidAmount && <span className="field-error-msg">{errors.paidAmount}</span>}
            </div>

            {/* 13. Remark */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label labour-form-label">Remark</label>
              <input
                type="text"
                name="remark"
                className="form-input"
                placeholder="Add invoice number or a note"
                value={formData.remark}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary-action"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary-action"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
