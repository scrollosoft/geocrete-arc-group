import React, { useState, useEffect, useMemo } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import TablePagination from './TablePagination.jsx'

export default function RecentExpenses({
  expenses = [],
  sites = [],
  selectedSiteFilter,
  setSelectedSiteFilter,
  dateFilter,
  setDateFilter,
  loading = false,
}) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Reset to page 1 when site or date filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedSiteFilter, dateFilter])

  const totalRecords = expenses.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)

  const currentExpenses = useMemo(() => {
    return expenses.slice(startIndex, endIndex)
  }, [expenses, startIndex, endIndex])

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '-'
    if (val === 0) return '-'
    return `₹${Number(val).toLocaleString('en-IN')}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  return (
    <section className="recent-expenses-section">
      <div className="section-header-with-filters">
        <div className="section-title-wrap">
          <h2 className="section-title">Recent Expense Entries</h2>
          <p className="section-subtitle">
            Manage projects, progress and financial health in one place.
          </p>
        </div>

        <div className="section-filters">
          {/* Site Filter Dropdown */}
          <div className="filter-dropdown-wrap">
            <select
              className="filter-site-select"
              value={selectedSiteFilter}
              onChange={(e) => setSelectedSiteFilter(e.target.value)}
            >
              <option value="all">All Sites</option>
              {sites.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="filter-select-arrow" />
          </div>

          {/* Date Filter Button */}
          <div className="filter-date-wrap">
            <button
              type="button"
              className={`btn filter-date-btn ${dateFilter ? 'active' : ''}`}
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <span>{dateFilter ? formatDate(dateFilter) : 'Date'}</span>
              <Calendar size={14} />
            </button>

            {showDatePicker && (
              <div className="date-picker-popover">
                <input
                  type="date"
                  className="popover-date-input"
                  value={dateFilter || ''}
                  onChange={(e) => {
                    setDateFilter(e.target.value)
                    setShowDatePicker(false)
                  }}
                />
                {dateFilter && (
                  <button
                    type="button"
                    className="clear-date-btn"
                    onClick={() => {
                      setDateFilter('')
                      setShowDatePicker(false)
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="table-responsive-container">
        <table className="expenses-table">
          <thead>
            <tr>
              <th className="th-date">DATE</th>
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
                  <td colSpan={6}>
                    <div className="skeleton-line" style={{ height: '24px', margin: '4px 0' }} />
                  </td>
                </tr>
              ))
            ) : currentExpenses.length > 0 ? (
              currentExpenses.map((item) => (
                <tr key={item._id} className="expense-row">
                  <td className="td-date">{formatDate(item.date)}</td>
                  <td className="td-site">{item.site?.name || item.site || '-'}</td>
                  <td className="td-category">{item.category || 'Material'}</td>
                  <td className="td-amount">{formatCurrency(item.amount)}</td>
                  <td className="td-paid">{formatCurrency(item.paidAmount)}</td>
                  <td className="td-pending">{formatCurrency(item.pendingAmount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="td-empty">
                  No expense records match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dynamic Pagination Footer */}
      {!loading && totalRecords > 0 && (
        <TablePagination
          currentPage={activePage}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setCurrentPage(1)
          }}
        />
      )}
    </section>
  )
}
