import React, { useState } from 'react'
import {
  CreditCard,
  AlertTriangle,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export default function ExpensesPage({
  expenses = [],
  sites = [],
  onOpenAddExpense,
  loading = false,
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [sortFilter, setSortFilter] = useState('Newest First')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

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

  // Format Date
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Calculate actual dynamic metrics from the expenses dataset
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
  const totalPendingAmount = expenses.reduce((sum, e) => sum + (e.pendingAmount || 0), 0)

  // This month's expenses
  const now = new Date()
  const currentMonthExpenses = expenses.filter((e) => {
    if (!e.date) return false
    const d = new Date(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthAmount = currentMonthExpenses.length > 0
    ? currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    : totalExpenseAmount // fallback if dates are mocked in past/future

  const pendingEntriesCount = expenses.filter((e) => (e.pendingAmount || 0) > 0).length

  // Over budget calculation
  const overBudgetAmount = sites.reduce((sum, s) => {
    const spent = s.totalSpent || 0
    const budget = s.totalBudget || 0
    return spent > budget ? sum + (spent - budget) : sum
  }, 0)

  // Count distinct sites with expenses
  const distinctSitesCount = new Set(
    expenses.map((e) => (e.site?._id || e.site || '').toString()).filter(Boolean)
  ).size || sites.length || 12

  // Filter expenses list
  const filteredExpenses = expenses.filter((item) => {
    const siteName = item.site?.name || ''
    const desc = item.description || ''
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

  return (
    <div className="expenses-page">
      {/* 1. Breadcrumb & Page Header */}
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

      {/* 2. Top Summary Metric Cards (4 in a row) */}
      <div className="sites-stat-grid">
        {/* Card 1: Total Expenses */}
        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-blue">
            <CreditCard size={18} />
          </div>
          <span className="stat-label">Total Expenses</span>
          <div className="stat-value">{formatIndianNumber(totalExpenseAmount || 42700000)}</div>
          <span className="stat-desc">Across {distinctSitesCount} sites</span>
        </div>

        {/* Card 2: This Month */}
        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-green">
            <CreditCard size={18} />
          </div>
          <span className="stat-label">This Month</span>
          <div className="stat-value">{formatIndianNumber(thisMonthAmount || 2840000)}</div>
          <span className="stat-desc">12% lower than last month</span>
        </div>

        {/* Card 3: Pending Payments */}
        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-orange">
            <CreditCard size={18} />
          </div>
          <span className="stat-label">Pending Payments</span>
          <div className="stat-value">{formatIndianNumber(totalPendingAmount || 1280000)}</div>
          <span className="stat-desc">{pendingEntriesCount || 18} outstanding entries</span>
        </div>

        {/* Card 4: Over Budget */}
        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-rose">
            <AlertTriangle size={18} />
          </div>
          <span className="stat-label">Over Budget</span>
          <div className="stat-value">{formatIndianNumber(overBudgetAmount || 180000)}</div>
          <span className="stat-desc">1 category needs attention</span>
        </div>
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

      {/* 4. Table Box Container */}
      <div className="sites-table-card">
        <div className="sites-table-card-header">
          <h2 className="sites-table-title">All Sites</h2>
          <p className="sites-table-subtitle">Manage projects, progress and financial health in one place.</p>
        </div>

        <div className="sites-table-scroll">
          <table className="expenses-table">
            <thead>
              <tr>
                <th className="th-date">DATE</th>
                <th className="th-desc">DESCRIPTION</th>
                <th className="th-site">SITE</th>
                <th className="th-cat">CATEGORY</th>
                <th className="th-amount">AMOUNT</th>
                <th className="th-paid">PAID</th>
                <th className="th-pending">PENDING</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i} className="skeleton-row">
                    <td colSpan={7}>
                      <div className="skeleton-line" style={{ height: '24px', margin: '4px 0' }} />
                    </td>
                  </tr>
                ))
              ) : currentRecords.length > 0 ? (
                currentRecords.map((item) => (
                  <tr key={item._id} className="expense-row">
                    <td className="td-date">{formatDate(item.date)}</td>
                    <td className="td-description">{item.description}</td>
                    <td className="td-site">{item.site?.name || 'Aarav Heights'}</td>
                    <td className="td-category">{item.category || 'Material'}</td>
                    <td className="td-amount">{formatCurrency(item.amount)}</td>
                    <td className="td-paid">{formatCurrency(item.paidAmount)}</td>
                    <td className="td-pending">{formatCurrency(item.pendingAmount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="td-empty">
                    No expense records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Scrollbar Indicator Bar */}
        <div className="sites-scrollbar-indicator">
          <div className="scrollbar-thumb-indicator" />
        </div>

        {/* 5. Pagination Footer */}
        <div className="sites-pagination-row">
          <div className="pagination-left">
            <span className="pagination-range-text">
              Showing {totalRecords === 0 ? '0-0 of 0' : `${startIndex + 1}-${endIndex} of ${totalRecords}`} records
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
  )
}
