import React, { useState } from 'react'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { consultingService } from '../services/consultingService.js'

export default function ConsultingForm({
  bankAccounts = [],
  onConsultingCreated,
  showNotification,
}) {
  const [formData, setFormData] = useState({
    siteName: '',
    siteOwner: '',
    location: '',
    totalBudget: '',
    advanceAmount: '',
    receivedAmount: '',
    bankAccountId: bankAccounts[0]?.id || bankAccounts[0]?._id ? String(bankAccounts[0].id || bankAccounts[0]._id) : '',
    paymentMethod: 'UPI',
    note: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const updated = { ...prev, [name]: value }
      // If user sets advance amount and received is empty or was tracking advance, keep received in sync
      if (name === 'advanceAmount' && (prev.receivedAmount === '' || prev.receivedAmount === prev.advanceAmount)) {
        updated.receivedAmount = value
      }
      return updated
    })
    if (errorMessage) setErrorMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    // 1. Validation
    if (!formData.siteName.trim()) {
      setErrorMessage('Site Name is required.')
      return
    }
    if (!formData.siteOwner.trim()) {
      setErrorMessage('Site Owner is required.')
      return
    }
    if (!formData.location.trim()) {
      setErrorMessage('City / Location is required.')
      return
    }

    const numBudget = Number(formData.totalBudget)
    if (isNaN(numBudget) || numBudget <= 0) {
      setErrorMessage('Please enter a valid Total Budget greater than zero.')
      return
    }

    const numAdvance = formData.advanceAmount !== '' ? Number(formData.advanceAmount) : 0
    if (isNaN(numAdvance) || numAdvance < 0) {
      setErrorMessage('Advance Amount must be a valid non-negative number.')
      return
    }
    if (numAdvance > numBudget) {
      setErrorMessage('Advance Amount cannot exceed Total Budget.')
      return
    }

    const numReceived = formData.receivedAmount !== '' ? Number(formData.receivedAmount) : numAdvance
    if (isNaN(numReceived) || numReceived < 0) {
      setErrorMessage('Received Amount must be a valid non-negative number.')
      return
    }
    if (numReceived > numBudget) {
      setErrorMessage('Received Amount cannot exceed Total Budget.')
      return
    }

    if (numReceived > 0 && !formData.bankAccountId) {
      setErrorMessage('Please select a Bank Name for the received payment.')
      return
    }

    setSubmitting(true)
    try {
      const created = await consultingService.create({
        siteName: formData.siteName.trim(),
        siteOwner: formData.siteOwner.trim(),
        location: formData.location.trim(),
        totalBudget: numBudget,
        advanceAmount: numAdvance,
        receivedAmount: numReceived,
        bankAccountId: formData.bankAccountId ? Number(formData.bankAccountId) : null,
        paymentMethod: formData.paymentMethod || 'UPI',
        note: formData.note.trim(),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Consulting entry "${created.siteName}" saved successfully!`,
        })
      }

      // Reset form
      setFormData({
        siteName: '',
        siteOwner: '',
        location: '',
        totalBudget: '',
        advanceAmount: '',
        receivedAmount: '',
        bankAccountId: bankAccounts[0]?.id || bankAccounts[0]?._id ? String(bankAccounts[0].id || bankAccounts[0]._id) : '',
        paymentMethod: 'UPI',
        note: '',
      })

      if (onConsultingCreated) {
        onConsultingCreated(created)
      }
    } catch (err) {
      console.error('Failed to create consulting entry:', err)
      setErrorMessage(err.message || 'Failed to save consulting entry. Please check the inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="daily-expense-section" id="consulting-form">
      <div className="section-header-compact">
        <h2 className="section-title">Add Consulting</h2>
        <p className="section-subtitle">Record new consulting project details, client, and payment receipt.</p>
      </div>

      {errorMessage && (
        <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="daily-expense-form" onSubmit={handleSubmit}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {/* Site Name */}
          <div className="form-group">
            <label className="form-label">
              Site Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              name="siteName"
              className="form-input"
              placeholder="e.g. Green Villa Consulting"
              value={formData.siteName}
              onChange={handleChange}
              required
            />
          </div>

          {/* Site Owner */}
          <div className="form-group">
            <label className="form-label">
              Site Owner <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              name="siteOwner"
              className="form-input"
              placeholder="e.g. Rajesh Sharma"
              value={formData.siteOwner}
              onChange={handleChange}
              required
            />
          </div>

          {/* City / Location */}
          <div className="form-group">
            <label className="form-label">
              City / Location <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              name="location"
              className="form-input"
              placeholder="e.g. Kothrud, Pune"
              value={formData.location}
              onChange={handleChange}
              required
            />
          </div>

          {/* Total Budget */}
          <div className="form-group">
            <label className="form-label">
              Total Budget (₹) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="number"
              name="totalBudget"
              className="form-input"
              placeholder="e.g. 50000"
              min="1"
              step="any"
              value={formData.totalBudget}
              onChange={handleChange}
              required
            />
          </div>

          {/* Advance Amount */}
          <div className="form-group">
            <label className="form-label">Advance Amount (₹)</label>
            <input
              type="number"
              name="advanceAmount"
              className="form-input"
              placeholder="e.g. 15000"
              min="0"
              step="any"
              value={formData.advanceAmount}
              onChange={handleChange}
            />
          </div>

          {/* Received Amount */}
          <div className="form-group">
            <label className="form-label">Received Amount (₹)</label>
            <input
              type="number"
              name="receivedAmount"
              className="form-input"
              placeholder="e.g. 15000"
              min="0"
              step="any"
              value={formData.receivedAmount}
              onChange={handleChange}
            />
          </div>

          {/* Bank Name */}
          <div className="form-group">
            <label className="form-label">
              Bank Name {Number(formData.receivedAmount) > 0 && <span style={{ color: '#DC2626' }}>*</span>}
            </label>
            <select
              name="bankAccountId"
              className="form-select"
              value={formData.bankAccountId}
              onChange={handleChange}
              required={Number(formData.receivedAmount) > 0}
            >
              <option value="">Select Bank Name...</option>
              {bankAccounts.map((b) => (
                <option key={b.id || b._id} value={b.id || b._id}>
                  {b.bankName} (Bal: ₹{Number(b.balance || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select
              name="paymentMethod"
              className="form-select"
              value={formData.paymentMethod}
              onChange={handleChange}
            >
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          {/* Note */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Note (Optional)</label>
            <input
              type="text"
              name="note"
              className="form-input"
              placeholder="e.g. Architectural consultation & site layout"
              value={formData.note}
              onChange={handleChange}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            type="submit"
            className="btn btn-primary-action"
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin-animate" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Add Consulting</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}

