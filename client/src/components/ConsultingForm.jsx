import React, { useState, useMemo } from 'react'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { consultingService } from '../services/consultingService.js'

export default function ConsultingForm({
  bankAccounts = [],
  onConsultingCreated,
  showNotification,
}) {
  const todayStr = new Date().toISOString().slice(0, 10)

  // Ensure all bank accounts + cash account are included in the dropdown list
  const allAccounts = useMemo(() => {
    const list = Array.isArray(bankAccounts) ? [...bankAccounts] : []
    const hasCash = list.some((b) => b.isCash || String(b.id || b._id).toLowerCase() === 'cash')
    if (!hasCash) {
      list.push({ id: 'cash', _id: 'cash', bankName: 'Cash', balance: 0, isCash: true })
    }
    return list
  }, [bankAccounts])

  const initialBankId = allAccounts[0]?.id || allAccounts[0]?._id ? String(allAccounts[0].id || allAccounts[0]._id) : ''

  const [formData, setFormData] = useState({
    date: todayStr,
    ownerName: '',
    mobileNumber: '',
    totalAmount: '',
    receivedAmount: '0',
    paymentMode: 'UPI',
    bankAccountId: initialBankId,
    remark: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isCashMode = formData.paymentMode === 'Cash' || String(formData.bankAccountId || '').toLowerCase() === 'cash'

  const handleChange = (e) => {
    const { name, value } = e.target

    if (name === 'mobileNumber') {
      // Keep only digits, up to 10 digits
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10)
      setFormData((prev) => ({ ...prev, mobileNumber: digitsOnly }))
      if (errorMessage) setErrorMessage('')
      return
    }

    if (name === 'paymentMode') {
      const isCash = value === 'Cash'
      setFormData((prev) => ({
        ...prev,
        paymentMode: value,
        bankAccountId: isCash ? 'cash' : (prev.bankAccountId === 'cash' ? initialBankId : prev.bankAccountId),
      }))
      if (errorMessage) setErrorMessage('')
      return
    }

    if (name === 'bankAccountId') {
      const isCash = String(value).toLowerCase() === 'cash'
      setFormData((prev) => ({
        ...prev,
        bankAccountId: value,
        paymentMode: isCash ? 'Cash' : (prev.paymentMode === 'Cash' ? 'UPI' : prev.paymentMode),
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

    // 1. Validations
    if (!formData.date) {
      setErrorMessage('Date is required.')
      return
    }

    const cleanOwnerName = formData.ownerName.trim()
    if (!cleanOwnerName) {
      setErrorMessage('Owner Name is required.')
      return
    }

    const cleanMobile = formData.mobileNumber.trim()
    if (!cleanMobile) {
      setErrorMessage('Mobile Number is required for WhatsApp sharing.')
      return
    }
    if (cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).')
      return
    }

    const numTotal = Number(formData.totalAmount)
    if (isNaN(numTotal) || numTotal <= 0) {
      setErrorMessage('Total Amount must be greater than zero.')
      return
    }

    const numReceived = formData.receivedAmount !== '' && formData.receivedAmount !== undefined
      ? Number(formData.receivedAmount)
      : 0
    if (isNaN(numReceived) || numReceived < 0) {
      setErrorMessage('Received Amount must be a valid non-negative number.')
      return
    }
    if (numReceived > numTotal) {
      setErrorMessage(`Received Amount (₹${numReceived.toLocaleString('en-IN')}) cannot exceed Total Amount (₹${numTotal.toLocaleString('en-IN')}).`)
      return
    }

    const isCashAccount = formData.paymentMode === 'Cash' || String(formData.bankAccountId || '').toLowerCase() === 'cash'
    if (numReceived > 0 && !formData.bankAccountId && !isCashAccount) {
      setErrorMessage('Please select a Bank Name / Account for the received payment.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        date: formData.date,
        ownerName: cleanOwnerName,
        mobileNumber: cleanMobile,
        totalAmount: numTotal,
        receivedAmount: numReceived,
        paymentMode: isCashAccount ? 'Cash' : formData.paymentMode,
        bankAccountId: isCashAccount ? null : (formData.bankAccountId ? Number(formData.bankAccountId) : null),
        remark: formData.remark.trim(),
      }

      const created = await consultingService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Consulting entry for "${created.ownerName}" added successfully!`,
        })
      }

      // Reset form
      setFormData({
        date: todayStr,
        ownerName: '',
        mobileNumber: '',
        totalAmount: '',
        receivedAmount: '0',
        paymentMode: 'UPI',
        bankAccountId: initialBankId,
        remark: '',
      })

      if (onConsultingCreated) {
        onConsultingCreated(created)
      }
    } catch (err) {
      console.error('Failed to create consulting entry:', err)
      setErrorMessage(err.message || 'Failed to save consulting entry. Please check the inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="daily-expense-section" id="consulting-form">
      <div className="section-header-compact">
        <h2 className="section-title">Add Consulting</h2>
        <p className="section-subtitle">Record new consulting details, owner contact, and payment receipt.</p>
      </div>

      {errorMessage && (
        <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="daily-expense-form" onSubmit={handleSubmit}>
        <div
          className="form-grid consulting-form-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '16px',
          }}
        >
          {/* 1. Date */}
          <div className="form-group">
            <label className="form-label">
              Date <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="date"
              name="date"
              className="form-input"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          {/* 2. Owner Name */}
          <div className="form-group">
            <label className="form-label">
              Owner Name <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              name="ownerName"
              className="form-input"
              placeholder="e.g. Rajesh Sharma"
              value={formData.ownerName}
              onChange={handleChange}
              required
            />
          </div>

          {/* 3. Mobile Number */}
          <div className="form-group">
            <label className="form-label">
              Mobile Number <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 12px',
                  height: '42px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRight: 'none',
                  borderTopLeftRadius: '6px',
                  borderBottomLeftRadius: '6px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: '#475569',
                  userSelect: 'none',
                }}
              >
                +91
              </span>
              <input
                type="tel"
                name="mobileNumber"
                className="form-input"
                placeholder="10-digit mobile number"
                value={formData.mobileNumber}
                onChange={handleChange}
                maxLength={10}
                style={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                }}
                required
              />
            </div>
          </div>

          {/* 4. Total Amount (₹) */}
          <div className="form-group">
            <label className="form-label">
              Total Amount (₹) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="number"
              name="totalAmount"
              className="form-input"
              placeholder="e.g. 50000"
              min="1"
              step="any"
              value={formData.totalAmount}
              onChange={handleChange}
              required
            />
          </div>

          {/* 5. Received Amount (₹) */}
          <div className="form-group">
            <label className="form-label">Received Amount (₹)</label>
            <input
              type="number"
              name="receivedAmount"
              className="form-input"
              placeholder="e.g. 15000 (0 if none)"
              min="0"
              step="any"
              value={formData.receivedAmount}
              onChange={handleChange}
            />
          </div>

          {/* 6. Payment Mode */}
          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select
              name="paymentMode"
              className="form-select"
              value={formData.paymentMode}
              onChange={handleChange}
            >
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          {/* 7. Bank Name / Account (includes Cash Account with live balance) */}
          <div className="form-group">
            <label className="form-label">
              Bank Name / Account{' '}
              {Number(formData.receivedAmount) > 0 && <span style={{ color: '#DC2626' }}>*</span>}
            </label>
            <select
              name="bankAccountId"
              className="form-select"
              value={formData.bankAccountId}
              onChange={handleChange}
              required={Number(formData.receivedAmount) > 0}
            >
              <option value="">Select Bank Name...</option>
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

          {/* 8. Remark */}
          <div className="form-group consulting-grid-span-2" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Remark (Optional)</label>
            <input
              type="text"
              name="remark"
              className="form-input"
              placeholder="e.g. Architectural consultation, structural planning"
              value={formData.remark}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-actions-right" style={{ marginTop: '20px' }}>
          <button
            type="submit"
            className="btn btn-primary-action btn-add-consulting-submit"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 24px',
              backgroundColor: '#0293DE',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(2, 147, 222, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Add Consulting</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
