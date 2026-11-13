import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

  const modalContent = (
    <div className="modal-overlay mep-modal-overlay" onClick={onClose}>
      <div
        className="modal-container mep-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header mep-modal-header">
          <div className="mep-header-left">
            <div className="mep-header-icon">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="modal-title mep-title">
                Make Payment – Expense
              </h3>
              <p className="mep-subtitle">
                Record money paid out for site expense
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn mep-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mep-form">
          <div className="modal-body mep-modal-body">

            {/* Read-only Financial Summary Box */}
            <div className="mep-summary-box">
              <div className="mep-summary-grid">
                <div className="mep-summary-item">
                  <span className="mep-summary-label">Site Name</span>
                  <span className="mep-summary-value">{siteName}</span>
                </div>
                <div className="mep-summary-item">
                  <span className="mep-summary-label">Category / Material</span>
                  <span className="mep-summary-value">{category}</span>
                </div>
                <div className="mep-summary-item">
                  <span className="mep-summary-label">Total Expense Amount</span>
                  <span className="mep-summary-value mep-total-amount">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="mep-summary-item">
                  <span className="mep-summary-label">Previously Paid Amount</span>
                  <span className="mep-summary-value mep-paid-amount">
                    {formatCurrency(previouslyPaid)}
                  </span>
                </div>
              </div>

              <div className="mep-pending-row">
                <span className="mep-pending-label">
                  Remaining Pending Amount:
                </span>
                <span
                  className={`mep-pending-badge ${
                    remainingPending > 0 ? 'mep-pending-due' : 'mep-pending-cleared'
                  }`}
                >
                  {formatCurrency(remainingPending)}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mep-error-box">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form Fields Grid */}
            <div className="mep-fields-grid">
              {/* Payment Amount */}
              <div className="form-group mep-field-group">
                <label className="form-label">
                  Payment Amount (₹) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-input mep-input"
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
              <div className="form-group mep-field-group">
                <label className="form-label">
                  Payment Date <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="date"
                  className="form-input mep-input"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              {/* Bank Account */}
              <div className="form-group mep-field-group">
                <label className="form-label">
                  Bank Account <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  className="form-input mep-input mep-select"
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
                  <span className="mep-balance-hint">
                    Available balance: {formatCurrency(bankBalance)}
                  </span>
                )}
              </div>

              {/* Payment Method */}
              <div className="form-group mep-field-group">
                <label className="form-label">
                  Payment Method <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  className="form-input mep-input mep-select"
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
              <div className="form-group mep-field-group mep-field-full">
                <label className="form-label">
                  Reference / Note (Optional)
                </label>
                <input
                  type="text"
                  className="form-input mep-input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. UTR / Cheque No. / Transaction Ref"
                />
              </div>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="modal-footer mep-modal-footer">
            <button
              type="button"
              className="btn btn-secondary-action mep-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary-action mep-btn-submit"
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

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent
}

