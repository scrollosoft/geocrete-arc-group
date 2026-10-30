import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  Landmark,
  X,
  RotateCcw,
  Receipt,
  ChevronRight,
  Wallet,
} from 'lucide-react'
import { bankAccountService } from '../services/bankAccountService.js'
import TransactionDetailModal from './TransactionDetailModal.jsx'

const formatRupee = (amt) => {
  if (amt === undefined || amt === null || isNaN(Number(amt))) return '₹0'
  return `₹${Math.round(Number(amt)).toLocaleString('en-IN')}`
}

const formatCompactRupee = (amt) => {
  const num = Math.abs(Number(amt) || 0)
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`
  return `₹${num.toLocaleString('en-IN')}`
}

const getMonthYearKey = (dateStr) => {
  if (!dateStr) return 'Other'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Other'
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function TransactionHistory({
  accounts = [],
  refreshTrigger = 0,
}) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter states
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'credit' | 'debit'
  const [selectedBankId, setSelectedBankId] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRangeFilter, setDateRangeFilter] = useState('all') // 'all' | 'this_month' | 'last_month' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Selected transaction for Google Pay detail modal
  const [selectedTxn, setSelectedTxn] = useState(null)

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await bankAccountService.getTransactions()
      if (res && res.transactions) {
        setTransactions(res.transactions)
      } else if (Array.isArray(res)) {
        setTransactions(res)
      } else {
        setTransactions([])
      }
    } catch (err) {
      console.error('Failed to load bank transactions:', err)
      setError(err.message || 'Failed to load transaction history.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions, refreshTrigger])

  // Derive date bounds for date filters
  const dateBounds = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // This month: 1st of current month to today
    const thisMonthStart = new Date(currentYear, currentMonth, 1).toISOString().slice(0, 10)
    const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10)

    // Last month
    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1).toISOString().slice(0, 10)
    const lastMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10)

    return { thisMonthStart, thisMonthEnd, lastMonthStart, lastMonthEnd }
  }, [])

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Type filter
      if (typeFilter !== 'all' && t.type !== typeFilter) {
        return false
      }

      // 2. Bank account filter
      if (selectedBankId !== 'all') {
        if (String(t.bankAccountId) !== String(selectedBankId)) {
          return false
        }
      }

      // 3. Date range filter
      if (dateRangeFilter === 'this_month') {
        if (t.date < dateBounds.thisMonthStart || t.date > dateBounds.thisMonthEnd) return false
      } else if (dateRangeFilter === 'last_month') {
        if (t.date < dateBounds.lastMonthStart || t.date > dateBounds.lastMonthEnd) return false
      } else if (dateRangeFilter === 'custom') {
        if (customStartDate && t.date < customStartDate) return false
        if (customEndDate && t.date > customEndDate) return false
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchTitle = (t.title || '').toLowerCase().includes(q)
        const matchSubtitle = (t.subtitle || '').toLowerCase().includes(q)
        const matchParty = (t.partyName || '').toLowerCase().includes(q)
        const matchSite = (t.siteName || '').toLowerCase().includes(q)
        const matchRef = (t.referenceId || '').toLowerCase().includes(q)
        const matchCategory = (t.category || '').toLowerCase().includes(q)
        const matchBank = (t.bankName || '').toLowerCase().includes(q)
        const matchAmount = String(t.amount || '').includes(q)
        if (!matchTitle && !matchSubtitle && !matchParty && !matchSite && !matchRef && !matchCategory && !matchBank && !matchAmount) {
          return false
        }
      }

      return true
    })
  }, [transactions, typeFilter, selectedBankId, dateRangeFilter, customStartDate, customEndDate, searchQuery, dateBounds])

  // Summary figures
  const totalReceived = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  }, [filteredTransactions])

  const totalSent = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  }, [filteredTransactions])

  // Group by Month/Year in chronological order (newest month first)
  const groupedTransactions = useMemo(() => {
    const groups = new Map()
    for (const t of filteredTransactions) {
      const groupKey = getMonthYearKey(t.date || t.rawTimestamp)
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey).push(t)
    }
    return Array.from(groups.entries())
  }, [filteredTransactions])

  const hasActiveFilters = typeFilter !== 'all' || selectedBankId !== 'all' || dateRangeFilter !== 'all' || searchQuery.trim() !== ''

  const clearAllFilters = () => {
    setTypeFilter('all')
    setSelectedBankId('all')
    setDateRangeFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setSearchQuery('')
  }

  return (
    <div className="gpay-history-container">
      {/* 1. Header & Summary Bar */}
      <div className="gpay-history-header">
        <div className="gpay-header-left">
          <div className="gpay-title-row">
            <h2 className="gpay-history-title">Transaction History</h2>
            <span className="gpay-history-count-badge">
              {filteredTransactions.length} {filteredTransactions.length === 1 ? 'Transaction' : 'Transactions'}
            </span>
          </div>
          <p className="gpay-history-subtitle">
            Google Pay-style real-time activity across your bank accounts
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div className="gpay-header-right">
          <div className="gpay-summary-pill gpay-pill-credit" title="Total Money Received">
            <div className="gpay-pill-icon-bubble gpay-bubble-green">
              <ArrowDownLeft size={14} strokeWidth={2.5} />
            </div>
            <div className="gpay-pill-content">
              <span className="gpay-pill-label">Total In</span>
              <span className="gpay-pill-val">+{formatCompactRupee(totalReceived)}</span>
            </div>
          </div>

          <div className="gpay-summary-pill gpay-pill-debit" title="Total Money Sent">
            <div className="gpay-pill-icon-bubble gpay-bubble-red">
              <ArrowUpRight size={14} strokeWidth={2.5} />
            </div>
            <div className="gpay-pill-content">
              <span className="gpay-pill-label">Total Out</span>
              <span className="gpay-pill-val">−{formatCompactRupee(totalSent)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="gpay-filter-bar">
        {/* Type Filter Pills (Google Pay style) */}
        <div className="gpay-type-pills">
          <button
            type="button"
            className={`gpay-type-pill ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All Transactions
          </button>
          <button
            type="button"
            className={`gpay-type-pill ${typeFilter === 'credit' ? 'active active-credit' : ''}`}
            onClick={() => setTypeFilter('credit')}
          >
            <ArrowDownLeft size={14} strokeWidth={2.4} />
            <span>Money Received</span>
          </button>
          <button
            type="button"
            className={`gpay-type-pill ${typeFilter === 'debit' ? 'active active-debit' : ''}`}
            onClick={() => setTypeFilter('debit')}
          >
            <ArrowUpRight size={14} strokeWidth={2.4} />
            <span>Money Sent</span>
          </button>
        </div>

        {/* Search & Dropdown Filters Row */}
        <div className="gpay-secondary-filters">
          {/* Search Box */}
          <div className="gpay-search-box">
            <Search size={16} className="gpay-search-icon" />
            <input
              type="text"
              className="gpay-search-input"
              placeholder="Search by description, site, supplier, or ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="gpay-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Bank Account Dropdown */}
          <div className="gpay-select-wrap">
            <Landmark size={15} className="gpay-select-icon" />
            <select
              className="gpay-select"
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              aria-label="Filter by bank account"
            >
              <option value="all">All Bank Accounts</option>
              {accounts.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  {b.bankName} (•••• {String(b.accountNumber || '').slice(-4)})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Dropdown */}
          <div className="gpay-select-wrap">
            <Calendar size={15} className="gpay-select-icon" />
            <select
              className="gpay-select"
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              aria-label="Filter by date range"
            >
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              className="gpay-clear-filters-btn"
              onClick={clearAllFilters}
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Custom Date Inputs Row (if custom is selected) */}
        {dateRangeFilter === 'custom' && (
          <div className="gpay-custom-date-row">
            <div className="gpay-date-field">
              <label className="gpay-date-label">From Date</label>
              <input
                type="date"
                className="gpay-date-input"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
            </div>
            <div className="gpay-date-field">
              <label className="gpay-date-label">To Date</label>
              <input
                type="date"
                className="gpay-date-input"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Transaction List */}
      <div className="gpay-list-wrap">
        {loading ? (
          <div className="gpay-loading-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="gpay-skeleton-row">
                <div className="gpay-skeleton-circle" />
                <div className="gpay-skeleton-text-group">
                  <div className="gpay-skeleton-line" style={{ width: '35%' }} />
                  <div className="gpay-skeleton-line" style={{ width: '60%', height: '11px' }} />
                </div>
                <div className="gpay-skeleton-line" style={{ width: '80px', height: '18px' }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="gpay-error-box">
            <span>{error}</span>
            <button type="button" className="btn btn-secondary-action" onClick={loadTransactions}>
              Retry
            </button>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="gpay-empty-state">
            <div className="gpay-empty-icon-wrap">
              <Receipt size={36} strokeWidth={1.8} />
            </div>
            <h3 className="gpay-empty-title">No transactions found</h3>
            <p className="gpay-empty-subtitle">
              {hasActiveFilters
                ? 'Try adjusting your search query, bank account, or date filter.'
                : 'No transactions have been recorded yet.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary-action gpay-empty-reset-btn"
                onClick={clearAllFilters}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="gpay-months-group">
            {groupedTransactions.map(([monthYear, items]) => (
              <div key={monthYear} className="gpay-month-section">
                {/* Month Group Header */}
                <div className="gpay-month-header">
                  <span className="gpay-month-title">{monthYear}</span>
                  <span className="gpay-month-badge">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Items in this month */}
                <div className="gpay-items-list">
                  {items.map((txn) => {
                    const isCredit = txn.type === 'credit'

                    return (
                      <div
                        key={txn.id}
                        className="gpay-item-row"
                        onClick={() => setSelectedTxn(txn)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedTxn(txn)
                          }
                        }}
                      >
                        {/* 1. Icon bubble */}
                        <div
                          className={`gpay-icon-bubble ${isCredit ? 'gpay-bubble-credit' : 'gpay-bubble-debit'}`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft size={20} strokeWidth={2.4} />
                          ) : (
                            <ArrowUpRight size={20} strokeWidth={2.4} />
                          )}
                        </div>

                        {/* 2. Middle Content */}
                        <div className="gpay-item-middle">
                          <div className="gpay-item-title-row">
                            <span className="gpay-item-title">{txn.title}</span>
                          </div>

                          <div className="gpay-item-subtitle" title={txn.subtitle}>
                            {txn.subtitle}
                          </div>

                          <div className="gpay-item-datetime">
                            {txn.dateTime}
                          </div>
                        </div>

                        {/* 3. Right Content (Amount & Balance) */}
                        <div className="gpay-item-right">
                          <div
                            className={`gpay-item-amount ${isCredit ? 'gpay-amount-credit' : 'gpay-amount-debit'}`}
                          >
                            {isCredit ? `+${formatRupee(txn.amount)}` : `−${formatRupee(txn.amount)}`}
                          </div>

                          {txn.balanceAfter !== null && txn.balanceAfter !== undefined ? (
                            <div className="gpay-running-bal" title="Bank balance after this transaction">
                              <Wallet size={11} className="gpay-bal-icon" />
                              <span>Bal: {formatRupee(txn.balanceAfter)}</span>
                            </div>
                          ) : (
                            <span className="gpay-running-bal-empty">
                              {txn.bankName ? txn.bankName : txn.paymentMethod}
                            </span>
                          )}
                        </div>

                        {/* Chevron right hint */}
                        <ChevronRight size={16} className="gpay-chevron-hint" />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Google Pay Detail Modal */}
      <TransactionDetailModal
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
        transaction={selectedTxn}
      />
    </div>
  )
}

