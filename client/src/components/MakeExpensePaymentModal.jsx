import React, { useState, useEffect } from 'react'
import { X, CreditCard, AlertCircle, CheckCircle2, Loader2, Building, DollarSign } from 'lucide-react'
import { expenseService } from '../services/expenseService.js'
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

export default function MakeExpensePaymentModal({
  isOpen,
  onClose,
  expense,
  onPaymentSuccess,
  showNotification,
}) {
  const today = new Date().toISOString().slice(0, 10)

  const [banks, setBanks] = useState([])
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Read-only values from the expense
  const siteName =
    typeof expense?.site === 'object'
      ? expense?.site?.name
      : expense?.site || 'Site'
  const category = expense?.category || 'Material'
  const totalAmount = Number(expense?.amount || 0)
  const previouslyPaid = Number(expense?.paidAmount || 0)
  const remainingPending = Number(
    expense?.pendingAmount !== undefined && expense?.pendingAmount !== null
      ? expense.pendingAmount
      : Math.max(0, totalAmount - previouslyPaid)
  )

  // Form states
  const [paymentAmount, setPaymentAmount] = useState(
    remainingPending > 0 ? String(remainingPending) : ''
  )
  const [paymentDate, setPaymentDate] = useState(today)
  const [paymentMethod, setPaymentMethod] = useState(
    expense?.paymentMethod || 'Bank Transfer'
  )
  const [bankAccountId, setBankAccountId] = useState(
    expense?.bankAccountId || ''
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

  // Sync remainingPending whenever expense changes
  useEffect(() => {
    if (expense) {
      const pending = Number(
        expense.pendingAmount !== undefined && expense.pendingAmount !== null
          ? expense.pendingAmount
          : Math.max(0, Number(expense.amount || 0) - Number(expense.paidAmount || 0))
      )
      setPaymentAmount(pending > 0 ? String(pending) : '')
      if (expense.bankAccountId) {
        setBankAccountId(String(expense.bankAccountId))
      }
      setErrorMsg('')
    }
  }, [expense])

  if (!isOpen || !expense) return null

  const selectedBank = banks.find(
    (b) => String(b._id || b.id) === String(bankAccountId)
  )
  const bankBalance = Number(selectedBank?.balance || 0)

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
      setErrorMsg('Please select a bank account.')
      return
    }

    if (selectedBank && bankBalance < numAmount) {
      setErrorMsg(
        `Insufficient bank balance in ${selectedBank.bankName}. Available: ${formatCurrency(bankBalance)}, Requested: ${formatCurrency(numAmount)}.`
      )
      return
    }

    setSubmitting(true)
    try {
      const expenseId = expense._id || expense.id
      await expenseService.recordPayment(expenseId, {
        amount: numAmount,
        paymentDate,
        paymentMethod,
        bankAccountId,
        reference: reference.trim(),
        notes: notes.trim() || 'Expense Payment',
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Payment of ${formatCurrency(numAmount)} recorded successfully!`,
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
                background: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Make Payment – Expense
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                Record money paid out for site expense
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
                    Category / Material
                  </span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{category}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Expense Amount
                  </span>
                  <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '14px' }}>
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Previously Paid Amount
                  </span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>
                    {formatCurrency(previouslyPaid)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px dashed #CBD5E1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Remaining Pending Amount:
                </span>
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: remainingPending > 0 ? '#DC2626' : '#059669',
                    background: remainingPending > 0 ? '#FEF2F2' : '#ECFDF5',
                    padding: '2px 10px',
                    borderRadius: '6px',
                    border: `1px solid ${remainingPending > 0 ? '#FECACA' : '#A7F3D0'}`,
                  }}
                >
                  {formatCurrency(remainingPending)}
                </span>
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

              {/* Bank Account */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Bank Account <span style={{ color: '#DC2626' }}>*</span>
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
                      {b.bankName} (Bal: {formatCurrency(b.balance)})
                    </option>
                  ))}
                </select>
                {selectedBank && (
                  <span style={{ fontSize: '11px', color: '#0284C7', marginTop: '4px', display: 'block' }}>
                    Available balance: {formatCurrency(bankBalance)}
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
                  placeholder="e.g. UTR / Cheque No. / Transaction Ref"
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
                background: '#059669',
                borderColor: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              disabled={submitting || remainingPending <= 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  <span>Processing Payment...</span>
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

