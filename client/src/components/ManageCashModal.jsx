import React, { useState, useEffect, useCallback } from 'react'
import { X, Wallet, Edit2, Trash2, Loader2, AlertTriangle, Check, RotateCcw } from 'lucide-react'
import { cashService } from '../services/cashService.js'

export default function ManageCashModal({
  isOpen,
  onClose,
  onCashUpdated,
  showNotification,
}) {
  const [records, setRecords] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [updating, setUpdating] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState(null) // { id, amount, date }
  const [deleting, setDeleting] = useState(false)

  const loadCashData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await cashService.getAll()
      if (res && res.records) {
        setRecords(res.records)
        setBalance(Number(res.balance || 0))
      }
    } catch (err) {
      console.error('Failed to load cash records:', err)
      setError(err.message || 'Failed to load cash records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadCashData()
      setEditingId(null)
      setDeleteTarget(null)
      setError('')
    }
  }, [isOpen, loadCashData])

  if (!isOpen) return null

  const startEdit = (rec) => {
    setEditingId(rec.id)
    setEditDate(rec.date ? rec.date.slice(0, 10) : '')
    setEditAmount(String(rec.amount || ''))
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDate('')
    setEditAmount('')
  }

  const handleUpdate = async (id) => {
    const numAmount = Number(editAmount)
    if (!editAmount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than zero.')
      return
    }

    try {
      setUpdating(true)
      setError('')
      const res = await cashService.update(id, {
        date: editDate,
        amount: numAmount,
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Cash entry updated successfully!',
        })
      }

      await loadCashData()
      cancelEdit()

      if (onCashUpdated) {
        await onCashUpdated()
      }
    } catch (err) {
      console.error('Failed to update cash record:', err)
      setError(err.message || 'Failed to update cash entry.')
    } finally {
      setUpdating(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    try {
      setDeleting(true)
      setError('')
      await cashService.delete(deleteTarget.id)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Cash entry of ₹${Number(deleteTarget.amount).toLocaleString('en-IN')} deleted.`,
        })
      }

      setDeleteTarget(null)
      await loadCashData()

      if (onCashUpdated) {
        await onCashUpdated()
      }
    } catch (err) {
      console.error('Failed to delete cash record:', err)
      setError(err.message || 'Failed to delete cash entry.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '640px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-icon-badge" style={{ backgroundColor: '#10B98115', color: '#10B981' }}>
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="modal-title">Cash in Hand Records</h3>
              <p className="modal-subtitle">
                View, edit, or delete cash deposits.
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

        {/* Current Balance Banner */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#F0FDF4',
            borderBottom: '1px solid #DCFCE7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', letterSpacing: '0.05em' }}>
              CURRENT AVAILABLE CASH
            </span>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '2px' }}>
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <span
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: '#BBF7D0',
              color: '#166534',
              fontWeight: 600,
            }}
          >
            {records.length} Cash {records.length === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        {/* Content */}
        <div className="modal-body" style={{ padding: '16px 24px', maxHeight: '420px', overflowY: 'auto' }}>
          {error && <div className="modal-error" style={{ marginBottom: '14px' }}>{error}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#70829F' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>Loading cash records...</p>
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#70829F' }}>
              <Wallet size={32} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#172033' }}>No cash records yet</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Click "Add Cash" on the Payments page to add cash.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {records.map((rec) => {
                const isEditing = editingId === rec.id

                if (isEditing) {
                  return (
                    <div
                      key={rec.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1.5px solid #10B981',
                        backgroundColor: '#F0FDF4',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '4px' }}>
                            Date
                          </label>
                          <input
                            type="date"
                            className="form-input"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            style={{ height: '36px', fontSize: '13px' }}
                            required
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '140px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: '#166534', display: 'block', marginBottom: '4px' }}>
                            Amount (₹)
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            className="form-input"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            style={{ height: '36px', fontSize: '13px' }}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={cancelEdit}
                          disabled={updating}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleUpdate(rec.id)}
                          disabled={updating}
                          style={{
                            padding: '6px 14px',
                            fontSize: '12px',
                            backgroundColor: '#10B981',
                            borderColor: '#10B981',
                          }}
                        >
                          {updating ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                          <span style={{ marginLeft: '4px' }}>Update</span>
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={rec.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #E5EAF1',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#172033' }}>
                        +₹{Number(rec.amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#70829F', marginTop: '2px' }}>
                        {rec.date ? new Date(rec.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'} · {rec.description || 'Cash Added'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => startEdit(rec)}
                        title="Edit entry"
                        style={{
                          background: 'none',
                          border: '1px solid #E5EAF1',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(rec)}
                        title="Delete entry"
                        style={{
                          background: 'none',
                          border: '1px solid #FEE2E2',
                          borderRadius: '6px',
                          padding: '6px',
                          cursor: 'pointer',
                          color: '#DC2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 24px',
            background: '#F8FAFC',
            borderTop: '1px solid #E5EAF1',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Delete Confirmation Popup Box */}
        {deleteTarget && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '16px',
            }}
            onClick={() => setDeleteTarget(null)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#172033' }}>
                    Delete Cash Entry?
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#70829F', marginTop: '2px' }}>
                    Confirm deletion of this cash record.
                  </p>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  border: '1px solid #E5EAF1',
                }}
              >
                <div style={{ fontSize: '13px', color: '#374151' }}>
                  <strong>Amount:</strong> ₹{Number(deleteTarget.amount).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '13px', color: '#374151', marginTop: '4px' }}>
                  <strong>Date:</strong> {deleteTarget.date}
                </div>
                <div style={{ fontSize: '12px', color: '#DC2626', marginTop: '6px' }}>
                  ⚠️ This amount will be deducted from your available cash balance.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                  style={{
                    backgroundColor: '#DC2626',
                    borderColor: '#DC2626',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {deleting ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    'Delete Entry'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

