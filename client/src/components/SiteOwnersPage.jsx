import React, { useState, useEffect, useCallback } from 'react'
import {
  CreditCard,
  AlertTriangle,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react'
import { siteOwnerService } from '../services/siteOwnerService.js'
import SiteOwnerDetailPage from './SiteOwnerDetailPage.jsx'

export default function SiteOwnersPage({
  sites = [],
  onOpenAddClient,
  showNotification,
  refreshTrigger = 0,
}) {
  const [clients, setClients] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [sortFilter, setSortFilter] = useState('Newest First')

  // Pagination
  const [pageSize, setPageSize] = useState(5)
  const [currentPage, setCurrentPage] = useState(1)

  // View modal state
  const [viewingClient, setViewingClient] = useState(null)

  const fetchSiteOwners = useCallback(async () => {
    try {
      setLoading(true)
      const res = await siteOwnerService.getAll({ search: search.trim() })
      if (res) {
        setClients(res.clients || (Array.isArray(res) ? res : []))
        if (res.summary) setSummary(res.summary)
      }
    } catch (err) {
      console.error('Failed to load site owners:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: 'Failed to load site owners.' })
      }
    } finally {
      setLoading(false)
    }
  }, [search, showNotification])

  useEffect(() => {
    fetchSiteOwners()
  }, [fetchSiteOwners, refreshTrigger])

  // Fallback demo data matching the screenshot if DB is initially empty
  const sampleClients = [
    {
      _id: 'c1',
      id: 'c1',
      name: 'Rajesh Mehta',
      siteName: 'Aarav Heights',
      phone: '+91234567892',
      projectValue: 85000000,
      advanceAmount: 6500000,
      totalReceived: 13500000,
      receivable: 5000000,
      status: 'On schedule',
    },
    {
      _id: 'c2',
      id: 'c2',
      name: 'Priya Shah',
      siteName: 'Aarav Heights',
      phone: '+91234567892',
      projectValue: 9250000,
      advanceAmount: 2500000,
      totalReceived: 4800000,
      receivable: 4400000,
      status: 'On schedule',
    },
    {
      _id: 'c3',
      id: 'c3',
      name: 'Vedanta',
      siteName: 'Orchid Business Park',
      phone: '+91234567892',
      projectValue: 24000000,
      advanceAmount: 8000000,
      totalReceived: 21000000,
      receivable: 3000000,
      status: 'Payment due',
    },
    {
      _id: 'c4',
      id: 'c4',
      name: 'Karan Malhotra',
      siteName: 'Greenfield Villa',
      phone: '+91234567892',
      projectValue: 704000000,
      advanceAmount: 2000000,
      totalReceived: 6800000,
      receivable: 6000000,
      status: 'On schedule',
    },
  ]

  const displayList = clients.length > 0 ? clients : sampleClients

  // Filtering
  const filteredClients = displayList.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const clientName = (item.name || '').toLowerCase()
      const sName = (item.siteName || '').toLowerCase()
      const phone = (item.phone || '').toLowerCase()
      if (!clientName.includes(q) && !sName.includes(q) && !phone.includes(q)) {
        return false
      }
    }

    if (statusFilter !== 'All Status') {
      if ((item.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
    }

    if (siteFilter !== 'All Sites') {
      if ((item.siteName || '') !== siteFilter) {
        return false
      }
    }

    return true
  })

  // Sorting
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortFilter === 'Oldest First') {
      return (a.name || '').localeCompare(b.name || '')
    }
    if (sortFilter === 'Project Value: High to Low') {
      return (Number(b.projectValue) || 0) - (Number(a.projectValue) || 0)
    }
    if (sortFilter === 'Receivable: High to Low') {
      return (Number(b.receivable) || 0) - (Number(a.receivable) || 0)
    }
    return 0 // Newest First default
  })

  // Pagination calculation
  const totalRecords = sortedClients.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const paginatedRecords = sortedClients.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Handle Delete
  const handleDeleteClient = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete client "${name}"?`)) {
      return
    }
    try {
      await siteOwnerService.delete(id)
      if (showNotification) {
        showNotification({ type: 'success', message: `Client "${name}" deleted successfully.` })
      }
      fetchSiteOwners()
    } catch (err) {
      console.error('Delete failed:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: 'Failed to delete client.' })
      }
    }
  }

  // Format large values into Indian currency (Cr, L)
  const formatCostValue = (amount, fallback) => {
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
      return fallback || '₹0'
    }
    const num = Number(amount)
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')} L`
    }
    return `₹${num.toLocaleString('en-IN')}`
  }

  // Format table amounts to match screenshot style: ₹8.5 cr, ₹65.0 L, etc.
  const formatTableAmount = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0'
    const num = Number(amount)
    if (num === 0) return '₹0'
    if (num >= 10000000) {
      const val = (num / 10000000).toFixed(1)
      return `₹${val} cr`
    }
    if (num >= 100000) {
      const val = (num / 100000).toFixed(1)
      return `₹${val} L`
    }
    return `₹${num.toLocaleString('en-IN')}`
  }

  // If a client was selected for detailed view, show the full details page matching screenshot
  if (viewingClient) {
    return (
      <SiteOwnerDetailPage
        clientId={viewingClient._id || viewingClient.id}
        client={viewingClient}
        onBack={() => {
          setViewingClient(null)
          fetchSiteOwners()
        }}
        showNotification={showNotification}
      />
    )
  }

  return (
    <div className="labour-page site-owners-page" style={{ paddingBottom: '30px' }}>
      {/* 1. Header with Breadcrumb and Action Button */}
      <div className="sites-header-wrap">
        <div className="sites-header-left">
          <div className="sites-breadcrumb">
            <span className="breadcrumb-root">WORKSPACE</span>
            <span className="breadcrumb-slash">/</span>
            <span className="breadcrumb-active" style={{ color: '#0293DE', fontWeight: 600 }}>
              SITE OWNER’S
            </span>
          </div>
          <h1 className="sites-title">Site Owner’s</h1>
          <p className="sites-subtitle">
            View every client relationship and project receivable.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary-action btn-add-site-header"
          onClick={onOpenAddClient}
          style={{ background: '#0293DE', borderColor: '#0293DE', gap: '8px' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add Client's</span>
        </button>
      </div>

      {/* 2. Four Summary Stat Cards */}
      <div className="sites-stat-grid">
        {/* Card 1: Site Owner's */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Site Owner’s</span>
            <div className="stat-icon-wrap stat-icon-blue">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">
            {summary?.count || (clients.length > 0 ? clients.length : 10)}
          </div>
          <span className="stat-desc">Across 12 projects</span>
        </div>

        {/* Card 2: Total Project Value */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Total Project Value</span>
            <div className="stat-icon-wrap stat-icon-green">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">
            {formatCostValue(summary?.totalProject, '₹6.84 Cr')}
          </div>
          <span className="stat-desc">Contracted value</span>
        </div>

        {/* Card 3: Total Received */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Total Received</span>
            <div className="stat-icon-wrap stat-icon-orange">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">
            {formatCostValue(summary?.totalReceived, '₹5.32 Cr')}
          </div>
          <span className="stat-desc">77.8% collected</span>
        </div>

        {/* Card 4: Balance Receivable */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Balance Receivable</span>
            <div className="stat-icon-wrap stat-icon-rose">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-value">
            {formatCostValue(summary?.balance, '₹1.52 Cr')}
          </div>
          <span className="stat-desc">Across active projects</span>
        </div>
      </div>

      {/* 3. Filter Row: Search on Left, 3 Dropdowns on Right */}
      <div className="sites-filter-row" style={{ marginTop: '16px', marginBottom: '16px' }}>
        {/* Left: Search input */}
        <div className="sites-search-box" style={{ width: '320px' }}>
          <Search size={16} className="sites-search-icon" />
          <input
            type="text"
            className="sites-search-input"
            placeholder="Search site owner's..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>

        {/* Right: Dropdowns */}
        <div className="sites-filters-right">
          {/* Status Dropdown */}
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
              <option value="On schedule">On schedule</option>
              <option value="Payment due">Payment due</option>
              <option value="Completed">Completed</option>
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>

          {/* Sites Dropdown */}
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
                <option key={s._id || s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>

          {/* Sort Dropdown */}
          <div className="site-select-wrapper">
            <select
              className="site-pill-select"
              value={sortFilter}
              onChange={(e) => {
                setSortFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="Newest First">Newest First</option>
              <option value="Oldest First">Oldest First</option>
              <option value="Project Value: High to Low">Project Value: High to Low</option>
              <option value="Receivable: High to Low">Receivable: High to Low</option>
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>
        </div>
      </div>

      {/* 4. Site Owners Table Card */}
      <div className="sites-table-card" style={{ padding: '0 0 16px 0', border: '1px solid #E5EAF1' }}>
        <div className="sites-table-scroll">
          <table className="sites-table">
            <thead>
              <tr style={{ borderBottom: '1px solid #E5EAF1' }}>
                <th style={{ padding: '16px 20px', width: '15%' }}>CLIENT</th>
                <th style={{ padding: '16px 20px', width: '18%' }}>ASSOCIATED SITE</th>
                <th style={{ padding: '16px 20px', width: '14%' }}>CONTACT</th>
                <th style={{ padding: '16px 20px', width: '12%' }}>PROJECT VALUE</th>
                <th style={{ padding: '16px 20px', width: '11%' }}>ADVANCE</th>
                <th style={{ padding: '16px 20px', width: '11%' }}>TOTAL RECEIVED</th>
                <th style={{ padding: '16px 20px', width: '11%' }}>RECEIVABLE</th>
                <th style={{ padding: '16px 20px', width: '11%' }}>STATUS</th>
                <th style={{ padding: '16px 20px', width: '8%', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#70829F' }}>
                    Loading site owners...
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#70829F' }}>
                    No site owners found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item) => {
                  const isPaymentDue = (item.status || '').toLowerCase() === 'payment due'
                  const statusBg = isPaymentDue ? '#FEF3C7' : '#D1FAE5'
                  const statusColor = isPaymentDue ? '#D97706' : '#059669'

                  return (
                    <tr key={item._id || item.id} className="site-data-row">
                      {/* CLIENT */}
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 500 }}>
                        {item.name}
                      </td>

                      {/* ASSOCIATED SITE */}
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#172033' }}>
                        {item.siteName || 'Aarav Heights'}
                      </td>

                      {/* CONTACT */}
                      <td style={{ padding: '16px 20px', color: '#70829F', fontWeight: 400 }}>
                        {item.phone || '+91234567892'}
                      </td>

                      {/* PROJECT VALUE */}
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 400 }}>
                        {formatTableAmount(item.projectValue)}
                      </td>

                      {/* ADVANCE */}
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 400 }}>
                        {formatTableAmount(item.advanceAmount)}
                      </td>

                      {/* TOTAL RECEIVED */}
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 400 }}>
                        {formatTableAmount(item.totalReceived)}
                      </td>

                      {/* RECEIVABLE */}
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 400 }}>
                        {formatTableAmount(item.receivable)}
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: statusBg,
                            color: statusColor,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.status || 'On schedule'}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {/* View */}
                          <button
                            type="button"
                            title="View client details"
                            onClick={() => setViewingClient(item)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '6px',
                              border: '1px solid #E5EAF1', background: '#F8FAFC',
                              color: '#0293DE', cursor: 'pointer', transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#E0F2FE'; e.currentTarget.style.borderColor = '#0293DE'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E5EAF1'; }}
                          >
                            <Eye size={14} strokeWidth={2} />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            title="Delete client"
                            onClick={() => handleDeleteClient(item.id || item._id, item.name)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '30px', height: '30px', borderRadius: '6px',
                              border: '1px solid #E5EAF1', background: '#F8FAFC',
                              color: '#EF4444', cursor: 'pointer', transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.borderColor = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E5EAF1'; }}
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Scrollbar Indicator Bar */}
        <div style={{ padding: '16px 20px 0 20px' }}>
          <div
            style={{
              height: '4px',
              background: '#F1F5F9',
              borderRadius: '2px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '18%',
                background: '#CBD5E1',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>

        {/* 5. Pagination Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 0 20px',
            fontSize: '13px',
            color: '#70829F',
          }}
        >
          <div>
            Showing {totalRecords === 0 ? 0 : startIndex + 1}-{endIndex} of {totalRecords} records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={activePage <= 1}
              onClick={() => handlePageChange(activePage - 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #E5EAF1',
                background: '#FFFFFF',
                color: activePage <= 1 ? '#94A3B8' : '#172033',
                cursor: activePage <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
              }}
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>

            {[...Array(totalPages)].map((_, idx) => {
              const p = idx + 1
              const isSelected = p === activePage
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePageChange(p)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: isSelected ? 'none' : '1px solid #E5EAF1',
                    background: isSelected ? '#172033' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : '#172033',
                    fontSize: '12px',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              )
            })}

            <button
              type="button"
              disabled={activePage >= totalPages}
              onClick={() => handlePageChange(activePage + 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #E5EAF1',
                background: '#FFFFFF',
                color: activePage >= totalPages ? '#94A3B8' : '#172033',
                cursor: activePage >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: '12px',
              }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
