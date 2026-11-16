import React, { useState } from 'react'
import { Eye, Pencil, Trash2, Search, X, Loader2, AlertCircle, CheckCircle2, CreditCard } from 'lucide-react'
import { consultingService } from '../services/consultingService.js'

const formatCurrency = (amt) => {
  if (amt === undefined || amt === null || isNaN(Number(amt))) return '₹0'
  return `₹${Math.round(Number(amt)).toLocaleString('en-IN')}`
}

export default function ConsultingTable({
  consultingList = [],
  loading = false,
  bankAccounts = [],
  onConsultingChanged,
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

  // Make Payment modal state
  const [payingRecord, setPayingRecord] = useState(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    bankAccountId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'UPI',
    remarks: '',
  })
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')

  // Edit form state
  const [editForm, setEditForm] = useState({
    siteName: '',
    siteOwner: '',
    location: '',
    totalBudget: '',
    advanceAmount: '',
    receivedAmount: '',
    bankAccountId: '',
    paymentMethod: 'UPI',
    note: '',
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  const handleOpenMakePayment = (record) => {
    setPayError('')
    const defaultBank = record.bankAccountId
      ? String(record.bankAccountId)
      : (bankAccounts.length > 0 ? String(bankAccounts[0].id || bankAccounts[0]._id) : '')

    setPayForm({
      amount: '',
      bankAccountId: defaultBank,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: record.paymentMethod || 'UPI',
      remarks: '',
    })
    setPayingRecord(record)
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    setPayError('')

    if (!payingRecord) return

    const totalBudget = Number(payingRecord.totalBudget || 0)
    const receivedAmount = Number(payingRecord.receivedAmount || 0)
    const pendingAmount = payingRecord.pendingAmount !== undefined
      ? payingRecord.pendingAmount
      : Math.max(0, totalBudget - receivedAmount)

    const numAmount = Number(payForm.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setPayError('Payment amount must be greater than zero.')
      return
    }

    if (numAmount > pendingAmount) {
      setPayError(`Payment amount cannot exceed pending amount of ${formatCurrency(pendingAmount)}.`)
      return
    }

    if (!payForm.bankAccountId) {
      setPayError('Please select a Bank Account or Cash.')
      return
    }

    setIsPaying(true)
    try {
      await consultingService.recordPayment(payingRecord.id, {
        amount: numAmount,
        bankAccountId: payForm.bankAccountId,
        paymentDate: payForm.paymentDate,
        paymentMethod: payForm.paymentMethod,
        remarks: payForm.remarks.trim(),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Payment of ${formatCurrency(numAmount)} recorded successfully for "${payingRecord.siteName}"!`,
        })
      }

      setPayingRecord(null)
      if (onConsultingChanged) onConsultingChanged()
    } catch (err) {
      console.error('Failed to record consulting payment:', err)
      setPayError(err.message || 'Failed to record payment.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleOpenEdit = (record) => {
    setEditError('')
    setEditForm({
      siteName: record.siteName || '',
      siteOwner: record.siteOwner || '',
      location: record.location || '',
      totalBudget: String(record.totalBudget || ''),
      advanceAmount: String(record.advanceAmount || ''),
      receivedAmount: String(record.receivedAmount || ''),
      bankAccountId: record.bankAccountId ? String(record.bankAccountId) : '',
      paymentMethod: record.paymentMethod || 'UPI',
      note: record.note || '',
    })
    setEditingRecord(record)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setEditError('')

    if (!editForm.siteName.trim()) {
      setEditError('Site Name is required.')
      return
    }
    if (!editForm.siteOwner.trim()) {
      setEditError('Site Owner is required.')
      return
    }
    if (!editForm.location.trim()) {
      setEditError('City / Location is required.')
      return
    }

    const numBudget = Number(editForm.totalBudget)
    if (isNaN(numBudget) || numBudget <= 0) {
      setEditError('Total Budget must be greater than zero.')
      return
    }

    const numAdvance = editForm.advanceAmount !== '' ? Number(editForm.advanceAmount) : 0
    if (isNaN(numAdvance) || numAdvance < 0) {
      setEditError('Advance Amount must be non-negative.')
      return
    }
    if (numAdvance > numBudget) {
      setEditError('Advance Amount cannot exceed Total Budget.')
      return
    }

    const numReceived = editForm.receivedAmount !== '' ? Number(editForm.receivedAmount) : 0
    if (isNaN(numReceived) || numReceived < 0) {
      setEditError('Received Amount must be non-negative.')
      return
    }
    if (numReceived > numBudget) {
      setEditError('Received Amount cannot exceed Total Budget.')
      return
    }

    if (numReceived > 0 && !editForm.bankAccountId) {
      setEditError('Please select a Bank Name for the received payment.')
      return
    }

    setIsUpdating(true)
    try {
      await consultingService.update(editingRecord.id, {
        siteName: editForm.siteName.trim(),
        siteOwner: editForm.siteOwner.trim(),
        location: editForm.location.trim(),
        totalBudget: numBudget,
        advanceAmount: numAdvance,
        receivedAmount: numReceived,
        bankAccountId: editForm.bankAccountId ? Number(editForm.bankAccountId) : null,
        paymentMethod: editForm.paymentMethod || 'UPI',
        note: editForm.note.trim(),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Consulting entry "${editForm.siteName}" updated successfully!`,
        })
      }

      setEditingRecord(null)
      if (onConsultingChanged) onConsultingChanged()
    } catch (err) {
      console.error('Failed to update consulting entry:', err)
      setEditError(err.message || 'Failed to update consulting entry.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await consultingService.delete(deletingRecord.id)
      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Consulting record "${deletingRecord.siteName}" deleted and bank balance adjusted successfully!`,
        })
      }
      setDeletingRecord(null)
      if (onConsultingChanged) onConsultingChanged()
    } catch (err) {
      console.error('Failed to delete consulting entry:', err)
      setDeleteError(err.message || 'Failed to delete consulting record.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Filtered list
  const filteredList = consultingList.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (item.siteName && item.siteName.toLowerCase().includes(q)) ||
      (item.siteOwner && item.siteOwner.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q)) ||
      (item.bankName && item.bankName.toLowerCase().includes(q)) ||
      (item.paymentMethod && item.paymentMethod.toLowerCase().includes(q)) ||
      (item.note && item.note.toLowerCase().includes(q))
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
            Consulting Records ({consultingList.length})
          </h2>
          <p className="sites-table-subtitle" style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            List of all consulting projects and client payment records.
          </p>
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', height: '34px', fontSize: '12.5px', borderRadius: '6px' }}
            placeholder="Search consulting..."
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
              <th className="th-desc">SITE NAME</th>
              <th className="th-desc">SITE OWNER</th>
              <th className="th-desc">CITY / LOCATION</th>
              <th className="th-amount">TOTAL BUDGET</th>
              <th className="th-amount">ADVANCE</th>
              <th className="th-amount">RECEIVED</th>
              <th className="th-amount">PENDING</th>
              <th className="th-desc">BANK NAME</th>
              <th className="th-desc">PAYMENT METHOD</th>
              <th
                style={{
                  textAlign: 'center',
                  width: '230px',
                  minWidth: '230px',
                  padding: '14px 16px',
                  whiteSpace: 'nowrap',
                }}
              >
                ACTION
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                  Loading consulting records...
                </td>
              </tr>
            ) : paginatedList.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  {search ? 'No matching consulting records found.' : 'No consulting records recorded yet.'}
                </td>
              </tr>
            ) : (
              paginatedList.map((item) => {
                const pendingAmt = item.pendingAmount !== undefined
                  ? item.pendingAmount
                  : Math.max(0, (Number(item.totalBudget) || 0) - (Number(item.receivedAmount) || 0))

                return (
                  <tr key={item.id} className="expense-row">
                    <td className="td-date">{item.date || '-'}</td>
                    <td className="td-description" style={{ fontWeight: 600, color: '#0F172A' }}>
                      {item.siteName}
                    </td>
                    <td className="td-description">{item.siteOwner}</td>
                    <td className="td-description">{item.location}</td>
                    <td className="td-amount" style={{ fontWeight: 600 }}>
                      {formatCurrency(item.totalBudget)}
                    </td>
                    <td className="td-amount" style={{ color: '#059669' }}>
                      {formatCurrency(item.advanceAmount)}
                    </td>
                    <td className="td-amount" style={{ fontWeight: 700, color: item.receivedAmount > 0 ? '#0284C7' : '#64748B' }}>
                      {formatCurrency(item.receivedAmount)}
                    </td>
                    <td className="td-amount" style={{ fontWeight: 700, color: pendingAmt > 0 ? '#EF4444' : '#64748B' }}>
                      {formatCurrency(pendingAmt)}
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
                    <td
                      style={{
                        textAlign: 'center',
                        width: '230px',
                        minWidth: '230px',
                        padding: '14px 16px',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {pendingAmt > 0 && (
                          <button
                            type="button"
                            className="btn-make-payment"
                            title="Make Payment"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              backgroundColor: '#16A34A',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                            onClick={() => handleOpenMakePayment(item)}
                          >
                            <CreditCard size={13} />
                            <span>Make Payment</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="action-icon-btn action-view-btn"
                          title="View Details"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1E293B',
                          }}
                          onClick={() => setViewingRecord(item)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn action-edit-btn"
                          title="Edit Record"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1E293B',
                          }}
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn action-delete-btn"
                          title="Delete Record"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1E293B',
                          }}
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

      {/* ── View Consulting Modal ── */}
      {viewingRecord && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setViewingRecord(null)}>
          <div className="modal-container" style={{ maxWidth: '520px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5EAF1' }}>
              <div>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                  Consulting Details
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                  {viewingRecord.siteName}
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setViewingRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Site Name</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>{viewingRecord.siteName}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Site Owner</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>{viewingRecord.siteOwner}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>City / Location</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>{viewingRecord.location}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Date</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>{viewingRecord.date || '-'}</span>
                </div>
              </div>

              <div className="consulting-view-financial-grid">
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Total Budget</span>
                  <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '14px' }}>{formatCurrency(viewingRecord.totalBudget)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Advance</span>
                  <span style={{ fontWeight: 600, color: '#059669', fontSize: '14px' }}>{formatCurrency(viewingRecord.advanceAmount)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Received</span>
                  <span style={{ fontWeight: 700, color: '#0284C7', fontSize: '14px' }}>{formatCurrency(viewingRecord.receivedAmount)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Pending</span>
                  <span style={{ fontWeight: 700, color: '#EF4444', fontSize: '14px' }}>
                    {formatCurrency(viewingRecord.pendingAmount !== undefined ? viewingRecord.pendingAmount : Math.max(0, (Number(viewingRecord.totalBudget) || 0) - (Number(viewingRecord.receivedAmount) || 0)))}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Bank Account</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.bankName}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Payment Method</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.paymentMethod}</span>
                </div>
              </div>

              {viewingRecord.note && (
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Note / Particulars</span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#334155', background: '#F1F5F9', padding: '8px 12px', borderRadius: '6px' }}>
                    {viewingRecord.note}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #E5EAF1', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary-action" onClick={() => setViewingRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Consulting Modal ── */}
      {editingRecord && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setEditingRecord(null)}>
          <div className="modal-container" style={{ maxWidth: '540px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5EAF1' }}>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Edit Consulting Entry
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setEditingRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '72vh', overflowY: 'auto' }}>
                {editError && (
                  <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                    <AlertCircle size={16} />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="consulting-edit-grid">
                  <div className="form-group">
                    <label className="form-label">Site Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.siteName}
                      onChange={(e) => setEditForm({ ...editForm, siteName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Site Owner *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.siteOwner}
                      onChange={(e) => setEditForm({ ...editForm, siteOwner: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">City / Location *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Budget (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      step="any"
                      value={editForm.totalBudget}
                      onChange={(e) => setEditForm({ ...editForm, totalBudget: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Advance Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      step="any"
                      value={editForm.advanceAmount}
                      onChange={(e) => setEditForm({ ...editForm, advanceAmount: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Received Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      step="any"
                      value={editForm.receivedAmount}
                      onChange={(e) => setEditForm({ ...editForm, receivedAmount: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <select
                      className="form-select"
                      value={editForm.bankAccountId}
                      onChange={(e) => setEditForm({ ...editForm, bankAccountId: e.target.value })}
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
                    <label className="form-label">Payment Method</label>
                    <select
                      className="form-select"
                      value={editForm.paymentMethod}
                      onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Note (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #E5EAF1', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary-action"
                  onClick={() => setEditingRecord(null)}
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary-action"
                  disabled={isUpdating}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setDeletingRecord(null)}>
          <div className="modal-container" style={{ maxWidth: '440px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E5EAF1' }}>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#DC2626' }}>
                Confirm Deletion
              </h3>
            </div>
            <div className="modal-body" style={{ padding: '18px 20px' }}>
              {deleteError && (
                <div className="form-alert form-alert-error" style={{ marginBottom: '12px' }}>
                  {deleteError}
                </div>
              )}
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete the consulting record for <strong>"{deletingRecord.siteName}"</strong>?
              </p>
              {deletingRecord.receivedAmount > 0 && (
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#B45309', background: '#FEF3C7', padding: '8px 12px', borderRadius: '6px' }}>
                  Note: The previously credited amount of {formatCurrency(deletingRecord.receivedAmount)} will be reversed from {deletingRecord.bankName}.
                </p>
              )}
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #E5EAF1', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary-action"
                onClick={() => setDeletingRecord(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#DC2626', color: '#FFFFFF', borderColor: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="spin-animate" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Make Payment Modal ── */}
      {payingRecord && (() => {
        const currentPending = payingRecord.pendingAmount !== undefined
          ? payingRecord.pendingAmount
          : Math.max(0, (Number(payingRecord.totalBudget) || 0) - (Number(payingRecord.receivedAmount) || 0))

        return (
          <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => !isPaying && setPayingRecord(null)}>
            <div className="modal-container" style={{ maxWidth: '520px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5EAF1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#16A34A',
                  }}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                      Make Payment
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                      Payment from {payingRecord.siteOwner || payingRecord.siteName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => !isPaying && setPayingRecord(null)}
                  disabled={isPaying}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePayment}>
                <div className="modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '72vh', overflowY: 'auto' }}>
                  {payError && (
                    <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                      <AlertCircle size={16} />
                      <span>{payError}</span>
                    </div>
                  )}

                  {/* Read-only Site & Owner Info */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    background: '#F8FAFC',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Site Name</span>
                      <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{payingRecord.siteName}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Site Owner / Client</span>
                      <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{payingRecord.siteOwner}</span>
                    </div>
                  </div>

                  {/* Read-only Financial Summary */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    background: '#F1F5F9',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                  }}>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Total Budget</span>
                      <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '13.5px' }}>{formatCurrency(payingRecord.totalBudget)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Previously Received</span>
                      <span style={{ fontWeight: 700, color: '#0284C7', fontSize: '13.5px' }}>{formatCurrency(payingRecord.receivedAmount)}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Pending Amount</span>
                      <span style={{ fontWeight: 700, color: '#EF4444', fontSize: '13.5px' }}>{formatCurrency(currentPending)}</span>
                    </div>
                  </div>

                  {/* Payment Amount */}
                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label className="form-label">Payment Amount (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max={currentPending}
                      step="any"
                      placeholder="e.g. 50000"
                      value={payForm.amount}
                      onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Outstanding: {formatCurrency(currentPending)}
                      </span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                        onClick={() => setPayForm((prev) => ({ ...prev, amount: String(currentPending) }))}
                      >
                        Pay full pending
                      </button>
                    </div>
                  </div>

                  {/* Bank Account / Cash selection */}
                  <div className="form-group">
                    <label className="form-label">Bank Account / Cash *</label>
                    <select
                      className="form-select"
                      value={payForm.bankAccountId}
                      onChange={(e) => {
                        const val = e.target.value
                        const isCash = val === 'cash'
                        setPayForm((prev) => ({
                          ...prev,
                          bankAccountId: val,
                          paymentMethod: isCash ? 'Cash' : (prev.paymentMethod === 'Cash' ? 'UPI' : prev.paymentMethod),
                        }))
                      }}
                      required
                    >
                      <option value="">Select bank account or cash...</option>
                      {bankAccounts.map((b) => {
                        const accId = String(b.id || b._id)
                        const isCash = b.isCash || accId === 'cash'
                        const displayName = isCash
                          ? `Cash in Hand — ₹${Number(b.balance || 0).toLocaleString('en-IN')} available`
                          : `${b.bankName || b.bank_name} — ₹${Number(b.balance || 0).toLocaleString('en-IN')} available`
                        return (
                          <option key={accId} value={accId}>
                            {displayName}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {/* Payment Date & Payment Method */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Payment Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={payForm.paymentDate}
                        onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Payment Method *</label>
                      <select
                        className="form-select"
                        value={payForm.paymentMethod}
                        onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                        required
                      >
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="NEFT/RTGS">NEFT / RTGS</option>
                      </select>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="form-group">
                    <label className="form-label">Remarks (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Part payment, Consulting fee installment..."
                      value={payForm.remarks}
                      onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })}
                    />
                  </div>
                </div>

                <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #E5EAF1', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary-action"
                    onClick={() => setPayingRecord(null)}
                    disabled={isPaying}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={isPaying}
                    style={{
                      background: '#16A34A',
                      color: '#FFFFFF',
                      borderColor: '#16A34A',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 600,
                    }}
                  >
                    {isPaying ? (
                      <>
                        <Loader2 size={15} className="spin-animate" />
                        <span>Recording...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={15} />
                        <span>Record Payment</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

