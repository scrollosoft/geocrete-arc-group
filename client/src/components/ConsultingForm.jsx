import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Loader2, AlertCircle, CreditCard, ChevronDown, X } from 'lucide-react'
import { consultingService } from '../services/consultingService.js'
import { shareConsultingPaymentConfirmationOnWhatsApp } from '../utils/whatsappHelper.jsx'

export default function ConsultingForm({
  bankAccounts = [],
  consultingList: propConsultingList = [],
  onConsultingCreated,
  onPaymentRecorded,
  showNotification,
}) {
  const todayStr = new Date().toISOString().slice(0, 10)

  // Sub-tabs: 'add' (default) or 'payment'
  const [activeTab, setActiveTab] = useState('add')

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

  // ══════════════════════════════════════════════════════════════
  // TAB 1: ADD CONSULTING (100% Preserved & Unchanged)
  // ══════════════════════════════════════════════════════════════
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

  const handleChange = (e) => {
    const { name, value } = e.target

    if (name === 'mobileNumber') {
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

      fetchConsultingList()

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

  // ══════════════════════════════════════════════════════════════
  // TAB 2: RECORD CONSULTING PAYMENT
  // ══════════════════════════════════════════════════════════════
  const [recordsList, setRecordsList] = useState(propConsultingList)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [paySearch, setPaySearch] = useState('')
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false)
  const ownerDropdownRef = useRef(null)

  const [payFormData, setPayFormData] = useState({
    paymentDate: todayStr,
    recordId: '',
    ownerName: '',
    mobileNumber: '',
    totalAmount: '',
    amount: '',
    paymentMode: 'UPI',
    bankAccountId: initialBankId,
    remark: '',
  })

  const [paySubmitting, setPaySubmitting] = useState(false)
  const [payErrorMessage, setPayErrorMessage] = useState('')

  // Sync prop changes into recordsList
  useEffect(() => {
    if (Array.isArray(propConsultingList) && propConsultingList.length > 0) {
      setRecordsList(propConsultingList)
    }
  }, [propConsultingList])

  // Fetch consulting records for the searchable dropdown
  const fetchConsultingList = () => {
    consultingService
      .getAll()
      .then((data) => {
        if (Array.isArray(data)) {
          setRecordsList(data)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch consulting records for payment form:', err)
      })
  }

  useEffect(() => {
    fetchConsultingList()
  }, [])

  // Close owner dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (ownerDropdownRef.current && !ownerDropdownRef.current.contains(e.target)) {
        setIsOwnerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter existing consulting records by owner name, mobile number, or record ID
  const filteredRecords = useMemo(() => {
    if (!paySearch.trim()) return recordsList
    const q = paySearch.toLowerCase().trim()
    return recordsList.filter((r) => {
      const name = (r.ownerName || '').toLowerCase()
      const phone = (r.mobileNumber || '').toLowerCase()
      const ref = (r.id ? String(r.id) : '').toLowerCase()
      return name.includes(q) || phone.includes(q) || ref.includes(q)
    })
  }, [recordsList, paySearch])

  // Select record handler
  const handleSelectRecord = (rec) => {
    setSelectedRecord(rec)
    setPaySearch(rec.ownerName || '')
    setIsOwnerDropdownOpen(false)
    if (payErrorMessage) setPayErrorMessage('')

    const isCash = rec.paymentMode === 'Cash' || !rec.bankAccountId || String(rec.bankAccountId) === 'cash'
    const defaultBank = isCash
      ? 'cash'
      : (rec.bankAccountId ? String(rec.bankAccountId) : (initialBankId || ''))

    setPayFormData((prev) => ({
      ...prev,
      recordId: String(rec.id),
      ownerName: rec.ownerName || '',
      mobileNumber: rec.mobileNumber || '',
      totalAmount: String(rec.totalAmount || ''),
      paymentMode: rec.paymentMode || prev.paymentMode || 'UPI',
      bankAccountId: defaultBank,
    }))
  }

  const handlePayChange = (e) => {
    const { name, value } = e.target

    if (name === 'paymentMode') {
      const isCash = value === 'Cash'
      setPayFormData((prev) => ({
        ...prev,
        paymentMode: value,
        bankAccountId: isCash ? 'cash' : (prev.bankAccountId === 'cash' ? initialBankId : prev.bankAccountId),
      }))
      if (payErrorMessage) setPayErrorMessage('')
      return
    }

    if (name === 'bankAccountId') {
      const isCash = String(value).toLowerCase() === 'cash'
      setPayFormData((prev) => ({
        ...prev,
        bankAccountId: value,
        paymentMode: isCash ? 'Cash' : (prev.paymentMode === 'Cash' ? 'UPI' : prev.paymentMode),
      }))
      if (payErrorMessage) setPayErrorMessage('')
      return
    }

    setPayFormData((prev) => ({ ...prev, [name]: value }))
    if (payErrorMessage) setPayErrorMessage('')
  }

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault()
    setPayErrorMessage('')

    if (!payFormData.recordId) {
      setPayErrorMessage('Please select an Owner from the existing consulting records.')
      return
    }

    if (!payFormData.paymentDate) {
      setPayErrorMessage('Payment Date is required.')
      return
    }

    const numAmount = Number(payFormData.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setPayErrorMessage('Payment Amount must be greater than zero.')
      return
    }

    // Pending amount check (internal validation only - fields are NOT displayed on form)
    if (selectedRecord) {
      const total = Number(selectedRecord.totalAmount || 0)
      const received = Number(selectedRecord.receivedAmount || 0)
      const pending = Math.max(0, total - received)
      if (pending <= 0) {
        setPayErrorMessage('This consulting record is already fully settled.')
        return
      }
      if (numAmount > pending) {
        setPayErrorMessage(`Payment amount cannot exceed the remaining pending balance of ₹${pending.toLocaleString('en-IN')}.`)
        return
      }
    }

    const isCashAccount = payFormData.paymentMode === 'Cash' || String(payFormData.bankAccountId || '').toLowerCase() === 'cash'
    if (!isCashAccount && !payFormData.bankAccountId) {
      setPayErrorMessage('Please select a Bank Name / Account for the payment.')
      return
    }

    setPaySubmitting(true)
    try {
      const payload = {
        amount: numAmount,
        bankAccountId: isCashAccount ? null : Number(payFormData.bankAccountId),
        paymentDate: payFormData.paymentDate,
        paymentMode: isCashAccount ? 'Cash' : payFormData.paymentMode,
        remarks: payFormData.remark.trim(),
        remark: payFormData.remark.trim(),
      }

      const updated = await consultingService.recordPayment(payFormData.recordId, payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully for "${payFormData.ownerName}"!`,
        })
      }

      // WhatsApp payment confirmation dialog / link
      if (selectedRecord) {
        const prevReceived = Number(selectedRecord.receivedAmount) || 0
        const newTotal = prevReceived + numAmount
        const remaining = Math.max(0, Number(selectedRecord.totalAmount) - newTotal)

        shareConsultingPaymentConfirmationOnWhatsApp({
          consulting: selectedRecord,
          newPaymentAmount: numAmount,
          previousReceivedAmount: prevReceived,
          updatedTotalReceivedAmount: newTotal,
          remainingPendingAmount: remaining,
          paymentDate: new Date(payFormData.paymentDate).toLocaleDateString('en-GB'),
          paymentMode: isCashAccount ? 'Cash' : payFormData.paymentMode,
          showNotification,
        })
      }

      // Reset payment form
      setPayFormData({
        paymentDate: todayStr,
        recordId: '',
        ownerName: '',
        mobileNumber: '',
        totalAmount: '',
        amount: '',
        paymentMode: 'UPI',
        bankAccountId: initialBankId,
        remark: '',
      })
      setSelectedRecord(null)
      setPaySearch('')

      // Reload fresh list
      fetchConsultingList()

      if (onPaymentRecorded) {
        onPaymentRecorded(updated)
      }
      if (onConsultingCreated) {
        onConsultingCreated(updated)
      }
    } catch (err) {
      console.error('Failed to record consulting payment:', err)
      setPayErrorMessage(err.message || 'Failed to record payment. Please check your inputs.')
    } finally {
      setPaySubmitting(false)
    }
  }

  return (
    <section className="daily-expense-section" id="consulting-form">
      {/* ── Sub-tabs Header ── */}
      <div
        className="consulting-subtabs-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          borderBottom: '1px solid #E5EAF1',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          className={`labour-tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
            fontWeight: activeTab === 'add' ? 600 : 500,
            color: activeTab === 'add' ? '#0284C7' : '#70829F',
            padding: '8px 0 14px 0',
            cursor: 'pointer',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color 0.15s ease',
          }}
        >
          <Plus size={16} />
          <span>Add Consulting</span>
          {activeTab === 'add' && (
            <span
              style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#0284C7',
                borderRadius: '2px 2px 0 0',
              }}
            />
          )}
        </button>

        <button
          type="button"
          className={`labour-tab-btn ${activeTab === 'payment' ? 'active' : ''}`}
          onClick={() => setActiveTab('payment')}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
            fontWeight: activeTab === 'payment' ? 600 : 500,
            color: activeTab === 'payment' ? '#0284C7' : '#70829F',
            padding: '8px 0 14px 0',
            cursor: 'pointer',
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color 0.15s ease',
          }}
        >
          <CreditCard size={16} />
          <span>Record Consulting Payment</span>
          {activeTab === 'payment' && (
            <span
              style={{
                position: 'absolute',
                bottom: '-1px',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#0284C7',
                borderRadius: '2px 2px 0 0',
              }}
            />
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB 1: ADD CONSULTING
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'add' && (
        <>
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

              {/* 7. Bank Name / Account */}
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 2: RECORD CONSULTING PAYMENT
         ══════════════════════════════════════════════════════════ */}
      {activeTab === 'payment' && (
        <>
          <div className="section-header-compact">
            <h2 className="section-title">Record Consulting Payment</h2>
            <p className="section-subtitle">Record a payment receipt against an existing consulting client record.</p>
          </div>

          {payErrorMessage && (
            <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{payErrorMessage}</span>
            </div>
          )}

          <form className="daily-expense-form" onSubmit={handleRecordPaymentSubmit}>
            <div
              className="form-grid consulting-form-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '16px',
              }}
            >
              {/* 1. Payment Date */}
              <div className="form-group">
                <label className="form-label">
                  Payment Date <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  className="form-input"
                  value={payFormData.paymentDate}
                  onChange={handlePayChange}
                  required
                />
              </div>

              {/* 2. Owner Name (Searchable Dropdown) */}
              <div className="form-group" ref={ownerDropdownRef} style={{ position: 'relative' }}>
                <label className="form-label">
                  Owner Name <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search owner name or mobile..."
                    value={paySearch}
                    onChange={(e) => {
                      setPaySearch(e.target.value)
                      setIsOwnerDropdownOpen(true)
                      if (payErrorMessage) setPayErrorMessage('')
                    }}
                    onFocus={() => setIsOwnerDropdownOpen(true)}
                    style={{
                      paddingRight: paySearch ? '56px' : '32px',
                    }}
                    required
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {paySearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaySearch('')
                          setSelectedRecord(null)
                          setPayFormData((prev) => ({
                            ...prev,
                            recordId: '',
                            ownerName: '',
                            mobileNumber: '',
                            totalAmount: '',
                          }))
                          setIsOwnerDropdownOpen(true)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          color: '#94A3B8',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Clear selection"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <ChevronDown
                      size={16}
                      style={{
                        color: '#94A3B8',
                        cursor: 'pointer',
                        transform: isOwnerDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease',
                      }}
                      onClick={() => setIsOwnerDropdownOpen((prev) => !prev)}
                    />
                  </div>
                </div>

                {/* Dropdown Options */}
                {isOwnerDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      marginTop: '4px',
                      maxHeight: '240px',
                      overflowY: 'auto',
                      background: '#FFFFFF',
                      border: '1px solid #DCE4F0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {filteredRecords.length === 0 ? (
                      <div style={{ padding: '14px 16px', color: '#94A3B8', fontSize: '13px', textAlign: 'center' }}>
                        No consulting records found
                      </div>
                    ) : (
                      filteredRecords.map((rec) => {
                        const isSelected = String(rec.id) === String(payFormData.recordId)
                        const formattedDate = rec.date ? new Date(rec.date).toLocaleDateString('en-GB') : ''
                        const formattedTotal = Number(rec.totalAmount || 0).toLocaleString('en-IN')
                        return (
                          <div
                            key={rec.id}
                            onClick={() => handleSelectRecord(rec)}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              backgroundColor: isSelected ? '#F0F9FF' : '#FFFFFF',
                              borderBottom: '1px solid #F1F5F9',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC'
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#172033' }}>
                                {rec.ownerName}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                                +91 {rec.mobileNumber} {formattedDate ? `• Date: ${formattedDate}` : ''} • Ref: #{rec.id}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0284C7' }}>
                                ₹{formattedTotal}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* 3. Mobile Number (Read-only) */}
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 12px',
                      height: '42px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRight: 'none',
                      borderTopLeftRadius: '6px',
                      borderBottomLeftRadius: '6px',
                      fontSize: '13.5px',
                      fontWeight: 600,
                      color: '#64748B',
                      userSelect: 'none',
                    }}
                  >
                    +91
                  </span>
                  <input
                    type="tel"
                    name="mobileNumber"
                    className="form-input"
                    value={payFormData.mobileNumber}
                    readOnly
                    placeholder="Auto-populated"
                    style={{
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      backgroundColor: '#F8FAFC',
                      color: '#475569',
                      cursor: 'not-allowed',
                    }}
                  />
                </div>
              </div>

              {/* 4. Total Amount (₹) (Read-only) */}
              <div className="form-group">
                <label className="form-label">Total Amount (₹)</label>
                <input
                  type="text"
                  name="totalAmount"
                  className="form-input"
                  value={payFormData.totalAmount ? `₹${Number(payFormData.totalAmount).toLocaleString('en-IN')}` : ''}
                  readOnly
                  placeholder="Auto-populated"
                  style={{
                    backgroundColor: '#F8FAFC',
                    color: '#475569',
                    cursor: 'not-allowed',
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* 5. Payment Amount (₹) */}
              <div className="form-group">
                <label className="form-label">
                  Payment Amount (₹) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  className="form-input"
                  placeholder="e.g. 15000"
                  min="1"
                  step="any"
                  value={payFormData.amount}
                  onChange={handlePayChange}
                  required
                />
              </div>

              {/* 6. Payment Mode */}
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select
                  name="paymentMode"
                  className="form-select"
                  value={payFormData.paymentMode}
                  onChange={handlePayChange}
                >
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>

              {/* 7. Bank Name / Account */}
              <div className="form-group">
                <label className="form-label">
                  Bank Name / Account{' '}
                  {payFormData.paymentMode !== 'Cash' && <span style={{ color: '#DC2626' }}>*</span>}
                </label>
                <select
                  name="bankAccountId"
                  className="form-select"
                  value={payFormData.bankAccountId}
                  onChange={handlePayChange}
                  required={payFormData.paymentMode !== 'Cash'}
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
                  placeholder="e.g. Part payment, final settlement, etc."
                  value={payFormData.remark}
                  onChange={handlePayChange}
                />
              </div>
            </div>

            <div className="form-actions-right" style={{ marginTop: '20px' }}>
              <button
                type="submit"
                className="btn btn-primary-action btn-add-consulting-submit"
                disabled={paySubmitting}
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
                  cursor: paySubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 3px rgba(2, 147, 222, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                {paySubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={16} />
                    <span>Record Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
