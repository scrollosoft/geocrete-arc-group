import React, { useState, useEffect } from 'react'
import { X, Wallet, Trash2 } from 'lucide-react'
import { cashService } from '../services/cashService.js'

export default function EditCashModal({
  isOpen,
  onClose,
  cashAccount,
  onCashUpdated,
  onCashDeleted,
  showNotification,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: 'Cash in Hand',
  })

  // Populate existing money whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setError('')
      setSubmitting(false)
      setDeleting(false)
      const existingMoney =
        cashAccount?.balance !== undefined && cashAccount?.balance !== null
          ? String(cashAccount.balance)
          : ''
      setFormData({
        amount: existingMoney,
        date: new Date().toISOString().slice(0, 10),
        description: 'Cash in Hand',
      })
    }
  }, [isOpen, cashAccount])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const numAmount = Number(formData.amount)
    if (formData.amount === '' || isNaN(numAmount) || numAmount < 0) {
      setError('Please enter a valid cash amount (0 or positive).')
      return
    }

    try {
      setSubmitting(true)
      const targetId = cashAccount?._id || cashAccount?.id
      // Directly update the cash account money value without creating a transaction or "Cash Added" entry
      await cashService.updateAccount({
        id: targetId,
        balance: numAmount,
        description: formData.description.trim() || 'Cash in Hand',
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Cash account balance updated successfully!',
        })
      }

      if (onCashUpdated) {
        await onCashUpdated()
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update cash balance')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this cash account?')
    if (!confirmed) return

    try {
      setDeleting(true)
      setError('')
      const targetId = cashAccount?._id || cashAccount?.id
      // Delete the whole cash account
      await cashService.deleteAccount(targetId)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Cash account deleted successfully!',
        })
      }

      if (onCashDeleted) {
        await onCashDeleted()
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete cash account')
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
            <div className="modal-icon-badge" style={{ background: '#ECFDF5', color: '#10B981' }}>
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="modal-title">Edit Cash Account</h3>
              <p className="modal-subtitle">
                Update available cash in hand or delete cash account.
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
              {/* Account Type (Read-only badge) */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Account Type</label>
                <input
                  type="text"
                  className="form-input"
                  value="Cash in Hand (Physical Cash)"
                  readOnly
                  style={{ background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }}
                />
              </div>

              {/* Date */}
              <div className="form-group">
                <label className="form-label">
                  Date <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  className="form-input"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Available Cash Amount */}
              <div className="form-group">
                <label className="form-label">
                  Cash Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  className="form-input"
                  placeholder="e.g. 500000"
                  min="0"
                  step="any"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description / Note</label>
                <input
                  type="text"
                  name="description"
                  className="form-input"
                  placeholder="e.g. Cash in Hand, Initial Cash Deposit"
                  value={formData.description}
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
              title="Delete this cash account"
            >
              <Trash2 size={15} />
              <span>{deleting ? 'Deleting...' : 'Delete Cash'}</span>
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
                style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
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
