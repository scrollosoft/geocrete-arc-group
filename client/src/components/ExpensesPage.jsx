import React, { useState, useEffect, useMemo } from 'react'
import {
  CreditCard,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  ArrowLeft,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import TablePagination from './TablePagination.jsx'
import { expenseService, approveExpense, rejectExpense } from '../services/expenseService.js'
import { request } from '../services/api.js'
import AddExpenseModal from './AddExpenseModal.jsx'
import MakeExpensePaymentModal from './MakeExpensePaymentModal.jsx'
import WhatsAppSharePromptModal from './WhatsAppSharePromptModal.jsx'
import { WhatsAppIcon, shareExpenseOnWhatsApp } from '../utils/whatsappHelper.jsx'

export default function ExpensesPage({
  expenses = [],
  sites = [],
  suppliers = [],
  bankAccounts = [],
  onOpenAddExpense,
  onExpenseChanged,
  showNotification,
  loading = false,
  hideHeader = false,
  onViewExpense,
  initialExpense = null,
  onBackFromDetail,
  userRole = 'Admin',
  loggedInUsername = '',
}) {
  const [editingExpense, setEditingExpense] = useState(null)
  const [payingExpense, setPayingExpense] = useState(null)
  const [whatsappExpense, setWhatsappExpense] = useState(null)
  const [viewExpense, setViewExpense] = useState(initialExpense)
  const [deletingId, setDeletingId] = useState(null)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [sortFilter, setSortFilter] = useState('Newest First')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detailPaymentPage, setDetailPaymentPage] = useState(1)
  const [detailPaymentPageSize, setDetailPaymentPageSize] = useState(10)

  const isManagerUser = userRole === 'Manager' || String(loggedInUsername || '').toLowerCase() === 'manager'

  // Owner | Manager tab — only Admin sees both tabs; Manager always sees their own
  const [expenseTab, setExpenseTab] = useState(isManagerUser ? 'manager' : 'owner')

  useEffect(() => {
    if (isManagerUser) {
      setExpenseTab('manager')
    }
  }, [isManagerUser])

  const [expensePayments, setExpensePayments] = useState([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0)

  useEffect(() => {
    setViewExpense(initialExpense)
  }, [initialExpense])

  // Keep viewExpense synchronized if expenses list updates
  useEffect(() => {
    if (viewExpense) {
      const expId = viewExpense._id || viewExpense.id
      const fresh = expenses.find((e) => String(e._id || e.id) === String(expId))
      if (
        fresh &&
        (fresh.updatedAt !== viewExpense.updatedAt ||
          fresh.paidAmount !== viewExpense.paidAmount ||
          fresh.pendingAmount !== viewExpense.pendingAmount ||
          fresh.amount !== viewExpense.amount)
      ) {
        setViewExpense(fresh)
      }
    }
  }, [expenses])

  // Fetch individual payment transactions for the viewed expense
  useEffect(() => {
    if (!viewExpense) {
      setExpensePayments([])
      return
    }
    const expId = viewExpense._id || viewExpense.id
    if (!expId) return

    let isMounted = true
    setLoadingPayments(true)
    expenseService
      .getPayments(expId)
      .then((data) => {
        if (isMounted) {
          setExpensePayments(Array.isArray(data) ? data : [])
        }
      })
      .catch((err) => {
        console.error('Failed to load expense payments:', err)
        if (isMounted) setExpensePayments([])
      })
      .finally(() => {
        if (isMounted) setLoadingPayments(false)
      })

    return () => {
      isMounted = false
    }
  }, [viewExpense?._id, viewExpense?.id, viewExpense?.paidAmount, viewExpense?.pendingAmount, paymentRefreshKey])

  // Process separate payment transactions in date-wise order, newest first,
  // calculating Pending After Payment sequentially from chronological transaction sequence
  const processedPayments = useMemo(() => {
    if (!viewExpense || !expensePayments || expensePayments.length === 0) return []

    const totalExpenseAmount = Number(viewExpense.amount) || 0

    // 1. Sort chronological (oldest to newest) to calculate sequential pending balance
    const chronological = [...expensePayments].sort((a, b) => {
      const timeA = new Date(a.paymentDate || a.createdAt).getTime() || 0
      const timeB = new Date(b.paymentDate || b.createdAt).getTime() || 0
      if (timeA !== timeB) return timeA - timeB
      const idA = Number(a.id) || 0
      const idB = Number(b.id) || 0
      return idA - idB
    })

    // 2. Sequentially deduct each individual payment from total
    let runningPending = totalExpenseAmount
    const withPending = chronological.map((p) => {
      const pAmt = Number(p.amount) || 0
      runningPending = Math.max(0, Number((runningPending - pAmt).toFixed(2)))
      return {
        ...p,
        pendingAfterPayment: runningPending,
      }
    })

    // 3. Return date-wise order, newest first
    return withPending.sort((a, b) => {
      const timeA = new Date(a.paymentDate || a.createdAt).getTime() || 0
      const timeB = new Date(b.paymentDate || b.createdAt).getTime() || 0
      if (timeA !== timeB) return timeB - timeA
      const idA = Number(a.id) || 0
      const idB = Number(b.id) || 0
      return idB - idA
    })
  }, [viewExpense, expensePayments])

  const handleView = (item) => {
    if (onViewExpense) {
      onViewExpense(item)
    } else {
      setViewExpense(item)
    }
  }

  // Indian Currency formatter for Metric Cards
  const formatIndianNumber = (amount) => {
    if (!amount && amount !== 0) return '₹0'
    const num = Number(amount)
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`
    return `₹${num.toLocaleString('en-IN')}`
  }

  // Format Table Currency
  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '-'
    if (val === 0) return '-'
    return `₹${Number(val).toLocaleString('en-IN')}`
  }

  const formatExactCurrency = (val) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '₹0'
    return `₹${Number(val).toLocaleString('en-IN')}`
  }

  // Format Date
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Helper: extract normalized approval status ('Approved' | 'Rejected' | 'Pending')
  const getApprovalStatus = (e) => {
    const raw = e?.approvalStatus || e?.approval_status || 'Pending'
    const lower = String(raw).trim().toLowerCase()
    if (lower === 'approved') return 'Approved'
    if (lower === 'rejected') return 'Rejected'
    return 'Pending'
  }

  // Dataset for dashboard summary metric cards:
  // Rejected expenses must not be included in any dashboard card calculation.
  // - Total Expenses: Include only expenses that are Pending or Approved. Exclude Rejected expenses.
  // - This Month: Include only Pending and Approved expenses for the current month. Exclude Rejected expenses.
  // - Pending Payments: Include pending payment amounts only from Pending and Approved expenses. Exclude Rejected expenses completely.
  const cardExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // 1. Strictly exclude any Rejected expense from all dashboard metric cards
      const status = getApprovalStatus(e)
      if (status === 'Rejected') {
        return false
      }

      // 2. Manager view: include only manager's own expenses (Pending or Approved)
      if (isManagerUser) {
        const matchName = loggedInUsername ? String(loggedInUsername).toLowerCase() : 'manager'
        const itemCreatedBy = String(e.createdBy || '').toLowerCase()
        const isOwn =
          e.createdByRole === 'Manager' ||
          itemCreatedBy === matchName ||
          itemCreatedBy === 'manager'
        return isOwn
      }

      // 3. Admin view: respect active tab
      if (expenseTab === 'manager') {
        return e.createdByRole === 'Manager'
      }
      if (expenseTab === 'owner') {
        return e.createdByRole !== 'Manager'
      }
      return true
    })
  }, [expenses, isManagerUser, expenseTab, loggedInUsername])

  // Calculate actual dynamic metrics from the filtered card dataset
  const totalExpenseAmount = cardExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const totalPendingAmount = cardExpenses.reduce((sum, e) => sum + (Number(e.pendingAmount) || 0), 0)

  // This month's expenses (excluding Rejected)
  const now = new Date()
  const currentMonthExpenses = cardExpenses.filter((e) => {
    if (!e.date) return false
    const d = new Date(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthAmount = currentMonthExpenses.length > 0
    ? currentMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    : 0

  const pendingEntriesCount = cardExpenses.filter((e) => (Number(e.pendingAmount) || 0) > 0).length

  // Count distinct sites with expenses
  const distinctSitesCount = new Set(
    cardExpenses.map((e) => (e.site?._id || e.site || '').toString()).filter(Boolean)
  ).size || 0

  // Filter & sort expenses list
  const filteredExpenses = expenses
    .filter((item) => {
      // Tab-based role filtering
      if (isManagerUser) {
        // Manager only sees their own expenses
        const matchName = loggedInUsername ? String(loggedInUsername).toLowerCase() : 'manager'
        const itemCreatedBy = String(item.createdBy || '').toLowerCase()
        const isOwn =
          item.createdByRole === 'Manager' ||
          itemCreatedBy === matchName ||
          itemCreatedBy === 'manager'
        if (!isOwn) return false
      } else if (expenseTab === 'owner') {
        // Admin Owner tab: show non-Manager expenses
        if (item.createdByRole === 'Manager') return false
      } else if (expenseTab === 'manager') {
        // Admin Manager tab: show only Manager expenses
        if (item.createdByRole !== 'Manager') return false
      }

      const siteName = item.site?.name || (typeof item.site === 'string' ? item.site : '')
      const desc = item.description || item.remark || ''
      const cat = item.category || ''

      const matchesSearch =
        !search ||
        desc.toLowerCase().includes(search.toLowerCase()) ||
        siteName.toLowerCase().includes(search.toLowerCase()) ||
        cat.toLowerCase().includes(search.toLowerCase())

      const matchesSite = siteFilter === 'All Sites' || siteName === siteFilter

      let matchesStatus = true
      if (statusFilter === 'Pending') {
        matchesStatus = (item.pendingAmount || 0) > 0
      } else if (statusFilter === 'Paid') {
        matchesStatus = (item.pendingAmount || 0) === 0
      }

      return matchesSearch && matchesSite && matchesStatus
    })
    .sort((a, b) => {
      if (sortFilter === 'Oldest First') {
        return new Date(a.date || 0) - new Date(b.date || 0)
      }
      if (sortFilter === 'Amount High-Low') {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0)
      }
      // 'Newest First'
      return new Date(b.date || 0) - new Date(a.date || 0)
    })

  // Pagination
  const totalRecords = filteredExpenses.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const currentRecords = filteredExpenses.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Generate pagination items with ellipses dynamically
  const getPaginationItems = () => {
    if (totalRecords === 0) return []
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const items = []
    items.push(1)

    if (activePage > 3) {
      items.push('...')
    }

    const start = Math.max(2, activePage - 1)
    const end = Math.min(totalPages - 1, activePage + 1)

    for (let i = start; i <= end; i++) {
      items.push(i)
    }

    if (activePage < totalPages - 2) {
      items.push('...')
    }

    items.push(totalPages)
    return items
  }

  const handleDeleteExpense = async (item) => {
    const itemName = item.category || 'this expense'
    if (!window.confirm(`Are you sure you want to delete ${itemName}? This cannot be undone.`)) {
      return
    }
    const id = item._id || item.id
    setDeletingId(id)
    try {
      await expenseService.delete(id)
      if (showNotification) {
        showNotification({ type: 'success', message: `Expense "${itemName}" deleted successfully!` })
      }
      if (onExpenseChanged) {
        onExpenseChanged()
      }
    } catch (err) {
      console.error('Failed to delete expense:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: err.message || 'Failed to delete expense' })
      } else {
        alert('Delete failed: ' + (err.message || 'Unknown error'))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleApproveExpense = async (item) => {
    const id = item._id || item.id
    setApprovingId(id)
    try {
      if (typeof approveExpense === 'function') {
        await approveExpense(id)
      } else if (typeof expenseService?.approveExpense === 'function') {
        await expenseService.approveExpense(id)
      } else {
        await request(`/expenses/${id}/approve`, { method: 'PUT' })
      }
      if (showNotification) {
        showNotification({ type: 'success', message: 'Expense approved successfully!' })
      }
      if (onExpenseChanged) {
        onExpenseChanged()
      }
    } catch (err) {
      console.error('Failed to approve expense:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: err.message || 'Failed to approve expense' })
      } else {
        alert('Approval failed: ' + (err.message || 'Unknown error'))
      }
    } finally {
      setApprovingId(null)
    }
  }

  const handleRejectExpense = async (item) => {
    const id = item._id || item.id
    if (!window.confirm(`Are you sure you want to reject this expense (${item.category || 'record'})?`)) {
      return
    }
    setRejectingId(id)
    try {
      if (typeof rejectExpense === 'function') {
        await rejectExpense(id)
      } else if (typeof expenseService?.rejectExpense === 'function') {
        await expenseService.rejectExpense(id)
      } else {
        await request(`/expenses/${id}/reject`, { method: 'PUT' })
      }
      if (showNotification) {
        showNotification({ type: 'success', message: 'Expense rejected successfully!' })
      }
      if (onExpenseChanged) {
        onExpenseChanged()
      }
    } catch (err) {
      console.error('Failed to reject expense:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: err.message || 'Failed to reject expense' })
      } else {
        alert('Rejection failed: ' + (err.message || 'Unknown error'))
      }
    } finally {
      setRejectingId(null)
    }
  }

  if (viewExpense) {
    const isLockedManagerExpense =
      isManagerUser &&
      (viewExpense.createdByRole === 'Manager' || !!viewExpense.approvalStatus) &&
      (viewExpense.approvalStatus === 'Approved' || viewExpense.approvalStatus === 'Rejected')

    return (
      <div className="expenses-page expense-detail-page">
        {/* 1. Header with Back Button, Category Name, Subtitle and Edit Expense Button */}
        <div className="sites-header-wrap" style={{ alignItems: 'flex-start' }}>
          <div className="sites-header-left">
            <button
              type="button"
              className="labour-back-link"
              onClick={() => {
                setViewExpense(null)
                if (isManagerUser) {
                  setExpenseTab('manager')
                }
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
              <span>Back to all expenses</span>
            </button>
            <h1 className="sites-title" style={{ fontSize: '26px', fontWeight: 700, color: '#172033', margin: '2px 0 0 0' }}>
              {viewExpense.category || 'Expense Details'}
            </h1>
            <p className="sites-subtitle" style={{ fontSize: '13px', color: '#70829F', marginTop: '4px' }}>
              {[
                viewExpense.site?.name || (typeof viewExpense.site === 'string' ? viewExpense.site : null),
                viewExpense.date ? formatDate(viewExpense.date) : null,
                viewExpense.supplier?.name || (typeof viewExpense.supplier === 'string' ? viewExpense.supplier : null),
              ].filter(Boolean).join(' • ')}
            </p>
          </div>

          {!isLockedManagerExpense && (
            <button
              type="button"
              className="btn btn-primary-action"
              onClick={() => setEditingExpense(viewExpense)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                backgroundColor: '#0284C7',
                color: '#FFFFFF',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              <Pencil size={15} />
              <span>Edit Expense</span>
            </button>
          )}
        </div>

        {/* 2. Top Summary Stat Cards */}
        <div className="sites-stat-grid expense-detail-stat-grid">
          <div className="site-stat-card">
            <div className="stat-icon-wrap stat-icon-blue">
              <CreditCard size={18} />
            </div>
            <span className="stat-label">Total Amount</span>
            <div className="stat-value">{formatExactCurrency(viewExpense.amount)}</div>
            <span className="stat-desc">Invoice / Bill Value</span>
          </div>

          <div className="site-stat-card">
            <div className="stat-icon-wrap stat-icon-green">
              <CreditCard size={18} />
            </div>
            <span className="stat-label">Paid Amount</span>
            <div className="stat-value" style={{ color: '#059669' }}>
              {formatExactCurrency(viewExpense.paidAmount)}
            </div>
            <span className="stat-desc">Settled to date</span>
          </div>

          <div className="site-stat-card">
            <div className="stat-icon-wrap stat-icon-orange">
              <CreditCard size={18} />
            </div>
            <span className="stat-label">Pending Amount</span>
            <div className="stat-value" style={{ color: (viewExpense.pendingAmount || 0) > 0 ? '#DC2626' : '#059669' }}>
              {formatExactCurrency(viewExpense.pendingAmount)}
            </div>
            <span className="stat-desc">{(viewExpense.pendingAmount || 0) > 0 ? 'Payment outstanding' : 'Fully cleared'}</span>
          </div>

          <div className="site-stat-card">
            <div className="stat-icon-wrap stat-icon-purple">
              <CreditCard size={18} />
            </div>
            <span className="stat-label">Payment Status</span>
            <div className="stat-value" style={{ fontSize: '18px', fontWeight: 700, color: (viewExpense.pendingAmount || 0) > 0 ? '#D97706' : '#059669' }}>
              {(viewExpense.pendingAmount || 0) > 0 ? 'Pending' : 'Paid'}
            </div>
            <span className="stat-desc">{viewExpense.paymentMethod || 'Bank Transfer'}</span>
          </div>
        </div>

        {/* 3. Detailed Info Card */}
        <div className="sites-table-card expense-detail-card">
          <div className="sites-table-card-header" style={{ marginBottom: '18px' }}>
            <h2 className="sites-table-title">Expense Particulars</h2>
            <p className="sites-table-subtitle">Complete breakdown and reference information for this transaction.</p>
          </div>

          <div className="expense-particulars-grid">
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600, color: '#1E293B' }}>{formatDate(viewExpense.date) || '-'}</p>
            </div>
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Construction Site</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600, color: '#1E293B' }}>{viewExpense.site?.name || (typeof viewExpense.site === 'string' ? viewExpense.site : '-')}</p>
            </div>
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category / Material</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600, color: '#1E293B' }}>{viewExpense.category || '-'}</p>
            </div>
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier / Vendor</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600, color: '#1E293B' }}>{viewExpense.supplier?.name || (typeof viewExpense.supplier === 'string' ? viewExpense.supplier : '-')}</p>
            </div>
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quantity & Rate</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600, color: '#1E293B' }}>
                {viewExpense.quantity ? `${viewExpense.quantity} ${viewExpense.unit || ''} @ ₹${viewExpense.ratePerUnit || 0}` : '-'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Mode</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600, color: '#1E293B' }}>{viewExpense.paymentMethod || 'Bank Transfer'}</p>
            </div>
            <div>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bank Account</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600, color: '#1E293B' }}>
                {viewExpense.bankAccount?.bankName || viewExpense.bankAccount?.accountNumber || (typeof viewExpense.bankAccount === 'string' ? viewExpense.bankAccount : '-')}
              </p>
            </div>
            {viewExpense.approvalStatus && (
              <div>
                <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approval Status</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '14.5px', fontWeight: 600 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor:
                        viewExpense.approvalStatus === 'Approved'
                          ? '#DEF7EC'
                          : viewExpense.approvalStatus === 'Rejected'
                          ? '#FEE2E2'
                          : '#FEF3C7',
                      color:
                        viewExpense.approvalStatus === 'Approved'
                          ? '#03543F'
                          : viewExpense.approvalStatus === 'Rejected'
                          ? '#991B1B'
                          : '#92400E',
                    }}
                  >
                    {viewExpense.approvalStatus}
                  </span>
                </p>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Remarks / Notes</span>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>{viewExpense.remark || viewExpense.description || 'No additional remarks provided.'}</p>
            </div>
          </div>
        </div>

        {/* 4. Date-wise Payment History Section */}
        <div className="sites-table-card" style={{ padding: '24px', marginTop: '24px' }}>
          <div className="sites-table-card-header" style={{ marginBottom: '18px' }}>
            <h2 className="sites-table-title">Payment History</h2>
            <p className="sites-table-subtitle">Date-wise breakdown of all payment transactions for this expense.</p>
          </div>

          <div className="sites-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th className="th-date" style={{ padding: '16px 20px', width: '13%' }}>PAYMENT DATE</th>
                  <th className="th-cat" style={{ padding: '16px 20px', width: '12%' }}>PAYMENT TYPE</th>
                  <th className="th-cat" style={{ padding: '16px 20px', width: '14%' }}>PAYMENT METHOD</th>
                  <th className="th-desc" style={{ padding: '16px 20px', width: '18%' }}>BANK ACCOUNT</th>
                  <th className="th-desc" style={{ padding: '16px 20px', width: '17%' }}>TRANSACTION REFERENCE</th>
                  <th className="th-amount" style={{ padding: '16px 20px', width: '13%', textAlign: 'right' }}>PAID AMOUNT (₹)</th>
                  <th className="th-pending" style={{ padding: '16px 20px', width: '13%', textAlign: 'right' }}>PENDING AFTER PAYMENT (₹)</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayments ? (
                  <tr>
                    <td colSpan={7} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      Loading payment transactions...
                    </td>
                  </tr>
                ) : processedPayments.length > 0 ? (
                  processedPayments
                    .slice((detailPaymentPage - 1) * detailPaymentPageSize, detailPaymentPage * detailPaymentPageSize)
                    .map((p, idx) => {
                    const matchedBank = p.bankAccountId
                      ? bankAccounts.find((b) => String(b._id || b.id) === String(p.bankAccountId))
                      : null
                    const bankDisplayName = p.bankName || matchedBank?.bankName || '—'
                    const accNumber = p.accountNumber || matchedBank?.accountNumber

                    return (
                      <tr key={p.id || p._id || idx} className="expense-row">
                        <td className="td-date" style={{ padding: '16px 20px' }}>
                          {p.paymentDate ? formatDate(p.paymentDate) : '—'}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              border: '1px solid #DBEAFE',
                            }}
                          >
                            {p.paymentType || 'Debit'}
                          </span>
                        </td>
                        <td className="td-category" style={{ padding: '16px 20px', color: '#70829F' }}>
                          {p.paymentMethod || 'Bank Transfer'}
                        </td>
                        <td className="td-description" style={{ padding: '16px 20px', color: '#172033' }}>
                          <div style={{ fontWeight: 600 }}>{bankDisplayName}</div>
                          {accNumber && (
                            <div style={{ fontSize: '12px', color: '#70829F', marginTop: '2px' }}>
                              •••• {String(accNumber).slice(-4)}
                            </div>
                          )}
                        </td>
                        <td className="td-description" style={{ padding: '16px 20px', color: '#70829F' }}>
                          {p.reference && p.reference !== '-' ? p.reference : (p.notes || '—')}
                        </td>
                        <td className="td-amount" style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, color: '#059669', fontSize: '14.5px' }}>
                            {formatExactCurrency(p.amount)}
                          </span>
                        </td>
                        <td className="td-pending" style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: '14.5px',
                              color: (p.pendingAfterPayment || 0) > 0 ? '#DC2626' : '#059669',
                            }}
                          >
                            {formatExactCurrency(p.pendingAfterPayment)}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      No payment transactions recorded for this expense.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {processedPayments.length > 0 && (
            <TablePagination
              currentPage={detailPaymentPage}
              pageSize={detailPaymentPageSize}
              totalRecords={processedPayments.length}
              onPageChange={setDetailPaymentPage}
              onPageSizeChange={(newSize) => {
                setDetailPaymentPageSize(newSize)
                setDetailPaymentPage(1)
              }}
              style={{ padding: '14px 20px', borderTop: '1px solid #E5EAF1', margin: 0 }}
            />
          )}
        </div>

        {/* Make Expense Payment Modal */}
      {payingExpense && (
        <MakeExpensePaymentModal
          isOpen={Boolean(payingExpense)}
          expense={payingExpense}
          onClose={() => setPayingExpense(null)}
          onPaymentSuccess={() => {
            setPayingExpense(null)
            setPaymentRefreshKey((k) => k + 1)
            if (onExpenseChanged) onExpenseChanged()
          }}
          showNotification={showNotification}
        />
      )}

      {/* Edit Expense Modal */}
        {editingExpense && (
          <AddExpenseModal
            isOpen={Boolean(editingExpense)}
            expenseToEdit={editingExpense}
            onClose={() => setEditingExpense(null)}
            sites={sites}
            suppliers={suppliers}
            bankAccounts={bankAccounts}
            onExpenseUpdated={() => {
              setEditingExpense(null)
              setPaymentRefreshKey((k) => k + 1)
              if (onExpenseChanged) onExpenseChanged()
            }}
            showNotification={showNotification}
          />
        )}
      </div>
    )
  }

  return (
    <div className="expenses-page">
      {/* 1. Breadcrumb & Page Header */}
      {!hideHeader && (
        <div className="sites-header-wrap">
          <div className="sites-header-left">
            <div className="sites-breadcrumb">
              <span className="breadcrumb-root">WORKSPACE</span>
              <span className="breadcrumb-slash">/</span>
              <span className="breadcrumb-active">EXPENSES</span>
            </div>
            <h1 className="sites-title">Expenses</h1>
            <p className="sites-subtitle">Track, review and manage every project expense.</p>
          </div>

          <button
            type="button"
            className="btn btn-primary-action btn-add-site-header"
            onClick={onOpenAddExpense}
          >
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        </div>
      )}

      {/* 2. Top Summary Metric Cards */}
      {!hideHeader && (
        <div className="sites-stat-grid expenses-stat-grid">
          {/* Card 1: Total Expenses */}
          <div className="site-stat-card">
            <div className="stat-icon-wrap stat-icon-blue">
              <CreditCard size={18} />
            </div>
            <span className="stat-label">Total Expenses</span>
            <div className="stat-value">{formatIndianNumber(totalExpenseAmount || 0)}</div>
            <span className="stat-desc">Across {distinctSitesCount} sites</span>
          </div>

          {/* Card 2: This Month */}
          <div className="site-stat-card">
            <div className="stat-icon-wrap stat-icon-green">
              <CreditCard size={18} />
            </div>
            <span className="stat-label">This Month</span>
            <div className="stat-value">{formatIndianNumber(thisMonthAmount || 0)}</div>
            <span className="stat-desc">12% lower than last month</span>
          </div>

          {/* Card 3: Pending Payments */}
          <div className="site-stat-card">
            <div className="stat-icon-wrap stat-icon-orange">
              <CreditCard size={18} />
            </div>
            <span className="stat-label">Pending Payments</span>
            <div className="stat-value">{formatIndianNumber(totalPendingAmount || 0)}</div>
            <span className="stat-desc">{pendingEntriesCount || 0} pending entries</span>
          </div>
        </div>
      )}

      {/* 4. Table Box Container */}
      <div className="sites-table-card">
        <div className="sites-table-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="sites-table-title">All Expenses</h2>
            <p className="sites-table-subtitle">Manage projects, progress and financial health in one place.</p>
          </div>

          {/* Owner | Manager Tabs for Admin */}
          {!isManagerUser && (
            <div
              className="expense-role-tabs"
              style={{
                display: 'inline-flex',
                background: '#F1F5F9',
                padding: '4px',
                borderRadius: '8px',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setExpenseTab('owner')
                  setCurrentPage(1)
                }}
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: expenseTab === 'owner' ? '#FFFFFF' : 'transparent',
                  color: expenseTab === 'owner' ? '#0F172A' : '#64748B',
                  boxShadow: expenseTab === 'owner' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpenseTab('manager')
                  setCurrentPage(1)
                }}
                style={{
                  padding: '7px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: expenseTab === 'manager' ? '#FFFFFF' : 'transparent',
                  color: expenseTab === 'manager' ? '#0F172A' : '#64748B',
                  boxShadow: expenseTab === 'manager' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Manager
              </button>
            </div>
          )}
        </div>

        {/* 3. Search and Dropdown Filter Row */}
        <div className="sites-filter-row">
          <div className="sites-search-box">
            <Search size={16} className="sites-search-icon" />
            <input
              type="text"
              className="sites-search-input"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          <div className="sites-filters-right">
            <div className="site-select-wrapper">
              <select
                className="site-pill-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="All Status">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
              <ChevronDown size={14} className="site-select-arrow" />
            </div>

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

            <div className="site-select-wrapper">
              <select
                className="site-pill-select"
                value={sortFilter}
                onChange={(e) => setSortFilter(e.target.value)}
              >
                <option value="Newest First">Newest First</option>
                <option value="Oldest First">Oldest First</option>
                <option value="Amount High-Low">Amount High-Low</option>
              </select>
              <ChevronDown size={14} className="site-select-arrow" />
            </div>
          </div>
        </div>

        {(() => {
          const isManagerTab = isManagerUser || expenseTab === 'manager'
          const colSpanCount = isManagerTab ? 9 : 7

          return (
            <div className="sites-table-scroll">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th className="th-date">DATE</th>
                    <th className="th-site">SITE</th>
                    <th className="th-cat">CATEGORY</th>
                    <th className="th-amount">AMOUNT</th>
                    <th className="th-paid">PAID</th>
                    <th className="th-pending">PENDING</th>
                    {isManagerTab && <th className="th-manager">MANAGER</th>}
                    {isManagerTab && <th className="th-status">STATUS</th>}
                    <th className="th-actions">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [1, 2, 3, 4].map((i) => (
                      <tr key={i} className="skeleton-row">
                        <td colSpan={colSpanCount}>
                          <div className="skeleton-line" style={{ height: '24px', margin: '4px 0' }} />
                        </td>
                      </tr>
                    ))
                  ) : currentRecords.length > 0 ? (
                    currentRecords.map((item) => (
                      <tr key={item._id} className="expense-row">
                        <td className="td-date">{formatDate(item.date)}</td>
                        <td className="td-site">{item.site?.name || item.site || '-'}</td>
                        <td className="td-category">{item.category || 'Material'}</td>
                        <td className="td-amount">{formatCurrency(item.amount)}</td>
                        <td className="td-paid">{formatCurrency(item.paidAmount)}</td>
                        <td className="td-pending">{formatCurrency(item.pendingAmount)}</td>

                        {isManagerTab && (
                          <td className="td-manager" style={{ fontWeight: 500, color: '#334155' }}>
                            {item.createdBy || 'manager'}
                          </td>
                        )}

                        {isManagerTab && (() => {
                          const itemApprovalStatus = getApprovalStatus(item)
                          const isApproved = itemApprovalStatus === 'Approved'
                          const isRejected = itemApprovalStatus === 'Rejected'

                          return (
                            <td className="td-status">
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  backgroundColor:
                                    isApproved
                                      ? '#DEF7EC'
                                      : isRejected
                                      ? '#FEE2E2'
                                      : '#FEF3C7',
                                  color:
                                    isApproved
                                      ? '#03543F'
                                      : isRejected
                                      ? '#991B1B'
                                      : '#92400E',
                                }}
                              >
                                {itemApprovalStatus}
                              </span>
                            </td>
                          )
                        })()}

                        <td className="td-actions">
                          <div className="site-actions-group">
                            {isManagerTab ? (() => {
                              const itemApprovalStatus = getApprovalStatus(item)
                              const isApproved = itemApprovalStatus === 'Approved'
                              const isRejected = itemApprovalStatus === 'Rejected'
                              const isPending = itemApprovalStatus === 'Pending'

                              return (
                                <>
                                  {/* Approve and Reject buttons: only Admin can approve/reject, only when Pending */}
                                  {!isManagerUser && isPending && (
                                    <>
                                      <button
                                        type="button"
                                        className="site-action-btn-approve"
                                        style={{
                                          width: 'auto',
                                          minWidth: '80px',
                                          height: '30px',
                                          backgroundColor: '#10B981',
                                          color: '#FFFFFF',
                                          border: '1px solid #10B981',
                                          borderRadius: '6px',
                                          padding: '0 10px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '5px',
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          fontSize: '12px',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                        }}
                                        title="Approve Expense"
                                        disabled={approvingId === (item._id || item.id) || rejectingId === (item._id || item.id)}
                                        onClick={() => handleApproveExpense(item)}
                                      >
                                        <CheckCircle size={14} />
                                        <span>Approve</span>
                                      </button>

                                      <button
                                        type="button"
                                        className="site-action-btn-reject"
                                        style={{
                                          width: 'auto',
                                          minWidth: '74px',
                                          height: '30px',
                                          backgroundColor: '#EF4444',
                                          color: '#FFFFFF',
                                          border: '1px solid #EF4444',
                                          borderRadius: '6px',
                                          padding: '0 10px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '5px',
                                          cursor: 'pointer',
                                          fontWeight: 600,
                                          fontSize: '12px',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                        }}
                                        title="Reject Expense"
                                        disabled={rejectingId === (item._id || item.id) || approvingId === (item._id || item.id)}
                                        onClick={() => handleRejectExpense(item)}
                                      >
                                        <XCircle size={14} />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  )}

                                  {/* View icon: enabled for all */}
                                  <button
                                    type="button"
                                    className="site-action-btn site-action-btn-view"
                                    title="View Expense Details"
                                    onClick={() => handleView(item)}
                                  >
                                    <Eye size={15} />
                                  </button>

                                  {/* Edit icon: for Manager, disabled if Approved or Rejected; enabled if Pending. For Admin, always enabled. */}
                                  <button
                                    type="button"
                                    className={`site-action-btn site-action-btn-edit ${isManagerUser && (isApproved || isRejected) ? 'site-action-btn-disabled' : ''}`}
                                    title={
                                      isManagerUser && isApproved
                                        ? 'Approved expenses cannot be edited'
                                        : isManagerUser && isRejected
                                        ? 'Rejected expenses cannot be edited'
                                        : 'Edit Expense'
                                    }
                                    disabled={isManagerUser && (isApproved || isRejected)}
                                    style={
                                      isManagerUser && (isApproved || isRejected)
                                        ? { opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'none' }
                                        : {}
                                    }
                                    onClick={() => {
                                      if (!isManagerUser || isPending) {
                                        setEditingExpense(item)
                                      }
                                    }}
                                  >
                                    <Pencil size={15} />
                                  </button>

                                  {/* Delete icon: for Manager, disabled if Approved or Rejected; enabled if Pending. For Admin, always enabled. */}
                                  <button
                                    type="button"
                                    className={`site-action-btn site-action-btn-delete ${isManagerUser && (isApproved || isRejected) ? 'site-action-btn-disabled' : ''}`}
                                    title={
                                      isManagerUser && isApproved
                                        ? 'Approved expenses cannot be deleted'
                                        : isManagerUser && isRejected
                                        ? 'Rejected expenses cannot be deleted'
                                        : 'Delete Expense'
                                    }
                                    disabled={
                                      (isManagerUser && (isApproved || isRejected)) ||
                                      deletingId === (item._id || item.id)
                                    }
                                    style={
                                      isManagerUser && (isApproved || isRejected)
                                        ? { opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'none' }
                                        : {}
                                    }
                                    onClick={() => {
                                      if (!isManagerUser || isPending) {
                                        handleDeleteExpense(item)
                                      }
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )
                            })() : (
                              <>
                                <button
                                  type="button"
                                  className="site-action-btn-pay"
                                  title={Number(item.pendingAmount || 0) <= 0 ? 'Fully Paid' : 'Make Payment'}
                                  disabled={Number(item.pendingAmount || 0) <= 0}
                                  onClick={() => setPayingExpense(item)}
                                >
                                  <CreditCard size={13} />
                                  <span>Make Payment</span>
                                </button>
                                <button
                                  type="button"
                                  className="site-action-btn site-action-btn-whatsapp"
                                  title="Share via WhatsApp"
                                  onClick={() => setWhatsappExpense(item)}
                                >
                                  <WhatsAppIcon size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="site-action-btn site-action-btn-view"
                                  title="View Expense Details"
                                  onClick={() => handleView(item)}
                                >
                                  <Eye size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="site-action-btn site-action-btn-edit"
                                  title="Edit Expense"
                                  onClick={() => setEditingExpense(item)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="site-action-btn site-action-btn-delete"
                                  title="Delete Expense"
                                  disabled={deletingId === (item._id || item.id)}
                                  onClick={() => handleDeleteExpense(item)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={colSpanCount} className="td-empty">
                        No expense records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        })()}

        {/* 5. Pagination Footer */}
        <TablePagination
          currentPage={activePage}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={handlePageChange}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setCurrentPage(1)
          }}
        />
      </div>

      {/* Make Expense Payment Modal */}
      {payingExpense && (
        <MakeExpensePaymentModal
          isOpen={Boolean(payingExpense)}
          expense={payingExpense}
          onClose={() => setPayingExpense(null)}
          onPaymentSuccess={() => {
            setPayingExpense(null)
            if (onExpenseChanged) onExpenseChanged()
          }}
          showNotification={showNotification}
        />
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <AddExpenseModal
          isOpen={Boolean(editingExpense)}
          expenseToEdit={editingExpense}
          onClose={() => setEditingExpense(null)}
          sites={sites}
          suppliers={suppliers}
          bankAccounts={bankAccounts}
          onExpenseUpdated={() => {
            setEditingExpense(null)
            if (onExpenseChanged) onExpenseChanged()
          }}
          showNotification={showNotification}
        />
      )}

      {/* WhatsApp Share Modal */}
      {whatsappExpense && (
        <WhatsAppSharePromptModal
          isOpen={Boolean(whatsappExpense)}
          onClose={() => setWhatsappExpense(null)}
          expense={whatsappExpense}
          suppliers={suppliers}
          sites={sites}
          showNotification={showNotification}
        />
      )}
    </div>
  )
}
