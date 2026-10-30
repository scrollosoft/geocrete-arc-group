import React, { useState, useEffect, useMemo } from 'react'
import { X, Building2, ShieldAlert } from 'lucide-react'
import { siteService } from '../services/siteService.js'
import { bankAccountService } from '../services/bankAccountService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

const maskAccountNumber = (accNum) => {
  if (!accNum) return 'â€¢â€¢â€¢â€¢'
  const str = String(accNum).trim()
  return `â€¢â€¢â€¢â€¢ ${str.slice(-4)}`
}

export default function AddClientSiteModal({
  isOpen,
  onClose,
  onCreated,
  showNotification,
  bankAccounts: initialBankAccounts,
}) {
  const [formData, setFormData] = useState(() => ({
    name: '',
    siteOwner: '',
    contactNumber: '',
    email: '',
    location: '',
    address: '',
    startDate: getTodayString(),
    expectedCompletionDate: '',
    status: 'Active',
    projectValue: '',
    advanceAmount: '',
    totalReceived: '',
    bankAccountId: '',
    description: '',
  }))

  const [bankAccounts, setBankAccounts] = useState(initialBankAccounts || [])
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load bank accounts if not supplied or empty
  useEffect(() => {
    if (isOpen) {
      if (initialBankAccounts && initialBankAccounts.length > 0) {
        setBankAccounts(initialBankAccounts)
      } else {
        setLoadingBanks(true)
        bankAccountService
          .getAll()
          .then((data) => setBankAccounts(data || []))
          .catch((err) => console.error('Failed to load bank accounts for modal:', err))
          .finally(() => setLoadingBanks(false))
      }
    }
  }, [isOpen, initialBankAccounts])

  // Calculated read-only Balance Receivable = Project Value - Total Received
  const balanceReceivable = useMemo(() => {
    const pVal = Number(formData.projectValue) || 0
    const rec = Number(formData.totalReceived) || 0
    return Math.max(0, pVal - rec)
  }, [formData.projectValue, formData.totalReceived])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const validate = () => {
    // 1. Site Name
    if (!formData.name.trim()) {
      return 'Site Name is required.'
    }
    // 2. Site Owner / Client Name
    if (!formData.siteOwner.trim()) {
      return 'Site Owner / Client Name is required.'
    }
    // 3. Contact Number
    if (!formData.contactNumber.trim()) {
      return 'Contact Number is required.'
    }
    // 4. Email validation if provided
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email.trim())) {
        return 'Please enter a valid email address.'
      }
    }
    // 5. Location
    if (!formData.location.trim()) {
      return 'Construction site location is required.'
    }
    // 8. Expected Completion not earlier than Start Date
    if (formData.startDate && formData.expectedCompletionDate) {
      if (formData.expectedCompletionDate < formData.startDate) {
        return 'Expected completion date cannot be earlier than start date.'
      }
    }
    // 10. Project Value
    if (formData.projectValue === '' || formData.projectValue === null || formData.projectValue === undefined) {
      return 'Project Value is required.'
    }
    const pVal = Number(formData.projectValue)
    if (isNaN(pVal) || pVal < 0) {
      return 'Project Value must be a valid non-negative amount.'
    }
    // 11. Advance Amount
    const adv = formData.advanceAmount !== '' ? Number(formData.advanceAmount) : 0
    if (isNaN(adv) || adv < 0) {
      return 'Advance Amount must be a valid non-negative amount.'
    }
    if (adv > pVal) {
      return 'Advance Amount cannot exceed Project Value.'
    }
    // 12. Total Received
    const totRec = formData.totalReceived !== '' ? Number(formData.totalReceived) : 0
    if (isNaN(totRec) || totRec < 0) {
      return 'Total Received must be a valid non-negative amount.'
    }
    if (totRec > pVal) {
      return 'Total Received cannot exceed Project Value.'
    }

    // 13. Bank Account validation
    if (totRec > 0) {
      if (bankAccounts.length === 0) {
        return 'No bank accounts exist. Please add a bank account in the Payments page first before receiving payments.'
      }
      if (!formData.bankAccountId) {
        return 'Bank Account selection is required when Total Received is greater than â‚¹0.'
      }
    }

    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        name: formData.name.trim(),
        siteOwner: formData.siteOwner.trim(),
        contactNumber: formData.contactNumber.trim(),
        email: formData.email.trim(),
        location: formData.location.trim(),
        address: formData.address.trim(),
        startDate: formData.startDate,
        expectedCompletionDate: formData.expectedCompletionDate || null,
        status: formData.status || 'Active',
        projectValue: Number(formData.projectValue) || 0,
        advanceAmount: formData.advanceAmount !== '' ? Number(formData.advanceAmount) : 0,
        totalReceived: formData.totalReceived !== '' ? Number(formData.totalReceived) : 0,
        bankAccountId: formData.bankAccountId ? Number(formData.bankAccountId) : null,
        description: formData.description.trim(),
      }

      const created = await siteService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Site "${created.name || payload.name}" & Client "${created.siteOwner || payload.siteOwner}" added successfully!`,
        })
      }

      // Reset form state
      setFormData({
        name: '',
        siteOwner: '',
        contactNumber: '',
        email: '',
        location: '',
        address: '',
        startDate: getTodayString(),
        expectedCompletionDate: '',
        status: 'Active',
        projectValue: '',
        advanceAmount: '',
        totalReceived: '',
        bankAccountId: '',
        description: '',
      })

      if (onCreated) {
        await onCreated(created)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save unified client and site:', err)
      setError(err.message || 'Failed to save site and client. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(val || 0))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ width: '740px', maxWidth: '96vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="modal-title">Add Client / Site Owner & Construction Site</h3>
              <p className="modal-subtitle">
                Create a construction site, add owner details, and configure project finances.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
            {error && (
              <div className="modal-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Section A: Site and Client Information */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#70829F',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                borderBottom: '1px solid #E5EAF1',
                paddingBottom: '4px',
              }}
            >
              A. Site & Client Information
            </div>

            <div className="modal-form-grid">
              {/* 1. Site Name */}
              <div className="form-group">
                <label className="form-label">
                  Site Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="e.g. Aarav Heights"
                  value={formData.name}
                  onChange={handleChange}
                  autoFocus
                />
              </div>

              {/* 2. Site Owner / Client Name */}
              <div className="form-group">
                <label className="form-label">
                  Site Owner / Client Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="siteOwner"
                  className="form-input"
                  placeholder="e.g. Rajesh Mehta"
                  value={formData.siteOwner}
                  onChange={handleChange}
                />
              </div>

              {/* 3. Contact Number */}
              <div className="form-group">
                <label className="form-label">
                  Contact Number <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="contactNumber"
                  className="form-input"
                  placeholder="e.g. +91 98220 11001"
                  value={formData.contactNumber}
                  onChange={handleChange}
                />
              </div>

              {/* 4. Email Address */}
              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="e.g. client@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              {/* 5. Location */}
              <div className="form-group">
                <label className="form-label">
                  Location (Site) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  className="form-input"
                  placeholder="e.g. Baner, Pune"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>

              {/* 6. Address / City */}
              <div className="form-group">
                <label className="form-label">Address / City (Client/Owner)</label>
                <input
                  type="text"
                  name="address"
                  className="form-input"
                  placeholder="e.g. Flat 402, MG Road, Pune"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>

              {/* 7. Start Date */}
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  className="form-input"
                  value={formData.startDate}
                  onChange={handleChange}
                />
              </div>

              {/* 8. Expected Completion */}
              <div className="form-group">
                <label className="form-label">Expected Completion</label>
                <input
                  type="date"
                  name="expectedCompletionDate"
                  className="form-input"
                  value={formData.expectedCompletionDate}
                  onChange={handleChange}
                />
              </div>

              {/* 9. Project Status */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Project Status</label>
                <select
                  name="status"
                  className="form-select"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section B: Project Financial Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#70829F',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                borderBottom: '1px solid #E5EAF1',
                paddingBottom: '4px',
              }}
            >
              B. Project Financial Details
            </div>

            <div className="modal-form-grid">
              {/* 10. Project Value */}
              <div className="form-group">
                <label className="form-label">
                  Project Value (â‚¹) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  name="projectValue"
                  className="form-input"
                  placeholder="e.g. 10000"
                  min="0"
                  step="any"
                  value={formData.projectValue}
                  onChange={handleChange}
                />
              </div>

              {/* 11. Advance Amount */}
              <div className="form-group">
                <label className="form-label">Advance Amount (â‚¹)</label>
                <input
                  type="number"
                  name="advanceAmount"
                  className="form-input"
                  placeholder="e.g. 5000"
                  min="0"
                  step="any"
                  value={formData.advanceAmount}
                  onChange={handleChange}
                />
              </div>

              {/* 12. Total Received */}
              <div className="form-group">
                <label className="form-label">Total Received (â‚¹)</label>
                <input
                  type="number"
                  name="totalReceived"
                  className="form-input"
                  placeholder="e.g. 5000"
                  min="0"
                  step="any"
                  value={formData.totalReceived}
                  onChange={handleChange}
                />
              </div>

              {/* 13. Bank Account */}
              <div className="form-group">
                <label className="form-label">
                  Bank Account{' '}
                  {Number(formData.totalReceived) > 0 ? (
                    <span style={{ color: '#EF4444' }}>*</span>
                  ) : (
                    <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Optional)</span>
                  )}
                </label>
                <select
                  name="bankAccountId"
                  className="form-select"
                  value={formData.bankAccountId}
                  onChange={handleChange}
                  disabled={loadingBanks}
                >
                  <option value="">
                    {loadingBanks
                      ? 'Loading banks...'
                      : bankAccounts.length === 0
                      ? 'No bank accounts available'
                      : 'Select Bank Account'}
                  </option>
                  {bankAccounts.map((b) => (
                    <option key={b.id || b._id} value={b.id || b._id}>
                      {b.bankName} ({maskAccountNumber(b.accountNumber)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Calculated Read-Only Balance Receivable */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">
                  Balance Receivable (â‚¹) <span style={{ color: '#94A3B8' }}>(Calculated)</span>
                </label>
                <div
                  style={{
                    backgroundColor: '#F8FAFD',
                    border: '1px solid #E5EAF1',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#70829F', fontWeight: 600 }}>
                    Project Value âˆ’ Total Actual Received:
                  </span>
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: balanceReceivable > 0 ? '#0293DE' : '#059669',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatINR(balanceReceivable)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          </div>{/* end modal-body */}

          {/* Modal Footer */}
          <div className="modal-footer">
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
              {submitting ? 'Saving Site & Finances...' : 'Save Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

