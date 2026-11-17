import React, { useState, useEffect } from 'react'
import { X, Wallet, Trash2, Loader2 } from 'lucide-react'
import { cashService } from '../services/cashService.js'

export default function EditCashModal({
  isOpen,
  onClose,
  cashAccount,
  onCashUpdated,
  onCashDeleted,
  showNotification,
}) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [records, setRecords] = useState([])
  const [selectedRecordId, setSelectedRecordId] = useState(null)
  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: 'Cash in Hand',
  })

  useEffect(() => {
    if (isOpen) {
      setError('')
      setSubmitting(false)
      setDeleting(false)
      setLoading(true)

      cashService
        .getAll()
        .then((res) => {
          const list = Array.isArray(res?.records) ? res.records : []
          setRecords(list)
          if (list.length > 0) {
            const first = list[0]
            setSelectedRecordId(first.id)
            setFormData({
              amount: String(first.amount || ''),
              date: first.date ? first.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
              description: first.description || 'Cash in Hand',
            })
          } else {
            setSelectedRecordId(null)
            setFormData({
              amount: String(cashAccount?.balance || '0'),
              date: new Date().toISOString().slice(0, 10),
              description: 'Cash in Hand',
            })
          }
        })
        .catch((err) => {
          setError(err.message || 'Failed to load cash data')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [isOpen, cashAccount])

  if (!isOpen) return null

  const handleRecordSelect = (recId) => {
    setSelectedRecordId(recId)
    const found = records.find((r) => String(r.id) === String(recId))
    if (found) {
      setFormData({
        amount: String(found.amount || ''),
        date: found.date ? found.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        description: found.description || 'Cash in Hand',
      })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const numAmount = Number(formData.amount)
    if (!formData.amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid cash amount greater than zero.')
      return
    }

    try {
      setSubmitting(true)
      if (selectedRecordId) {
        await cashService.update(selectedRecordId, {
          amount: numAmount,
          date: formData.date,
          description: formData.description.trim() || 'Cash in Hand',
        })
      } else {
        await cashService.add({
          amount: numAmount,
          date: formData.date,
          description: formData.description.trim() || 'Cash in Hand',
        })
      }

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Cash in Hand updated successfully!',
        })
      }

      if (onCashUpdated) {
        await onCashUpdated()
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update cash')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    // Direct delete without browser alert
    try {
      setDeleting(true)
      setError('')
      if (selectedRecordId) {
        await cashService.delete(selectedRecordId)
      }

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Cash entry deleted successfully!',
        })
      }

      if (onCashDeleted) {
        await onCashDeleted()
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete cash')
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
                Update available cash in hand or delete cash entry.
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

            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#70829F' }}>
                <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px auto' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>Loading cash details...</p>
              </div>
            ) : (
              <div className="modal-form-grid">
                {/* Entry Selector if multiple records exist */}
                {records.length > 1 && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Select Cash Entry to Edit</label>
                    <select
                      className="form-input"
                      value={selectedRecordId || ''}
                      onChange={(e) => handleRecordSelect(e.target.value)}
                    >
                      {records.map((r, i) => (
                        <option key={r.id} value={r.id}>
                          Entry #{i + 1}: ₹{Number(r.amount).toLocaleString('en-IN')} (
                          {r.date ? r.date.slice(0, 10) : '-'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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
                    min="1"
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
            )}
          </div>

          {/* Modal Footer with Delete on Left and Cancel/Save on Right */}
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting || deleting || loading || (!selectedRecordId && records.length === 0)}
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
                cursor: submitting || deleting || loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Delete this cash entry"
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
                disabled={submitting || deleting || loading}
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

