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
  Trash2,
} from 'lucide-react'
import { siteOwnerService } from '../services/siteOwnerService.js'
import SiteOwnerDetailPage from './SiteOwnerDetailPage.jsx'
import TablePagination from './TablePagination.jsx'

export default function SiteOwnersPage({
  sites = [],
  bankAccounts = [],
  onOpenAddClient,
  showNotification,
  refreshTrigger = 0,
  onPaymentRecorded,
  onClientsChanged,
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
  const [pageSize, setPageSize] = useState(10)
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

  const displayList = clients.length > 0 ? clients : []

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
      if (onClientsChanged) onClientsChanged()
    } catch (err) {
      console.error('Delete failed:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: 'Failed to delete client.' })
      }
    }
  }

  // Format amounts using proper Indian currency format (no L/Cr abbreviations)
  const formatCostValue = (amount, fallback) => {
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
      return fallback || '₹0'
    }
    const num = Number(amount)
    return `₹${Math.round(num).toLocaleString('en-IN')}`
  }

  // Format table amounts using proper Indian currency format (no L/Cr abbreviations)
  const formatTableAmount = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0'
    const num = Number(amount)
    if (num === 0) return '₹0'
    return `₹${Math.round(num).toLocaleString('en-IN')}`
  }

  // If a client was selected for detailed view, show the full details page matching screenshot
  if (viewingClient) {
    return (
      <SiteOwnerDetailPage
        clientId={viewingClient._id || viewingClient.id}
        client={viewingClient}
        bankAccounts={bankAccounts}
        onBack={() => {
          setViewingClient(null)
          fetchSiteOwners()
        }}
        showNotification={showNotification}
        onPaymentRecorded={onPaymentRecorded}
        onClientsChanged={onClientsChanged}
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
            {summary?.count !== undefined ? summary.count : clients.length}
          </div>
          <span className="stat-desc">Across {summary?.count !== undefined ? summary.count : clients.length} projects</span>
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
            {formatCostValue(summary?.totalProject, '₹0')}
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
            {formatCostValue(summary?.totalReceived, '₹0')}
          </div>
          <span className="stat-desc">
            {summary?.totalProject > 0
              ? `${Math.round(((summary?.totalReceived || 0) / summary.totalProject) * 100)}% collected`
              : '0% collected'}
          </span>
        </div>

        {/* Card 4: Pending */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Pending</span>
            <div className="stat-icon-wrap stat-icon-rose">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-value">
            {formatCostValue(summary?.balance, '₹0')}
          </div>
          <span className="stat-desc">Across active projects</span>
        </div>
      </div>

      {/* 4. Site Owners Table Card with Search and Filters inside */}
      <div className="sites-table-card">
        {/* 3. Filter Row: Search on Left, 3 Dropdowns on Right */}
        <div className="sites-filter-row">
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
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
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
                  const rawStatus = (item.status || 'Active').trim()
                  const isCompleted = rawStatus.toLowerCase() === 'completed'
                  const isOnHold = rawStatus.toLowerCase() === 'on hold'
                  const pillClass = isCompleted
                    ? 'status-completed'
                    : isOnHold
                    ? 'status-onhold'
                    : 'status-inprogress'

                  return (
                    <tr key={item._id || item.id} className="site-data-row">
                      {/* CLIENT */}
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 500 }}>
                        {item.name || '-'}
                      </td>

                      {/* ASSOCIATED SITE */}
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#172033' }}>
                        {item.siteName || '-'}
                      </td>

                      {/* CONTACT */}
                      <td style={{ padding: '16px 20px', color: '#70829F', fontWeight: 400 }}>
                        {item.phone || '-'}
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
                        <span className={`site-status-pill ${pillClass}`}>
                          {item.status || 'Active'}
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
          style={{ padding: '16px 20px 0 20px', margin: 0 }}
        />
      </div>

    </div>
  )
}
