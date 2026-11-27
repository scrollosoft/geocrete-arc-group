import React, { useState, useEffect, useMemo } from 'react'
import { Eye, Pencil, Trash2, Search, X, Loader2, AlertCircle, ArrowUpRight, ArrowDownLeft, FolderOpen, DollarSign, Calendar, Layers } from 'lucide-react'
import { otherTransactionService } from '../services/otherTransactionService.js'
import TablePagination from './TablePagination.jsx'

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
  const [pageSize, setPageSize] = useState(10)

  // Ledger grouping & modal states
  const [viewingLedgerKey, setViewingLedgerKey] = useState(null)
  const [viewingRecord, setViewingRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [deletingRecord, setDeletingRecord] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Delete ledger group modal states
  const [deletingLedgerGroup, setDeletingLedgerGroup] = useState(null)
  const [isDeletingLedger, setIsDeletingLedger] = useState(false)
  const [deleteLedgerError, setDeleteLedgerError] = useState('')

  // ── Compute Ledger-Wise Grouping ──
  const ledgerGroups = useMemo(() => {
    const groupsMap = new Map()

    transactions.forEach((tx) => {
      const rawLedger = (tx.ledgerName || '').trim()
      const key = rawLedger ? rawLedger.toLowerCase() : '__general__'
      const displayName = rawLedger || 'General / Miscellaneous'

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          ledgerName: displayName,
          isGeneral: !rawLedger,
          totalReceive: 0,
          totalSend: 0,
          netBalance: 0,
          latestDate: tx.date || '',
          transactions: [],
        })
      }

      const group = groupsMap.get(key)
      const isSend = tx.paymentType === 'Send' || tx.type === 'debit'
      const amt = Number(tx.amount || 0)

      if (isSend) {
        group.totalSend += amt
      } else {
        group.totalReceive += amt
      }

      if (tx.date && (!group.latestDate || tx.date > group.latestDate)) {
        group.latestDate = tx.date
      }

      group.transactions.push(tx)
    })

    const result = Array.from(groupsMap.values()).map((g) => {
      // Sort transactions inside group date descending (latest first)
      g.transactions.sort((a, b) => {
        const dCompare = (b.date || '').localeCompare(a.date || '')
        if (dCompare !== 0) return dCompare
        return (b.id || 0) - (a.id || 0)
      })
      g.netBalance = g.totalReceive - g.totalSend
      return g
    })

    // Sort groups by latestDate descending
    result.sort((a, b) => {
      const dCompare = (b.latestDate || '').localeCompare(a.latestDate || '')
      if (dCompare !== 0) return dCompare
      return a.ledgerName.localeCompare(b.ledgerName)
    })

    return result
  }, [transactions])

  // Sync active viewing ledger with latest transactions data
  const viewingLedger = useMemo(() => {
    if (!viewingLedgerKey) return null
    return ledgerGroups.find((g) => g.key === viewingLedgerKey) || null
  }, [ledgerGroups, viewingLedgerKey])

  // ── Lock background scroll while any popup is open & restore position on close ──
  useEffect(() => {
    const isAnyModalOpen = Boolean(viewingLedgerKey || viewingRecord || editingRecord || deletingRecord || deletingLedgerGroup)
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
  }, [viewingLedgerKey, viewingRecord, editingRecord, deletingRecord])

  // Edit form state
  const [editForm, setEditForm] = useState({
    date: '',
    amount: '',
    bankAccountId: '',
    paymentMethod: 'UPI',
    paymentType: 'Send',
    ledgerName: '',
    note: '',
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  const handleOpenEdit = (record) => {
    setEditError('')
    const isCashTxn = !record.bankAccountId || record.isCash || String(record.bankAccountId).toLowerCase() === 'cash' || String(record.paymentMethod).toLowerCase() === 'cash'
    setEditForm({
      date: record.date || '',
      amount: String(record.amount || ''),
      bankAccountId: isCashTxn ? 'cash' : (record.bankAccountId ? String(record.bankAccountId) : ''),
      paymentMethod: record.paymentMethod || (isCashTxn ? 'Cash' : 'UPI'),
      paymentType: record.paymentType || (record.type === 'debit' ? 'Send' : 'Receive'),
      ledgerName: record.ledgerName || '',
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

    const isCash = String(editForm.bankAccountId || '').toLowerCase() === 'cash' || editForm.paymentMethod === 'Cash'

    setIsUpdating(true)
    try {
      await otherTransactionService.update(editingRecord.id, {
        date: editForm.date,
        amount: numAmount,
        bankAccountId: isCash ? 'cash' : Number(editForm.bankAccountId),
        paymentMethod: isCash ? 'Cash' : (editForm.paymentMethod || 'UPI'),
        paymentType: editForm.paymentType,
        ledgerName: editForm.ledgerName.trim(),
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

  const handleDeleteLedgerGroup = async () => {
    if (!deletingLedgerGroup) return
    setIsDeletingLedger(true)
    setDeleteLedgerError('')
    try {
      for (const tx of deletingLedgerGroup.transactions) {
        await otherTransactionService.delete(tx.id)
      }
      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Ledger "${deletingLedgerGroup.ledgerName}" deleted and bank balances adjusted successfully!`,
        })
      }
      setDeletingLedgerGroup(null)
      if (onTransactionChanged) onTransactionChanged()
    } catch (err) {
      console.error('Failed to delete ledger transactions:', err)
      setDeleteLedgerError(err.message || 'Failed to delete ledger.')
    } finally {
      setIsDeletingLedger(false)
    }
  }

  // Filtered ledger groups
  const filteredLedgers = useMemo(() => {
    if (!search.trim()) return ledgerGroups
    const q = search.toLowerCase()
    return ledgerGroups.filter((g) => {
      return (
        g.ledgerName.toLowerCase().includes(q) ||
        g.latestDate.toLowerCase().includes(q) ||
        g.transactions.some(
          (tx) =>
            (tx.bankName && tx.bankName.toLowerCase().includes(q)) ||
            (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(q)) ||
            (tx.note && tx.note.toLowerCase().includes(q))
        )
      )
    })
  }, [ledgerGroups, search])

  // Pagination for main ledger table
  const totalPages = Math.ceil(filteredLedgers.length / pageSize) || 1
  const paginatedLedgers = filteredLedgers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="sites-table-card" style={{ marginTop: '20px' }}>
      {/* Table Header & Search */}
      <div className="sites-table-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="sites-table-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            Other Transactions ({ledgerGroups.length} {ledgerGroups.length === 1 ? 'Ledger' : 'Ledgers'})
          </h2>
          <p className="sites-table-subtitle" style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
            Ledger-wise summary of all Send (debit) and Receive (credit) transactions.
          </p>
        </div>

        <div style={{ position: 'relative', width: '250px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', height: '34px', fontSize: '12.5px', borderRadius: '6px' }}
            placeholder="Search ledgers or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>
      </div>

      {/* Main Ledger Summary Table */}
      <div className="sites-table-scroll" style={{ overflowX: 'auto', marginTop: '12px' }}>
        <table className="expenses-table">
          <thead>
            <tr>
              <th className="th-desc" style={{ minWidth: '180px' }}>LEDGER NAME</th>
              <th className="th-date">LATEST DATE</th>
              <th className="th-amount" style={{ textAlign: 'right' }}>TOTAL RECEIVE</th>
              <th className="th-amount" style={{ textAlign: 'right' }}>TOTAL SEND</th>
              <th className="th-desc" style={{ textAlign: 'center' }}>TRANSACTIONS</th>
              <th className="th-actions" style={{ textAlign: 'center' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                  Loading transaction ledgers...
                </td>
              </tr>
            ) : paginatedLedgers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  {search ? 'No matching ledgers found.' : 'No other transactions recorded yet.'}
                </td>
              </tr>
            ) : (
              paginatedLedgers.map((group) => {
                return (
                  <tr key={group.key} className="expense-row">
                    <td className="td-description" style={{ fontWeight: 600, color: '#0F172A' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FolderOpen size={16} style={{ color: '#0284C7', flexShrink: 0 }} />
                        <span>{group.ledgerName}</span>
                      </div>
                    </td>
                    <td className="td-date">{group.latestDate || '-'}</td>
                    <td className="td-amount" style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      +{formatCurrency(group.totalReceive)}
                    </td>
                    <td className="td-amount" style={{ textAlign: 'right', fontWeight: 600, color: '#DC2626' }}>
                      −{formatCurrency(group.totalSend)}
                    </td>
                    <td className="td-description" style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: '#F1F5F9',
                          color: '#334155',
                          border: '1px solid #E2E8F0',
                        }}
                      >
                        {group.transactions.length} {group.transactions.length === 1 ? 'Transaction' : 'Transactions'}
                      </span>
                    </td>
                    <td className="td-actions">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="site-action-btn site-action-btn-view"
                          title="View Details"
                          onClick={() => setViewingLedgerKey(group.key)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="site-action-btn site-action-btn-delete"
                          title="Delete Ledger"
                          onClick={() => {
                            setDeleteLedgerError('')
                            setDeletingLedgerGroup(group)
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
      <TablePagination
        currentPage={currentPage}
        pageSize={pageSize}
        totalRecords={filteredLedgers.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize)
          setCurrentPage(1)
        }}
        style={{ padding: '12px 16px', borderTop: '1px solid #E5EAF1', margin: 0 }}
      />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 1. Ledger-Wise Transaction History Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {viewingLedger && (
        <div className="modal-overlay txn-modal-overlay" style={{ zIndex: 1000 }} onClick={() => setViewingLedgerKey(null)}>
          <div
            className="modal-container txn-modal-container"
            style={{ maxWidth: '950px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header txn-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: '#E0F2FE',
                  color: '#0284C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <FolderOpen size={20} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                    {viewingLedger.ledgerName}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                    Ledger Transaction History · {viewingLedger.transactions.length} record{viewingLedger.transactions.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingLedgerKey(null)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body txn-modal-body" style={{ padding: '16px 20px', overflowY: 'auto' }}>
              {/* Summary Cards Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {/* Total Receive */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#065F46', textTransform: 'uppercase' }}>
                    Total Receive (Credit)
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                    +{formatCurrency(viewingLedger.totalReceive)}
                  </div>
                </div>

                {/* Total Send */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#991B1B', textTransform: 'uppercase' }}>
                    Total Send (Debit)
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                    −{formatCurrency(viewingLedger.totalSend)}
                  </div>
                </div>

                {/* Net Balance */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: viewingLedger.netBalance >= 0 ? '#F0FDF4' : '#FFF1F2',
                  border: `1px solid ${viewingLedger.netBalance >= 0 ? '#BBF7D0' : '#FECDD3'}`,
                  borderRadius: '8px',
                }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: viewingLedger.netBalance >= 0 ? '#166534' : '#9F1239',
                    textTransform: 'uppercase',
                  }}>
                    Net Balance ({viewingLedger.netBalance >= 0 ? 'Surplus' : 'Deficit'})
                  </span>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: viewingLedger.netBalance >= 0 ? '#15803D' : '#BE123C',
                    marginTop: '4px',
                  }}>
                    {viewingLedger.netBalance >= 0
                      ? `+${formatCurrency(viewingLedger.netBalance)}`
                      : `−${formatCurrency(Math.abs(viewingLedger.netBalance))}`}
                  </div>
                </div>

                {/* Total Transactions */}
                <div style={{
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
                    Total Transactions
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                    {viewingLedger.transactions.length}
                  </div>
                </div>
              </div>

              {/* Ledger Transactions Table */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="expenses-table" style={{ margin: 0 }}>
                  <thead style={{ backgroundColor: '#F8FAFC' }}>
                    <tr>
                      <th className="th-date" style={{ padding: '10px 12px' }}>DATE</th>
                      <th className="th-amount" style={{ padding: '10px 12px' }}>AMOUNT</th>
                      <th className="th-desc" style={{ padding: '10px 12px' }}>BANK NAME</th>
                      <th className="th-desc" style={{ padding: '10px 12px' }}>PAYMENT METHOD</th>
                      <th className="th-desc" style={{ padding: '10px 12px' }}>PAYMENT TYPE</th>
                      <th className="th-desc" style={{ padding: '10px 12px' }}>NOTE / REFERENCE</th>
                      <th className="th-actions" style={{ padding: '10px 12px', textAlign: 'center' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingLedger.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                          No transactions found in this ledger.
                        </td>
                      </tr>
                    ) : (
                      viewingLedger.transactions.map((item) => {
                        const isSend = item.paymentType === 'Send' || item.type === 'debit'
                        return (
                          <tr key={item.id} className="expense-row">
                            <td className="td-date" style={{ padding: '10px 12px' }}>{item.date || '-'}</td>
                            <td
                              className="td-amount"
                              style={{
                                padding: '10px 12px',
                                fontWeight: 700,
                                color: isSend ? '#DC2626' : '#059669',
                              }}
                            >
                              {isSend ? `−${formatCurrency(item.amount)}` : `+${formatCurrency(item.amount)}`}
                            </td>
                            <td className="td-description" style={{ padding: '10px 12px' }}>{item.bankName}</td>
                            <td className="td-description" style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: '#F1F5F9',
                                  color: '#334155',
                                }}
                              >
                                {item.paymentMethod || 'UPI'}
                              </span>
                            </td>
                            <td className="td-description" style={{ padding: '10px 12px' }}>
                              <span
                                style={{
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
                                }}
                              >
                                {isSend ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                {isSend ? 'Send' : 'Receive'}
                              </span>
                            </td>
                            <td className="td-description" style={{ padding: '10px 12px', color: '#475569', fontSize: '12.5px' }}>
                              {item.note || '-'}
                            </td>
                            <td className="td-actions" style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="site-action-btn site-action-btn-view"
                                  title="View Details"
                                  onClick={() => setViewingRecord(item)}
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="site-action-btn site-action-btn-edit"
                                  title="Edit Transaction"
                                  onClick={() => handleOpenEdit(item)}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="site-action-btn site-action-btn-delete"
                                  title="Delete Transaction"
                                  onClick={() => {
                                    setDeleteError('')
                                    setDeletingRecord(item)
                                  }}
                                >
                                  <Trash2 size={14} />
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
            </div>

            {/* Modal Footer */}
            <div className="modal-footer txn-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0' }}>
              <button
                type="button"
                className="txn-modal-btn txn-modal-btn-cancel"
                onClick={() => setViewingLedgerKey(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 2. Individual Transaction Details Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {viewingRecord && (
        <div className="modal-overlay txn-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setViewingRecord(null)}>
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
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Ledger</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.ledgerName || 'General / Miscellaneous'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Bank Account</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.bankName}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>Payment Method</span>
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{viewingRecord.paymentMethod}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 3. Edit Transaction Modal ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {editingRecord && (
        <div className="modal-overlay txn-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setEditingRecord(null)}>
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
                      onChange={(e) => {
                        const val = e.target.value
                        const isCashSelected = String(val).toLowerCase() === 'cash'
                        setEditForm({
                          ...editForm,
                          bankAccountId: val,
                          paymentMethod: isCashSelected ? 'Cash' : (editForm.paymentMethod === 'Cash' ? 'UPI' : editForm.paymentMethod),
                        })
                      }}
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

                  <div className="form-group">
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

                  <div className="form-group">
                    <label className="form-label">Ledger Name (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Office Expenses, Petty Cash"
                      value={editForm.ledgerName}
                      onChange={(e) => setEditForm({ ...editForm, ledgerName: e.target.value })}
                    />
                  </div>

                  <div className="form-group txn-span-2">
                    <label className="form-label">Note / Reference (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Note or reference"
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 4. Delete Confirmation Dialog ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {deletingRecord && (
        <div className="modal-overlay txn-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setDeletingRecord(null)}>
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

      {/* ── 5. Delete Ledger Group Confirmation Dialog ── */}
      {deletingLedgerGroup && (
        <div className="modal-overlay txn-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setDeletingLedgerGroup(null)}>
          <div className="modal-container txn-modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header txn-modal-header">
              <h3 className="modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#DC2626' }}>
                Confirm Ledger Deletion
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setDeletingLedgerGroup(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body txn-modal-body">
              {deleteLedgerError && (
                <div className="form-alert form-alert-error" style={{ marginBottom: '12px' }}>
                  {deleteLedgerError}
                </div>
              )}
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                Are you sure you want to delete ledger <strong>&quot;{deletingLedgerGroup.ledgerName}&quot;</strong> ({deletingLedgerGroup.transactions.length} {deletingLedgerGroup.transactions.length === 1 ? 'transaction' : 'transactions'})?
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#B45309', background: '#FEF3C7', padding: '8px 12px', borderRadius: '6px' }}>
                Note: Associated bank account balances will be automatically adjusted to reverse all transactions under this ledger.
              </p>
            </div>
            <div className="modal-footer txn-modal-footer">
              <button
                type="button"
                className="txn-modal-btn txn-modal-btn-cancel"
                onClick={() => setDeletingLedgerGroup(null)}
                disabled={isDeletingLedger}
              >
                Cancel
              </button>
              <button
                type="button"
                className="txn-modal-btn txn-modal-btn-delete"
                onClick={handleDeleteLedgerGroup}
                disabled={isDeletingLedger}
              >
                {isDeletingLedger ? (
                  <>
                    <Loader2 size={15} className="spin-animate" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Ledger</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

