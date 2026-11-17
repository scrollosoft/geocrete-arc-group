import React, { useState, useEffect } from 'react'
import { X, Building2, Trash2 } from 'lucide-react'
import { bankAccountService } from '../services/bankAccountService.js'

export default function EditBankModal({
  isOpen,
  onClose,
  account,
  onBankUpdated,
  onBankDeleted,
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
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && account) {
      setFormData({
        bankName: account.bankName || account.bank_name || '',
        ifscCode: account.ifscCode || account.ifsc_code || '',
        accountHolderName: account.accountHolderName || account.account_holder_name || '',
        accountNumber: account.accountNumber || account.account_number || '',
        balance: account.balance !== undefined && account.balance !== null ? String(account.balance) : '',
      })
      setError('')
      setSubmitting(false)
      setDeleting(false)
    }
  }, [isOpen, account])

  if (!isOpen || !account) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'ifscCode') {
      setFormData((prev) => ({ ...prev, [name]: value.toUpperCase().slice(0, 11) }))
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
    if (error) setError('')
  }

  const validate = () => {
    if (!formData.bankName.trim()) {
      return 'Bank name is required.'
    }

    const trimmedIfsc = formData.ifscCode.trim().toUpperCase()
    if (!trimmedIfsc) {
      return 'IFSC code is required.'
    }
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
    if (!ifscRegex.test(trimmedIfsc)) {
      return 'Invalid IFSC code format (must be 11 characters e.g. HDFC0001234).'
    }

    if (!formData.accountHolderName.trim()) {
      return 'Account holder name is required.'
    }

    const trimmedAccNum = String(formData.accountNumber).trim()
    if (!trimmedAccNum) {
      return 'Account number is required.'
    }
    const accRegex = /^\d{9,18}$/
    if (!accRegex.test(trimmedAccNum)) {
      return 'Account number must be between 9 and 18 digits.'
    }

    const currentId = String(account._id || account.id || '')
    const isDuplicate = existingAccounts.some((acc) => {
      const otherId = String(acc._id || acc.id || '')
      return otherId !== currentId && String(acc.accountNumber || '').trim() === trimmedAccNum
    })
    if (isDuplicate) {
      return 'Another bank account with this account number already exists.'
    }

    if (formData.balance === '' || formData.balance === null || formData.balance === undefined) {
      return 'Balance is required.'
    }
    const numBalance = Number(formData.balance)
    if (isNaN(numBalance) || numBalance < 0) {
      return 'Balance must be 0 or a positive number.'
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

      const accountId = account._id || account.id
      const updated = await bankAccountService.update(accountId, payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Bank account "${updated.bankName || payload.bankName}" updated successfully!`,
        })
      }

      if (onBankUpdated) {
        await onBankUpdated(updated)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update bank account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      setError('')
      const accountId = account._id || account.id
      const bankName = account.bankName || account.bank_name || 'this bank account'
      await bankAccountService.delete(accountId)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Bank account "${bankName}" deleted successfully!`,
        })
      }

      if (onBankDeleted) {
        await onBankDeleted(account)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete bank account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="modal-title">Edit Bank Account</h3>
              <p className="modal-subtitle">
                Update account details or delete this bank account.
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

              {/* 5. Balance */}
              <div className="form-group">
                <label className="form-label">
                  Balance (₹) <span style={{ color: '#EF4444' }}>*</span>
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
          </div>

          {/* Modal Footer with Delete on Left and Cancel/Save on Right */}
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting || deleting}
              style={{
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: submitting || deleting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Delete this bank account"
            >
              <Trash2 size={15} />
              <span>{deleting ? 'Deleting...' : 'Delete Bank'}</span>
            </button>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary-action"
                onClick={onClose}
                disabled={submitting || deleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary-action"
                disabled={submitting || deleting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

