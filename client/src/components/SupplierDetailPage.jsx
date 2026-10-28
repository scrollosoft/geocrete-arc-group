import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  MapPin,
  User,
  CreditCard,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  X,
} from 'lucide-react'
import { supplierService } from '../services/supplierService.js'

const PAGE_SIZE = 5

export default function SupplierDetailPage({
  supplierId,
  siteId,
  onBack,
  showNotification,
}) {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [currentPage, setPage]    = useState(1)

  // Record Payment modal state
  const [payModal, setPayModal]       = useState(false)
  const [payTarget, setPayTarget]     = useState(null) // specific purchase or null (bulk)
  const [payAmount, setPayAmount]     = useState('')
  const [payNote, setPayNote]         = useState('')
  const [payLoading, setPayLoading]   = useState(false)

  const load = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    try {
      // Pass siteId when available to filter purchase history to this site only
      const res = await supplierService.getPurchases(supplierId, siteId || null)
      setData(res)
    } catch {
      if (showNotification) showNotification({ type: 'error', message: 'Failed to load supplier details.' })
    } finally {
      setLoading(false)
    }
  }, [supplierId, siteId])

  useEffect(() => { load() }, [load])

  const handleRecordPayment = async () => {
    if (!payTarget) return
    setPayLoading(true)
    try {
      await supplierService.recordPayment({ materialId: payTarget._id })
      setPayModal(false)
      setPayTarget(null)
      setPayAmount('')
      setPayNote('')
      await load()
      if (showNotification) showNotification({ type: 'success', message: 'Payment recorded successfully.' })
    } catch {
      if (showNotification) showNotification({ type: 'error', message: 'Failed to record payment.' })
    } finally {
      setPayLoading(false)
    }
  }

  const openPayModal = (purchase = null) => {
    setPayTarget(purchase)
    setPayAmount(purchase ? String(purchase.totalCost || '') : '')
    setPayNote('')
    setPayModal(true)
  }

  const fmt = (n) => {
    if (!n || isNaN(n) || Number(n) === 0) return '₹0'
    const num = Number(n)
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`
    return `₹${num.toLocaleString('en-IN')}`
  }

  if (loading) {
    return (
      <div className="supplier-detail-loading">
        <div className="settings-spinner" />
        <p>Loading supplier details…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="supplier-detail-loading">
        <p style={{ color: '#EF4444' }}>Supplier not found.</p>
        <button className="btn btn-settings-discard" onClick={onBack} style={{ marginTop: '16px' }}>← Back</button>
      </div>
    )
  }

  const { supplier, purchases = [], summary = {} } = data
  const totalPages = Math.max(1, Math.ceil(purchases.length / PAGE_SIZE))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)
  const start = (activePage - 1) * PAGE_SIZE
  const paginated = purchases.slice(start, start + PAGE_SIZE)

  const statusBadge = (status) => {
    const s = (status || 'Pending').toLowerCase()
    if (s === 'paid')     return <span className="sd-badge sd-badge-paid">Paid</span>
    if (s === 'partial')  return <span className="sd-badge sd-badge-partial">Partial</span>
    if (s === 'overdue')  return <span className="sd-badge sd-badge-overdue">Overdue</span>
    return <span className="sd-badge sd-badge-pending">Pending</span>
  }

  return (
    <div className="supplier-detail-page">
      {/* Breadcrumb / Back */}
      <div className="sd-back-row">
        <button type="button" className="sd-back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          Back to all sites
        </button>
      </div>

      {/* Header row: name + Record Payment */}
      <div className="sd-header-row">
        <div className="sd-header-left">
          <h1 className="sd-supplier-name">{supplier.name}</h1>
          <div className="sd-supplier-meta">
            {supplier.address && (
              <span className="sd-meta-item">
                <MapPin size={13} />
                {supplier.address}
              </span>
            )}
            {supplier.contactPerson && (
              <span className="sd-meta-item">
                <User size={13} />
                {supplier.contactPerson}
              </span>
            )}
            {!supplier.address && !supplier.contactPerson && supplier.categories && (
              <span className="sd-meta-item">
                <User size={13} />
                {supplier.categories}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn sd-record-payment-btn"
          onClick={() => openPayModal(null)}
        >
          <Wallet size={15} />
          Record Payment
        </button>
      </div>

      {/* Summary cards */}
      <div className="sd-stat-grid">
        <div className="sd-stat-card">
          <div className="sd-stat-top">
            <span className="sd-stat-label">Total Purchases</span>
            <div className="sd-stat-icon-wrap sd-icon-blue"><CreditCard size={16} /></div>
          </div>
          <div className="sd-stat-value">{fmt(summary.totalPurchase)}</div>
          <div className="sd-stat-sub">{purchases.length} purchase record{purchases.length !== 1 ? 's' : ''}</div>
        </div>

        <div className="sd-stat-card">
          <div className="sd-stat-top">
            <span className="sd-stat-label">Total Paid</span>
            <div className="sd-stat-icon-wrap sd-icon-green"><CheckCircle2 size={16} /></div>
          </div>
          <div className="sd-stat-value">{fmt(summary.totalPaid)}</div>
          <div className="sd-stat-sub">
            {summary.totalPurchase > 0
              ? `${Math.round((summary.totalPaid / summary.totalPurchase) * 100)}% cleared`
              : '—'}
          </div>
        </div>

        <div className="sd-stat-card">
          <div className="sd-stat-top">
            <span className="sd-stat-label">Outstanding</span>
            <div className="sd-stat-icon-wrap sd-icon-orange"><AlertTriangle size={16} /></div>
          </div>
          <div className="sd-stat-value">{fmt(summary.outstanding)}</div>
          <div className="sd-stat-sub">
            {summary.outstanding > 0 ? 'Payment overdue' : 'No pending amount'}
          </div>
        </div>
      </div>

      {/* Purchase History table */}
      <div className="sd-table-card">
        <div className="sd-table-header">
          <div>
            <div className="sd-table-title">Purchase History</div>
            <div className="sd-table-subtitle">
              Complete financial history with {supplier.name}
            </div>
          </div>
        </div>

        <div className="sites-table-scroll">
          <table className="sites-table" style={{ width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5EAF1' }}>
                <th style={{ padding: '14px 20px', width: '11%' }}>DATE</th>
                <th style={{ padding: '14px 20px', width: '20%' }}>DETAILS</th>
                <th style={{ padding: '14px 20px', width: '12%' }}>REF NO.</th>
                <th style={{ padding: '14px 20px', width: '12%', textAlign: 'right' }}>AMOUNT</th>
                <th style={{ padding: '14px 20px', width: '12%', textAlign: 'right' }}>TOTAL PAID</th>
                <th style={{ padding: '14px 20px', width: '12%', textAlign: 'right' }}>OUTSTANDING</th>
                <th style={{ padding: '14px 20px', width: '10%', textAlign: 'center' }}>STATUS</th>
                <th style={{ padding: '14px 20px', width: '11%', textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px', color: '#70829F', fontSize: '14px' }}>
                    No purchase records found for this supplier.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const cost = Number(p.totalCost || 0)
                  const rawPaid = p.isExpense
                    ? Number(p.paidAmount || 0)
                    : Number(p.paidAmount !== undefined && p.paidAmount !== null ? p.paidAmount : (p.paymentStatus === 'Paid' ? cost : 0))
                  const rowPaid = Math.min(cost, Math.max(0, rawPaid))
                  const rowOutstanding = Math.max(0, cost - rowPaid)

                  return (
                    <tr key={p._id} className="site-data-row">
                      <td style={{ padding: '14px 20px', color: '#70829F', fontSize: '13px' }}>
                        {p.purchaseDate
                          ? (p.purchaseDate.includes('T')
                              ? new Date(p.purchaseDate).toLocaleDateString('en-GB')
                              : p.purchaseDate)
                          : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#172033', fontWeight: 500, fontSize: '13.5px' }}>
                        {p.materialName || '—'}
                        {p.site && typeof p.site === 'object' && (
                          <div style={{ fontSize: '12px', color: '#70829F', marginTop: '2px', fontWeight: 400 }}>
                            {p.site.name}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#70829F', fontSize: '12.5px' }}>
                        {p.refNumber || '—'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#172033', fontWeight: 600, textAlign: 'right', fontSize: '13.5px' }}>
                        ₹{cost.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#16A34A', fontWeight: 600, textAlign: 'right', fontSize: '13.5px' }}>
                        ₹{rowPaid.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 600, textAlign: 'right', fontSize: '13.5px', color: rowOutstanding > 0 ? '#EF4444' : '#70829F' }}>
                        {rowOutstanding > 0 ? `₹${rowOutstanding.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        {statusBadge(p.paymentStatus)}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        {p.paymentStatus !== 'Paid' ? (
                          <button
                            type="button"
                            className="sd-pay-btn"
                            onClick={() => openPayModal(p)}
                            title="Record payment for this purchase"
                          >
                            Pay
                          </button>
                        ) : (
                          <span style={{ color: '#B0BFCF', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Scrollbar indicator */}
        <div style={{ padding: '0 20px', marginTop: '12px' }}>
          <div className="sites-scrollbar-indicator" style={{ margin: 0 }}>
            <div className="scrollbar-thumb-indicator" style={{ width: '30%' }} />
          </div>
        </div>

        {/* Pagination */}
        <div className="sites-pagination-row" style={{ padding: '14px 20px 0', margin: 0 }}>
          <div className="pagination-left">
            <span className="pagination-range-text">
              Showing {purchases.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, purchases.length)} of {purchases.length} records
            </span>
          </div>
          <div className="pagination-right">
            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={activePage <= 1}
            >
              <ChevronLeft size={14} /> Back
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                className="pagination-num-btn"
                style={{
                  backgroundColor: activePage === n ? '#0F172A' : '#FFFFFF',
                  color: activePage === n ? '#FFFFFF' : '#334155',
                  borderColor: activePage === n ? '#0F172A' : '#E2E8F0',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            {totalPages > 3 && <span style={{ color: '#94A3B8', padding: '0 4px' }}>…</span>}
            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={activePage >= totalPages}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {payModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
          }}
          onClick={() => !payLoading && setPayModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              width: '100%', maxWidth: '440px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 26px 18px', borderBottom: '1px solid #E5EAF1' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#172033' }}>Record Payment</div>
                <div style={{ fontSize: '12px', color: '#70829F', marginTop: '2px' }}>
                  {payTarget ? `${payTarget.materialName} – ${payTarget.refNumber}` : supplier.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#70829F', display: 'flex', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px 26px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#70829F', display: 'block', marginBottom: '6px' }}>Purchase</label>
                <div style={{ fontSize: '13.5px', color: '#172033', fontWeight: 500 }}>
                  {payTarget ? payTarget.materialName : `All outstanding for ${supplier.name}`}
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#70829F', display: 'block', marginBottom: '6px' }}>Amount (₹)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  style={{
                    width: '100%', height: '40px', padding: '0 12px', border: '1.5px solid #DCE4F0',
                    borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#172033',
                    background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#70829F', display: 'block', marginBottom: '6px' }}>Note (optional)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="e.g. Bank transfer, Cheque #1234"
                  style={{
                    width: '100%', height: '40px', padding: '0 12px', border: '1.5px solid #DCE4F0',
                    borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', color: '#172033',
                    background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 26px 22px', borderTop: '1px solid #E5EAF1' }}>
              <button
                type="button"
                onClick={() => setPayModal(false)}
                disabled={payLoading}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1.5px solid #DCE4F0', background: '#fff', color: '#344155', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordPayment}
                disabled={payLoading || !payTarget}
                style={{
                  padding: '8px 22px', borderRadius: '8px', border: 'none',
                  background: !payTarget ? '#B0BFCF' : '#0293DE',
                  color: '#fff', fontSize: '13px', fontWeight: 600,
                  cursor: payLoading || !payTarget ? 'default' : 'pointer',
                  fontFamily: 'inherit', opacity: payLoading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Wallet size={14} />
                {payLoading ? 'Recording…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
