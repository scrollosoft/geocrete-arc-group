import React from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

export default function TablePagination({
  currentPage = 1,
  pageSize = 10,
  totalRecords = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 15],
  style,
}) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)

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
    <div className="sites-pagination-row" style={{ marginTop: '16px', ...style }}>
      <div className="pagination-left">
        <span className="pagination-show-label">Show</span>
        <div className="pagination-page-size-select-wrap">
          <select
            className="pagination-page-size-select"
            value={pageSize}
            onChange={(e) => {
              if (onPageSizeChange) {
                onPageSizeChange(Number(e.target.value))
              }
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} rows
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="pagination-select-arrow" />
        </div>
        <span className="pagination-range-text">
          {totalRecords === 0
            ? 'Showing 0–0 of 0 records'
            : `Showing ${startIndex + 1}–${endIndex} of ${totalRecords.toLocaleString('en-IN')} records`}
        </span>
      </div>

      <div className="pagination-right">
        <button
          type="button"
          className="pagination-nav-btn"
          disabled={activePage <= 1 || totalRecords === 0}
          onClick={() => onPageChange && onPageChange(activePage - 1)}
          aria-label="Previous Page"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          <span>Previous</span>
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
                onClick={() => onPageChange && onPageChange(item)}
              >
                {item}
              </button>
            )
          })}

        <button
          type="button"
          className="pagination-nav-btn"
          disabled={activePage >= totalPages || totalRecords === 0}
          onClick={() => onPageChange && onPageChange(activePage + 1)}
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
