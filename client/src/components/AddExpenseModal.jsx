import React, { useState, useEffect, useMemo } from 'react'
import { X, Receipt, Calendar } from 'lucide-react'
import { expenseService } from '../services/expenseService.js'
import { materialService } from '../services/materialService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

const UNITS = [
  'Bags',
  'Tons',
  'Units',
  'Hours',
  'CFT',
  'Trips',
  'Pieces',
  'Days',
  'Kg',
  'Meters',
]

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cheque',
  'Cash',
  'UPI',
  'Credit',
]

export default function AddExpenseModal({
  isOpen,
  onClose,
  sites = [],
  suppliers = [],
  bankAccounts = [],
  onExpenseCreated,
  showNotification,
}) {
  const [formData, setFormData] = useState({
    date: getTodayString(),
    site: '',
    supplier: '',
    category: '',
    quantity: '',
    unit: 'Bags',
    ratePerUnit: '',
    paidAmount: '',
    paymentMethod: 'Bank Transfer',
    bankAccountId: '',
    remark: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [materialsList, setMaterialsList] = useState([])

  // Load actual materials when modal opens
  useEffect(() => {
    if (!isOpen) return
    let active = true
    materialService
      .getAll()
      .then((res) => {
        if (!active) return
        const list = res?.materials || (Array.isArray(res) ? res : [])
        setMaterialsList(list)
      })
      .catch(() => {
        if (active) setMaterialsList([])
      })
    return () => {
      active = false
    }
  }, [isOpen])

  // Pre-select first site if none selected
  useEffect(() => {
    if (isOpen && sites.length > 0 && !formData.site) {
      setFormData((prev) => ({ ...prev, site: sites[0]._id || sites[0].id }))
    }
  }, [isOpen, sites, formData.site])

  // Material options for the dropdown:
  // - If a supplier is selected → show ALL of that supplier's saved categories directly
  // - If no supplier → show unique categories from materialsList purchase records
  const filteredMaterialsList = useMemo(() => {
    if (formData.supplier) {
      const selectedSupplier = suppliers.find(
        (s) => String(s._id || s.id) === String(formData.supplier)
      )
      if (selectedSupplier?.categories) {
        const cats = selectedSupplier.categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
        if (cats.length > 0) {
          const seen = new Set()
          const unique = []
          for (const cat of cats) {
            if (!seen.has(cat.toLowerCase())) {
              seen.add(cat.toLowerCase())
              unique.push({ displayName: cat })
            }
          }
          return unique.sort((a, b) => a.displayName.localeCompare(b.displayName))
        }
      }
      // Supplier selected but has no categories saved
      return []
    }
    // No supplier — show all unique categories from purchase records
    const seen = new Set()
    const unique = []
    for (const m of materialsList) {
      const name = (m.category || m.materialName || m.name || '').trim()
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        unique.push({ ...m, displayName: name })
      }
    }
    return unique.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [materialsList, formData.supplier, suppliers])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }

      // Changing supplier: re-filter material dropdown and clear selection if no longer valid
      if (name === 'supplier') {
        if (value) {
          // Supplier selected — clear category if it's not in the new supplier's categories
          const newSupplier = suppliers.find(
            (s) => String(s._id || s.id) === String(value)
          )
          const cats = newSupplier?.categories
            ? new Set(newSupplier.categories.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean))
            : new Set()
          if (prev.category) {
            const currentName = prev.category.trim().toLowerCase()
            if (cats.size === 0 || !cats.has(currentName)) {
              updated.category = ''
            }
          }
        } else {
          // No supplier (Direct Expense) — clear category so user picks fresh from full list
          updated.category = ''
        }
      }

      // Selecting a material auto-fills unit from that materials row
      if (name === 'category' && value) {
        const match = materialsList.find(
          (m) => (m.category || m.materialName || m.name || '').trim().toLowerCase() === value.trim().toLowerCase()
        )
        if (match?.unit) updated.unit = match.unit
      }

      // Auto-update paidAmount if quantity or ratePerUnit changed
      if (name === 'quantity' || name === 'ratePerUnit') {
        const q = Number(name === 'quantity' ? value : prev.quantity) || 0
        const r = Number(name === 'ratePerUnit' ? value : prev.ratePerUnit) || 0
        updated.paidAmount = q * r > 0 ? String(q * r) : ''
      }
      return updated
    })
    if (error) setError('')
  }

  const calculatedTotal =
    Number(formData.quantity) > 0 && Number(formData.ratePerUnit) > 0
      ? Number(formData.quantity) * Number(formData.ratePerUnit)
      : 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.site) {
      setError('Please select a construction site.')
      return
    }

    if (!formData.category || !formData.category.trim()) {
      setError('Please select a material.')
      return
    }

    const numQuantity = Number(formData.quantity)
    if (isNaN(numQuantity) || numQuantity <= 0) {
      setError('Please enter a valid quantity greater than 0.')
      return
    }

    const numRate = Number(formData.ratePerUnit)
    if (isNaN(numRate) || numRate < 0) {
      setError('Please enter a valid rate per unit.')
      return
    }

    const totalAmount = numQuantity * numRate
    const numPaid =
      formData.paidAmount !== '' && formData.paidAmount !== undefined
        ? Number(formData.paidAmount)
        : totalAmount

    if (numPaid < 0) {
      setError('Paid amount cannot be negative.')
      return
    }

    if (numPaid > totalAmount) {
      setError('Paid amount cannot exceed total amount.')
      return
    }

    if (numPaid > 0 && !formData.bankAccountId) {
      setError('Please select a bank account.')
      return
    }

    if (formData.bankAccountId && numPaid > 0) {
      const selectedBank = bankAccounts.find(
        (b) => String(b._id || b.id) === String(formData.bankAccountId)
      )
      if (selectedBank) {
        const bal = Number(selectedBank.balance || 0)
        if (bal <= 0) {
          setError('This bank account has zero balance. Please select another bank account.')
          return
        }
        if (bal < numPaid) {
          setError(`Insufficient bank balance. Available balance: ₹${bal.toLocaleString('en-IN')}.`)
          return
        }
      }
    }

    try {
      setSubmitting(true)

      const payload = {
        date: formData.date || getTodayString(),
        site: formData.site,
        supplier: formData.supplier || undefined,
        category: formData.category.trim(),
        quantity: numQuantity,
        unit: formData.unit || 'Units',
        ratePerUnit: numRate,
        paidAmount: numPaid,
        bankAccountId: numPaid > 0 ? (formData.bankAccountId || undefined) : undefined,
        paymentMethod: formData.paymentMethod || 'Bank Transfer',
        remark: formData.remark.trim(),
      }

      const created = await expenseService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Expense recorded successfully!',
        })
      }

      // Reset form
      setFormData({
        date: getTodayString(),
        site: sites.length > 0 ? (sites[0]._id || sites[0].id) : '',
        supplier: '',
        category: '',
        quantity: '',
        unit: 'Bags',
        ratePerUnit: '',
        paidAmount: '',
        paymentMethod: 'Bank Transfer',
        bankAccountId: '',
        remark: '',
      })

      if (onExpenseCreated) {
        onExpenseCreated(created)
      }
      onClose()
    } catch (err) {
      console.error('Failed to create expense:', err)
      setError(err.message || 'Failed to save expense. Please check your inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{
          maxWidth: '640px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #E5EAF1' }}>
          <div className="modal-title-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="modal-icon-badge"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#E0F2FE',
                color: '#0293DE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172033', margin: 0 }}>
                Add Expense
              </h3>
              <p className="modal-subtitle" style={{ fontSize: '13px', color: '#70829F', margin: '4px 0 0 0' }}>
                Record daily site expenses, materials or supplier payments
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#70829F',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="form-alert form-alert-error"
            style={{
              margin: '16px 24px 0 24px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#FEE2E2',
              color: '#B91C1C',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form" style={{ padding: '20px 24px' }}>
          <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* 1. Date */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Date *
              </label>
              <input
                type="date"
                name="date"
                className="form-input"
                value={formData.date}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033' }}
              />
            </div>

            {/* 2. Construction Site */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Construction Site *
              </label>
              <select
                name="site"
                className="form-select"
                value={formData.site}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033', background: '#FFFFFF' }}
              >
                <option value="">-- Select Site --</option>
                {sites.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name} ({s.location || 'Site'})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Material — filtered by supplier's categories when a supplier is selected */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Material *
              </label>
              <select
                name="category"
                className="form-select"
                value={formData.category}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033', background: '#FFFFFF' }}
              >
                {filteredMaterialsList.length === 0 ? (
                  <option value="">No materials match this supplier — add a purchase first</option>
                ) : (
                  <>
                    <option value="">-- Select material --</option>
                    {filteredMaterialsList.map((m) => (
                      <option key={m.displayName} value={m.displayName}>
                        {m.displayName}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* 4. Supplier */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Supplier (Optional)
              </label>
              <select
                name="supplier"
                className="form-select"
                value={formData.supplier}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033', background: '#FFFFFF' }}
              >
                <option value="">-- Direct Expense / None --</option>
                {suppliers.map((sup) => (
                  <option key={sup._id || sup.id} value={sup._id || sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>


            {/* 6. Quantity */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Quantity *
              </label>
              <input
                type="number"
                name="quantity"
                className="form-input"
                placeholder="e.g. 50"
                min="0.01"
                step="any"
                value={formData.quantity}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033' }}
              />
            </div>

            {/* 7. Unit */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Unit
              </label>
              <select
                name="unit"
                className="form-select"
                value={formData.unit}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033', background: '#FFFFFF' }}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* 8. Rate per Unit */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Rate per Unit (₹) *
              </label>
              <input
                type="number"
                name="ratePerUnit"
                className="form-input"
                placeholder="e.g. 380"
                min="0"
                step="any"
                value={formData.ratePerUnit}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033' }}
              />
            </div>

            {/* 9. Total Calculated Amount */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#70829F', marginBottom: '6px' }}>
                Total Amount (₹)
              </label>
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0293DE',
                }}
              >
                ₹{calculatedTotal > 0 ? calculatedTotal.toLocaleString('en-IN') : '0'}
              </div>
            </div>

            {/* 10. Paid Amount */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Paid Amount (₹)
              </label>
              <input
                type="number"
                name="paidAmount"
                className="form-input"
                placeholder={calculatedTotal > 0 ? String(calculatedTotal) : 'e.g. 19000'}
                min="0"
                max={calculatedTotal > 0 ? calculatedTotal : undefined}
                step="any"
                value={formData.paidAmount}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033' }}
              />
            </div>

            {/* 11. Payment Method */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Payment Method
              </label>
              <select
                name="paymentMethod"
                className="form-select"
                value={formData.paymentMethod}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033', background: '#FFFFFF' }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* 12. Bank Account */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Bank Account
              </label>
              <select
                name="bankAccountId"
                className="form-select"
                value={formData.bankAccountId}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033', background: '#FFFFFF' }}
              >
                <option value="">-- Select Bank --</option>
                {bankAccounts.map((b) => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.bankName} (₹{Number(b.balance || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            {/* 13. Remark / Notes */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                Remark / Notes (Optional)
              </label>
              <textarea
                name="remark"
                className="form-textarea"
                rows="2"
                placeholder="Invoice reference, delivery note, or any specific details..."
                value={formData.remark}
                onChange={handleChange}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E5EAF1', fontSize: '14px', color: '#172033', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div
            className="modal-actions"
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #E5EAF1',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #E5EAF1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: '#0293DE',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
