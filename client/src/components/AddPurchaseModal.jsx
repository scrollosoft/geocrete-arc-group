import React, { useState, useEffect } from 'react'
import { X, Package, Plus, Trash2, IndianRupee } from 'lucide-react'
import { materialService } from '../services/materialService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

const CATEGORIES = [
  'Cement',
  'Steel',
  'Bricks',
  'Sand',
  'Aggregate',
  'Electrical Materials',
  'Plumbing Materials',
  'Other',
]

const UNITS = [
  'Bags',
  'Kg',
  'Ton',
  'Pieces',
  'Cubic Feet',
  'Cubic Meter',
  'Meter',
  'Liter',
  'Other',
]

const PAYMENT_STATUSES = ['Pending', 'Partial', 'Paid']

export default function AddPurchaseModal({
  isOpen,
  onClose,
  sites = [],
  suppliers = [],
  onPurchaseCreated,
  showNotification,
}) {
  const [refNumber, setRefNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(getTodayString())
  const [siteId, setSiteId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('Pending')
  const [notes, setNotes] = useState('')

  const [items, setItems] = useState([
    {
      id: 1,
      materialName: '',
      category: 'Cement',
      quantity: '',
      unit: 'Bags',
      unitPrice: '',
    },
  ])

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  // Load next ref number and default site on open
  useEffect(() => {
    if (isOpen) {
      if (sites.length > 0 && !siteId) {
        setSiteId(sites[0]._id || sites[0].id)
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

  if (!isOpen) return null

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        materialName: '',
        category: 'Cement',
        quantity: '',
        unit: 'Bags',
        unitPrice: '',
      },
    ])
  }

  const handleRemoveItem = (id) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleItemChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    )
    if (errors[`item_${id}_${field}`]) {
      setErrors((prev) => ({ ...prev, [`item_${id}_${field}`]: '' }))
    }
  }

  const calculateLineTotal = (item) => {
    const q = parseFloat(item.quantity) || 0
    const p = parseFloat(item.unitPrice) || 0
    return q * p
  }

  const grandTotal = items.reduce((acc, it) => acc + calculateLineTotal(it), 0)

  const validate = () => {
    const newErrors = {}

    if (!siteId) {
      newErrors.siteId = 'Construction site is required.'
    }
    if (!purchaseDate) {
      newErrors.purchaseDate = 'Purchase date is required.'
    }

    items.forEach((item, index) => {
      if (!item.materialName || !item.materialName.trim()) {
        newErrors[`item_${item.id}_materialName`] = `Item #${index + 1}: Material name is required.`
      }
      const qty = parseFloat(item.quantity)
      if (isNaN(qty) || qty <= 0) {
        newErrors[`item_${item.id}_quantity`] = `Quantity must be greater than 0.`
      }
      const price = parseFloat(item.unitPrice)
      if (isNaN(price) || price < 0) {
        newErrors[`item_${item.id}_unitPrice`] = `Unit price cannot be negative.`
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    if (!validate()) return

    try {
      setSubmitting(true)

      const payload = {
        refNumber,
        purchaseDate,
        siteId,
        supplierId: supplierId || null,
        paymentStatus,
        notes,
        items: items.map((it) => ({
          materialName: it.materialName.trim(),
          category: it.category,
          quantity: parseFloat(it.quantity),
          unit: it.unit,
          unitPrice: parseFloat(it.unitPrice),
          totalCost: calculateLineTotal(it),
        })),
      }

      const result = await materialService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Purchase "${refNumber}" saved successfully!`,
        })
      }

      if (onPurchaseCreated) {
        onPurchaseCreated(result)
      }

      onClose()
    } catch (err) {
      setServerError(err.message || 'Failed to record purchase. Please check inputs.')
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
            {/* 1. Reference Number */}
            <div className="form-group">
              <label className="form-label labour-form-label">Purchase Reference #</label>
              <input
                type="text"
                className="form-input"
                style={{ backgroundColor: '#F8FAFC', fontWeight: 600, color: '#334155' }}
                value={refNumber}
                readOnly
              />
            </div>

            {/* 2. Purchase Date * */}
            <div className="form-group">
              <label className="form-label labour-form-label">Purchase Date *</label>
              <input
                type="date"
                className={`form-input ${errors.purchaseDate ? 'input-error' : ''}`}
                value={purchaseDate}
                onChange={(e) => {
                  setPurchaseDate(e.target.value)
                  if (errors.purchaseDate) setErrors((prev) => ({ ...prev, purchaseDate: '' }))
                }}
              />
              {errors.purchaseDate && <span className="field-error-msg">{errors.purchaseDate}</span>}
            </div>

            {/* 3. Construction Site * */}
            <div className="form-group">
              <label className="form-label labour-form-label">Construction Site *</label>
              <select
                className={`form-select ${errors.siteId ? 'input-error' : ''}`}
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value)
                  if (errors.siteId) setErrors((prev) => ({ ...prev, siteId: '' }))
                }}
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
                className="form-select"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select a Supplier (Optional)</option>
                {suppliers.map((sup) => (
                  <option key={sup._id || sup.id} value={sup._id || sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items Section */}
          <div style={{ marginTop: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#172033', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Purchase Items ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: '1px dashed #0293DE',
                  color: '#0293DE',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map((item, idx) => {
                const lineTotal = calculateLineTotal(item)
                return (
                  <div
                    key={item.id}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                        Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                          }}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1.2fr 1.2fr', gap: '8px', alignItems: 'flex-start' }}>
                      {/* Material Name */}
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                          Material Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. TMT Steel Fe500"
                          className={`form-input ${errors[`item_${item.id}_materialName`] ? 'input-error' : ''}`}
                          style={{ height: '34px', fontSize: '12.5px' }}
                          value={item.materialName}
                          onChange={(e) => handleItemChange(item.id, 'materialName', e.target.value)}
                        />
                        {errors[`item_${item.id}_materialName`] && (
                          <span className="field-error-msg" style={{ fontSize: '10.5px' }}>{errors[`item_${item.id}_materialName`]}</span>
                        )}
                      </div>

                      {/* Category */}
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                          Category
                        </label>
                        <select
                          className="form-select"
                          style={{ height: '34px', fontSize: '12.5px' }}
                          value={item.category}
                          onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                          Quantity *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="0"
                          className={`form-input ${errors[`item_${item.id}_quantity`] ? 'input-error' : ''}`}
                          style={{ height: '34px', fontSize: '12.5px' }}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        />
                        {errors[`item_${item.id}_quantity`] && (
                          <span className="field-error-msg" style={{ fontSize: '10.5px' }}>{errors[`item_${item.id}_quantity`]}</span>
                        )}
                      </div>

                      {/* Unit */}
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                          Unit
                        </label>
                        <select
                          className="form-select"
                          style={{ height: '34px', fontSize: '12.5px' }}
                          value={item.unit}
                          onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>

                      {/* Unit Price */}
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                          Unit Price (₹) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          className={`form-input ${errors[`item_${item.id}_unitPrice`] ? 'input-error' : ''}`}
                          style={{ height: '34px', fontSize: '12.5px' }}
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(item.id, 'unitPrice', e.target.value)}
                        />
                        {errors[`item_${item.id}_unitPrice`] && (
                          <span className="field-error-msg" style={{ fontSize: '10.5px' }}>{errors[`item_${item.id}_unitPrice`]}</span>
                        )}
                      </div>

                      {/* Line Total */}
                      <div>
                        <label style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                          Line Total (₹)
                        </label>
                        <div
                          style={{
                            height: '34px',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#1E293B',
                          }}
                        >
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Grand Total Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px',
                marginTop: '12px',
                padding: '10px 14px',
                background: '#F1F5F9',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Total Purchase Cost:
              </span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#0284C7' }}>
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Bottom Grid: Payment Status & Notes */}
          <div className="modal-form-grid" style={{ marginTop: '8px' }}>
            <div className="form-group">
              <label className="form-label labour-form-label">Payment Status</label>
              <select
                className="form-select"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                {PAYMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label labour-form-label">Notes / Remarks</label>
              <input
                type="text"
                className="form-input"
                placeholder="Optional notes or supplier invoice number"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
