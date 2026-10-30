import React, { useState } from 'react'
import { X, Wallet, Building2 } from 'lucide-react'
import { bankAccountService } from '../services/bankAccountService.js'

export default function AddBankModal({
  isOpen,
  onClose,
  onBankCreated,
  existingAccounts = [],
  showNotification,
}) {
  const [formData, setFormData] = useState({
    bankName: '',
    ifscCode: '',
    accountHolderName: '',
    accountNumber: '',
    balance: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'ifscCode') {
      // Auto uppercase and limit to 11 chars
      setFormData((prev) => ({ ...prev, [name]: value.toUpperCase().slice(0, 11) }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
    if (error) setError('')
  }

  const validate = () => {
    // 1. Bank Name
    if (!formData.bankName.trim()) {
      return 'Bank name is required.'
    }

    // 2. IFSC Code
    const trimmedIfsc = formData.ifscCode.trim().toUpperCase()
    if (!trimmedIfsc) {
      return 'IFSC code is required.'
    }
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
    if (!ifscRegex.test(trimmedIfsc)) {
      return 'Invalid IFSC code format (must be 11 characters e.g. HDFC0001234).'
    }

    // 3. Account Holder Name
    if (!formData.accountHolderName.trim()) {
      return 'Account holder name is required.'
    }

    // 4. Account Number (preserve leading zeros, 9-18 digits)
    const trimmedAccNum = String(formData.accountNumber).trim()
    if (!trimmedAccNum) {
      return 'Account number is required.'
    }
    const accRegex = /^\d{9,18}$/
    if (!accRegex.test(trimmedAccNum)) {
      return 'Account number must be between 9 and 18 digits.'
    }

    // Duplicate check
    const isDuplicate = existingAccounts.some(
      (acc) => String(acc.accountNumber || '').trim() === trimmedAccNum,
    )
    if (isDuplicate) {
      return 'A bank account with this account number already exists.'
    }

    // 5. Initial Deposit / Opening Balance (allow 0, reject negative/invalid)
    if (formData.balance === '' || formData.balance === null || formData.balance === undefined) {
      return 'Initial deposit / opening balance is required.'
    }
    const numBalance = Number(formData.balance)
    if (isNaN(numBalance) || numBalance < 0) {
      return 'Opening balance must be 0 or a positive number.'
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
        bankName: formData.bankName.trim(),
        ifscCode: formData.ifscCode.trim().toUpperCase(),
        accountHolderName: formData.accountHolderName.trim(),
        accountNumber: String(formData.accountNumber).trim(),
        balance: Number(formData.balance),
      }

      const newAccount = await bankAccountService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Bank account "${newAccount.bankName || payload.bankName}" added successfully!`,
        })
      }

      setFormData({
        bankName: '',
        ifscCode: '',
        accountHolderName: '',
        accountNumber: '',
        balance: '',
      })

      if (onBankCreated) {
        await onBankCreated(newAccount)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save bank account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="modal-title">+ Add Bank</h3>
              <p className="modal-subtitle">
                Enter bank account details and initial opening balance.
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
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-form-grid">
            {/* 1. Bank Name */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">
                Bank Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                name="bankName"
                className="form-input"
                placeholder="e.g. HDFC Bank, State Bank of India"
                value={formData.bankName}
                onChange={handleChange}
                autoFocus
              />
            </div>

            {/* 2. IFSC Code */}
            <div className="form-group">
              <label className="form-label">
                IFSC Code <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                name="ifscCode"
                className="form-input"
                placeholder="e.g. HDFC0001234"
                value={formData.ifscCode}
                onChange={handleChange}
                maxLength={11}
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            {/* 3. Account Holder Name */}
            <div className="form-group">
              <label className="form-label">
                Account Holder Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                name="accountHolderName"
                className="form-input"
                placeholder="e.g. Geocrete Arch Group"
                value={formData.accountHolderName}
                onChange={handleChange}
              />
            </div>

            {/* 4. Account Number */}
            <div className="form-group">
              <label className="form-label">
                Account Number <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                name="accountNumber"
                className="form-input"
                placeholder="e.g. 001401500213"
                value={formData.accountNumber}
                onChange={handleChange}
              />
            </div>

            {/* 5. Initial Deposit / Opening Balance */}
            <div className="form-group">
              <label className="form-label">
                Initial Deposit / Opening Balance (₹) <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="number"
                name="balance"
                className="form-input"
                placeholder="0"
                min="0"
                step="any"
                value={formData.balance}
                onChange={handleChange}
              />
            </div>
          </div>

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
              {submitting ? 'Saving Bank...' : 'Save Bank'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

