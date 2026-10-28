import React, { useState, useEffect, useMemo } from 'react'
import { Calendar, Plus } from 'lucide-react'
import { expenseService } from '../services/expenseService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

const ALL_MATERIALS = [
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

export default function DailyExpenseForm({
  sites = [],
  suppliers = [],
  onExpenseCreated,
  showNotification,
  initialData,
}) {
  const [formData, setFormData] = useState(() => ({
    date: initialData?.date || getTodayString(),
    site: initialData?.site?._id || initialData?.site || '',
    supplier: initialData?.supplier?._id || initialData?.supplier || '',
    material: initialData?.material || 'Cement',
    quantity: initialData?.quantity ?? '',
    unit: initialData?.unit || 'Bags',
    ratePerUnit: initialData?.ratePerUnit ?? '',
    paymentMethod: initialData?.paymentMethod || 'Bank Transfer',
    paidAmount: initialData?.paidAmount ?? '',
    remark: initialData?.remark || '',
  }))

  // Derived: Total Amount = Quantity × Rate Per Unit
  const totalAmount = (() => {
    const q = Number(formData.quantity)
    const r = Number(formData.ratePerUnit)
    return q > 0 && r >= 0 ? Number((q * r).toFixed(2)) : 0
  })()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date || getTodayString(),
        site: initialData.site?._id || initialData.site || '',
        supplier: initialData.supplier?._id || initialData.supplier || '',
        material: initialData.material || 'Cement',
        quantity: initialData.quantity ?? '',
        unit: initialData.unit || 'Bags',
        ratePerUnit: initialData.ratePerUnit ?? '',
        paymentMethod: initialData.paymentMethod || 'Bank Transfer',
        paidAmount: initialData.paidAmount ?? '',
        remark: initialData.remark || '',
      })
    }
  }, [initialData])

  // Derive the list of materials to show based on selected supplier's categories
  const materialOptions = useMemo(() => {
    if (!formData.supplier) return ALL_MATERIALS
    const selectedSupplier = suppliers.find(
      (s) => String(s._id || s.id) === String(formData.supplier)
    )
    if (!selectedSupplier?.categories) return ALL_MATERIALS
    const supplierCats = selectedSupplier.categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    if (supplierCats.length === 0) return ALL_MATERIALS
    // Only show ALL_MATERIALS entries that exist in this supplier's categories
    const filtered = ALL_MATERIALS.filter((m) => supplierCats.includes(m))
    return filtered.length > 0 ? filtered : supplierCats
  }, [formData.supplier, suppliers])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }
      // When supplier changes, clear material if it's no longer available
      if (name === 'supplier') {
        const newSupplier = suppliers.find(
          (s) => String(s._id || s.id) === String(value)
        )
        const cats = newSupplier?.categories
          ? newSupplier.categories.split(',').map((c) => c.trim()).filter(Boolean)
          : []
        const allFiltered = ALL_MATERIALS.filter((m) => cats.includes(m))
        const available = allFiltered.length > 0 ? allFiltered : (cats.length > 0 ? cats : ALL_MATERIALS)
        if (prev.material && !available.includes(prev.material)) {
          updated.material = ''
        }
      }
      return updated
    })
    if (errorMessage) setErrorMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!formData.site) {
      setErrorMessage('Please select a construction site.')
      return
    }

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      setErrorMessage('Please enter a valid quantity greater than 0.')
      return
    }

    if (!formData.ratePerUnit || Number(formData.ratePerUnit) < 0) {
      setErrorMessage('Please enter a valid rate per unit.')
      return
    }

    const numQuantity = Number(formData.quantity)
    const numRate = Number(formData.ratePerUnit)
    const computedTotal = Number((numQuantity * numRate).toFixed(2))
    const numPaid = formData.paidAmount !== '' && formData.paidAmount !== undefined
      ? Number(formData.paidAmount)
      : 0

    if (numPaid < 0) {
      setErrorMessage('Paid amount cannot be negative.')
      return
    }

    if (numPaid > computedTotal) {
      setErrorMessage('Paid amount cannot exceed total amount.')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        date: formData.date,
        site: formData.site,
        supplier: formData.supplier || undefined,
        category: formData.material,
        quantity: numQuantity,
        unit: formData.unit,
        ratePerUnit: numRate,
        paymentMethod: formData.paymentMethod,
        remark: formData.remark,
        paidAmount: numPaid,
      }

      const created = await expenseService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Expense recorded successfully!',
        })
      }

      setFormData({
        date: getTodayString(),
        site: '',
        supplier: '',
        material: 'Cement',
        quantity: '',
        unit: 'Bags',
        ratePerUnit: '',
        paymentMethod: 'Bank Transfer',
        paidAmount: '',
        remark: '',
      })

      if (onExpenseCreated) {
        onExpenseCreated(created)
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to record expense. Please try again.')
      if (showNotification) {
        showNotification({
          type: 'error',
          message: err.message || 'Failed to save expense',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="daily-expense-section" id="daily-expense-form">
      <div className="section-header-compact">
        <h2 className="section-title">Add Daily Expenses</h2>
        <p className="section-subtitle">Record today's material purchase and supplier payment.</p>
      </div>

      {errorMessage && (
        <div className="form-alert form-alert-error">
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="daily-expense-form" onSubmit={handleSubmit}>
        {/* Row 1: Date, Construction Site, Supplier, Material */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="expense-date">Date</label>
            <div className="input-with-icon">
              <input
                id="expense-date"
                type="date"
                name="date"
                className="form-input"
                value={formData.date}
                onChange={handleChange}
                required
              />
              <Calendar size={16} className="input-icon-right" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-site">Construction Site</label>
            <select
              id="expense-site"
              name="site"
              className="form-select"
              value={formData.site}
              onChange={handleChange}
              required
            >
              <option value="">Select site</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.location})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-supplier">Supplier</label>
            <select
              id="expense-supplier"
              name="supplier"
              className="form-select"
              value={formData.supplier}
              onChange={handleChange}
            >
              <option value="">e.g. Shree cement co.</option>
              {suppliers.map((sup) => (
                <option key={sup._id} value={sup._id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-material">Material</label>
            <select
              id="expense-material"
              name="material"
              className="form-select"
              value={formData.material}
              onChange={handleChange}
            >
              <option value="">-- Select material --</option>
              {materialOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Row 2: Quantity, Unit, Rate Per Unit, Payment Method */}
          <div className="form-group">
            <label className="form-label" htmlFor="expense-quantity">Quantity</label>
            <input
              id="expense-quantity"
              type="number"
              name="quantity"
              className="form-input"
              placeholder="0"
              min="0.01"
              step="any"
              value={formData.quantity}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-unit">Unit</label>
            <select
              id="expense-unit"
              name="unit"
              className="form-select"
              value={formData.unit}
              onChange={handleChange}
            >
              <option value="Bags">Bags</option>
              <option value="Tons">Tons</option>
              <option value="Units">Units</option>
              <option value="Kg">Kg</option>
              <option value="Days">Days</option>
              <option value="Hours">Hours</option>
              <option value="Trips">Trips</option>
              <option value="Sq.Ft">Sq.Ft</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-rate">Rate Per Unit</label>
            <div className="input-with-prefix">
              <span className="input-prefix">₹</span>
              <input
                id="expense-rate"
                type="number"
                name="ratePerUnit"
                className="form-input with-prefix"
                placeholder="0"
                min="0"
                step="any"
                value={formData.ratePerUnit}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-payment">Payment Method</label>
            <select
              id="expense-payment"
              name="paymentMethod"
              className="form-select"
              value={formData.paymentMethod}
              onChange={handleChange}
            >
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
            </select>
          </div>
        </div>

        {/* Row 3: Remark, Total Amount (read-only), Paid Amount, Submit */}
        <div className="form-bottom-row">
          <div className="form-group form-remark-group">
            <label className="form-label" htmlFor="expense-remark">Remark</label>
            <input
              id="expense-remark"
              type="text"
              name="remark"
              className="form-input"
              placeholder="Add invoice number or a note"
              value={formData.remark}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-total-amount">Total Amount (₹)</label>
            <div className="input-with-prefix">
              <span className="input-prefix">₹</span>
              <input
                id="expense-total-amount"
                type="text"
                className="form-input with-prefix expense-total-readonly"
                value={totalAmount > 0 ? totalAmount.toLocaleString('en-IN') : '0'}
                readOnly
                tabIndex={-1}
                aria-label="Total Amount calculated automatically"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-paid-amount">Paid Amount (₹)</label>
            <div className="input-with-prefix">
              <span className="input-prefix">₹</span>
              <input
                id="expense-paid-amount"
                type="number"
                name="paidAmount"
                className="form-input with-prefix"
                placeholder="0"
                min="0"
                max={totalAmount > 0 ? totalAmount : undefined}
                step="any"
                value={formData.paidAmount}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group form-submit-group">
            <button
              type="submit"
              className="btn btn-add-expense-submit"
              disabled={submitting}
            >
              <Plus size={16} />
              <span>{submitting ? 'Recording...' : 'Add Expense'}</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
