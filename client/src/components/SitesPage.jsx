import React, { useState } from 'react'
import {
  Building2,
  TrendingUp,
  Activity,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  X,
} from 'lucide-react'
import { siteService } from '../services/siteService.js'
import { bankAccountService } from '../services/bankAccountService.js'
import SiteDetailPage from './SiteDetailPage.jsx'

export default function SitesPage({
  sites = [],
  expenses = [],
  onOpenAddSite,
  onOpenAddExpense,
  loading = false,
  onSitesChanged,
  showNotification,
}) {
  const [selectedSiteForDetail, setSelectedSiteForDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [sortFilter, setSortFilter] = useState('Newest First')

  // Dynamic Pagination State
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const sampleSites = [
    {
      _id: 's1',
      date: '11/08/2026',
      name: 'Greenfield Villa',
      particulars: 'Shreedhar patil',
      budget: '₹42.0 L',
      totalSpent: '00',
      remaining: '00',
      status: 'In Progress',
    },
    {
      _id: 's2',
      date: '11/08/2026',
      name: "Aarav Height's",
      particulars: 'Shreedhar patil',
      budget: '₹42.0 L',
      totalSpent: '00',
      remaining: '00',
      status: 'In Progress',
    },
    {
      _id: 's3',
      date: '11/08/2026',
      name: "Aarav Height's",
      particulars: 'Shreedhar patil',
      budget: '₹42.0 L',
      totalSpent: '00',
      remaining: '00',
      status: 'In Progress',
    },
    {
      _id: 's4',
      date: '11/08/2026',
      name: "Aarav Height's",
      particulars: 'Shreedhar patil',
      budget: '₹42.0 L',
      totalSpent: '00',
      remaining: '00',
      status: 'Completed',
    },
  ]

  const formatIndianBudget = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0'
    const num = Number(amount)
    if (num === 0) return '₹0'
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`
    return `₹${num.toLocaleString('en-IN')}`
  }

  // Combine MongoDB sites with reference structure
  const displayRows = sites.length > 0
    ? sites.map((s, idx) => {
        const budget = Number(s.totalBudget !== undefined ? s.totalBudget : (s.projectValue || 0))
        const received = Number(s.totalReceived || 0)
        const spent = Number(s.totalSpent || 0)
        const balanceReceivable = Math.max(0, budget - received)
        const remainingBudget = Math.max(0, budget - spent)

        return {
          _id: s._id || `site-${idx}`,
          raw: s,
          date: s.startDate
            ? new Date(s.startDate).toLocaleDateString('en-GB')
            : s.createdAt
            ? new Date(s.createdAt).toLocaleDateString('en-GB')
            : '11/08/2026',
          name: s.name || "Aarav Height's",
          particulars: s.siteOwner || 'Shreedhar patil',
          budget: formatIndianBudget(budget),
          totalReceived: formatIndianBudget(received),
          totalSpent: formatIndianBudget(spent),
          balanceReceivable: formatIndianBudget(balanceReceivable),
          remaining: formatIndianBudget(remainingBudget),
          status: s.status === 'Completed' ? 'Completed' : (s.status === 'On Hold' || s.status === 'On hold') ? 'On hold' : 'In Progress',
        }
      })
    : sampleSites.map((s) => ({
        ...s,
        raw: s,
        totalReceived: '₹0',
        balanceReceivable: s.budget || '₹0',
      }))

  // Filter rows
  const filteredRows = displayRows.filter((row) => {
    const matchesSearch =
      !search ||
      row.name.toLowerCase().includes(search.toLowerCase()) ||
      row.particulars.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'All Status' ||
      row.status.toLowerCase() === statusFilter.toLowerCase()

    const matchesSite =
      siteFilter === 'All Sites' || row.name === siteFilter

    return matchesSearch && matchesStatus && matchesSite
  })

  // Dynamic Pagination Calculations
  const totalRecords = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))

  // Calculate actual counts from the dataset
  const actualTotalSites = displayRows.length
  const inProgressSites = displayRows.filter((s) => s.status === 'In Progress' || s.status === 'Active').length
  const completedSites = displayRows.filter((s) => s.status === 'Completed').length
  const onHoldSites = displayRows.filter((s) => s.status === 'On hold' || s.status === 'On Hold').length

  const inProgressPercent = actualTotalSites > 0 ? Math.round((inProgressSites / actualTotalSites) * 100) : 0

  // Calculate completed delivered budget
  const completedDeliveredAmount = (sites.length > 0 ? sites : [])
    .filter((s) => s.status === 'Completed')
    .reduce((sum, s) => sum + (s.totalBudget || 0), 0)
  const deliveredText = completedDeliveredAmount > 0
    ? `${formatIndianBudget(completedDeliveredAmount)} delivered`
    : '0 delivered'

  // Ensure current page is valid when dataset or page size changes
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const currentRecords = filteredRows.slice(startIndex, endIndex)

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Generate pagination items with ellipses
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

  // Action Modals State
  const [viewingSite, setViewingSite] = useState(null)
  const [editingSite, setEditingSite] = useState(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    location: '',
    siteOwner: '',
    contactNumber: '',
    email: '',
    address: '',
    projectValue: '',
    advanceAmount: '',
    totalReceived: 0,
    bankAccountId: '',
    additionalReceived: '0',
    startDate: '',
    expectedCompletionDate: '',
    status: 'Active',
    description: '',
  })
  const [editBankAccounts, setEditBankAccounts] = useState([])
  const [editLoadingBanks, setEditLoadingBanks] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // View handler - opens full Site Details Page matching reference design
  const handleView = (row) => {
    setSelectedSiteForDetail(row.raw || row)
  }

  // Edit handler
  const handleEdit = async (row) => {
    const raw = row.raw || row
    setEditingSite(raw)
    setEditFormData({
      name: raw.name || row.name || '',
      location: raw.location || '',
      siteOwner: raw.siteOwner || row.particulars || '',
      contactNumber: raw.contactNumber || '',
      email: raw.email || '',
      address: raw.address || '',
      projectValue:
        raw.totalBudget !== undefined && raw.totalBudget !== null
          ? raw.totalBudget
          : raw.projectValue !== undefined
          ? raw.projectValue
          : '',
      advanceAmount: raw.advanceAmount || 0,
      totalReceived: raw.totalReceived || 0,
      bankAccountId: raw.bankAccountId || '',
      additionalReceived: '0',
      startDate: raw.startDate ? raw.startDate.slice(0, 10) : '',
      expectedCompletionDate: raw.expectedCompletionDate
        ? raw.expectedCompletionDate.slice(0, 10)
        : '',
      status:
        raw.status || (row.status === 'Completed' ? 'Completed' : row.status === 'On hold' ? 'On Hold' : 'Active'),
      description: raw.description || '',
    })
    // Load bank accounts
    setEditLoadingBanks(true)
    try {
      const banks = await bankAccountService.getAll()
      setEditBankAccounts(Array.isArray(banks) ? banks : [])
    } catch (_) {
      setEditBankAccounts([])
    } finally {
      setEditLoadingBanks(false)
    }
  }

  // Submit Edit
  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!editingSite) return

    // --- Frontend validation ---
    if (!editFormData.name.trim()) {
      showNotification && showNotification({ type: 'error', message: 'Site name is required' })
      return
    }
    if (!editFormData.siteOwner.trim()) {
      showNotification && showNotification({ type: 'error', message: 'Site owner / client is required' })
      return
    }
    if (!editFormData.contactNumber.trim()) {
      showNotification && showNotification({ type: 'error', message: 'Contact number is required' })
      return
    }
    if (!editFormData.location.trim()) {
      showNotification && showNotification({ type: 'error', message: 'Location is required' })
      return
    }
    if (editFormData.email && editFormData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(editFormData.email.trim())) {
        showNotification && showNotification({ type: 'error', message: 'Invalid email address format' })
        return
      }
    }
    if (
      editFormData.startDate &&
      editFormData.expectedCompletionDate &&
      editFormData.expectedCompletionDate < editFormData.startDate
    ) {
      showNotification && showNotification({ type: 'error', message: 'Expected completion date cannot be earlier than start date' })
      return
    }
    const addlReceived = Number(editFormData.additionalReceived || 0)
    if (addlReceived > 0 && !editFormData.bankAccountId) {
      showNotification && showNotification({ type: 'error', message: 'Please select a bank account to record this payment' })
      return
    }

    try {
      setUpdating(true)
      const isSample =
        !editingSite._id ||
        String(editingSite._id).startsWith('site-') ||
        String(editingSite._id).startsWith('s')
      if (!isSample) {
        await siteService.update(editingSite._id, {
          name: editFormData.name,
          location: editFormData.location,
          siteOwner: editFormData.siteOwner,
          contactNumber: editFormData.contactNumber,
          email: editFormData.email,
          address: editFormData.address,
          projectValue: Number(editFormData.projectValue),
          advanceAmount: Number(editFormData.advanceAmount || 0),
          bankAccountId: editFormData.bankAccountId || null,
          additionalReceived: addlReceived,
          startDate: editFormData.startDate || null,
          expectedCompletionDate: editFormData.expectedCompletionDate || null,
          status: editFormData.status,
          description: editFormData.description,
        })
      }
      if (showNotification) {
        showNotification({ type: 'success', message: `Site "${editFormData.name}" updated successfully!` })
      }
      if (onSitesChanged) onSitesChanged()
      setEditingSite(null)
    } catch (err) {
      if (showNotification) {
        showNotification({ type: 'error', message: err.message || 'Failed to update site' })
      }
    } finally {
      setUpdating(false)
    }
  }

  // Delete handler
  const handleDelete = async (row) => {
    const siteName = row.name || 'this site'
    if (!window.confirm(`Are you sure you want to delete "${siteName}"?`)) {
      return
    }

    try {
      setDeletingId(row._id)
      if (row._id && !row._id.startsWith('site-') && !row._id.startsWith('s')) {
        await siteService.delete(row._id)
      }
      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Site "${siteName}" deleted successfully!`,
        })
      }
      if (onSitesChanged) onSitesChanged()
    } catch (err) {
      if (showNotification) {
        showNotification({
          type: 'error',
          message: err.message || 'Failed to delete site. Please ensure it has no attached expenses.',
        })
      }
    } finally {
      setDeletingId(null)
    }
  }

  // If a site is selected for details, render the dedicated SiteDetailPage
  if (selectedSiteForDetail) {
    return (
      <SiteDetailPage
        site={selectedSiteForDetail}
        expenses={expenses}
        onBack={() => setSelectedSiteForDetail(null)}
        onOpenAddExpense={onOpenAddExpense}
      />
    )
  }

  return (
    <div className="sites-page">
      {/* 1. Breadcrumb & Title Row */}
      <div className="sites-header-wrap">
        <div className="sites-header-left">
          <div className="sites-breadcrumb">
            <span className="breadcrumb-root">WORKSPACE</span>
            <span className="breadcrumb-slash">/</span>
            <span className="breadcrumb-active">SITES</span>
          </div>
          <h1 className="sites-title">Sites</h1>
          <p className="sites-subtitle">Manage projects, progress and financial health in one place.</p>
        </div>

        <button type="button" className="btn btn-primary-action btn-add-site-header" onClick={onOpenAddSite}>
          <Plus size={16} />
          <span>Add Site</span>
        </button>
      </div>

      {/* 2. Top Summary Stat Cards (4 in a row) */}
      <div className="sites-stat-grid">
        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-blue">
            <Building2 size={18} />
          </div>
          <span className="stat-label">Total Sites</span>
          <div className="stat-value">{actualTotalSites}</div>
          <span className="stat-desc">{inProgressSites} currently active</span>
        </div>

        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-green">
            <TrendingUp size={18} />
          </div>
          <span className="stat-label">Sites In Progress</span>
          <div className="stat-value">{inProgressSites}</div>
          <span className="stat-desc">{inProgressPercent}% of all projects</span>
        </div>

        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-orange">
            <TrendingUp size={18} />
          </div>
          <span className="stat-label">Completed</span>
          <div className="stat-value">{completedSites}</div>
          <span className="stat-desc">{deliveredText}</span>
        </div>

        <div className="site-stat-card">
          <div className="stat-icon-wrap stat-icon-purple">
            <Activity size={18} />
          </div>
          <span className="stat-label">On hold</span>
          <div className="stat-value">{onHoldSites}</div>
          <span className="stat-desc">Awaiting client approval</span>
        </div>
      </div>

      {/* 3. Search and Dropdown Filter Row */}
      <div className="sites-filter-row">
        <div className="sites-search-box">
          <Search size={16} className="sites-search-icon" />
          <input
            type="text"
            className="sites-search-input"
            placeholder="Search sites, clients, suppliers..."
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
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On hold">On hold</option>
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
              <option value="Budget High-Low">Budget High-Low</option>
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>
        </div>
      </div>

      {/* 4. All Sites Table Container Box */}
      <div className="sites-table-card">
        <div className="sites-table-card-header">
          <h2 className="sites-table-title">All Sites</h2>
          <p className="sites-table-subtitle">Manage projects, progress and financial health in one place.</p>
        </div>

        <div className="sites-table-scroll">
          <table className="sites-table">
            <thead>
              <tr>
                <th className="th-site-date">DATE</th>
                <th className="th-site-name">SITE</th>
                <th className="th-site-owner">PARTICULAR'S</th>
                <th className="th-site-budget">PROJECT BUDGET</th>
                <th className="th-site-received">TOTAL RECEIVED</th>
                <th className="th-site-spent">TOTAL SPENT</th>
                <th className="th-site-rem">BALANCE RECEIVABLE</th>
                <th className="th-site-status">STATUS</th>
                <th className="th-site-actions">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={i} className="skeleton-row">
                    <td colSpan={9}>
                      <div className="skeleton-line" style={{ height: '24px', margin: '6px 0' }} />
                    </td>
                  </tr>
                ))
              ) : currentRecords.length > 0 ? (
                currentRecords.map((row) => (
                  <tr key={row._id} className="site-data-row">
                    <td className="td-site-date">{row.date}</td>
                    <td className="td-site-name">{row.name}</td>
                    <td className="td-site-owner">{row.particulars}</td>
                    <td className="td-site-budget">{row.budget}</td>
                    <td className="td-site-received">{row.totalReceived}</td>
                    <td className="td-site-spent">{row.totalSpent}</td>
                    <td className="td-site-rem">{row.balanceReceivable}</td>
                    <td className="td-site-status">
                      <span
                        className={`site-status-pill ${
                          row.status === 'Completed'
                            ? 'status-completed'
                            : row.status === 'On hold'
                            ? 'status-onhold'
                            : 'status-inprogress'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="td-site-actions">
                      <div className="site-actions-group">
                        <button
                          type="button"
                          className="site-action-btn site-action-btn-view"
                          title="View Site Details"
                          onClick={() => handleView(row)}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="site-action-btn site-action-btn-edit"
                          title="Edit / Update Site"
                          onClick={() => handleEdit(row)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="site-action-btn site-action-btn-delete"
                          title="Delete Site"
                          disabled={deletingId === row._id}
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="td-empty">
                    No site records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Scroll indicator bar under table */}
        <div className="sites-scrollbar-indicator">
          <div className="scrollbar-thumb-indicator" />
        </div>

        {/* 5. Dynamic Pagination Footer */}
        <div className="sites-pagination-row">
          <div className="pagination-left">
            <span className="pagination-show-label">Show</span>
            <div className="pagination-page-size-select-wrap">
              <select
                className="pagination-page-size-select"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
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

      {/* View Site Modal */}
      {viewingSite && (
        <div className="modal-overlay" onClick={() => setViewingSite(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-icon-badge">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="modal-title">{viewingSite.name || 'Site Details'}</h3>
                  <p className="modal-subtitle">Project parameters, status and budget</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingSite(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="site-view-details" style={{ padding: '20px 24px' }}>
              <div className="site-view-grid">
                <div className="site-view-item">
                  <span className="site-view-label">Site Name</span>
                  <span className="site-view-val">{viewingSite.name || '-'}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Location</span>
                  <span className="site-view-val">{viewingSite.location || 'Pune / Maharashtra'}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Client / Particular's</span>
                  <span className="site-view-val">{viewingSite.siteOwner || viewingSite.particulars || '-'}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Status</span>
                  <span className="site-view-val">{viewingSite.status || 'In Progress'}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Project Budget</span>
                  <span className="site-view-val">
                    {viewingSite.totalBudget !== undefined
                      ? formatIndianBudget(viewingSite.totalBudget)
                      : (viewingSite.budget || '-')}
                  </span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Total Received</span>
                  <span className="site-view-val">
                    {formatIndianBudget(viewingSite.totalReceived || 0)}
                  </span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Total Spent</span>
                  <span className="site-view-val">
                    {formatIndianBudget(viewingSite.totalSpent || 0)}
                  </span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Balance Receivable</span>
                  <span className="site-view-val">
                    {formatIndianBudget(
                      Math.max(
                        0,
                        Number(viewingSite.totalBudget !== undefined ? viewingSite.totalBudget : (viewingSite.projectValue || 0)) -
                          Number(viewingSite.totalReceived || 0)
                      )
                    )}
                  </span>
                </div>
                <div className="site-view-item full-width">
                  <span className="site-view-label">Description / Remarks</span>
                  <span className="site-view-val" style={{ fontWeight: 400, color: '#556987' }}>
                    {viewingSite.description || 'No additional description provided.'}
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px', padding: 0 }}>
                <button
                  type="button"
                  className="btn btn-primary-action"
                  onClick={() => setViewingSite(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Update Site Modal */}
      {editingSite && (
        <div className="modal-overlay" onClick={() => setEditingSite(null)}>
          <div className="modal-container" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-icon-badge">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Update Construction Site</h3>
                  <p className="modal-subtitle">Modify site details, owner info, and project finances</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingSite(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="modal-form">
              {/* ── Section A: Site & Owner Details ── */}
              <p style={{ fontSize: 12, fontWeight: 600, color: '#0293DE', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>
                Site &amp; Owner Details
              </p>
              <div className="modal-form-grid">
                <div className="form-group">
                  <label className="form-label">Site Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Number *</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editFormData.contactNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, contactNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Site Owner / Client *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.siteOwner}
                    onChange={(e) => setEditFormData({ ...editFormData, siteOwner: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Address / City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editFormData.startDate}
                    onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expected Completion</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editFormData.expectedCompletionDate}
                    onChange={(e) => setEditFormData({ ...editFormData, expectedCompletionDate: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Project Status</label>
                  <select
                    className="form-select"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  >
                    <option value="Active">In Progress / Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* ── Section B: Project Financial Details ── */}
              <p style={{ fontSize: 12, fontWeight: 600, color: '#0293DE', letterSpacing: '0.06em', margin: '18px 0 10px', textTransform: 'uppercase' }}>
                Project Financial Details
              </p>
              <div className="modal-form-grid">
                <div className="form-group">
                  <label className="form-label">Project Value (₹) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editFormData.projectValue}
                    onChange={(e) => setEditFormData({ ...editFormData, projectValue: e.target.value })}
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Advance Amount (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editFormData.advanceAmount}
                    onChange={(e) => setEditFormData({ ...editFormData, advanceAmount: e.target.value })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Received (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editFormData.totalReceived}
                    readOnly
                    style={{ background: '#f5f7fa', cursor: 'not-allowed', color: '#6b7c96' }}
                    tabIndex={-1}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bank Account</label>
                  <select
                    className="form-select"
                    value={editFormData.bankAccountId}
                    onChange={(e) => setEditFormData({ ...editFormData, bankAccountId: e.target.value })}
                    disabled={editLoadingBanks}
                  >
                    <option value="">
                      {editLoadingBanks ? 'Loading banks...' : '— Select Bank Account —'}
                    </option>
                    {editBankAccounts.map((bank) => (
                      <option key={bank._id || bank.id} value={bank._id || bank.id}>
                        {bank.bankName} •••• {String(bank.accountNumber || '').slice(-4)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Additional Amount Received Now (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editFormData.additionalReceived}
                    onChange={(e) => setEditFormData({ ...editFormData, additionalReceived: e.target.value })}
                    min="0"
                    placeholder="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Balance Receivable (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={
                      Math.max(
                        0,
                        Number(editFormData.projectValue || 0) -
                          Number(editFormData.totalReceived || 0) -
                          Number(editFormData.additionalReceived || 0)
                      )
                    }
                    readOnly
                    style={{ background: '#f5f7fa', cursor: 'not-allowed', color: '#6b7c96' }}
                    tabIndex={-1}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Description / Remarks</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary-action"
                  onClick={() => setEditingSite(null)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary-action"
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
