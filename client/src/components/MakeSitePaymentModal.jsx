import React, { useState, useEffect } from 'react'
import { X, CreditCard, AlertCircle, CheckCircle2, Loader2, Building2 } from 'lucide-react'
import { siteService } from '../services/siteService.js'
import { bankAccountService } from '../services/bankAccountService.js'

const PAYMENT_METHODS = [
  'Bank Transfer',
  'UPI',
  'Cash',
  'Cheque',
  'NEFT/RTGS',
]

const formatCurrency = (amt) => {
  if (amt === undefined || amt === null || isNaN(Number(amt))) return '₹0'
  return `₹${Math.round(Number(amt)).toLocaleString('en-IN')}`
}

export default function MakeSitePaymentModal({
  isOpen,
  onClose,
  site,
  onPaymentSuccess,
  showNotification,
}) {
  const today = new Date().toISOString().slice(0, 10)

  const [banks, setBanks] = useState([])
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Read-only values from the site
  const siteName = site?.name || 'Site'
  const projectBudget = Number(site?.totalBudget || site?.total_budget || site?.projectValue || 0)
  const previouslyReceived = Number(site?.totalReceived || site?.total_received || 0)
  const remainingPending = Math.max(0, projectBudget - previouslyReceived)

  // Form states
  const [paymentAmount, setPaymentAmount] = useState(
    remainingPending > 0 ? String(remainingPending) : ''
  )
  const [paymentDate, setPaymentDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer')
  const [bankAccountId, setBankAccountId] = useState(
    site?.bankAccountId || site?.bank_account_id || ''
  )
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  // Load active bank accounts
  useEffect(() => {
    let mounted = true
    setLoadingBanks(true)
    bankAccountService
      .getAll()
      .then((res) => {
        if (!mounted) return
        const list = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : []
        setBanks(list)
        if (!bankAccountId && list.length > 0) {
          setBankAccountId(String(list[0]._id || list[0].id))
        }
      })
      .catch((err) => {
        console.error('Failed to load bank accounts:', err)
        if (mounted) setBanks([])
      })
      .finally(() => {
        if (mounted) setLoadingBanks(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Sync remainingPending whenever site changes
  useEffect(() => {
    if (site) {
      const budget = Number(site.totalBudget || site.total_budget || site.projectValue || 0)
      const received = Number(site.totalReceived || site.total_received || 0)
      const pending = Math.max(0, budget - received)
      setPaymentAmount(pending > 0 ? String(pending) : '')
      if (site.bankAccountId || site.bank_account_id) {
        setBankAccountId(String(site.bankAccountId || site.bank_account_id))
      }
      setErrorMsg('')
    }
  }, [site])

  if (!isOpen || !site) return null

  const selectedBank = banks.find(
    (b) => String(b._id || b.id) === String(bankAccountId)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    const numAmount = Number(paymentAmount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than zero.')
      return
    }

    if (numAmount > remainingPending) {
      setErrorMsg(
        `Payment amount (${formatCurrency(numAmount)}) cannot exceed remaining pending amount of ${formatCurrency(remainingPending)}.`
      )
      return
    }

    if (!bankAccountId) {
      setErrorMsg('Please select a bank account to receive this payment.')
      return
    }

    setSubmitting(true)
    try {
      const siteId = site._id || site.id
      await siteService.recordPayment(siteId, {
        amount: numAmount,
        paymentDate,
        paymentMethod,
        bankAccountId,
        reference: reference.trim(),
        notes: notes.trim() || 'Client Payment Received',
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Client payment of ${formatCurrency(numAmount)} received and credited to ${selectedBank?.bankName || 'bank account'}!`,
        })
      }

      if (onPaymentSuccess) {
        onPaymentSuccess()
      }
      onClose()
    } catch (err) {
      console.error('Payment error:', err)
      setErrorMsg(err.message || 'Failed to record payment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-container"
        style={{ maxWidth: '600px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Make Payment – Client Payment
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                Receive client payment for construction site
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px 24px', maxHeight: '72vh', overflowY: 'auto' }}>

            {/* Read-only Financial Summary Box */}
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '18px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px 16px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Site Name
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{siteName}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Project Budget
                  </span>
                  <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '14px' }}>
                    {formatCurrency(projectBudget)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Previously Received Amount
                  </span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>
                    {formatCurrency(previouslyReceived)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Remaining Pending Amount
                  </span>
                  <span
                    style={{
                      fontWeight: 800,
                      color: remainingPending > 0 ? '#DC2626' : '#059669',
                    }}
                  >
                    {formatCurrency(remainingPending)}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Payment Amount */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Payment Amount (₹) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max={remainingPending}
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => {
                    setPaymentAmount(e.target.value)
                    setErrorMsg('')
                  }}
                  placeholder="Enter amount"
                  required
                />
              </div>

              {/* Payment Date */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Payment Date <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              {/* Bank Account (Where to deposit) */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Deposit To Bank Account <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={bankAccountId}
                  onChange={(e) => {
                    setBankAccountId(e.target.value)
                    setErrorMsg('')
                  }}
                  disabled={loadingBanks}
                  required
                >
                  <option value="">{loadingBanks ? 'Loading banks...' : 'Select Bank Account'}</option>
                  {banks.map((b) => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.bankName} (Current: {formatCurrency(b.balance)})
                    </option>
                  ))}
                </select>
                {selectedBank && (
                  <span style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'block' }}>
                    Will be credited to: {selectedBank.bankName}
                  </span>
                )}
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Payment Method <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reference / Note (Full Width) */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Reference / Note (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. Cheque No. / Transaction ID / Receipt No."
                />
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div
            className="modal-footer"
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #E5EAF1',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary-action"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary-action"
              style={{
                background: '#0284C7',
                borderColor: '#0284C7',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              disabled={submitting || remainingPending <= 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  <span>Recording Payment...</span>
                </>
              ) : (
                <>
                  <CreditCard size={16} />
                  <span>Make Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

