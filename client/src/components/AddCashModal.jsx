import React, { useState, useEffect } from 'react'
import { X, Wallet, Loader2 } from 'lucide-react'
import { cashService } from '../services/cashService.js'

export default function AddCashModal({
  isOpen,
  onClose,
  onCashAdded,
  showNotification,
}) {
  const getToday = () => new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState(getToday())
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setDate(getToday())
      setAmount('')
      setError('')
      setSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const numAmount = Number(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid cash amount greater than zero.')
      return
    }

    try {
      setSubmitting(true)
      const res = await cashService.add({
        date: date || getToday(),
        amount: numAmount,
        description: 'Cash Added',
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `₹${numAmount.toLocaleString('en-IN')} cash added successfully!`,
        })
      }

      if (onCashAdded) {
        await onCashAdded(res)
      }
      onClose()
    } catch (err) {
      console.error('Failed to add cash:', err)
      setError(err.message || 'Failed to add cash. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-icon-badge" style={{ backgroundColor: '#10B98115', color: '#10B981' }}>
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="modal-title">Add Cash</h3>
              <p className="modal-subtitle">
                Record cash added into cash in hand account.
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body" style={{ padding: '20px 24px' }}>
            {error && <div className="modal-error">{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 1. Date */}
              <div className="form-group">
                <label className="form-label">
                  Date <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    if (error) setError('')
                  }}
                  required
                />
              </div>

              {/* 2. Amount */}
              <div className="form-group">
                <label className="form-label">
                  Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#70829F',
                    }}
                  >
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    className="form-input"
                    style={{ paddingLeft: '32px' }}
                    placeholder="Enter cash amount (e.g. 10000)"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      if (error) setError('')
                    }}
                    autoFocus
                    required
                  />
                </div>
                {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#10B981', fontWeight: 500 }}>
                    ₹{Number(amount).toLocaleString('en-IN')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer with Save Cash and Cancel */}
          <div className="modal-footer" style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E5EAF1', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save Cash'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

