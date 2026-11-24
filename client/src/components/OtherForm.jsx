import React, { useState } from 'react'
import { Plus, Loader2, AlertCircle, Calendar } from 'lucide-react'
import { otherTransactionService } from '../services/otherTransactionService.js'

export default function OtherForm({
  bankAccounts = [],
  onTransactionCreated,
  showNotification,
}) {
  const today = new Date().toISOString().slice(0, 10)

  const [formData, setFormData] = useState({
    date: today,
    amount: '',
    bankAccountId: bankAccounts[0]?.id || bankAccounts[0]?._id ? String(bankAccounts[0].id || bankAccounts[0]._id) : '',
    paymentMethod: 'UPI',
    paymentType: 'Send', // 'Send' | 'Receive'
    ledgerName: '',
    note: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const selectedBank = bankAccounts.find(
    (b) => String(b.id || b._id) === String(formData.bankAccountId)
  )
  const isCashAccount = String(formData.bankAccountId || '').toLowerCase() === 'cash' || selectedBank?.isCash
  const bankBalance = Number(selectedBank?.balance || 0)

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'bankAccountId') {
      const isCash = String(value).toLowerCase() === 'cash'
      setFormData((prev) => ({
        ...prev,
        bankAccountId: value,
        paymentMethod: isCash ? 'Cash' : (prev.paymentMethod === 'Cash' ? 'UPI' : prev.paymentMethod),
      }))
      if (errorMessage) setErrorMessage('')
      return
    }
    if (name === 'paymentMethod') {
      const isCash = value === 'Cash'
      const cashAcc = bankAccounts.find((b) => b.isCash || String(b.id || b._id).toLowerCase() === 'cash')
      setFormData((prev) => ({
        ...prev,
        paymentMethod: value,
        bankAccountId: isCash && cashAcc ? String(cashAcc.id || cashAcc._id) : prev.bankAccountId,
      }))
      if (errorMessage) setErrorMessage('')
      return
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errorMessage) setErrorMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    if (!formData.date) {
      setErrorMessage('Date is required.')
      return
    }

    const numAmount = Number(formData.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than zero.')
      return
    }

    if (!formData.bankAccountId) {
      setErrorMessage('Please select a Bank Name.')
      return
    }

    if (formData.paymentType === 'Send' && selectedBank && bankBalance < numAmount) {
      setErrorMessage(
        `Insufficient ${isCashAccount ? 'cash' : 'bank'} balance in ${selectedBank.bankName}. Available: ₹${Math.round(bankBalance).toLocaleString('en-IN')}, Requested: ₹${Math.round(numAmount).toLocaleString('en-IN')}.`
      )
      return
    }

    const isCash = String(formData.bankAccountId || '').toLowerCase() === 'cash' || selectedBank?.isCash
    const payloadBankAccountId = isCash ? 'cash' : Number(formData.bankAccountId)

    setSubmitting(true)
    try {
      const created = await otherTransactionService.create({
        date: formData.date,
        amount: numAmount,
        bankAccountId: payloadBankAccountId,
        paymentMethod: isCash ? 'Cash' : (formData.paymentMethod || 'UPI'),
        paymentType: formData.paymentType,
        ledgerName: formData.ledgerName.trim(),
        note: formData.note.trim(),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `${formData.paymentType === 'Send' ? 'Debit (Send)' : 'Credit (Receive)'} payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully!`,
        })
      }

      // Reset form
      setFormData({
        date: today,
        amount: '',
        bankAccountId: bankAccounts[0]?.id || bankAccounts[0]?._id ? String(bankAccounts[0].id || bankAccounts[0]._id) : '',
        paymentMethod: 'UPI',
        paymentType: 'Send',
        ledgerName: '',
        note: '',
      })

      if (onTransactionCreated) {
        onTransactionCreated(created)
      }
    } catch (err) {
      console.error('Failed to create other transaction:', err)
      setErrorMessage(err.message || 'Failed to record transaction. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="daily-expense-section" id="other-form">
      <div className="section-header-compact">
        <h2 className="section-title">Other Transactions</h2>
        <p className="section-subtitle">Record miscellaneous bank payments (Send) and deposits (Receive).</p>
      </div>

      {errorMessage && (
        <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="daily-expense-form" onSubmit={handleSubmit}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {/* Date */}
          <div className="form-group">
            <label className="form-label">
              Date <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div className="input-with-icon">
              <input
                type="date"
                name="date"
                className="form-input"
                value={formData.date}
                onChange={handleChange}
                required
              />
              <Calendar size={16} className="input-icon-right" />
            </div>
          </div>

          {/* Amount */}
          <div className="form-group">
            <label className="form-label">
              Amount (₹) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="number"
              name="amount"
              className="form-input"
              placeholder="e.g. 5000"
              min="1"
              step="any"
              value={formData.amount}
              onChange={handleChange}
              required
            />
          </div>

          {/* Bank Name */}
          <div className="form-group">
            <label className="form-label">
              Bank Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              name="bankAccountId"
              className="form-select"
              value={formData.bankAccountId}
              onChange={handleChange}
              required
            >
              <option value="">Select Bank Account...</option>
              {bankAccounts.map((b) => (
                <option key={b.id || b._id} value={b.id || b._id}>
                  {b.bankName} (Bal: ₹{Number(b.balance || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
            {selectedBank && (
              <span style={{ fontSize: '11px', color: '#0284C7', marginTop: '3px', display: 'block' }}>
                Available balance: ₹{Number(selectedBank.balance || 0).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Payment Method */}
          <div className="form-group">
            <label className="form-label">
              Payment Method <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              name="paymentMethod"
              className="form-select"
              value={formData.paymentMethod}
              onChange={handleChange}
              required
            >
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          {/* Payment Type */}
          <div className="form-group">
            <label className="form-label">
              Payment Type <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              name="paymentType"
              className="form-select"
              value={formData.paymentType}
              onChange={handleChange}
              required
            >
              <option value="Send">Send (Deduct from Bank)</option>
              <option value="Receive">Receive (Credit to Bank)</option>
            </select>
          </div>

          {/* Ledger Name */}
          <div className="form-group">
            <label className="form-label">Ledger Name (Optional)</label>
            <input
              type="text"
              name="ledgerName"
              className="form-input"
              placeholder="e.g. Office Expenses, Petty Cash"
              value={formData.ledgerName}
              onChange={handleChange}
            />
          </div>

          {/* Note */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Note / Reference (Optional)</label>
            <input
              type="text"
              name="note"
              className="form-input"
              placeholder="e.g. Office maintenance, petty cash, electricity bill"
              value={formData.note}
              onChange={handleChange}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            type="submit"
            className="btn btn-primary-action"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: formData.paymentType === 'Send' ? '#0284C7' : '#059669',
              borderColor: formData.paymentType === 'Send' ? '#0284C7' : '#059669',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin-animate" />
                <span>Recording...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>{formData.paymentType === 'Send' ? 'Record Send Payment' : 'Record Receive Deposit'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}

