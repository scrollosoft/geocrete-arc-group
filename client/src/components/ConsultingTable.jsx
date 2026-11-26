import React, { useState, useEffect, useMemo } from 'react'
import {
  Eye,
  Pencil,
  Trash2,
  Search,
  X,
  Loader2,
  AlertCircle,
  CreditCard,
  Calendar,
  Phone,
  User,
  CheckCircle,
} from 'lucide-react'
import { consultingService } from '../services/consultingService.js'
import TablePagination from './TablePagination.jsx'
import {
  WhatsAppIcon,
  shareConsultingOnWhatsApp,
  shareConsultingPaymentConfirmationOnWhatsApp,
} from '../utils/whatsappHelper.jsx'

const formatCurrency = (amt) => {
  if (amt === undefined || amt === null || isNaN(Number(amt))) return '₹0'
  return `₹${Math.round(Number(amt)).toLocaleString('en-IN')}`
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return String(dateString).slice(0, 10)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
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
  const [pageSize, setPageSize] = useState(10)

  // Ensure all bank accounts + cash account are available in dropdowns
  const allAccounts = useMemo(() => {
    const list = Array.isArray(bankAccounts) ? [...bankAccounts] : []
    const hasCash = list.some((b) => b.isCash || String(b.id || b._id).toLowerCase() === 'cash')
    if (!hasCash) {
      list.push({ id: 'cash', _id: 'cash', bankName: 'Cash', balance: 0, isCash: true })
    }
    return list
  }, [bankAccounts])

  // Modals state
  const [viewingRecord, setViewingRecord] = useState(null)
  const [viewPayments, setViewPayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  const [editingRecord, setEditingRecord] = useState(null)
  const [editForm, setEditForm] = useState({
    date: '',
    ownerName: '',
    mobileNumber: '',
    totalAmount: '',
    receivedAmount: '',
    paymentMode: 'UPI',
    bankAccountId: '',
    remark: '',
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  const [deletingRecord, setDeletingRecord] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Make Payment (Record Payment) modal state
  const [payingRecord, setPayingRecord] = useState(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    bankAccountId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: 'UPI',
    remark: '',
  })
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState('')

  // Fetch payment history when viewing a record
  useEffect(() => {
    if (!viewingRecord?.id) {
      setViewPayments([])
      return
    }
    let isMounted = true
    setLoadingPayments(true)
    consultingService
      .getPayments(viewingRecord.id)
      .then((data) => {
        if (isMounted) {
          setViewPayments(Array.isArray(data) ? data : [])
        }
      })
      .catch((err) => {
        console.error('Failed to load consulting payment history:', err)
        if (isMounted) setViewPayments([])
      })
      .finally(() => {
        if (isMounted) setLoadingPayments(false)
      })
    return () => {
      isMounted = false
    }
  }, [viewingRecord?.id])

  // Open Edit Modal
  const handleOpenEdit = (record) => {
    setEditError('')
    const isCash = record.paymentMode === 'Cash' || !record.bankAccountId || String(record.bankAccountId) === 'cash'
    const defaultBank = isCash
      ? 'cash'
      : (record.bankAccountId ? String(record.bankAccountId) : (allAccounts[0]?.id ? String(allAccounts[0].id) : ''))

    setEditForm({
      date: record.date ? String(record.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      ownerName: record.ownerName || '',
      mobileNumber: record.mobileNumber || '',
      totalAmount: String(record.totalAmount || ''),
      receivedAmount: String(record.receivedAmount !== undefined ? record.receivedAmount : ''),
      paymentMode: record.paymentMode || 'UPI',
      bankAccountId: defaultBank,
      remark: record.remark || '',
    })
    setEditingRecord(record)
  }

  // Save Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setEditError('')

    if (!editingRecord) return

    const cleanOwnerName = editForm.ownerName.trim()
    if (!cleanOwnerName) {
      setEditError('Owner Name is required.')
      return
    }

    const cleanMobile = editForm.mobileNumber.trim().replace(/\D/g, '')
    if (!cleanMobile || cleanMobile.length !== 10) {
      setEditError('Please enter a valid 10-digit mobile number.')
      return
    }

    const numTotal = Number(editForm.totalAmount)
    if (isNaN(numTotal) || numTotal <= 0) {
      setEditError('Total Amount must be greater than zero.')
      return
    }

    const numReceived = editForm.receivedAmount !== '' && editForm.receivedAmount !== undefined
      ? Number(editForm.receivedAmount)
      : 0
    if (isNaN(numReceived) || numReceived < 0) {
      setEditError('Received Amount must be a valid non-negative number.')
      return
    }

    if (numReceived > numTotal) {
      setEditError(
        `Received Amount (₹${numReceived.toLocaleString('en-IN')}) cannot exceed Total Amount (₹${numTotal.toLocaleString('en-IN')}).`
      )
      return
    }

    const isCash = editForm.paymentMode === 'Cash' || String(editForm.bankAccountId || '').toLowerCase() === 'cash'
    const finalBankId = isCash ? null : (editForm.bankAccountId ? Number(editForm.bankAccountId) : null)

    if (numReceived > 0 && !isCash && !finalBankId) {
      setEditError('Please select a Bank Account for the received payment.')
      return
    }

    setIsUpdating(true)
    try {
      await consultingService.update(editingRecord.id, {
        date: editForm.date,
        ownerName: cleanOwnerName,
        mobileNumber: cleanMobile,
        totalAmount: numTotal,
        receivedAmount: numReceived,
        paymentMode: isCash ? 'Cash' : editForm.paymentMode,
        bankAccountId: finalBankId,
        remark: editForm.remark.trim(),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Consulting entry for "${cleanOwnerName}" updated successfully!`,
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

  // Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await consultingService.delete(deletingRecord.id)
      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Consulting record for "${deletingRecord.ownerName}" deleted successfully!`,
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

  // Open Make Payment Modal
  const handleOpenMakePayment = (record) => {
    setPayError('')
    const isCash = record.paymentMode === 'Cash' || !record.bankAccountId || String(record.bankAccountId) === 'cash'
    const defaultBank = isCash
      ? 'cash'
      : (record.bankAccountId ? String(record.bankAccountId) : (allAccounts[0]?.id ? String(allAccounts[0].id) : ''))

    setPayForm({
      amount: '',
      bankAccountId: defaultBank,
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMode: record.paymentMode || 'UPI',
      remark: '',
    })
    setPayingRecord(record)
  }

  // Save Payment
  const handleSavePayment = async (e) => {
    e.preventDefault()
    setPayError('')

    if (!payingRecord) return

    const pendingAmount = Number(payingRecord.pendingAmount) || 0
    const numAmount = Number(payForm.amount)

    if (isNaN(numAmount) || numAmount <= 0) {
      setPayError('Payment amount must be greater than zero.')
      return
    }

    if (numAmount > pendingAmount) {
      setPayError(`Payment amount cannot exceed remaining pending amount of ${formatCurrency(pendingAmount)}.`)
      return
    }

    const isCash = payForm.paymentMode === 'Cash' || String(payForm.bankAccountId || '').toLowerCase() === 'cash'
    if (!isCash && !payForm.bankAccountId) {
      setPayError('Please select a Bank Account or Cash.')
      return
    }

    setIsPaying(true)
    try {
      const result = await consultingService.recordPayment(payingRecord.id, {
        amount: numAmount,
        bankAccountId: isCash ? null : Number(payForm.bankAccountId),
        paymentDate: payForm.paymentDate,
        paymentMode: isCash ? 'Cash' : payForm.paymentMode,
        remark: payForm.remark.trim(),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Payment of ${formatCurrency(numAmount)} recorded successfully for "${payingRecord.ownerName}"!`,
        })
      }

      // Automatically offer WhatsApp Payment Confirmation
      const prevReceived = Number(payingRecord.receivedAmount) || 0
      const newTotal = prevReceived + numAmount
      const remaining = Math.max(0, Number(payingRecord.totalAmount) - newTotal)

      shareConsultingPaymentConfirmationOnWhatsApp({
        consulting: payingRecord,
        newPaymentAmount: numAmount,
        previousReceivedAmount: prevReceived,
        updatedTotalReceivedAmount: newTotal,
        remainingPendingAmount: remaining,
        paymentDate: formatDate(payForm.paymentDate),
        paymentMode: isCash ? 'Cash' : payForm.paymentMode,
        showNotification,
      })

      setPayingRecord(null)
      if (onConsultingChanged) onConsultingChanged()
    } catch (err) {
      console.error('Failed to record consulting payment:', err)
      setPayError(err.message || 'Failed to record payment.')
    } finally {
      setIsPaying(false)
    }
  }

  // Filtered search list
  const filteredList = useMemo(() => {
    if (!search.trim()) return consultingList
    const q = search.toLowerCase().trim()
    return consultingList.filter((item) => {
      const owner = String(item.ownerName || '').toLowerCase()
      const mobile = String(item.mobileNumber || '').toLowerCase()
      const mode = String(item.paymentMode || '').toLowerCase()
      const bank = String(item.bankName || '').toLowerCase()
      const rem = String(item.remark || '').toLowerCase()
      const dt = String(item.date || '').toLowerCase()
      return (
        owner.includes(q) ||
        mobile.includes(q) ||
        mode.includes(q) ||
        bank.includes(q) ||
        rem.includes(q) ||
        dt.includes(q)
      )
    })
  }, [consultingList, search])

  // Pagination
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredList.slice(start, start + pageSize)
  }, [filteredList, currentPage, pageSize])

  return (
    <div className="sites-table-card" style={{ marginTop: '20px' }}>
      {/* Table Header & Search */}
      <div
        className="sites-table-card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 className="sites-table-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            Consulting Records ({consultingList.length})
          </h2>
          <p className="sites-table-subtitle" style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            List of all consulting projects and client payment records.
          </p>
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8',
            }}
          />
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
              <th className="th-desc">OWNER NAME</th>
              <th className="th-desc">MOBILE NUMBER</th>
              <th className="th-amount">TOTAL AMOUNT</th>
              <th className="th-amount">RECEIVED AMOUNT</th>
              <th className="th-amount">PENDING AMOUNT</th>
              <th className="th-desc">PAYMENT MODE</th>
              <th className="th-desc">REMARK</th>
              <th
                style={{
                  textAlign: 'center',
                  width: '260px',
                  minWidth: '260px',
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
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                  Loading consulting records...
                </td>
              </tr>
            ) : paginatedList.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  {search ? 'No matching consulting records found.' : 'No consulting records recorded yet.'}
                </td>
              </tr>
            ) : (
              paginatedList.map((item) => {
                const pendingAmt = Number(item.pendingAmount) || 0

                return (
                  <tr key={item.id} className="expense-row">
                    {/* Date */}
                    <td className="td-date">{formatDate(item.date)}</td>

                    {/* Owner Name */}
                    <td className="td-description" style={{ fontWeight: 600, color: '#0F172A' }}>
                      {item.ownerName || '-'}
                    </td>

                    {/* Mobile Number */}
                    <td className="td-description" style={{ color: '#475569', fontWeight: 500 }}>
                      {item.mobileNumber ? `+91 ${item.mobileNumber}` : '-'}
                    </td>

                    {/* Total Amount */}
                    <td className="td-amount" style={{ fontWeight: 600 }}>
                      {formatCurrency(item.totalAmount)}
                    </td>

                    {/* Received Amount */}
                    <td
                      className="td-amount"
                      style={{
                        fontWeight: 700,
                        color: Number(item.receivedAmount) > 0 ? '#0284C7' : '#64748B',
                      }}
                    >
                      {formatCurrency(item.receivedAmount)}
                    </td>

                    {/* Pending Amount */}
                    <td
                      className="td-amount"
                      style={{
                        fontWeight: 700,
                        color: pendingAmt > 0 ? '#EF4444' : '#64748B',
                      }}
                    >
                      {formatCurrency(pendingAmt)}
                    </td>

                    {/* Payment Mode */}
                    <td className="td-description">
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: item.paymentMode === 'Cash' ? '#DCFCE7' : '#F1F5F9',
                          color: item.paymentMode === 'Cash' ? '#166534' : '#334155',
                        }}
                      >
                        {item.paymentMode || 'UPI'}
                      </span>
                    </td>

                    {/* Remark */}
                    <td className="td-description" style={{ color: '#64748B', maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {item.remark || '-'}
                    </td>

                    {/* Action Column */}
                    <td
                      style={{
                        textAlign: 'center',
                        width: '260px',
                        minWidth: '260px',
                        padding: '12px 14px',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {/* Make Payment Button: visible when pending > 0 */}
                        {pendingAmt > 0 && (
                          <button
                            type="button"
                            className="btn-make-payment"
                            title="Receive Payment"
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
                              transition: 'background-color 0.15s ease',
                            }}
                            onClick={() => handleOpenMakePayment(item)}
                          >
                            <CreditCard size={13} />
                            <span>Receive Payment</span>
                          </button>
                        )}

                        {/* WhatsApp Share Button */}
                        <button
                          type="button"
                          className="action-icon-btn site-action-btn-whatsapp"
                          title="Share on WhatsApp"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#25D366',
                          }}
                          onClick={() => shareConsultingOnWhatsApp(item, showNotification)}
                        >
                          <WhatsAppIcon size={15} />
                        </button>

                        {/* View Details Button */}
                        <button
                          type="button"
                          className="action-icon-btn site-action-btn-view"
                          title="View Details"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563EB',
                          }}
                          onClick={() => setViewingRecord(item)}
                        >
                          <Eye size={15} />
                        </button>

                        {/* Edit Record Button */}
                        <button
                          type="button"
                          className="action-icon-btn site-action-btn-edit"
                          title="Edit Record"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#059669',
                          }}
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil size={15} />
                        </button>

                        {/* Delete Record Button */}
                        <button
                          type="button"
                          className="action-icon-btn site-action-btn-delete"
                          title="Delete Record"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#DC2626',
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

      {/* Pagination Footer */}
      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalRecords={filteredList.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize)
          setCurrentPage(1)
        }}
        style={{ padding: '12px 16px', borderTop: '1px solid #E5EAF1', margin: 0 }}
      />

      {/* ── View Details Modal ── */}
      {viewingRecord && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setViewingRecord(null)}>
          <div className="modal-container" style={{ maxWidth: '580px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div
              className="modal-header"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #E5EAF1',
              }}
            >
              <div>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                  Consulting Details
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                  {viewingRecord.ownerName} • +91 {viewingRecord.mobileNumber}
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setViewingRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <div
              className="modal-body"
              style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '75vh', overflowY: 'auto' }}
            >
              {/* Particulars Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  background: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Owner Name
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                    {viewingRecord.ownerName || '-'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Mobile Number
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                    {viewingRecord.mobileNumber ? `+91 ${viewingRecord.mobileNumber}` : '-'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Date
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                    {formatDate(viewingRecord.date)}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Payment Mode
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                    {viewingRecord.paymentMode || 'UPI'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Bank / Account
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                    {viewingRecord.bankName || 'Cash'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Remark
                  </span>
                  <span style={{ fontWeight: 500, color: '#334155', fontSize: '13px' }}>
                    {viewingRecord.remark || '-'}
                  </span>
                </div>
              </div>

              {/* Financial Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  background: '#F1F5F9',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  textAlign: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Total Amount
                  </span>
                  <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '15px' }}>
                    {formatCurrency(viewingRecord.totalAmount)}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Received Amount
                  </span>
                  <span style={{ fontWeight: 700, color: '#0284C7', fontSize: '15px' }}>
                    {formatCurrency(viewingRecord.receivedAmount)}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                    Pending Amount
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: Number(viewingRecord.pendingAmount) > 0 ? '#EF4444' : '#64748B',
                      fontSize: '15px',
                    }}
                  >
                    {formatCurrency(viewingRecord.pendingAmount)}
                  </span>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 style={{ margin: '8px 0 8px 0', fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                  Payment History ({viewPayments.length})
                </h4>

                {loadingPayments ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#64748B', fontSize: '12.5px' }}>
                    Loading payment records...
                  </div>
                ) : viewPayments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '6px', color: '#94A3B8', fontSize: '12.5px' }}>
                    No payment transactions recorded yet.
                  </div>
                ) : (
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>DATE</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right' }}>AMOUNT</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>MODE</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>ACCOUNT</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>REMARK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewPayments.map((p, idx) => (
                          <tr key={p.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 10px', color: '#0F172A', fontWeight: 500 }}>
                              {formatDate(p.paymentDate || p.createdAt)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                              {formatCurrency(p.amount)}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#334155' }}>
                              {p.paymentMode || 'UPI'}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {p.bankName || 'Cash'}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#64748B' }}>
                              {p.remark || p.reference || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #E5EAF1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#25D366',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
                onClick={() => shareConsultingOnWhatsApp(viewingRecord, showNotification)}
              >
                <WhatsAppIcon size={15} />
                <span>Share Details on WhatsApp</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary-action"
                onClick={() => setViewingRecord(null)}
              >
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
            <div
              className="modal-header"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #E5EAF1',
              }}
            >
              <div>
                <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                  Edit Consulting Entry
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Update consulting and client particulars.
                </p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setEditingRecord(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div
                className="modal-body"
                style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '72vh', overflowY: 'auto' }}
              >
                {editError && (
                  <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                    <AlertCircle size={16} />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Received & Pending Summary */}
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '10px 14px', borderRadius: '6px', fontSize: '12.5px', color: '#1E40AF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <strong>Total:</strong> {formatCurrency(editForm.totalAmount || 0)} &nbsp;|&nbsp; <strong>Received:</strong> {formatCurrency(editForm.receivedAmount || 0)}
                  </div>
                  <div>
                    <strong>Pending:</strong> <span style={{ color: '#DC2626', fontWeight: 700 }}>{formatCurrency(Math.max(0, (Number(editForm.totalAmount) || 0) - (Number(editForm.receivedAmount) || 0)))}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {/* Date */}
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

                  {/* Owner Name */}
                  <div className="form-group">
                    <label className="form-label">Owner Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Rajesh Sharma"
                      value={editForm.ownerName}
                      onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                      required
                    />
                  </div>

                  {/* Mobile Number */}
                  <div className="form-group">
                    <label className="form-label">Mobile Number *</label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 10px',
                          height: '38px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRight: 'none',
                          borderTopLeftRadius: '6px',
                          borderBottomLeftRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#475569',
                          userSelect: 'none',
                        }}
                      >
                        +91
                      </span>
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="10-digit mobile number"
                        value={editForm.mobileNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                          setEditForm({ ...editForm, mobileNumber: val })
                        }}
                        maxLength={10}
                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                        required
                      />
                    </div>
                  </div>

                  {/* Total Amount */}
                  <div className="form-group">
                    <label className="form-label">Total Amount (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      step="any"
                      placeholder="e.g. 50000"
                      value={editForm.totalAmount}
                      onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                      required
                    />
                  </div>

                  {/* Received Amount */}
                  <div className="form-group">
                    <label className="form-label">Received Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      step="any"
                      placeholder="e.g. 20000 (0 if none)"
                      value={editForm.receivedAmount}
                      onChange={(e) => setEditForm({ ...editForm, receivedAmount: e.target.value })}
                    />
                  </div>

                  {/* Payment Mode */}
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select
                      className="form-select"
                      value={editForm.paymentMode}
                      onChange={(e) => {
                        const val = e.target.value
                        const isCash = val === 'Cash'
                        setEditForm({
                          ...editForm,
                          paymentMode: val,
                          bankAccountId: isCash ? 'cash' : editForm.bankAccountId,
                        })
                      }}
                    >
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  {/* Bank Name / Account */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">
                      Bank Account / Cash {Number(editForm.receivedAmount) > 0 && <span style={{ color: '#DC2626' }}>*</span>}
                    </label>
                    <select
                      className="form-select"
                      value={editForm.bankAccountId}
                      onChange={(e) => {
                        const val = e.target.value
                        const isCash = val === 'cash'
                        setEditForm({
                          ...editForm,
                          bankAccountId: val,
                          paymentMode: isCash ? 'Cash' : (editForm.paymentMode === 'Cash' ? 'UPI' : editForm.paymentMode),
                        })
                      }}
                      required={Number(editForm.receivedAmount) > 0}
                    >
                      <option value="">Select Account...</option>
                      {allAccounts.map((b) => {
                        const accId = String(b.id || b._id)
                        const isCash = b.isCash || accId.toLowerCase() === 'cash'
                        const name = isCash ? 'Cash' : (b.bankName || b.bank_name || 'Bank')
                        const bal = Number(b.balance || 0).toLocaleString('en-IN')
                        return (
                          <option key={accId} value={accId}>
                            {name} (Bal: ₹{bal})
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                {/* Remark */}
                <div className="form-group">
                  <label className="form-label">Remark (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Structural consultation, floor plan"
                    value={editForm.remark}
                    onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                  />
                </div>
              </div>

              <div
                className="modal-footer"
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid #E5EAF1',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
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
                  style={{
                    backgroundColor: '#0293DE',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontWeight: 600,
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
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
                Are you sure you want to delete the consulting record for <strong>"{deletingRecord.ownerName}"</strong>?
              </p>
              {Number(deletingRecord.receivedAmount) > 0 && (
                <p
                  style={{
                    margin: '10px 0 0 0',
                    fontSize: '12.5px',
                    color: '#B45309',
                    background: '#FEF3C7',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Note:</strong> The previously credited amount of {formatCurrency(deletingRecord.receivedAmount)} will be reversed from {deletingRecord.bankName || 'Cash'}.
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
                style={{
                  background: '#DC2626',
                  color: '#FFFFFF',
                  borderColor: '#DC2626',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
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

      {/* ── Record Payment (Make Payment) Modal ── */}
      {payingRecord && (() => {
        const pendingAmount = Number(payingRecord.pendingAmount) || 0

        return (
          <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => !isPaying && setPayingRecord(null)}>
            <div className="modal-container" style={{ maxWidth: '520px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
              <div
                className="modal-header"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #E5EAF1',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      backgroundColor: '#DCFCE7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#16A34A',
                    }}
                  >
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                      Record Consulting Payment
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                      Payment from {payingRecord.ownerName} (+91 {payingRecord.mobileNumber})
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
                <div
                  className="modal-body"
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '72vh',
                    overflowY: 'auto',
                  }}
                >
                  {payError && (
                    <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                      <AlertCircle size={16} />
                      <span>{payError}</span>
                    </div>
                  )}

                  {/* Read-only Financial Summary */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      background: '#F1F5F9',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                        Total Amount
                      </span>
                      <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '13.5px' }}>
                        {formatCurrency(payingRecord.totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                        Previously Received
                      </span>
                      <span style={{ fontWeight: 700, color: '#0284C7', fontSize: '13.5px' }}>
                        {formatCurrency(payingRecord.receivedAmount)}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
                        Current Pending
                      </span>
                      <span style={{ fontWeight: 700, color: '#EF4444', fontSize: '13.5px' }}>
                        {formatCurrency(pendingAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Amount */}
                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label className="form-label">Payment Amount (₹) *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      max={pendingAmount}
                      step="any"
                      placeholder={`e.g. ${pendingAmount}`}
                      value={payForm.amount}
                      onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                        Outstanding: {formatCurrency(pendingAmount)}
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
                        onClick={() => setPayForm((prev) => ({ ...prev, amount: String(pendingAmount) }))}
                      >
                        Pay full pending ({formatCurrency(pendingAmount)})
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
                          paymentMode: isCash ? 'Cash' : (prev.paymentMode === 'Cash' ? 'UPI' : prev.paymentMode),
                        }))
                      }}
                      required
                    >
                      <option value="">Select bank account or cash...</option>
                      {allAccounts.map((b) => {
                        const accId = String(b.id || b._id)
                        const isCash = b.isCash || accId.toLowerCase() === 'cash'
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

                  {/* Payment Date & Payment Mode */}
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
                      <label className="form-label">Payment Mode *</label>
                      <select
                        className="form-select"
                        value={payForm.paymentMode}
                        onChange={(e) => {
                          const val = e.target.value
                          const isCash = val === 'Cash'
                          setPayForm((prev) => ({
                            ...prev,
                            paymentMode: val,
                            bankAccountId: isCash ? 'cash' : prev.bankAccountId,
                          }))
                        }}
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
                    <label className="form-label">Remark (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Part payment, Consulting fee installment..."
                      value={payForm.remark}
                      onChange={(e) => setPayForm({ ...payForm, remark: e.target.value })}
                    />
                  </div>
                </div>

                <div
                  className="modal-footer"
                  style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #E5EAF1',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                  }}
                >
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
                      borderRadius: '6px',
                      padding: '8px 18px',
                      cursor: isPaying ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isPaying ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
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
