import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Receipt,
  Search,
  ChevronDown,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  User,
  HardHat,
} from 'lucide-react'
import { workerPaymentService } from '../services/workerPaymentService.js'
import { labourService } from '../services/labourService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

export default function LabourPaymentForm({
  workers: initialWorkers = [],
  sites = [],
  bankAccounts = [],
  onPaymentRecorded,
  showNotification,
}) {
  const [workersList, setWorkersList] = useState(initialWorkers)
  const [selectedWorkerId, setSelectedWorkerId] = useState('')
  const [workerSearch, setWorkerSearch] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Form inputs
  const [siteId, setSiteId] = useState('')
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [paymentDate, setPaymentDate] = useState(getTodayString())
  const [remarks, setRemarks] = useState('')

  // Live worker financial metrics fetched from payment history
  const [liveWorkerPayments, setLiveWorkerPayments] = useState([])
  const [loadingLiveDetails, setLoadingLiveDetails] = useState(false)

  // State
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Keep workersList in sync with parent prop
  useEffect(() => {
    if (initialWorkers && initialWorkers.length > 0) {
      setWorkersList(initialWorkers)
    }
  }, [initialWorkers])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Currently selected worker object from list
  const selectedWorker = useMemo(() => {
    if (!selectedWorkerId) return null
    return (
      workersList.find(
        (w) => String(w._id || w.id) === String(selectedWorkerId)
      ) || null
    )
  }, [selectedWorkerId, workersList])

  // Filtered workers for the searchable dropdown
  const filteredWorkers = useMemo(() => {
    if (!workerSearch.trim()) return workersList
    const q = workerSearch.toLowerCase().trim()
    return workersList.filter((w) => {
      const name = (w.name || '').toLowerCase()
      const trade = (w.trade || '').toLowerCase()
      const siteName = (w.siteName || w.site?.name || '').toLowerCase()
      const phone = (w.phone || '').toLowerCase()
      return (
        name.includes(q) ||
        trade.includes(q) ||
        siteName.includes(q) ||
        phone.includes(q)
      )
    })
  }, [workersList, workerSearch])

  // Auto-populated Construction Site display name
  const siteDisplayValue = useMemo(() => {
    if (!selectedWorker) return ''

    // 1. If worker has site object with name
    if (selectedWorker.site && typeof selectedWorker.site === 'object') {
      const sName = selectedWorker.site.name || ''
      const sLoc = selectedWorker.site.location ? ` (${selectedWorker.site.location})` : ''
      if (sName) return `${sName}${sLoc}`.trim()
    }

    // 2. If worker has siteName string
    if (selectedWorker.siteName) {
      const matched = sites.find(
        (s) =>
          (s.name && s.name.toLowerCase() === selectedWorker.siteName.toLowerCase()) ||
          String(s._id || s.id) === String(selectedWorker.siteId || selectedWorker.site_id)
      )
      if (matched && matched.location && !selectedWorker.siteName.includes('(')) {
        return `${matched.name} (${matched.location})`
      }
      return selectedWorker.siteName
    }

    // 3. If worker has site ID string/number
    const rawSiteId =
      selectedWorker.siteId ||
      selectedWorker.site_id ||
      (typeof selectedWorker.site === 'string' || typeof selectedWorker.site === 'number'
        ? String(selectedWorker.site)
        : '')
    if (rawSiteId) {
      const matched = sites.find((s) => String(s._id || s.id) === String(rawSiteId))
      if (matched) {
        return `${matched.name}${matched.location ? ` (${matched.location})` : ''}`
      }
    }
    return ''
  }, [selectedWorker, sites])

  // When worker is selected, auto-populate site and fetch latest payment history
  useEffect(() => {
    if (!selectedWorker) {
      setSiteId('')
      setLiveWorkerPayments([])
      return
    }

    // Auto-populate site ID
    let assignedSiteId =
      selectedWorker.siteId ||
      selectedWorker.site_id ||
      selectedWorker.site?._id ||
      selectedWorker.site?.id ||
      (typeof selectedWorker.site === 'string' || typeof selectedWorker.site === 'number'
        ? String(selectedWorker.site)
        : '') ||
      ''

    if (!assignedSiteId && selectedWorker.siteName) {
      const matched = sites.find(
        (s) => s.name && s.name.toLowerCase() === selectedWorker.siteName.toLowerCase()
      )
      if (matched) {
        assignedSiteId = String(matched._id || matched.id)
      }
    }
    setSiteId(assignedSiteId)

    // Clear previous errors/success
    setErrorMessage('')
    setSuccessMessage('')

    // Fetch fresh payment records for this worker to ensure 100% database accuracy
    const wid = selectedWorker._id || selectedWorker.id
    if (wid) {
      setLoadingLiveDetails(true)
      workerPaymentService
        .getByWorker(wid)
        .then((res) => {
          const list = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
            ? res
            : []
          setLiveWorkerPayments(list)
        })
        .catch(() => setLiveWorkerPayments([]))
        .finally(() => setLoadingLiveDetails(false))
    }
  }, [selectedWorkerId])

  // Derived financial values for selected worker
  const totalAmount = useMemo(() => {
    if (!selectedWorker) return 0
    return Number(
      selectedWorker.totalAmount !== undefined
        ? selectedWorker.totalAmount
        : selectedWorker.wagesEarned !== undefined
        ? selectedWorker.wagesEarned
        : selectedWorker.dailyRate || 0
    )
  }, [selectedWorker])

  const advancePayment = useMemo(() => {
    if (!selectedWorker) return 0
    return Number(
      selectedWorker.advanceAmount !== undefined
        ? selectedWorker.advanceAmount
        : selectedWorker.advancePaid || 0
    )
  }, [selectedWorker])

  // Total paid: calculate from live payment history if fetched, or fallback to worker record
  const totalPaidAmount = useMemo(() => {
    if (!selectedWorker) return 0
    if (liveWorkerPayments.length > 0) {
      // Sum all recorded amounts
      return liveWorkerPayments.reduce(
        (sum, p) => sum + Number(p.amount !== undefined ? p.amount : p.advance || 0),
        0
      )
    }
    return Number(selectedWorker.totalPaid || 0)
  }, [selectedWorker, liveWorkerPayments])

  // Pending Amount = Total Amount - Total Paid Amount
  const pendingAmount = useMemo(() => {
    if (!selectedWorker) return 0
    return Math.max(0, totalAmount - totalPaidAmount)
  }, [totalAmount, totalPaidAmount, selectedWorker])

  // Selected bank object
  const selectedBank = useMemo(() => {
    if (!bankAccountId) return null
    return (
      bankAccounts.find(
        (b) => String(b._id || b.id) === String(bankAccountId)
      ) || null
    )
  }, [bankAccountId, bankAccounts])

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedWorkerId || !selectedWorker) {
      setErrorMessage('Please select a worker.')
      return
    }

    if (!bankAccountId) {
      setErrorMessage('Please select a bank account.')
      return
    }

    const numAmount = Number(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.')
      return
    }

    if (pendingAmount > 0 && numAmount > pendingAmount) {
      setErrorMessage(
        `Payment amount (₹${numAmount.toLocaleString('en-IN')}) cannot exceed the pending amount of ₹${pendingAmount.toLocaleString('en-IN')}.`
      )
      return
    }

    // Check bank balance
    if (selectedBank) {
      const balance = Number(selectedBank.balance || 0)
      if (balance <= 0) {
        setErrorMessage(
          `Bank account (${selectedBank.bankName || selectedBank.bank_name}) has zero balance. Please select another account.`
        )
        return
      }
      if (balance < numAmount) {
        setErrorMessage(
          `Insufficient bank balance in ${selectedBank.bankName || selectedBank.bank_name}. Available: ₹${balance.toLocaleString('en-IN')}, Requested: ₹${numAmount.toLocaleString('en-IN')}.`
        )
        return
      }
    }

    try {
      setSubmitting(true)

      const payload = {
        workerId: selectedWorkerId,
        siteId: siteId || null,
        bankAccountId,
        amount: numAmount,
        paymentDate: paymentDate || getTodayString(),
        paymentType: 'Remaining Payment',
        remarks: (remarks || '').trim(),
        createdBy: 'Admin',
      }

      const res = await workerPaymentService.create(payload)

      const successMsg = `Payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully for ${selectedWorker.name}!`
      setSuccessMessage(successMsg)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: successMsg,
        })
      }

      // Reset transaction inputs
      setAmount('')
      setRemarks('')

      // Reload fresh labour and bank account data
      if (onPaymentRecorded) {
        onPaymentRecorded()
      }

      // Re-fetch workers list to update state immediately
      try {
        const freshLabour = await labourService.getAll()
        const freshList = freshLabour?.workers || []
        setWorkersList(freshList)
      } catch (err) {
        console.error('Failed to reload fresh labour after payment:', err)
      }

      // Re-fetch fresh live payments for the selected worker to update metrics immediately
      try {
        const freshPaymentsRes = await workerPaymentService.getByWorker(selectedWorkerId)
        const list = Array.isArray(freshPaymentsRes?.data)
          ? freshPaymentsRes.data
          : Array.isArray(freshPaymentsRes)
          ? freshPaymentsRes
          : []
        setLiveWorkerPayments(list)
      } catch (err) {
        console.error('Failed to refresh worker payments:', err)
      }
    } catch (err) {
      console.error('Failed to record labour payment:', err)
      setErrorMessage(err.message || 'Failed to record payment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="daily-expense-section" id="labour-payment-form">
      <div className="section-header-compact">
        <h2 className="section-title">Labour Payment</h2>
        <p className="section-subtitle">
          Record wage, advance, or remaining payments for existing registered workers.
        </p>
      </div>

      {errorMessage && (
        <div
          className="form-alert form-alert-error"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          className="form-alert form-alert-success"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '8px',
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="daily-expense-form">
        <div className="dashboard-worker-form-grid">
          {/* 1. Worker Name (Searchable Dropdown) */}
          <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
            <label className="form-label labour-form-label">
              Worker Name <span style={{ color: '#EF4444' }}>*</span>
            </label>

            {/* Clickable Display / Search Input */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                className="form-input"
                placeholder={
                  selectedWorker
                    ? selectedWorker.name
                    : 'Search or select registered worker...'
                }
                value={
                  isDropdownOpen
                    ? workerSearch
                    : selectedWorker
                    ? selectedWorker.name
                    : ''
                }
                onFocus={() => {
                  setIsDropdownOpen(true)
                  setWorkerSearch('')
                }}
                onChange={(e) => {
                  setWorkerSearch(e.target.value)
                  if (!isDropdownOpen) setIsDropdownOpen(true)
                }}
                style={{
                  paddingRight: '36px',
                  cursor: 'pointer',
                  fontWeight: selectedWorker && !isDropdownOpen ? 600 : 400,
                  color: selectedWorker && !isDropdownOpen ? '#172033' : 'inherit',
                }}
              />

              {selectedWorker && !isDropdownOpen ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedWorkerId('')
                    setWorkerSearch('')
                  }}
                  title="Clear selected worker"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={15} />
                </button>
              ) : (
                <ChevronDown
                  size={16}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    color: '#94A3B8',
                    pointerEvents: 'none',
                    transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              )}
            </div>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 250,
                  marginTop: '4px',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                  maxHeight: '230px',
                  overflowY: 'auto',
                }}
              >
                {filteredWorkers.length > 0 ? (
                  filteredWorkers.map((w) => {
                    const isSelected =
                      String(w._id || w.id) === String(selectedWorkerId)
                    const pending = Math.max(
                      0,
                      Number(w.totalAmount || w.wagesEarned || w.dailyRate || 0) -
                        Number(w.totalPaid || 0)
                    )
                    return (
                      <div
                        key={w._id || w.id}
                        onClick={() => {
                          setSelectedWorkerId(String(w._id || w.id))
                          setIsDropdownOpen(false)
                          setWorkerSearch('')
                        }}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                          transition: 'background-color 0.1s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 600,
                              color: '#172033',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {w.name}
                          </div>
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: '#64748B',
                              marginTop: '1px',
                            }}
                          >
                            {w.trade || 'Worker'}
                            {w.siteName ? ` · ${w.siteName}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: pending > 0 ? '#FEF2F2' : '#F0FDF4',
                              color: pending > 0 ? '#DC2626' : '#16A34A',
                            }}
                          >
                            {pending > 0 ? `₹${pending.toLocaleString('en-IN')} pending` : 'Paid'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      textAlign: 'center',
                      color: '#94A3B8',
                      fontSize: '13px',
                    }}
                  >
                    No registered workers found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Worker Trade / Role (Read-only) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Worker Trade / Role</label>
            <input
              type="text"
              className="form-input expense-total-readonly"
              value={selectedWorker ? selectedWorker.trade || '—' : ''}
              readOnly
              placeholder="Auto-populated trade"
              style={{
                backgroundColor: '#F8FAFC',
                borderColor: '#E2E8F0',
                color: '#334155',
                cursor: 'default',
              }}
            />
          </div>

          {/* 3. Construction Site (Auto-populated) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Construction Site</label>
            {selectedWorker && !siteDisplayValue ? (
              <select
                className="form-select"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
              >
                <option value="">Select construction site...</option>
                {sites.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name} {s.location ? `(${s.location})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input expense-total-readonly"
                value={siteDisplayValue}
                readOnly
                placeholder="Auto-populated site"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#334155',
                  cursor: 'default',
                }}
              />
            )}
          </div>

          {/* 4. Total Amount (₹) (Read-only) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Total Amount (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={
                  selectedWorker
                    ? totalAmount.toLocaleString('en-IN')
                    : ''
                }
                readOnly
                placeholder="0"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#1E293B',
                  fontWeight: 600,
                  cursor: 'default',
                }}
              />
            </div>
          </div>

          {/* 5. Advance Payment (₹) (Read-only) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Advance Payment (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={
                  selectedWorker
                    ? advancePayment.toLocaleString('en-IN')
                    : ''
                }
                readOnly
                placeholder="0"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#1E293B',
                  fontWeight: 600,
                  cursor: 'default',
                }}
              />
            </div>
          </div>

          {/* 6. Total Paid Amount (₹) (Read-only) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Total Paid Amount (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={
                  selectedWorker
                    ? totalPaidAmount.toLocaleString('en-IN')
                    : ''
                }
                readOnly
                placeholder="0"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#15803D',
                  fontWeight: 600,
                  cursor: 'default',
                }}
              />
            </div>
          </div>

          {/* 7. Pending Amount (₹) (Read-only) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Pending Amount (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={
                  selectedWorker
                    ? pendingAmount.toLocaleString('en-IN')
                    : ''
                }
                readOnly
                placeholder="0"
                style={{
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: pendingAmount > 0 ? '#DC2626' : '#15803D',
                  fontWeight: 700,
                  cursor: 'default',
                }}
              />
            </div>
          </div>

          {/* 8. Payment Amount (₹) */}
          <div className="form-group">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <label className="form-label labour-form-label">
                Payment Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
              </label>
              {selectedWorker && pendingAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(pendingAmount))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: '4px',
                  }}
                >
                  Pay full pending
                </button>
              )}
            </div>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="number"
                name="amount"
                className="form-input input-with-prefix"
                placeholder={pendingAmount > 0 ? `e.g. ${pendingAmount}` : '0'}
                min="1"
                max={pendingAmount > 0 ? pendingAmount : undefined}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!selectedWorker}
              />
            </div>
          </div>

          {/* 9. Bank Account */}
          <div className="form-group">
            <label className="form-label labour-form-label">
              Bank Account <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              name="bankAccountId"
              className="form-select"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
            >
              <option value="">Select bank account...</option>
              {bankAccounts.map((b) => (
                <option key={b.id || b._id} value={b.id || b._id}>
                  {b.bankName || b.bank_name} (₹{Number(b.balance || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* 10. Payment Date */}
          <div className="form-group">
            <label className="form-label labour-form-label">
              Payment Date <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="date"
                name="paymentDate"
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
              <Calendar
                size={16}
                style={{
                  position: 'absolute',
                  right: '12px',
                  color: '#94A3B8',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* 11. Remarks (Optional) — Spanning 2 columns */}
          <div
            className="form-group"
            style={{
              gridColumn: 'span 2',
            }}
          >
            <label className="form-label labour-form-label">Remarks (Optional)</label>
            <input
              type="text"
              name="remarks"
              className="form-input"
              placeholder="e.g. Weekly wage payment, advance adjustment..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* 12. Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button
            type="submit"
            className="btn btn-primary-action"
            disabled={submitting || !selectedWorker}
            style={{
              backgroundColor: '#16A34A',
              borderColor: '#16A34A',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              fontWeight: 600,
              fontSize: '13.5px',
              borderRadius: '8px',
              cursor: submitting || !selectedWorker ? 'not-allowed' : 'pointer',
              opacity: !selectedWorker ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin-animate" />
                <span>Recording Payment...</span>
              </>
            ) : (
              <>
                <Receipt size={16} />
                <span>Record Payment</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
