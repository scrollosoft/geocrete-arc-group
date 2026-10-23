import React, { useState } from 'react'
import { Calendar, Plus } from 'lucide-react'
import { expenseService } from '../services/expenseService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

export default function DailyExpenseForm({
  sites = [],
  suppliers = [],
  onExpenseCreated,
  showNotification,
}) {
  const [formData, setFormData] = useState(() => ({
    date: getTodayString(),
    site: '',
    supplier: '',
    material: 'Cement',
    quantity: '',
    unit: 'Bags',
    ratePerUnit: '',
    paymentMethod: 'Bank Transfer',
    remark: '',
  }))
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
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

    try {
      setSubmitting(true)
      const payload = {
        date: formData.date,
        site: formData.site,
        supplier: formData.supplier || undefined,
        material: formData.material,
        category: formData.material.toLowerCase().includes('labour') ? 'Labour' : 'Material',
        quantity: Number(formData.quantity),
        unit: formData.unit,
        ratePerUnit: Number(formData.ratePerUnit),
        paymentMethod: formData.paymentMethod,
        remark: formData.remark,
        paidAmount: Number(formData.quantity) * Number(formData.ratePerUnit),
      }

      const created = await expenseService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Expense added successfully and recorded to MongoDB!',
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
              <option value="Cement">Cement</option>
              <option value="Structural steel">Structural steel</option>
              <option value="Bricks & Blocks">Bricks & Blocks</option>
              <option value="River Sand">River Sand</option>
              <option value="Aggregates">Aggregates</option>
              <option value="Ready-Mix Concrete">Ready-Mix Concrete</option>
              <option value="Masonry labour">Masonry labour</option>
              <option value="Excavator rental">Excavator rental</option>
              <option value="Plumbing Supplies">Plumbing Supplies</option>
              <option value="Electrical Cables">Electrical Cables</option>
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

        {/* Row 3: Remark spans 3 cols, Submit button in 4th col */}
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

          <div className="form-group form-submit-group">
            <button
              type="submit"
              className="btn btn-add-expense-submit"
              disabled={submitting}
            >
              <Plus size={16} />
              <span>{submitting ? 'Recording...' : '+ Add Expense'}</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
