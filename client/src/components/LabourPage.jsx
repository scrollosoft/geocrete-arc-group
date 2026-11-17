import React, { useState, useEffect, useMemo } from 'react'
import {
  CreditCard,
  AlertTriangle,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Eye,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
} from 'lucide-react'
import { labourService } from '../services/labourService.js'
import { workerPaymentService } from '../services/workerPaymentService.js'
import { bankAccountService } from '../services/bankAccountService.js'
import RecordWorkerPaymentModal from './RecordWorkerPaymentModal.jsx'

export default function LabourPage({
  workers = [],
  summary = {},
  sites = [],
  onOpenAddWorker,
  loading = false,
  onLabourChanged,
  onRefreshAccounts,
  hideHeader = false,
  onViewWorker,
  initialWorker = null,
  onBackFromDetail,
  showNotification,
}) {
  const [activeTab, setActiveTab] = useState('Payments')
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Local list so delete/edit reflects instantly
  const [localWorkers, setLocalWorkers] = useState(null)

  // View worker detail page
  const [viewWorker, setViewWorker] = useState(initialWorker)

  useEffect(() => {
    setViewWorker(initialWorker)
  }, [initialWorker])
  const [detailTab, setDetailTab] = useState('Payments')

  // Edit modal
  const [editWorker, setEditWorker] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete loading id
  const [deletingId, setDeletingId] = useState(null)

  // Bank accounts for Edit Worker additional advance
  const [bankAccounts, setBankAccounts] = useState([])
  const [loadingBanks, setLoadingBanks] = useState(false)

  useEffect(() => {
    setLoadingBanks(true)
    bankAccountService.getAll()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setBankAccounts(list)
      })
      .catch(() => setBankAccounts([]))
      .finally(() => setLoadingBanks(false))
  }, [])

  // Record Payment modal
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const [recordPaymentWorker, setRecordPaymentWorker] = useState(null)

  const handleRecordPayment = (worker) => {
    setRecordPaymentWorker(worker)
    setShowRecordPayment(true)
  }

  // Real payment history for worker detail view
  const [workerPaymentHistory, setWorkerPaymentHistory] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  // All payments list for Payments tab
  const [paymentsList, setPaymentsList] = useState([])
  const [loadingPaymentsList, setLoadingPaymentsList] = useState(false)

  // View Payment modal
  const [viewPayment, setViewPayment] = useState(null)
  const [viewPaymentHistory, setViewPaymentHistory] = useState([])
  const [loadingViewHistory, setLoadingViewHistory] = useState(false)

  // Edit Payment modal
  const [editPayment, setEditPayment] = useState(null)
  const [editPaymentForm, setEditPaymentForm] = useState({})
  const [editPaymentSaving, setEditPaymentSaving] = useState(false)
  const [editPaymentError, setEditPaymentError] = useState('')

  // Delete Payment confirmation
  const [deletePaymentItem, setDeletePaymentItem] = useState(null)
  const [deletingPayment, setDeletingPayment] = useState(false)

  // Delete Worker confirmation
  const [deleteWorkerItem, setDeleteWorkerItem] = useState(null)
  const [deleteWorkerError, setDeleteWorkerError] = useState('')

  // Load real data when viewing a worker's detail
  useEffect(() => {
    if (!viewWorker) return
    const id = viewWorker._id || viewWorker.id
    if (!id) return

    // Load payment history
    setLoadingPayments(true)
    workerPaymentService.getByWorker(id)
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setWorkerPaymentHistory(list)
      })
      .catch(() => setWorkerPaymentHistory([]))
      .finally(() => setLoadingPayments(false))
  }, [viewWorker])

  // Load all payments for the Payments tab
  const loadAllPayments = () => {
    setLoadingPaymentsList(true)
    workerPaymentService.getAll()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setPaymentsList(list)
      })
      .catch((err) => console.error('Failed to load payments:', err))
      .finally(() => setLoadingPaymentsList(false))
  }

  useEffect(() => {
    loadAllPayments()
  }, [workers, localWorkers])

  const formatExactCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00'
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Use localWorkers after an edit/delete, otherwise use prop workers
  const baseWorkers = localWorkers !== null ? localWorkers : workers

  const displayWorkers = (baseWorkers || []).map((w) => {
    const totalAmt = Number(w.totalAmount !== undefined ? w.totalAmount : (w.wagesEarned !== undefined ? w.wagesEarned : w.dailyRate || 0))
    const earned = Number(w.wagesEarned !== undefined ? w.wagesEarned : totalAmt)
    const paid = Number(w.totalPaid || 0)
    const out = Math.max(0, earned - paid)
    return {
      _id: w._id || w.id,
      id: w.id || w._id,
      name: w.name,
      phone: w.phone || '',
      trade: w.trade || '',
      site: w.site,
      siteName: w.site?.name || w.siteName || '',
      dailyRate: Number(w.dailyRate || totalAmt),
      totalAmount: totalAmt,
      wagesEarned: earned,
      totalPaid: paid,
      advanceAmount: Number(w.advanceAmount || 0),
      advancePaid: Number(w.advancePaid || 0),
      bankAccountId: w.bankAccountId,
      bankName: w.bankName,
      outstanding: out,
      paymentType: w.paymentType || 'Daily',
      status: w.status || 'Active',
      address: w.address || '',
      remarks: w.remarks || '',
      joiningDate: w.joiningDate,
    }
  })

  // Dynamic summary values from props or calculated from dataset
  const totalWorkersCount = summary?.totalWorkers !== undefined
    ? summary.totalWorkers
    : displayWorkers.length

  const totalWagesEarned = summary?.wagesEarned !== undefined
    ? summary.wagesEarned
    : displayWorkers.reduce((acc, w) => acc + (w.wagesEarned || 0), 0)

  const totalPaidAmount = summary?.totalPaid !== undefined
    ? summary.totalPaid
    : displayWorkers.reduce((acc, w) => acc + (w.totalPaid || 0), 0)

  const totalOutstanding = summary?.outstanding !== undefined
    ? summary.outstanding
    : Math.max(0, totalWagesEarned - totalPaidAmount)

  // Filter workers based on search and site filter
  const filteredWorkers = displayWorkers.filter((worker) => {
    const matchesSearch =
      !search ||
      (worker.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (worker.trade || '').toLowerCase().includes(search.toLowerCase()) ||
      (worker.phone || '').toLowerCase().includes(search.toLowerCase())

    const matchesSite =
      siteFilter === 'All Sites' ||
      (worker.siteName || '').toLowerCase() === siteFilter.toLowerCase()

    return matchesSearch && matchesSite
  })

  // Build allPayments from real API paymentsList
  const allPayments = useMemo(() => {
    if (paymentsList.length > 0) {
      return paymentsList.map((p) => {
        const raw = p.rawDate || p.paymentDate || p.date || ''
        let displayDate = '-'
        if (raw) {
          const d = new Date(raw)
          displayDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : String(raw)
        }
        return {
          id: p.id || p._id,
          workerId: p.workerId || p.worker_id,
          workerName: p.workerName || p.worker_name || '',
          trade: p.trade || '',
          siteName: p.siteName || p.site_name || '',
          date: displayDate,
          paymentDate: displayDate,
          rawDate: raw,
          type: p.paymentType || p.type || 'Paid',
          paymentType: p.paymentType || p.type || 'Paid',
          method: p.paymentMethod || p.method || 'Cash',
          paymentMethod: p.paymentMethod || p.method || 'Cash',
          advance: Number(p.advance !== undefined ? p.advance : (p.amount || 0)),
          amount: Number(p.advance !== undefined ? p.advance : (p.amount || 0)),
          totalAmount: Number(p.totalAmount || 0),
          totalPaid: Number(p.totalPaid !== undefined ? p.totalPaid : 0),
          pending: Number(p.pending !== undefined ? p.pending : 0),
          bankName: p.bankName || p.bank_name || '',
          remarks: p.remarks || p.remark || '',
          remark: p.remarks || p.remark || '',
        }
      })
    }
    // Fallback: derive from displayWorkers
    return displayWorkers
      .filter((w) => Number(w.totalPaid) > 0)
      .map((w, idx) => ({
        id: `dbp-${w._id || idx}`,
        workerId: w._id,
        workerName: w.name,
        trade: w.trade || '',
        siteName: w.siteName || '',
        date: w.joiningDate ? new Date(w.joiningDate).toLocaleDateString('en-GB') : '-',
        paymentDate: w.joiningDate ? new Date(w.joiningDate).toLocaleDateString('en-GB') : '-',
        rawDate: w.joiningDate || '',
        type: 'Paid',
        paymentType: 'Paid',
        method: w.paymentType === 'Daily' ? 'Cash' : 'Bank Transfer',
        paymentMethod: w.paymentType === 'Daily' ? 'Cash' : 'Bank Transfer',
        advance: Number(w.totalPaid),
        amount: Number(w.totalPaid),
        totalAmount: Number(w.wagesEarned),
        totalPaid: Number(w.totalPaid || 0),
        pending: Math.max(0, Number(w.wagesEarned) - Number(w.totalPaid)),
        bankName: '',
        remarks: w.remarks || 'Wage / Advance payment',
        remark: w.remarks || 'Wage / Advance payment',
      }))
  }, [paymentsList, displayWorkers])

  const filteredPayments = allPayments.filter((p) => {
    const matchesSearch =
      !search ||
      (p.workerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.remarks || p.remark || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.method || p.paymentMethod || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.type || p.paymentType || '').toLowerCase().includes(search.toLowerCase())

    const matchesSite =
      siteFilter === 'All Sites' ||
      (p.siteName || '').toLowerCase() === siteFilter.toLowerCase()

    return matchesSearch && matchesSite
  })

  // Dynamic Pagination based on active tab
  const currentDataset = activeTab === 'Payments' ? filteredPayments : filteredWorkers
  const totalRecords = currentDataset.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const currentRecords = filteredWorkers.slice(startIndex, endIndex)
  const currentPayments = filteredPayments.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const getPaginationItems = () => {
    if (totalRecords === 0) return []
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const items = [1]
    if (activePage > 3) items.push('...')
    const start = Math.max(2, activePage - 1)
    const end = Math.min(totalPages - 1, activePage + 1)
    for (let i = start; i <= end; i++) items.push(i)
    if (activePage < totalPages - 2) items.push('...')
    items.push(totalPages)
    return items
  }

  // ── VIEW WORKER ───────────────────────────────────────────────────────────
  const handleView = (item) => {
    if (onViewWorker) {
      onViewWorker(item)
    } else {
      setViewWorker(item)
    }
  }

  // ── VIEW PAYMENT ──────────────────────────────────────────────────────────
  const handleViewPayment = (p) => {
    setViewPayment(p)
    setViewPaymentHistory([])
    if (p?.workerId) {
      setLoadingViewHistory(true)
      workerPaymentService.getByWorker(p.workerId)
        .then((res) => {
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
          setViewPaymentHistory(list)
        })
        .catch((err) => console.error('Failed to load payment history:', err))
        .finally(() => setLoadingViewHistory(false))
    }
  }

  // ── EDIT PAYMENT ──────────────────────────────────────────────────────────
  const handleEditPayment = (p) => {
    setEditPayment(p)
    // Parse rawDate for date input (YYYY-MM-DD)
    let dateVal = ''
    const rd = p.rawDate || p.paymentDate || p.date || ''
    if (rd) {
      const d = new Date(rd)
      if (!isNaN(d.getTime())) {
        dateVal = d.toISOString().slice(0, 10)
      }
    }
    setEditPaymentForm({
      paymentDate: dateVal,
      paymentType: p.paymentType || p.type || '',
      amount: p.advance !== undefined ? p.advance : (p.amount || ''),
      bankAccountId: '',
      remarks: p.remarks || p.remark || '',
    })
    setEditPaymentError('')
  }

  const handleEditPaymentSave = async () => {
    if (editPaymentSaving) return
    if (!editPaymentForm.paymentDate) { setEditPaymentError('Payment date is required.'); return }
    if (!editPaymentForm.paymentType) { setEditPaymentError('Payment type is required.'); return }
    if (!editPaymentForm.amount || Number(editPaymentForm.amount) <= 0) { setEditPaymentError('Amount must be greater than 0.'); return }

    setEditPaymentSaving(true)
    setEditPaymentError('')
    try {
      await workerPaymentService.update(editPayment.id, {
        paymentDate: editPaymentForm.paymentDate,
        paymentType: editPaymentForm.paymentType,
        amount: Number(editPaymentForm.amount),
        bankAccountId: editPaymentForm.bankAccountId || undefined,
        remarks: editPaymentForm.remarks,
      })
      setEditPayment(null)
      loadAllPayments()
      if (onLabourChanged) onLabourChanged()
      if (onRefreshAccounts) onRefreshAccounts()
    } catch (err) {
      setEditPaymentError(err.message || 'Update failed.')
    } finally {
      setEditPaymentSaving(false)
    }
  }

  // ── DELETE PAYMENT ────────────────────────────────────────────────────────
  const handleDeletePayment = (p) => {
    setDeletePaymentItem(p)
  }

  const handleConfirmDeletePayment = async () => {
    if (deletingPayment || !deletePaymentItem) return
    setDeletingPayment(true)
    try {
      await workerPaymentService.delete(deletePaymentItem.id)
      setDeletePaymentItem(null)
      loadAllPayments()
      if (onLabourChanged) onLabourChanged()
      if (onRefreshAccounts) onRefreshAccounts()
    } catch (err) {
      window.alert('Delete failed: ' + (err.message || 'Unknown error'))
    } finally {
      setDeletingPayment(false)
    }
  }

  // ── EDIT WORKER ───────────────────────────────────────────────────────────
  const handleEdit = (item) => {
    setEditWorker(item)
    const prevAdv = Number(item.advancePaid !== undefined ? item.advancePaid : (item.advanceAmount || 0))
    setEditForm({
      name: item.name || '',
      phone: item.phone || '',
      trade: item.trade || '',
      dailyRate: item.dailyRate || item.wagesEarned || '',
      wagesEarned: item.wagesEarned !== undefined ? item.wagesEarned : (item.dailyRate || 0),
      totalPaid: item.totalPaid !== undefined ? item.totalPaid : 0,
      previousAdvanceAmount: prevAdv,
      additionalAdvance: '',
      bankAccountId: item.bankAccountId || item.bank_account_id || '',
      address: item.address || '',
      remarks: item.remarks || '',
    })
    setEditError('')

    // Fetch advance payment records for this worker to ensure exact previous advance
    const workerId = item._id || item.id
    if (workerId) {
      workerPaymentService.getByWorker(workerId)
        .then((res) => {
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
          const initAdv = Number(item.advanceAmount || 0)
          const extraAdv = list
            .filter((p) => p.paymentType === 'Advance Payment')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0)
          const calculatedAdv = initAdv + extraAdv
          setEditForm((prev) => ({
            ...prev,
            previousAdvanceAmount: Math.max(prevAdv, calculatedAdv),
          }))
        })
        .catch(() => {})
    }
  }

  const handleEditSave = async () => {
    if (editSaving) return
    if (!editWorker) return
    const workerId = editWorker._id || editWorker.id
    if (!workerId) {
      setEditError('Worker ID is missing.')
      return
    }

    if (!editForm.name?.trim()) { setEditError('Name is required.'); return }
    if (!editForm.trade?.trim()) { setEditError('Trade is required.'); return }
    const effectiveAmount = editForm.wagesEarned !== undefined && editForm.wagesEarned !== '' ? editForm.wagesEarned : editForm.dailyRate
    if (!effectiveAmount || Number(effectiveAmount) <= 0) { setEditError('Total Amount must be > 0.'); return }

    setEditSaving(true)
    setEditError('')
    try {
      const updated = await labourService.update(workerId, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        trade: editForm.trade.trim(),
        dailyRate: Number(effectiveAmount),
        wagesEarned: Number(effectiveAmount) || 0,
        totalPaid: Number(editForm.totalPaid) || 0,
        bankAccountId: editForm.bankAccountId ? Number(editForm.bankAccountId) : undefined,
        address: editForm.address,
        remarks: editForm.remarks,
      })
      setLocalWorkers((prev) => {
        const base = prev !== null ? prev : workers
        return base.map((w) => String(w._id || w.id) === String(workerId) ? { ...w, ...updated } : w)
      })
      if (viewWorker && String(viewWorker._id || viewWorker.id) === String(workerId)) {
        const effWages = Number(updated?.wagesEarned !== undefined ? updated.wagesEarned : effectiveAmount)
        const effPaid = Number(updated?.totalPaid !== undefined ? updated.totalPaid : editForm.totalPaid)
        const effOutstanding = Math.max(0, effWages - effPaid)
        setViewWorker((prev) => ({
          ...prev,
          ...updated,
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          trade: editForm.trade.trim(),
          dailyRate: Number(effectiveAmount),
          totalAmount: effWages,
          wagesEarned: effWages,
          totalPaid: effPaid,
          outstanding: effOutstanding,
          address: editForm.address,
          remarks: editForm.remarks,
          siteName: updated?.site?.name || prev?.siteName || 'N/A',
        }))
        // Refresh payment history if currently viewing this worker
        workerPaymentService.getByWorker(workerId)
          .then((res) => {
            const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
            setWorkerPaymentHistory(list)
          })
          .catch(() => {})
      }
      setEditWorker(null)
      if (onLabourChanged) onLabourChanged()
      if (onRefreshAccounts) onRefreshAccounts()
    } catch (err) {
      setEditError(err.message || 'Update failed.')
    } finally {
      setEditSaving(false)
    }
  }

  // ── DELETE WORKER ─────────────────────────────────────────────────────────
  const handleDelete = (item) => {
    setDeleteWorkerError('')
    setDeleteWorkerItem(item)
  }

  const handleConfirmDeleteWorker = async () => {
    if (!deleteWorkerItem || deletingId) return
    const item = deleteWorkerItem
    setDeletingId(item._id)
    setDeleteWorkerError('')
    try {
      await labourService.delete(item._id)
      setLocalWorkers((prev) => {
        const base = prev !== null ? prev : workers
        return base.filter((w) => w._id !== item._id)
      })
      setDeleteWorkerItem(null)
      if (onLabourChanged) onLabourChanged()
      if (showNotification) {
        showNotification({ type: 'success', message: `Worker "${item.name}" deleted successfully` })
      }
    } catch (err) {
      console.error('Failed to delete worker:', err)
      const msg = err.response?.data?.message || err.message || 'Failed to delete worker. Please try again.'
      setDeleteWorkerError(msg)
      if (showNotification) {
        showNotification({ type: 'error', message: msg })
      }
    } finally {
      setDeletingId(null)
    }
  }

  // ── VIEW PAYMENT HISTORY (useMemo) ────────────────────────────────────────
  const viewHistoryRecords = useMemo(() => {
    if (!viewPayment) return []
    const source = viewPaymentHistory.length > 0
      ? viewPaymentHistory
      : allPayments.filter((p) => String(p.workerId) === String(viewPayment.workerId))

    // Sort ascending for accurate cumulative calculation
    const sorted = [...source].sort((a, b) => {
      const da = new Date(a.rawDate || a.paymentDate || a.date || 0).getTime()
      const db = new Date(b.rawDate || b.paymentDate || b.date || 0).getTime()
      if (da !== db) return da - db
      if (a.isInitialAdvance) return -1
      if (b.isInitialAdvance) return 1
      const ca = new Date(a.createdAt || 0).getTime()
      const cb = new Date(b.createdAt || 0).getTime()
      if (ca !== cb) return ca - cb
      return (Number(a.id) || 0) - (Number(b.id) || 0)
    })

    // Determine total agreed amount
    const totalAgreed = Number(viewPayment.totalAmount || 0)

    let cumulative = 0
    const calculatedRows = sorted.map((p) => {
      const amt = Number(p.amount !== undefined ? p.amount : (p.advance || 0))
      cumulative += amt
      const pendingAfter = Math.max(0, totalAgreed - cumulative)

      const raw = p.rawDate || p.paymentDate || p.date || ''
      let displayDate = '-'
      if (raw) {
        const d = new Date(raw)
        displayDate = !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : String(raw)
      }

      return {
        id: p.id || p._id,
        isInitialAdvance: p.isInitialAdvance,
        rawDate: raw,
        createdAt: p.createdAt,
        displayDate,
        paymentType: p.paymentType || p.type || '—',
        paymentMethod: p.paymentMethod || p.method || '—',
        bankName: p.bankName || '—',
        amount: amt, // Only individual transaction amount!
        pendingAfter,
      }
    })

    // Sort descending (latest date first; if same date, latest created transaction first)
    calculatedRows.sort((a, b) => {
      const da = new Date(a.rawDate || 0).getTime()
      const db = new Date(b.rawDate || 0).getTime()
      if (da !== db) return db - da
      if (a.isInitialAdvance) return 1
      if (b.isInitialAdvance) return -1
      const ca = new Date(a.createdAt || 0).getTime()
      const cb = new Date(b.createdAt || 0).getTime()
      if (ca !== cb) return cb - ca
      return (Number(b.id) || 0) - (Number(a.id) || 0)
    })

    return calculatedRows
  }, [viewPayment, viewPaymentHistory, allPayments])

  const modalTotalPaid = useMemo(() => {
    if (!viewPayment) return 0
    if (viewHistoryRecords.length > 0) {
      return viewHistoryRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    }
    return Number(viewPayment.totalPaid || 0)
  }, [viewPayment, viewHistoryRecords])

  const modalTotalAgreed = Number(viewPayment?.totalAmount || 0)
  const modalRemainingPending = Math.max(0, modalTotalAgreed - modalTotalPaid)

  return (
    <>
      {viewWorker ? (
        <div className="labour-page labour-detail-page">
          {/* 1. Header with Back Button, Worker Name, Subtitle and Edit Worker Button */}
          <div className="sites-header-wrap" style={{ alignItems: 'flex-start' }}>
            <div className="sites-header-left">
              <button
                type="button"
                className="labour-back-link"
                onClick={() => {
                  setViewWorker(null)
                  if (onBackFromDetail) onBackFromDetail()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#70829F',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 0,
                  marginBottom: '6px',
                  transition: 'color 0.15s ease',
                }}
              >
                <ArrowLeft size={15} />
                <span>Back to all labour's</span>
              </button>
              <h1 className="sites-title" style={{ fontSize: '26px', fontWeight: 700, color: '#172033', margin: '2px 0 0 0' }}>
                {viewWorker.name}
              </h1>
              <p className="sites-subtitle" style={{ fontSize: '13px', color: '#70829F', marginTop: '4px' }}>
                {[viewWorker.trade, viewWorker.siteName || viewWorker.site?.name, viewWorker.phone].filter(Boolean).join(' · ')}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary-action"
              style={{
                backgroundColor: '#0284C7',
                borderColor: '#0284C7',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 600,
                padding: '0 20px',
                height: '38px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
              onClick={() => handleEdit(viewWorker)}
            >
              <span>Edit Worker</span>
            </button>
          </div>

          {/* 2. Three Stat Cards for the Worker */}
          <div className="sites-stat-grid">
            {/* Card 1: Total Amount */}
            <div className="site-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="stat-label">Total Amount</span>
                <div className="stat-icon-wrap stat-icon-blue">
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="stat-value">{formatExactCurrency(viewWorker.totalAmount !== undefined ? viewWorker.totalAmount : viewWorker.wagesEarned)}</div>
              <span className="stat-desc">Total amount</span>
            </div>

            {/* Card 2: Total Paid */}
            <div className="site-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="stat-label">Total Paid</span>
                <div className="stat-icon-wrap stat-icon-orange">
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="stat-value">{formatExactCurrency(viewWorker.totalPaid)}</div>
              <span className="stat-desc">Includes advances</span>
            </div>

            {/* Card 4: Outstanding */}
            <div className="site-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="stat-label">Pending</span>
                <div className="stat-icon-wrap stat-icon-rose">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div className="stat-value">{formatExactCurrency(viewWorker.outstanding)}</div>
              <span className="stat-desc">Ready for settlement</span>
            </div>
          </div>

          {/* 3. Detail Main Card with Tabs, Actions & Table */}
          <div className="labour-table-card" style={{ padding: '18px 24px 24px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5EAF1', paddingBottom: '0', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                {['Payments'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`labour-tab-btn ${detailTab === tab ? 'active' : ''}`}
                    onClick={() => setDetailTab(tab)}
                    style={{ paddingBottom: '12px', marginBottom: '-1px' }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="labour-actions-right" style={{ marginBottom: '8px' }}>
                <button
                  type="button"
                  className="btn-record-payments"
                  onClick={() => setShowRecordPayment(true)}
                >
                  <Receipt size={16} />
                  <span>Record Payment's</span>
                </button>
              </div>
            </div>

            {/* Tab: Payments */}
            {detailTab === 'Payments' && (
              <div className="sites-table-scroll">
                {loadingPayments && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#70829F' }}>Loading payments...</div>
                )}
                {!loadingPayments && workerPaymentHistory.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#70829F', fontSize: '14px' }}>
                    No payment records found for {viewWorker.name}.
                  </div>
                )}
                {!loadingPayments && workerPaymentHistory.length > 0 && (
                  <table className="labour-table">
                    <thead>
                      <tr>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>DATE</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>TYPE</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>BANK</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>AMOUNT</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>REMARK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workerPaymentHistory.map((p) => {
                        const typeColors = {
                          'Advance Payment': { bg: '#FFEDD5', color: '#C2410C' },
                          'Wage Payment': { bg: '#DCFCE7', color: '#15803D' },
                          'Final Settlement': { bg: '#E0E7FF', color: '#4338CA' },
                        }
                        const tc = typeColors[p.paymentType] || { bg: '#F1F5F9', color: '#64748B' }
                        return (
                          <tr key={p.id} className="labour-data-row">
                            <td style={{ padding: '18px 16px', color: '#70829F', fontSize: '13.5px' }}>{formatDate(p.rawDate || p.paymentDate)}</td>
                            <td style={{ padding: '18px 16px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 14px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, background: tc.bg, color: tc.color }}>
                                {p.paymentType}
                              </span>
                            </td>
                            <td style={{ padding: '18px 16px', color: '#475569', fontSize: '13.5px' }}>{p.bankName || '—'}</td>
                            <td style={{ padding: '18px 16px', fontWeight: 600, color: '#172033', fontSize: '13.5px' }}>{formatExactCurrency(p.amount)}</td>
                            <td style={{ padding: '18px 16px', color: '#64748B', fontSize: '13.5px' }}>{p.remarks || p.referenceId || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="labour-page">
          {/* 1. Header with Breadcrumb and Action Button */}
          {!hideHeader && (
            <div className="sites-header-wrap">
              <div className="sites-header-left">
                <div className="sites-breadcrumb">
                  <span className="breadcrumb-root">WORKSPACE</span>
                  <span className="breadcrumb-slash">/</span>
                  <span className="breadcrumb-active">LABOUR</span>
                </div>
                <h1 className="sites-title">Labour</h1>
                <p className="sites-subtitle">Manage your workforce and wage settlements.</p>
              </div>

              <button
                type="button"
                className="btn btn-primary-action btn-add-site-header"
                onClick={onOpenAddWorker}
              >
                <Plus size={16} />
                <span>Add Worker</span>
              </button>
            </div>
          )}

          {/* 2. Top Summary Metric Cards (4 in a row) */}
          {!hideHeader && (
            <div className="sites-stat-grid">
              {/* Card 1: Total Workers */}
              <div className="site-stat-card">
                <div className="stat-icon-wrap stat-icon-blue">
                  <CreditCard size={18} />
                </div>
                <span className="stat-label">Total Workers</span>
                <div className="stat-value">{totalWorkersCount}</div>
                <span className="stat-desc">Across active construction sites</span>
              </div>

              {/* Card 2: Total Amount */}
              <div className="site-stat-card">
                <div className="stat-icon-wrap stat-icon-green">
                  <CreditCard size={18} />
                </div>
                <span className="stat-label">Total Amount</span>
                <div className="stat-value">{formatExactCurrency(totalWagesEarned)}</div>
                <span className="stat-desc">Total workforce amount</span>
              </div>

              {/* Card 3: Total Paid */}
              <div className="site-stat-card">
                <div className="stat-icon-wrap stat-icon-orange">
                  <CreditCard size={18} />
                </div>
                <span className="stat-label">Total Paid</span>
                <div className="stat-value">{formatExactCurrency(totalPaidAmount)}</div>
                <span className="stat-desc">Wages and advances</span>
              </div>

              {/* Card 4: Outstanding */}
              <div className="site-stat-card">
                <div className="stat-icon-wrap stat-icon-rose">
                  <AlertTriangle size={18} />
                </div>
                <span className="stat-label">Pending</span>
                <div className="stat-value">{formatExactCurrency(totalOutstanding)}</div>
                <span className="stat-desc">Payable to your workforce</span>
              </div>
            </div>
          )}

          {/* 3. Main Card with Tabs, Search, Actions, Table and Pagination */}
          <div className="labour-table-card">
            {/* Navigation Tabs Header */}
            <div className="labour-tabs-bar">
              {['Workers', 'Payments'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`labour-tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab)
                    setCurrentPage(1)
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Filter and Action Row */}
            <div className="labour-filter-row">
              <div className="labour-filter-left">
                {/* Search Input */}
                <div className="sites-search-box" style={{ width: '280px' }}>
                  <Search size={16} className="sites-search-icon" />
                  <input
                    type="text"
                    className="sites-search-input"
                    placeholder="Search name, trade, phone..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>

                {/* Site Select Dropdown */}
                <div className="site-select-wrapper">
                  <select
                    className="site-pill-select"
                    value={siteFilter}
                    onChange={(e) => {
                      setSiteFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  >
                    <option value="All Sites">All Sites</option>
                    {sites.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="site-select-arrow" />
                </div>
              </div>

              {activeTab === 'Payments' && (
                <div className="labour-actions-right">
                  <button
                    type="button"
                    className="btn-record-payments"
                    onClick={() => {
                      setRecordPaymentWorker(null)
                      setShowRecordPayment(true)
                    }}
                  >
                    <Receipt size={16} />
                    <span>Record Payment's</span>
                  </button>
                </div>
              )}
            </div>

            {/* Table: If activeTab === 'Payments', render Payments Table. Otherwise render Workers Table */}
            {activeTab === 'Payments' ? (
              <div className="sites-table-scroll">
                {loadingPaymentsList && (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#70829F' }}>Loading payments...</div>
                )}
                {!loadingPaymentsList && (
                  <table className="labour-table">
                    <thead>
                      <tr>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>DATE</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>WORKER</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>TYPE</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>METHOD</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>ADVANCE</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>TOTAL AMOUNT</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>PENDING</th>
                        <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPayments.length > 0 ? (
                        currentPayments.map((p) => {
                          const typeColors = {
                            'Advance Payment': { bg: '#FFEDD5', color: '#C2410C' },
                            'Wage Payment': { bg: '#DCFCE7', color: '#15803D' },
                            'Final Settlement': { bg: '#E0E7FF', color: '#4338CA' },
                            'Paid': { bg: '#DCFCE7', color: '#15803D' },
                          }
                          const tc = typeColors[p.type || p.paymentType] || { bg: '#F1F5F9', color: '#64748B' }
                          return (
                            <tr key={p.id} className="labour-data-row">
                              <td style={{ padding: '18px 16px', color: '#70829F', fontSize: '13.5px' }}>
                                {formatDate(p.rawDate || p.date || p.paymentDate)}
                              </td>
                              <td style={{ padding: '18px 16px', fontWeight: 700, color: '#172033', fontSize: '13.5px' }}>
                                {p.workerName}
                              </td>
                              <td style={{ padding: '18px 16px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px 14px',
                                  borderRadius: '999px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  backgroundColor: tc.bg,
                                  color: tc.color,
                                }}>
                                  {p.type || p.paymentType}
                                </span>
                              </td>
                              <td style={{ padding: '18px 16px', color: '#475569', fontSize: '13.5px' }}>
                                {p.method || p.paymentMethod}
                              </td>
                              <td style={{ padding: '18px 16px', fontWeight: 600, color: '#172033', fontSize: '13.5px' }}>
                                {formatExactCurrency(p.advance !== undefined ? p.advance : p.amount)}
                              </td>
                              <td style={{ padding: '18px 16px', fontWeight: 500, color: '#172033', fontSize: '13.5px' }}>
                                {formatExactCurrency(p.totalAmount)}
                              </td>
                              <td style={{ padding: '18px 16px', fontWeight: 600, color: '#DC2626', fontSize: '13.5px' }}>
                                {formatExactCurrency(p.pending)}
                              </td>
                              <td style={{ padding: '18px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    type="button"
                                    title="View Payment"
                                    className="labour-action-btn labour-action-view"
                                    onClick={() => handleViewPayment(p)}
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Edit Payment"
                                    className="labour-action-btn labour-action-edit"
                                    onClick={() => handleEditPayment(p)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete Payment"
                                    className="labour-action-btn labour-action-delete"
                                    onClick={() => handleDeletePayment(p)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="td-empty" style={{ padding: '36px', textAlign: 'center' }}>
                            No payment records match the selected filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="sites-table-scroll">
                <table className="labour-table">
                  <thead>
                    <tr>
                      <th className="th-labour-worker">WORKER</th>
                      <th className="th-labour-trade">TRADE OR SITE</th>
                      <th className="th-labour-total">TOTAL AMOUNT</th>
                      <th className="th-labour-paid">PAID</th>
                      <th className="th-labour-out">PENDING</th>
                      <th className="th-labour-actions">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [1, 2, 3, 4].map((i) => (
                        <tr key={i} className="skeleton-row">
                          <td colSpan={6}>
                            <div className="skeleton-line" style={{ height: '24px', margin: '8px 0' }} />
                          </td>
                        </tr>
                      ))
                    ) : currentRecords.length > 0 ? (
                      currentRecords.map((item) => (
                        <tr key={item._id} className="labour-data-row">
                          {/* Worker: Name and Phone stacked */}
                          <td className="td-labour-worker">
                            <div className="worker-cell">
                              <span className="worker-name">{item.name}</span>
                              <span className="worker-phone">{item.phone}</span>
                            </div>
                          </td>

                          {/* Trade or Site: Trade on top, Site beneath in light grey */}
                          <td className="td-labour-trade">
                            <div className="trade-cell">
                              <span className="trade-title">{item.trade}</span>
                              <span className="trade-site">{item.siteName}</span>
                            </div>
                          </td>

                          {/* Total Amount */}
                          <td className="td-labour-total">{formatExactCurrency(item.wagesEarned || item.totalAmount || item.dailyRate)}</td>

                          {/* Paid */}
                          <td className="td-labour-paid">{formatExactCurrency(item.totalPaid)}</td>

                          {/* Outstanding with Orange Pill Badge */}
                          <td className="td-labour-out">
                            <span className="labour-outstanding-badge">
                              {formatExactCurrency(item.outstanding)}
                            </span>
                          </td>

                          {/* Actions: View / Edit / Delete */}
                          <td className="td-labour-actions">
                            <div className="labour-action-btns">
                              <button
                                type="button"
                                className="labour-record-pay-btn"
                                disabled={Number(item.outstanding || 0) <= 0}
                                onClick={() => handleRecordPayment(item)}
                                title={Number(item.outstanding || 0) <= 0 ? `All payments completed for ${item.name}` : `Record Payment for ${item.name}`}
                              >
                                <Receipt size={13} />
                                <span>Record Payment</span>
                              </button>
                              <button type="button" title="View Details" className="labour-action-btn labour-action-view" onClick={() => handleView(item)}>
                                <Eye size={15} />
                              </button>
                              <button type="button" title="Edit Worker" className="labour-action-btn labour-action-edit" onClick={() => handleEdit(item)}>
                                <Pencil size={15} />
                              </button>
                              <button type="button" title="Delete Worker" className="labour-action-btn labour-action-delete" disabled={deletingId === item._id} onClick={() => handleDelete(item)}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center' }}>
                          No labour records match the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Dynamic Pagination Footer */}
            <div className="sites-pagination-row" style={{ marginTop: '16px' }}>
              <div className="pagination-left">
                <span className="pagination-show-label">Show</span>
                <div className="pagination-page-size-select-wrap">
                  <select
                    className="pagination-page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  <ChevronDown size={12} className="pagination-select-arrow" />
                </div>
                <span className="pagination-range-text">
                  {totalRecords === 0
                    ? '0–0 of 0'
                    : `${startIndex + 1}–${endIndex} of ${totalRecords.toLocaleString('en-IN')}`}
                </span>
              </div>

              <div className="pagination-right">
                <button
                  type="button"
                  className="pagination-nav-btn"
                  disabled={activePage <= 1 || totalRecords === 0}
                  onClick={() => handlePageChange(activePage - 1)}
                >
                  <ChevronLeft size={14} strokeWidth={1.75} />
                  <span>Back</span>
                </button>

                {totalPages > 1 &&
                  getPaginationItems().map((item, index) => {
                    if (item === '...') {
                      return (
                        <span key={`dots-${index}`} className="pagination-dots">
                          ...
                        </span>
                      )
                    }
                    const isSelected = item === activePage
                    return (
                      <button
                        key={item}
                        type="button"
                        className={`pagination-num-btn ${isSelected ? 'pagination-num-active' : ''}`}
                        onClick={() => handlePageChange(item)}
                      >
                        {item}
                      </button>
                    )
                  })}

                <button
                  type="button"
                  className="pagination-nav-btn"
                  disabled={activePage >= totalPages || totalRecords === 0}
                  onClick={() => handlePageChange(activePage + 1)}
                >
                  <span>Next</span>
                  <ChevronRight size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW PAYMENT MODAL ─────────────────────────────────────────────── */}
      {viewPayment && (
        <div className="lmodal-overlay" onClick={() => setViewPayment(null)}>
          <div
            className="lmodal-box"
            style={{ maxWidth: '760px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lmodal-header">
              <h2 className="lmodal-title">Payment Details</h2>
              <button className="lmodal-close" onClick={() => setViewPayment(null)}><X size={18} /></button>
            </div>
            <div className="lmodal-body">
              {/* Top section: Worker info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>WORKER NAME</div>
                  <div style={{ fontWeight: 700, color: '#172033', fontSize: '15px' }}>{viewPayment.workerName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>TRADE / ROLE</div>
                  <div style={{ color: '#475569', fontSize: '14px' }}>
                    {displayWorkers.find((w) => String(w._id) === String(viewPayment.workerId))?.trade || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>CONSTRUCTION SITE</div>
                  <div style={{ color: '#475569', fontSize: '14px' }}>{viewPayment.siteName || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>PAYMENT DATE</div>
                  <div style={{ color: '#475569', fontSize: '14px' }}>{formatDate(viewPayment.rawDate || viewPayment.date || viewPayment.paymentDate) || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>PAYMENT TYPE</div>
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', padding: '4px 14px', borderRadius: '999px',
                      fontSize: '12px', fontWeight: 600,
                      background: viewPayment.paymentType === 'Advance Payment' ? '#FFEDD5' : '#DCFCE7',
                      color: viewPayment.paymentType === 'Advance Payment' ? '#C2410C' : '#15803D',
                    }}>
                      {viewPayment.type || viewPayment.paymentType}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>PAYMENT METHOD</div>
                  <div style={{ color: '#475569', fontSize: '14px' }}>{viewPayment.method || viewPayment.paymentMethod || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>ADVANCE AMOUNT</div>
                  <div style={{ fontWeight: 700, color: '#0284C7', fontSize: '16px' }}>{formatExactCurrency(viewPayment.advance !== undefined ? viewPayment.advance : viewPayment.amount)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>TOTAL AGREED AMOUNT</div>
                  <div style={{ fontWeight: 700, color: '#172033', fontSize: '16px' }}>{formatExactCurrency(modalTotalAgreed)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>TOTAL PAID AMOUNT</div>
                  <div style={{ fontWeight: 700, color: '#15803D', fontSize: '16px' }}>
                    {formatExactCurrency(modalTotalPaid)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>REMAINING PENDING</div>
                  <div style={{ fontWeight: 700, color: '#DC2626', fontSize: '16px' }}>{formatExactCurrency(modalRemainingPending)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '4px' }}>BANK ACCOUNT</div>
                  <div style={{ color: '#475569', fontSize: '14px' }}>{viewPayment.bankName || '—'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#8C9CAB', letterSpacing: '0.5px', marginBottom: '6px' }}>REMARKS / NOTE</div>
                  <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px', color: '#475569', fontSize: '13.5px', minHeight: '40px' }}>
                    {viewPayment.remarks || viewPayment.remark || '—'}
                  </div>
                </div>
              </div>

              {/* Payment History section */}
              <div style={{ borderTop: '1px solid #E5EAF1', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#172033', marginBottom: '14px' }}>Payment History</h3>
                {loadingViewHistory && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#70829F' }}>Loading history...</div>
                )}
                {!loadingViewHistory && viewHistoryRecords.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#70829F', fontSize: '13.5px' }}>
                    No payment history found.
                  </div>
                )}
                {!loadingViewHistory && viewHistoryRecords.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="labour-table" style={{ fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '10px 12px', color: '#8C9CAB', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px' }}>DATE</th>
                          <th style={{ padding: '10px 12px', color: '#8C9CAB', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px' }}>PAYMENT TYPE</th>
                          <th style={{ padding: '10px 12px', color: '#8C9CAB', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px' }}>PAYMENT METHOD</th>
                          <th style={{ padding: '10px 12px', color: '#8C9CAB', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px' }}>BANK ACCOUNT</th>
                          <th style={{ padding: '10px 12px', color: '#8C9CAB', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px' }}>PAID AMOUNT (₹)</th>
                          <th style={{ padding: '10px 12px', color: '#8C9CAB', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px' }}>PENDING AFTER (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewHistoryRecords.map((row, idx) => (
                          <tr key={row.id || idx} className="labour-data-row">
                            <td style={{ padding: '12px', color: '#70829F' }}>{row.displayDate || '—'}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px',
                                fontSize: '11px', fontWeight: 600,
                                background: row.paymentType === 'Advance Payment' ? '#FFEDD5' : '#DCFCE7',
                                color: row.paymentType === 'Advance Payment' ? '#C2410C' : '#15803D',
                              }}>
                                {row.paymentType}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: '#475569' }}>{row.paymentMethod}</td>
                            <td style={{ padding: '12px', color: '#475569' }}>{row.bankName}</td>
                            <td style={{ padding: '12px', fontWeight: 600, color: '#172033' }}>{formatExactCurrency(row.amount)}</td>
                            <td style={{ padding: '12px', fontWeight: 600, color: '#DC2626' }}>{formatExactCurrency(row.pendingAfter)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="lmodal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary-action"
                style={{
                  background: '#16A34A',
                  borderColor: '#16A34A',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '7px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                onClick={() => {
                  const targetWorker = displayWorkers.find((w) => String(w._id) === String(viewPayment.workerId)) || {
                    _id: viewPayment.workerId,
                    name: viewPayment.workerName,
                    trade: viewPayment.trade,
                    siteId: viewPayment.siteId,
                    outstanding: modalRemainingPending,
                  }
                  setViewWorker(targetWorker)
                  setShowRecordPayment(true)
                }}
              >
                <Receipt size={15} />
                <span>Record Payment</span>
              </button>
              <button className="ledit-cancel" onClick={() => setViewPayment(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PAYMENT MODAL ─────────────────────────────────────────────── */}
      {editPayment && (
        <div className="lmodal-overlay" onClick={() => setEditPayment(null)}>
          <div className="lmodal-box" onClick={(e) => e.stopPropagation()}>
            <div className="lmodal-header">
              <h2 className="lmodal-title">Edit Payment</h2>
              <button className="lmodal-close" onClick={() => setEditPayment(null)}><X size={18} /></button>
            </div>
            <div className="lmodal-body">
              {editPaymentError && <div className="ledit-error">{editPaymentError}</div>}
              <div className="ledit-grid">
                <div className="ledit-field ledit-full">
                  <label className="ledit-label">Worker</label>
                  <input
                    className="ledit-input"
                    type="text"
                    readOnly
                    value={editPayment.workerName || ''}
                    style={{ background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="ledit-field">
                  <label className="ledit-label">Payment Date *</label>
                  <input
                    className="ledit-input"
                    type="date"
                    value={editPaymentForm.paymentDate || ''}
                    onChange={(e) => setEditPaymentForm(f => ({ ...f, paymentDate: e.target.value }))}
                  />
                </div>
                <div className="ledit-field">
                  <label className="ledit-label">Payment Type *</label>
                  <select
                    className="ledit-input"
                    value={editPaymentForm.paymentType || ''}
                    onChange={(e) => setEditPaymentForm(f => ({ ...f, paymentType: e.target.value }))}
                  >
                    <option value="">Select type...</option>
                    <option value="Advance Payment">Advance Payment</option>
                    <option value="Wage Payment">Wage Payment</option>
                    <option value="Final Settlement">Final Settlement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="ledit-field">
                  <label className="ledit-label">Amount (₹) *</label>
                  <input
                    className="ledit-input"
                    type="number"
                    min="0"
                    value={editPaymentForm.amount || ''}
                    onChange={(e) => setEditPaymentForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="ledit-field">
                  <label className="ledit-label">Bank Account</label>
                  <select
                    className="ledit-input"
                    value={editPaymentForm.bankAccountId || ''}
                    onChange={(e) => setEditPaymentForm(f => ({ ...f, bankAccountId: e.target.value }))}
                    disabled={loadingBanks}
                  >
                    <option value="">{loadingBanks ? 'Loading banks...' : 'Select Bank Name...'}</option>
                    {bankAccounts.map((b) => (
                      <option key={b._id || b.id} value={b._id || b.id}>
                        {b.bankName || b.bank_name} {b.balance !== undefined ? `(₹${Number(b.balance).toLocaleString('en-IN')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ledit-field ledit-full">
                  <label className="ledit-label">Remarks</label>
                  <input
                    className="ledit-input"
                    type="text"
                    value={editPaymentForm.remarks || ''}
                    onChange={(e) => setEditPaymentForm(f => ({ ...f, remarks: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="lmodal-footer">
              <button className="ledit-cancel" onClick={() => setEditPayment(null)}>Cancel</button>
              <button className="ledit-save" disabled={editPaymentSaving} onClick={handleEditPaymentSave}>
                {editPaymentSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE PAYMENT CONFIRMATION MODAL ─────────────────────────────── */}
      {deletePaymentItem && (
        <div className="lmodal-overlay" onClick={() => setDeletePaymentItem(null)}>
          <div className="lmodal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="lmodal-header">
              <h2 className="lmodal-title">Delete Payment</h2>
              <button className="lmodal-close" onClick={() => setDeletePaymentItem(null)}><X size={18} /></button>
            </div>
            <div className="lmodal-body">
              <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
                Are you sure you want to delete this payment of{' '}
                <strong style={{ color: '#DC2626' }}>
                  {formatExactCurrency(deletePaymentItem.advance !== undefined ? deletePaymentItem.advance : deletePaymentItem.amount)}
                </strong>{' '}
                for <strong>{deletePaymentItem.workerName}</strong>?
                <br />
                This action will reverse the related bank transaction and cannot be undone.
              </p>
            </div>
            <div className="lmodal-footer">
              <button className="ledit-cancel" onClick={() => setDeletePaymentItem(null)}>Cancel</button>
              <button
                className="ledit-save"
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
                disabled={deletingPayment}
                onClick={handleConfirmDeletePayment}
              >
                {deletingPayment ? 'Deleting…' : 'Yes, Delete Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE WORKER CONFIRMATION MODAL ──────────────────────────────── */}
      {deleteWorkerItem && (
        <div className="lmodal-overlay" onClick={() => !deletingId && setDeleteWorkerItem(null)}>
          <div className="lmodal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="lmodal-header">
              <h2 className="lmodal-title">Delete Worker</h2>
              <button className="lmodal-close" onClick={() => !deletingId && setDeleteWorkerItem(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="lmodal-body">
              {deleteWorkerError && (
                <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C', fontSize: '13px' }}>
                  {deleteWorkerError}
                </div>
              )}
              <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                Are you sure you want to delete worker <strong>{deleteWorkerItem.name}</strong>?
                <br />
                This action cannot be undone and will remove all associated worker records.
              </p>
            </div>
            <div className="lmodal-footer">
              <button className="ledit-cancel" disabled={!!deletingId} onClick={() => setDeleteWorkerItem(null)}>
                Cancel
              </button>
              <button
                className="ledit-save"
                style={{ background: '#DC2626', borderColor: '#DC2626' }}
                disabled={!!deletingId}
                onClick={handleConfirmDeleteWorker}
              >
                {deletingId ? 'Deleting…' : 'Yes, Delete Worker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ──────────────────────────────────────────── */}
      {showRecordPayment && (
        <RecordWorkerPaymentModal
          worker={recordPaymentWorker || viewWorker || null}
          workers={displayWorkers}
          sites={sites}
          onClose={() => {
            setShowRecordPayment(false)
            setRecordPaymentWorker(null)
          }}
          onSuccess={async () => {
            // Immediate refresh of workers table with recalculated paid & pending amounts
            try {
              const res = await labourService.getAll()
              const updatedList = res?.workers || (Array.isArray(res) ? res : [])
              if (updatedList.length > 0) {
                setLocalWorkers(updatedList)
              }
            } catch (err) {
              console.error('Failed to reload workers:', err)
            }
            // Refresh payment history if a worker is currently viewed
            if (viewWorker) {
              const id = viewWorker._id || viewWorker.id
              workerPaymentService.getByWorker(id)
                .then((res) => {
                  const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
                  setWorkerPaymentHistory(list)
                })
                .catch(() => {})
            }
            if (viewPayment?.workerId) {
              workerPaymentService.getByWorker(viewPayment.workerId)
                .then((res) => {
                  const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
                  setViewPaymentHistory(list)
                })
                .catch(() => {})
            }
            loadAllPayments()
            if (onLabourChanged) onLabourChanged()
            if (onRefreshAccounts) onRefreshAccounts()
          }}
        />
      )}

      {/* ── EDIT WORKER MODAL ─────────────────────────────────────────────── */}
      {editWorker && (
        <div className="lmodal-overlay" onClick={() => setEditWorker(null)}>
          <div className="lmodal-box" onClick={(e) => e.stopPropagation()}>
            <div className="lmodal-header">
              <h2 className="lmodal-title">Edit Worker</h2>
              <button className="lmodal-close" onClick={() => setEditWorker(null)}><X size={18} /></button>
            </div>
            <div className="lmodal-body">
              {editError && <div className="ledit-error">{editError}</div>}
              <div className="ledit-grid">
                <div className="ledit-field"><label className="ledit-label">Full Name *</label><input className="ledit-input" value={editForm.name || ''} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Phone</label><input className="ledit-input" value={editForm.phone || ''} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Trade / Role *</label><input className="ledit-input" value={editForm.trade || ''} onChange={(e) => setEditForm(f => ({ ...f, trade: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Total Amount</label><input className="ledit-input" type="number" min="0" value={editForm.wagesEarned || ''} onChange={(e) => setEditForm(f => ({ ...f, wagesEarned: e.target.value, dailyRate: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Total Paid (₹)</label><input className="ledit-input" type="number" min="0" value={editForm.totalPaid || ''} onChange={(e) => setEditForm(f => ({ ...f, totalPaid: e.target.value }))} /></div>
                {/* Previous Advance Amount (Read-only) */}
                <div className="ledit-field">
                  <label className="ledit-label">Previous Advance Amount</label>
                  <input
                    className="ledit-input"
                    type="text"
                    readOnly
                    value={`₹${Number(editForm.previousAdvanceAmount || 0).toLocaleString('en-IN')}`}
                    style={{ background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }}
                  />
                </div>


                {/* Bank Name (Dropdown populated with actual bank names) */}
                <div className="ledit-field ledit-full">
                  <label className="ledit-label">Bank Name</label>
                  <select
                    className="ledit-input"
                    value={editForm.bankAccountId || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, bankAccountId: e.target.value }))}
                    disabled={loadingBanks}
                  >
                    <option value="">
                      {loadingBanks ? 'Loading banks...' : 'Select Bank Name...'}
                    </option>
                    {bankAccounts.map((b) => (
                      <option key={b._id || b.id} value={b._id || b.id}>
                        {b.bankName || b.bank_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ledit-field ledit-full"><label className="ledit-label">Address</label><input className="ledit-input" value={editForm.address || ''} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div className="ledit-field ledit-full"><label className="ledit-label">Remarks</label><input className="ledit-input" value={editForm.remarks || ''} onChange={(e) => setEditForm(f => ({ ...f, remarks: e.target.value }))} /></div>
              </div>
            </div>
            <div className="lmodal-footer">
              <button className="ledit-cancel" onClick={() => setEditWorker(null)}>Cancel</button>
              <button className="ledit-save" disabled={editSaving} onClick={handleEditSave}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
