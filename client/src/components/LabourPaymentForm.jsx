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
  Building2,
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
  const [selectedWorkerKey, setSelectedWorkerKey] = useState('')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')
  const [workerSearch, setWorkerSearch] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Form inputs
  const [amount, setAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [paymentDate, setPaymentDate] = useState(getTodayString())
  const [remarks, setRemarks] = useState('')

  // Live worker financial metrics fetched from payment history for selected assignment
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

  // ── Group workers by unique identity (Name + Phone) ──
  const workerGroups = useMemo(() => {
    const map = new Map()
    workersList.forEach((w) => {
      const key = (w.name || '').trim().toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: w.name,
          phone: w.phone,
          assignments: [],
        })
      }
      map.get(key).assignments.push(w)
    })
    return Array.from(map.values())
  }, [workersList])

  // Currently selected worker group
  const selectedWorker = useMemo(() => {
    if (!selectedWorkerKey) return null
    return workerGroups.find((g) => g.key === selectedWorkerKey) || null
  }, [selectedWorkerKey, workerGroups])

  // Filtered workers for the searchable dropdown
  const filteredWorkers = useMemo(() => {
    if (!workerSearch.trim()) return workerGroups
    const q = workerSearch.toLowerCase().trim()
    return workerGroups.filter((g) => {
      const name = (g.name || '').toLowerCase()
      const phone = (g.phone || '').toLowerCase()
      const hasMatchingSiteOrTrade = g.assignments.some(
        (a) =>
          (a.trade || '').toLowerCase().includes(q) ||
          (a.siteName || a.site?.name || '').toLowerCase().includes(q)
      )
      return name.includes(q) || phone.includes(q) || hasMatchingSiteOrTrade
    })
  }, [workerGroups, workerSearch])

  // Construction sites assigned to the selected worker
  const assignedSites = useMemo(() => {
    if (!selectedWorker) return []
    return selectedWorker.assignments
  }, [selectedWorker])

  // Currently selected worker-site assignment
  const selectedAssignment = useMemo(() => {
    if (!selectedAssignmentId || !selectedWorker) return null
    return (
      selectedWorker.assignments.find(
        (a) => String(a._id || a.id) === String(selectedAssignmentId)
      ) || null
    )
  }, [selectedAssignmentId, selectedWorker])

  // Fetch live payment records for the selected worker-site assignment
  useEffect(() => {
    if (!selectedAssignment) {
      setLiveWorkerPayments([])
      return
    }

    const wid = selectedAssignment._id || selectedAssignment.id
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
  }, [selectedAssignmentId, selectedAssignment])

  // Derived financial values for the selected worker-site assignment
  const totalAmount = useMemo(() => {
    if (!selectedAssignment) return 0
    return Number(
      selectedAssignment.totalAmount !== undefined
        ? selectedAssignment.totalAmount
        : selectedAssignment.wagesEarned !== undefined
        ? selectedAssignment.wagesEarned
        : selectedAssignment.dailyRate || 0
    )
  }, [selectedAssignment])

  const advancePayment = useMemo(() => {
    if (!selectedAssignment) return 0
    return Number(
      selectedAssignment.advanceAmount !== undefined
        ? selectedAssignment.advanceAmount
        : selectedAssignment.advancePaid || 0
    )
  }, [selectedAssignment])

  // Total paid: calculate from live payment history if fetched, or fallback to assignment record
  const totalPaidAmount = useMemo(() => {
    if (!selectedAssignment) return 0
    if (liveWorkerPayments.length > 0) {
      return liveWorkerPayments.reduce(
        (sum, p) => sum + Number(p.amount !== undefined ? p.amount : p.advance || 0),
        0
      )
    }
    return Number(selectedAssignment.totalPaid || 0)
  }, [selectedAssignment, liveWorkerPayments])

  // Pending Amount = Total Amount - Total Paid Amount
  const pendingAmount = useMemo(() => {
    if (!selectedAssignment) return 0
    return Math.max(0, totalAmount - totalPaidAmount)
  }, [totalAmount, totalPaidAmount, selectedAssignment])

  // Selected bank object
  const selectedBank = useMemo(() => {
    if (!bankAccountId) return null
    return (
      bankAccounts.find(
        (b) => String(b._id || b.id) === String(bankAccountId)
      ) || null
    )
  }, [bankAccountId, bankAccounts])

  const handleSelectWorker = (workerGroup) => {
    setSelectedWorkerKey(workerGroup.key)
    setSelectedAssignmentId('')
    setLiveWorkerPayments([])
    setIsDropdownOpen(false)
    setWorkerSearch('')
    setErrorMessage('')
    setSuccessMessage('')
  }

  const handleClearWorker = () => {
    setSelectedWorkerKey('')
    setSelectedAssignmentId('')
    setLiveWorkerPayments([])
    setWorkerSearch('')
    setIsDropdownOpen(false)
    setErrorMessage('')
  }

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedWorker) {
      setErrorMessage('Please select a Worker Name.')
      return
    }

    if (!selectedAssignmentId || !selectedAssignment) {
      setErrorMessage('Please select a Construction Site assigned to this worker.')
      return
    }

    if (!bankAccountId) {
      setErrorMessage('Please select a Bank Account.')
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

      const rawSiteId =
        selectedAssignment.siteId ||
        selectedAssignment.site_id ||
        selectedAssignment.site?._id ||
        selectedAssignment.site?.id ||
        null

      const payload = {
        workerId: selectedAssignment._id || selectedAssignment.id,
        siteId: rawSiteId,
        bankAccountId,
        amount: numAmount,
        paymentDate: paymentDate || getTodayString(),
        paymentType: 'Remaining Payment',
        remarks: (remarks || '').trim(),
        createdBy: 'Admin',
      }

      await workerPaymentService.create(payload)

      const assignedSiteName = selectedAssignment.siteName || selectedAssignment.site?.name || 'site'
      const successMsg = `Payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully for ${selectedWorker.name} at ${assignedSiteName}!`
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

      // Re-fetch fresh live payments for the selected worker assignment
      const wid = selectedAssignment._id || selectedAssignment.id
      if (wid) {
        try {
          const freshPaymentsRes = await workerPaymentService.getByWorker(wid)
          const list = Array.isArray(freshPaymentsRes?.data)
            ? freshPaymentsRes.data
            : Array.isArray(freshPaymentsRes)
            ? freshPaymentsRes
            : []
          setLiveWorkerPayments(list)
        } catch (err) {
          console.error('Failed to refresh worker payments:', err)
        }
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
          {/* Step 1: Worker Name (Searchable Dropdown) */}
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
                    handleClearWorker()
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
                  filteredWorkers.map((g) => {
                    const isSelected = selectedWorkerKey === g.key
                    const totalPending = g.assignments.reduce(
                      (sum, a) =>
                        sum +
                        Math.max(
                          0,
                          Number(a.totalAmount || a.wagesEarned || a.dailyRate || 0) -
                            Number(a.totalPaid || 0)
                        ),
                      0
                    )
                    const siteNames = Array.from(
                      new Set(g.assignments.map((a) => a.siteName || a.site?.name).filter(Boolean))
                    )
                    return (
                      <div
                        key={g.key}
                        onClick={() => handleSelectWorker(g)}
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
                            {g.name}
                          </div>
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: '#64748B',
                              marginTop: '1px',
                            }}
                          >
                            {g.assignments.length === 1
                              ? (g.assignments[0]?.trade || 'Worker')
                              : `${g.assignments.length} Sites`}
                            {siteNames.length > 0 ? ` · ${siteNames.join(', ')}` : ''}
                            {g.phone && g.phone !== 'N/A' ? ` · ${g.phone}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: totalPending > 0 ? '#FEF2F2' : '#F0FDF4',
                              color: totalPending > 0 ? '#DC2626' : '#16A34A',
                            }}
                          >
                            {totalPending > 0 ? `₹${totalPending.toLocaleString('en-IN')} pending` : 'Paid'}
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

          {/* Step 3 (Populated once site is chosen): Worker Trade / Role (Read-only) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Worker Trade / Role</label>
            <input
              type="text"
              className="form-input expense-total-readonly"
              value={selectedAssignment ? selectedAssignment.trade || '—' : ''}
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

          {/* Step 2: Construction Site (Dropdown filtered to worker's assigned sites) */}
          <div className="form-group">
            <label className="form-label labour-form-label">
              Construction Site <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              className="form-select"
              value={selectedAssignmentId}
              disabled={!selectedWorker}
              onChange={(e) => {
                setSelectedAssignmentId(e.target.value)
                setErrorMessage('')
              }}
              style={{
                backgroundColor: !selectedWorker ? '#F8FAFC' : '#FFFFFF',
                cursor: !selectedWorker ? 'not-allowed' : 'pointer',
                borderColor: selectedWorker && !selectedAssignmentId ? '#0284C7' : undefined,
              }}
              required
            >
              <option value="">
                {!selectedWorker
                  ? 'Select worker first...'
                  : assignedSites.length === 0
                  ? 'No sites assigned to this worker'
                  : 'Select assigned site...'}
              </option>
              {assignedSites.map((a) => {
                const aSiteName = a.siteName || a.site?.name || 'Assigned Site'
                const aTrade = a.trade ? ` (${a.trade})` : ''
                return (
                  <option key={a._id || a.id} value={String(a._id || a.id)}>
                    {aSiteName}{aTrade}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Step 3: Total Amount (₹) (Read-only, populated for selected site assignment) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Total Amount (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={selectedAssignment ? totalAmount.toLocaleString('en-IN') : ''}
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

          {/* Step 3: Advance Payment (₹) (Read-only, populated for selected site assignment) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Advance Payment (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={selectedAssignment ? advancePayment.toLocaleString('en-IN') : ''}
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

          {/* Step 3: Total Paid Amount (₹) (Read-only, populated for selected site assignment) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Total Paid Amount (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={selectedAssignment ? totalPaidAmount.toLocaleString('en-IN') : ''}
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

          {/* Step 3: Pending Amount (₹) (Read-only, populated for selected site assignment) */}
          <div className="form-group">
            <label className="form-label labour-form-label">Pending Amount (₹)</label>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="text"
                className="form-input input-with-prefix"
                value={selectedAssignment ? pendingAmount.toLocaleString('en-IN') : ''}
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

          {/* Editable Field 1: Payment Amount (₹) – Required */}
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
              {pendingAmount > 0 && selectedAssignment && (
                <button
                  type="button"
                  onClick={() => setAmount(String(pendingAmount))}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284C7',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Pay Full Pending (₹{pendingAmount.toLocaleString('en-IN')})
                </button>
              )}
            </div>
            <div className="input-with-currency-wrap">
              <span className="input-currency-prefix">₹</span>
              <input
                type="number"
                className="form-input input-with-prefix"
                placeholder="0"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  if (errorMessage) setErrorMessage('')
                }}
                required
              />
            </div>
          </div>

          {/* Editable Field 2: Bank Account – Required */}
          <div className="form-group">
            <label className="form-label labour-form-label">
              Bank Account <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              className="form-select"
              value={bankAccountId}
              onChange={(e) => {
                setBankAccountId(e.target.value)
                if (errorMessage) setErrorMessage('')
              }}
              required
            >
              <option value="">Select bank account...</option>
              {bankAccounts.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  {b.bankName || b.bank_name} (Bal: ₹
                  {Number(b.balance || 0).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Editable Field 3: Payment Date – Required */}
          <div className="form-group">
            <label className="form-label labour-form-label">
              Payment Date <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div className="input-with-icon">
              <input
                type="date"
                className="form-input"
                value={paymentDate}
                onChange={(e) => {
                  setPaymentDate(e.target.value)
                  if (errorMessage) setErrorMessage('')
                }}
                required
              />
              <Calendar size={16} className="input-icon-right" />
            </div>
          </div>

          {/* Editable Field 4: Remarks (Optional) */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label labour-form-label">Remarks (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Weekly wage payment, advance adjustment..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            type="submit"
            className="btn btn-primary-action"
            disabled={submitting}
            style={{
              backgroundColor: '#16A34A',
              borderColor: '#16A34A',
              minWidth: '160px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin-animate" />
                <span>Recording...</span>
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
