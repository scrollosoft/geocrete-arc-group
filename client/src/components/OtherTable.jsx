import React, { useState, useEffect } from 'react'
import { Eye, Pencil, Trash2, Search, X, Loader2, AlertCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { otherTransactionService } from '../services/otherTransactionService.js'

const formatCurrency = (amt) => {
  if (amt === undefined || amt === null || isNaN(Number(amt))) return '₹0'
  return `₹${Math.round(Number(amt)).toLocaleString('en-IN')}`
}

export default function OtherTable({
  transactions = [],
  loading = false,
  bankAccounts = [],
  onTransactionChanged,
  showNotification,
}) {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modal states
  const [viewingRecord, setViewingRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [deletingRecord, setDeletingRecord] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // ── Lock background scroll while any popup is open & restore position on close ──
  useEffect(() => {
    const isAnyModalOpen = Boolean(viewingRecord || editingRecord || deletingRecord)
    if (!isAnyModalOpen) return

    const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalTop = document.body.style.top
    const originalWidth = document.body.style.width

    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.position = originalPosition
      document.body.style.top = originalTop
      document.body.style.width = originalWidth
      document.body.style.overflow = originalOverflow
      window.scrollTo(0, scrollY)
    }
  }, [viewingRecord, editingRecord, deletingRecord])

  // Edit form state
  const [editForm, setEditForm] = useState({
    date: '',
    amount: '',
    bankAccountId: '',
    paymentMethod: 'UPI',
    paymentType: 'Send',
    note: '',
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  const handleOpenEdit = (record) => {
    setEditError('')
    setEditForm({
      date: record.date || '',
      amount: String(record.amount || ''),
      bankAccountId: record.bankAccountId ? String(record.bankAccountId) : '',
      paymentMethod: record.paymentMethod || 'UPI',
      paymentType: record.paymentType || (record.type === 'debit' ? 'Send' : 'Receive'),
      note: record.note || '',
    })
    setEditingRecord(record)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setEditError('')

    if (!editForm.date) {
      setEditError('Date is required.')
      return
    }

    const numAmount = Number(editForm.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setEditError('Please enter a valid amount greater than zero.')
      return
    }

    if (!editForm.bankAccountId) {
      setEditError('Please select a Bank Name.')
      return
    }

    setIsUpdating(true)
    try {
      await otherTransactionService.update(editingRecord.id, {
        date: editForm.date,
        amount: numAmount,
        bankAccountId: Number(editForm.bankAccountId),
        paymentMethod: editForm.paymentMethod || 'UPI',
        paymentType: editForm.paymentType,
        note: editForm.note.trim(),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Transaction updated successfully!',
        })
      }

      setEditingRecord(null)
      if (onTransactionChanged) onTransactionChanged()
    } catch (err) {
      console.error('Failed to update other transaction:', err)
      setEditError(err.message || 'Failed to update transaction.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await otherTransactionService.delete(deletingRecord.id)
      if (showNotification) {
        showNotification({
          type: 'success',
          message: 'Transaction deleted and bank balance adjusted successfully!',
        })
      }
      setDeletingRecord(null)
      if (onTransactionChanged) onTransactionChanged()
    } catch (err) {
      console.error('Failed to delete transaction:', err)
      setDeleteError(err.message || 'Failed to delete transaction.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered list
  const filteredList = transactions.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (item.bankName && item.bankName.toLowerCase().includes(q)) ||
      (item.paymentMethod && item.paymentMethod.toLowerCase().includes(q)) ||
      (item.paymentType && item.paymentType.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q)) ||
      (item.date && item.date.toLowerCase().includes(q))
    )
  })

  // Pagination
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1
  const paginatedList = filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="sites-table-card" style={{ marginTop: '20px' }}>
      {/* Table Header & Search */}
      <div className="sites-table-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="sites-table-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            Other Transactions ({transactions.length})
          </h2>
          <p className="sites-table-subtitle" style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            List of all miscellaneous Send (debit) and Receive (credit) transactions.
          </p>
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', height: '34px', fontSize: '12.5px', borderRadius: '6px' }}
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="sites-table-scroll" style={{ overflowX: 'auto', marginTop: '12px' }}>
        <table className="expenses-table">
          <thead>
            <tr>
              <th className="th-date">DATE</th>
              <th className="th-amount">AMOUNT</th>
              <th className="th-desc">BANK NAME</th>
              <th className="th-desc">PAYMENT METHOD</th>
              <th className="th-desc">PAYMENT TYPE</th>
              <th className="th-desc">NOTE / REFERENCE</th>
              <th className="th-actions" style={{ textAlign: 'center' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                  Loading transactions...
                </td>
              </tr>
            ) : paginatedList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  {search ? 'No matching transactions found.' : 'No other transactions recorded yet.'}
                </td>
              </tr>
            ) : (
              paginatedList.map((item) => {
                const isSend = item.paymentType === 'Send' || item.type === 'debit'
                return (
                  <tr key={item.id} className="expense-row">
                    <td className="td-date">{item.date || '-'}</td>
                    <td className="td-amount" style={{ fontWeight: 700, color: isSend ? '#DC2626' : '#059669' }}>
                      {isSend ? `−${formatCurrency(item.amount)}` : `+${formatCurrency(item.amount)}`}
                    </td>
                    <td className="td-description">{item.bankName}</td>
                    <td className="td-description">
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: '#F1F5F9',
                        color: '#334155',
                      }}>
                        {item.paymentMethod || 'UPI'}
                      </span>
                    </td>
                    <td className="td-description">
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: isSend ? '#FEF2F2' : '#ECFDF5',
                        color: isSend ? '#DC2626' : '#059669',
                        border: `1px solid ${isSend ? '#FECACA' : '#A7F3D0'}`,
                      }}>
                        {isSend ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                        {isSend ? 'Send' : 'Receive'}
                      </span>
                    </td>
                    <td className="td-description" style={{ color: '#475569', fontSize: '12.5px' }}>
                      {item.note || '-'}
                    </td>
                    <td className="td-actions">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="action-icon-btn action-view-btn"
                          title="View Details"
                          onClick={() => setViewingRecord(item)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn action-edit-btn"
                          title="Edit Transaction"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn action-delete-btn"
                          title="Delete Transaction"
                          onClick={() => {
                            setDeleteError('')
                            setDeletingRecord(item)
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '12px 16px', borderTop: '1px solid #E5EAF1' }}>
          <button
            type="button"
            className="btn btn-secondary-action"
            style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary-action"
            style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* ── View Modal ── */}
      {viewingRecord && (
        <div className="modal-overlay txn-modal-overlay" onClick={() => setViewingRecord(null)}>
          <div className="modal-container txn-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header txn-modal-header">
              <div>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                  Transaction Details
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                  {viewingRecord.paymentType === 'Send' ? 'Outgoing Debit Payment' : 'Incoming Credit Deposit'}
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setViewingRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body txn-modal-body">
              <div style={{
                background: viewingRecord.paymentType === 'Send' ? '#FEF2F2' : '#ECFDF5',
                border: `1px solid ${viewingRecord.paymentType === 'Send' ? '#FECACA' : '#A7F3D0'}`,
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Transaction Amount
                </span>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: viewingRecord.paymentType === 'Send' ? '#DC2626' : '#059669',
                  marginTop: '4px',
                }}>
                  {viewingRecord.paymentType === 'Send' ? `−${formatCurrency(viewingRecord.amount)}` : `+${formatCurrency(viewingRecord.amount)}`}
                </div>
                <span style={{
                  display: 'inline-block',
                  marginTop: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: viewingRecord.paymentType === 'Send' ? '#991B1B' : '#065F46',
                }}>
                  {viewingRecord.paymentType === 'Send' ? 'Debit (Deducted from Bank)' : 'Credit (Added to Bank)'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Date</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.date || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Bank Account</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.bankName}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Payment Method</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.paymentMethod}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Payment Type</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.paymentType}</span>
                </div>
              </div>

              {viewingRecord.note && (
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Note / Reference</span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#334155', background: '#F1F5F9', padding: '8px 12px', borderRadius: '6px' }}>
                    {viewingRecord.note}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer txn-modal-footer">
              <button type="button" className="txn-modal-btn txn-modal-btn-cancel" onClick={() => setViewingRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingRecord && (
        <div className="modal-overlay txn-modal-overlay" onClick={() => setEditingRecord(null)}>
          <div className="modal-container txn-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header txn-modal-header">
              <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Edit Transaction
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setEditingRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', overflow: 'hidden' }}>
              <div className="modal-body txn-modal-body">
                {editError && (
                  <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                    <AlertCircle size={16} />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="txn-edit-grid">
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      step="any"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bank Name *</label>
                    <select
                      className="form-select"
                      value={editForm.bankAccountId}
                      onChange={(e) => setEditForm({ ...editForm, bankAccountId: e.target.value })}
                      required
                    >
                      <option value="">Select Bank Account...</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id || b._id} value={b.id || b._id}>
                          {b.bankName} (Bal: ₹{Number(b.balance || 0).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Method *</label>
                    <select
                      className="form-select"
                      value={editForm.paymentMethod}
                      onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                      required
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  <div className="form-group txn-span-2">
                    <label className="form-label">Payment Type *</label>
                    <select
                      className="form-select"
                      value={editForm.paymentType}
                      onChange={(e) => setEditForm({ ...editForm, paymentType: e.target.value })}
                      required
                    >
                      <option value="Send">Send (Deduct from Bank)</option>
                      <option value="Receive">Receive (Credit to Bank)</option>
                    </select>
                  </div>

                  <div className="form-group txn-span-2">
                    <label className="form-label">Note / Reference (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.note}
                      onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer txn-modal-footer">
                <button
                  type="button"
                  className="txn-modal-btn txn-modal-btn-cancel"
                  onClick={() => setEditingRecord(null)}
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="txn-modal-btn txn-modal-btn-primary"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 size={15} className="spin-animate" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deletingRecord && (
        <div className="modal-overlay txn-modal-overlay" onClick={() => setDeletingRecord(null)}>
          <div className="modal-container txn-modal-container" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header txn-modal-header">
              <h3 className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#DC2626' }}>
                Confirm Deletion
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setDeletingRecord(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body txn-modal-body">
              {deleteError && (
                <div className="form-alert form-alert-error" style={{ marginBottom: '12px' }}>
                  {deleteError}
                </div>
              )}
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete this {deletingRecord.paymentType} transaction of <strong>{formatCurrency(deletingRecord.amount)}</strong>?
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#B45309', background: '#FEF3C7', padding: '8px 12px', borderRadius: '6px' }}>
                Note: The balance on {deletingRecord.bankName} will be automatically adjusted to reverse this transaction.
              </p>
            </div>
            <div className="modal-footer txn-modal-footer">
              <button
                type="button"
                className="txn-modal-btn txn-modal-btn-cancel"
                onClick={() => setDeletingRecord(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="txn-modal-btn txn-modal-btn-delete"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="spin-animate" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Transaction</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

