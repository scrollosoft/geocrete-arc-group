import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  Plus,
  Wallet,
} from 'lucide-react'
import { siteOwnerService } from '../services/siteOwnerService.js'
import { bankAccountService } from '../services/bankAccountService.js'

export default function SiteOwnerDetailPage({
  clientId,
  client: initialClient,
  onBack,
  showNotification,
  onPaymentRecorded,
  onClientsChanged,
  bankAccounts: propBankAccounts = [],
}) {
  const [client, setClient] = useState(initialClient || null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [bankAccounts, setBankAccounts] = useState(propBankAccounts || [])

  // Record Payment Modal State
  const [payModal, setPayModal] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [payType, setPayType] = useState('Project milestone payment')
  const [payMethod, setPayMethod] = useState('Bank transfer')
  const [payBankAccountId, setPayBankAccountId] = useState('')
  const [payRef, setPayRef] = useState('Reference verified')
  const [payError, setPayError] = useState('')
  const [payLoading, setPayLoading] = useState(false)

  const loadBankAccounts = useCallback(async () => {
    try {
      const data = await bankAccountService.getAll()
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
      setBankAccounts(list)
    } catch {
      setBankAccounts([])
    }
  }, [])

  useEffect(() => {
    if (propBankAccounts && propBankAccounts.length > 0) {
      setBankAccounts(propBankAccounts)
    } else {
      loadBankAccounts()
    }
  }, [propBankAccounts, loadBankAccounts])

  const loadData = useCallback(async () => {
    const id = clientId || initialClient?.id || initialClient?._id
    if (!id) return
    try {
      setLoading(true)
      const [fetchedClient, fetchedPayments] = await Promise.all([
        siteOwnerService.getById(id).catch(() => null),
        siteOwnerService.getPayments(id).catch(() => []),
      ])
      if (fetchedClient) {
        setClient(fetchedClient)
      }
      if (Array.isArray(fetchedPayments) && fetchedPayments.length > 0) {
        setPayments(fetchedPayments)
      } else {
        const c = fetchedClient || initialClient
        const adv = Number(c?.advanceAmount || 0)
        const defaultList = []
        if (adv > 0) {
          defaultList.push({
            id: 'p-adv',
            paymentDate: c?.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : '-',
            title: 'Project advance received',
            paymentMethod: 'Bank transfer',
            reference: 'Initial advance',
            amount: adv,
            status: 'Paid',
          })
        }
        setPayments(defaultList)
      }
    } catch (err) {
      console.error('Failed to load site owner detail:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: 'Failed to load site owner details.' })
      }
    } finally {
      setLoading(false)
    }
  }, [clientId, initialClient, showNotification])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    setPayError('')
    const id = client?.id || client?._id || clientId
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) {
      setPayError('Please enter a valid payment amount greater than zero.')
      return
    }
    if (!payBankAccountId) {
      setPayError('Please select a bank account.')
      return
    }

    setPayLoading(true)
    try {
      const res = await siteOwnerService.recordPayment(id, {
        amount: amt,
        paymentDate: payDate,
        title: payType,
        paymentMethod: payMethod,
        bankAccountId: payBankAccountId,
        reference: payRef,
        siteId: client?.siteId || null,
      })
      if (res?.client) setClient(res.client)
      if (res?.payments) setPayments(res.payments)
      setPayModal(false)
      setPayAmount('')
      setPayBankAccountId('')
      setPayError('')
      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Payment of ₹${amt.toLocaleString('en-IN')} recorded successfully.`,
        })
      }
      await loadData()
      await loadBankAccounts()
      if (onPaymentRecorded) onPaymentRecorded()
      if (onClientsChanged) onClientsChanged()
    } catch (err) {
      console.error('Failed to record payment:', err)
      const msg = err.response?.data?.error || err.message || 'Failed to record payment.'
      setPayError(msg)
      if (showNotification) {
        showNotification({ type: 'error', message: msg })
      }
    } finally {
      setPayLoading(false)
    }
  }

  // Format compact currency (Cr, L, or formatted)
  const formatCompact = (val) => {
    const num = Number(val || 0)
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`
    if (num >= 100000) return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')} L`
    return `₹${num.toLocaleString('en-IN')}`
  }

  // Format exact currency
  const formatExact = (val) => {
    const num = Number(val || 0)
    return `₹${num.toLocaleString('en-IN')}`
  }

  // Format date (e.g. 24 May 2025)
  const formatDateStr = (dStr) => {
    if (!dStr) return ''
    try {
      const d = new Date(dStr)
      if (isNaN(d.getTime())) return dStr
      const day = d.getDate()
      const month = d.toLocaleString('en-GB', { month: 'short' })
      const year = d.getFullYear()
      return `${day} ${month} ${year}`
    } catch {
      return dStr
    }
  }

  if (loading && !client) {
    return (
      <div className="supplier-detail-loading">
        <div className="settings-spinner" />
        <p>Loading site owner details…</p>
      </div>
    )
  }

  const c = client || initialClient || {}
  const projectVal = Number(c.projectValue || 0)
  const advanceVal = Number(c.advanceAmount || 0)
  const receivedVal = Number(c.totalReceived || 0)
  const receivableVal = Number(c.receivable !== undefined ? c.receivable : Math.max(0, projectVal - receivedVal))
  const collectedPct = projectVal > 0 ? Math.round((receivedVal / projectVal) * 100) : 0

  return (
    <div className="site-owner-detail-page">
      {/* 1. Back link */}
      <div className="sod-back-row">
        <button type="button" className="sod-back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          <span>Back to all site owner's</span>
        </button>
      </div>

      {/* 2. Header row: Name + Client subtitle and Record Payment's button */}
      <div className="sod-header-row">
        <div className="sod-header-left">
          <h1 className="sod-title">{c.name || 'Site Owner'}</h1>
          <div className="sod-subtitle">
            Client · {c.siteName || '-'}
          </div>
        </div>

        <button
          type="button"
          className="sod-record-payment-btn"
          onClick={() => {
            setPayAmount('')
            setPayBankAccountId('')
            setPayError('')
            setPayDate(new Date().toISOString().slice(0, 10))
            loadBankAccounts()
            setPayModal(true)
          }}
        >
          <Plus size={16} />
          <span>Record Payment's</span>
        </button>
      </div>

      {/* 3. 4 Summary Cards Grid */}
      <div className="sod-stat-grid">
        {/* Card 1: Project Value */}
        <div className="sod-stat-card">
          <div className="sod-stat-top">
            <span className="sod-stat-label">Project Value</span>
            <div className="sod-stat-icon-wrap sod-icon-blue">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="sod-stat-val">{formatCompact(projectVal)}</div>
          <div className="sod-stat-sub">{c.siteName || '-'}</div>
        </div>

        {/* Card 2: Advance Received */}
        <div className="sod-stat-card">
          <div className="sod-stat-top">
            <span className="sod-stat-label">Advance Received</span>
            <div className="sod-stat-icon-wrap sod-icon-green">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="sod-stat-val">{formatCompact(advanceVal)}</div>
          <div className="sod-stat-sub">12 Jan 2024</div>
        </div>

        {/* Card 3: Total Received */}
        <div className="sod-stat-card">
          <div className="sod-stat-top">
            <span className="sod-stat-label">Total Received</span>
            <div className="sod-stat-icon-wrap sod-icon-orange">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="sod-stat-val">{formatCompact(receivedVal)}</div>
          <div className="sod-stat-sub">{collectedPct}% collected</div>
        </div>

        {/* Card 4: Pending */}
        <div className="sod-stat-card">
          <div className="sod-stat-top">
            <span className="sod-stat-label">Pending</span>
            <div className="sod-stat-icon-wrap sod-icon-red">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="sod-stat-val">{formatCompact(receivableVal)}</div>
          <div className="sod-stat-sub">
            {receivableVal > 0 ? 'Next due 06 Jun' : 'Payment cleared'}
          </div>
        </div>
      </div>

      {/* 4. Payment Timeline Card */}
      <div className="sod-timeline-card">
        <div className="sod-timeline-header">
          <h2 className="sod-timeline-title">Payment Timeline</h2>
          <p className="sod-timeline-subtitle">
            Complete financial history with {c.name || 'client'}
          </p>
        </div>

        <div className="sod-timeline-list">
          {payments.length === 0 ? (
            <div className="sod-empty-state">
              No payments recorded yet for this client.
            </div>
          ) : (
            payments.map((p, idx) => (
              <div key={p.id || idx} className="sod-timeline-row">
                {/* Date with bullet */}
                <div className="sod-timeline-date-col">
                  <span className="sod-bullet">•</span>
                  <span className="sod-date-text">{formatDateStr(p.paymentDate || p.createdAt)}</span>
                </div>

                {/* Title & Reference */}
                <div className="sod-timeline-info-col">
                  <div className="sod-payment-title">{p.title || 'Project milestone payment'}</div>
                  <div className="sod-payment-meta">
                    {p.paymentMethod || 'Bank transfer'} · {p.reference || 'Reference verified'}
                  </div>
                </div>

                {/* Amount */}
                <div className="sod-timeline-amount-col">
                  {formatExact(p.amount)}
                </div>

                {/* Status Badge */}
                <div className="sod-timeline-status-col">
                  <span className="sod-paid-badge">{p.status || 'Paid'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. Record Payment Modal */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-icon-badge" style={{ background: '#E0F2FE', color: '#0293DE' }}>
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Record Payment</h3>
                  <p className="modal-subtitle">Record incoming payment from {c.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPayModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 500000"
                  className="sites-search-input"
                  value={payAmount}
                  onChange={(e) => {
                    setPayAmount(e.target.value)
                    setPayError('')
                  }}
                  style={{ width: '100%', height: '38px', paddingLeft: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    className="sites-search-input"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    style={{ width: '100%', height: '38px', paddingLeft: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Payment Method
                  </label>
                  <select
                    className="sites-search-input"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    style={{ width: '100%', height: '38px', paddingLeft: '8px' }}
                  >
                    <option value="Bank transfer">Bank transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              {/* Bank Account - placed below Payment Method */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Bank Account *
                </label>
                <select
                  required
                  className="sites-search-input"
                  value={payBankAccountId}
                  onChange={(e) => {
                    setPayBankAccountId(e.target.value)
                    setPayError('')
                  }}
                  style={{ width: '100%', height: '38px', paddingLeft: '8px' }}
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id || b._id} value={b.id || b._id}>
                      {b.bankName || b.bank_name} (₹{Number(b.balance || 0).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Payment Description
                </label>
                <select
                  className="sites-search-input"
                  value={payType}
                  onChange={(e) => setPayType(e.target.value)}
                  style={{ width: '100%', height: '38px', paddingLeft: '8px' }}
                >
                  <option value="Project milestone payment">Project milestone payment</option>
                  <option value="Project advance received">Project advance received</option>
                  <option value="Final settlement">Final settlement</option>
                  <option value="Other payment">Other payment</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Reference / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reference verified, Txn #12345"
                  className="sites-search-input"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  style={{ width: '100%', height: '38px', paddingLeft: '12px' }}
                />
              </div>

              {payError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#B91C1C', fontSize: '12px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{payError}</span>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPayModal(false)}
                  disabled={payLoading}
                  style={{ padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={payLoading}
                  style={{ background: '#0293DE', borderColor: '#0293DE', padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {payLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
