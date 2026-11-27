import React, { useState, useEffect, useRef } from 'react'
import { Plus, Loader2, AlertCircle, Calendar, ChevronDown, Check, X } from 'lucide-react'
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

  // Searchable Ledger dropdown state
  const [ledgers, setLedgers] = useState([])
  const [isLedgerOpen, setIsLedgerOpen] = useState(false)
  const ledgerDropdownRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    const loadLedgers = async () => {
      try {
        const list = await otherTransactionService.getLedgers()
        if (isMounted && Array.isArray(list)) {
          setLedgers(list)
        }
      } catch (err) {
        console.error('Failed to load ledgers:', err)
      }
    }
    loadLedgers()
    return () => {
      isMounted = false
    }
  }, [])

  // Close ledger dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ledgerDropdownRef.current && !ledgerDropdownRef.current.contains(event.target)) {
        setIsLedgerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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

  // Filter ledgers based on user input
  const trimmedInput = (formData.ledgerName || '').trim().toLowerCase()
  const filteredLedgers = ledgers.filter((l) =>
    l.toLowerCase().includes(trimmedInput)
  )
  const isExactMatch = ledgers.some((l) => l.toLowerCase() === trimmedInput)

  const handleSelectLedger = (ledger) => {
    setFormData((prev) => ({ ...prev, ledgerName: ledger }))
    setIsLedgerOpen(false)
  }

  const handleClearLedger = () => {
    setFormData((prev) => ({ ...prev, ledgerName: '' }))
    setIsLedgerOpen(false)
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
    const submittedLedger = formData.ledgerName.trim()

    setSubmitting(true)
    try {
      const created = await otherTransactionService.create({
        date: formData.date,
        amount: numAmount,
        bankAccountId: payloadBankAccountId,
        paymentMethod: isCash ? 'Cash' : (formData.paymentMethod || 'UPI'),
        paymentType: formData.paymentType,
        ledgerName: submittedLedger,
        note: formData.note.trim(),
      })

      // Add to local ledgers list if it's new
      if (submittedLedger && !ledgers.some((l) => l.toLowerCase() === submittedLedger.toLowerCase())) {
        setLedgers((prev) => [...prev, submittedLedger].sort((a, b) => a.localeCompare(b)))
      }

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

          {/* Ledger Name (Searchable Combobox) */}
          <div className="form-group" ref={ledgerDropdownRef} style={{ position: 'relative' }}>
            <label className="form-label">Ledger Name (Optional)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                name="ledgerName"
                className="form-input"
                placeholder="Search or enter ledger name..."
                value={formData.ledgerName}
                autoComplete="off"
                onChange={(e) => {
                  handleChange(e)
                  setIsLedgerOpen(true)
                }}
                onFocus={() => setIsLedgerOpen(true)}
                style={{ paddingRight: '56px' }}
              />
              <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {formData.ledgerName && (
                  <button
                    type="button"
                    onClick={handleClearLedger}
                    title="Clear ledger"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '2px',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsLedgerOpen((prev) => !prev)}
                  title="Toggle ledger list"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '2px',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronDown
                    size={16}
                    style={{
                      transform: isLedgerOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Dropdown Menu */}
            {isLedgerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  marginTop: '4px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
              >
                {/* Option to create new ledger if typed text is not empty and not an exact match */}
                {formData.ledgerName.trim() && !isExactMatch && (
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectLedger(formData.ledgerName.trim())
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: '#F0FDF4',
                      borderBottom: '1px solid #E2E8F0',
                      color: '#166534',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={14} />
                    <span>Create new ledger: &quot;{formData.ledgerName.trim()}&quot;</span>
                  </div>
                )}

                {filteredLedgers.length > 0 ? (
                  filteredLedgers.map((ledger) => {
                    const isSelected = ledger.toLowerCase() === (formData.ledgerName || '').trim().toLowerCase()
                    return (
                      <div
                        key={ledger}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectLedger(ledger)
                        }}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '13px',
                          color: '#1E293B',
                          backgroundColor: isSelected ? '#EFF6FF' : '#ffffff',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff'
                        }}
                      >
                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{ledger}</span>
                        {isSelected && <Check size={14} style={{ color: '#2563EB' }} />}
                      </div>
                    )
                  })
                ) : !formData.ledgerName.trim() ? (
                  <div style={{ padding: '12px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                    No ledgers saved yet. Type a name to create one.
                  </div>
                ) : isExactMatch ? null : (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: '#64748B', textAlign: 'center' }}>
                    Click above to create &quot;{formData.ledgerName.trim()}&quot;
                  </div>
                )}
              </div>
            )}
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

