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
  CreditCard,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { siteService } from '../services/siteService.js'
import { bankAccountService } from '../services/bankAccountService.js'
import SiteDetailPage from './SiteDetailPage.jsx'
import MakeSitePaymentModal from './MakeSitePaymentModal.jsx'
import TablePagination from './TablePagination.jsx'

export default function SitesPage({
  sites = [],
  expenses = [],
  onOpenAddSite,
  onOpenAddExpense,
  loading = false,
  onSitesChanged,
  onRefreshAccounts,
  showNotification,
  hideHeader = false,
  onViewSite,
}) {
  const [selectedSiteForDetail, setSelectedSiteForDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [sortFilter, setSortFilter] = useState('Newest First')

  // Dynamic Pagination State
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Dynamic sites only

  const formatIndianBudget = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0'
    const num = Number(amount)
    if (num === 0) return '₹0'
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`
    return `₹${num.toLocaleString('en-IN')}`
  }

  // Combine MongoDB sites with reference structure
  const displayRows = (sites || []).map((s, idx) => {
    const budget = Number(s.totalBudget !== undefined ? s.totalBudget : (s.projectValue || 0))
    const received = Number(s.totalReceived || 0)
    const spent = Number(s.totalSpent || 0)
    const balanceReceivable = Math.max(0, budget - received)
    const remainingBudget = Math.max(0, budget - spent)

    return {
      _id: s._id || s.id || `site-${idx}`,
      raw: s,
      date: s.startDate
        ? new Date(s.startDate).toLocaleDateString('en-GB')
        : s.createdAt
        ? new Date(s.createdAt).toLocaleDateString('en-GB')
        : '-',
      name: s.name || 'Unnamed Site',
      particulars: s.siteOwner || s.particulars || s.clientName || '-',
      budget: formatIndianBudget(budget),
      totalReceived: formatIndianBudget(received),
      totalSpent: formatIndianBudget(spent),
      balanceReceivable: formatIndianBudget(balanceReceivable),
      rawPending: balanceReceivable,
      remaining: formatIndianBudget(remainingBudget),
      status: s.status === 'Completed' ? 'Completed' : (s.status === 'On Hold' || s.status === 'On hold') ? 'On hold' : 'In Progress',
    }
  })

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
  const [payingSite, setPayingSite] = useState(null)
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
  const [deleteConfirmSite, setDeleteConfirmSite] = useState(null)

  // View handler - opens full Site Details Page matching reference design
  const handleView = (row) => {
    const target = row.raw || row
    if (onViewSite) {
      onViewSite(target)
    } else {
      setSelectedSiteForDetail(target)
    }
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
    } catch {
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
    try {
      setUpdating(true)
      if (editingSite && editingSite._id) {
        await siteService.update(editingSite._id, {
          name: editFormData.name,
          location: editFormData.location,
          siteOwner: editFormData.siteOwner,
          contactNumber: editFormData.contactNumber,
          email: editFormData.email,
          address: editFormData.address,
          projectValue: Number(editFormData.projectValue),
          advanceAmount: Number(editFormData.advanceAmount || 0),
          totalReceived: Number(editFormData.totalReceived || 0),
          bankAccountId: editFormData.bankAccountId || null,
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
      if (onRefreshAccounts) onRefreshAccounts()
      setEditingSite(null)
    } catch (err) {
      if (showNotification) {
        showNotification({ type: 'error', message: err.message || 'Failed to update site' })
      }
    } finally {
      setUpdating(false)
    }
  }

  // Delete click opens popup box instead of browser alert
  const handleDelete = (row) => {
    setDeleteConfirmSite(row)
  }

  // Confirmed delete execution
  const handleConfirmDelete = async () => {
    if (!deleteConfirmSite) return
    const row = deleteConfirmSite
    const siteName = row.name || 'this site'

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
      setDeleteConfirmSite(null)
      if (onSitesChanged) onSitesChanged()
      if (onRefreshAccounts) onRefreshAccounts()
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
      {!hideHeader && (
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
      )}

      {/* 2. Top Summary Stat Cards (4 in a row) */}
      {!hideHeader && (
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
      )}

      {/* 4. All Sites Table Container Box */}
      <div className="sites-table-card">
        <div className="sites-table-card-header">
          <h2 className="sites-table-title">All Sites</h2>
          <p className="sites-table-subtitle">Manage projects, progress and financial health in one place.</p>
        </div>

        {/* 3. Search and Dropdown Filter Row (Inside All Sites container, directly above table) */}
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
                <th className="th-site-rem">PENDING</th>
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
                          className="site-action-btn-pay"
                          title={(row.rawPending || 0) <= 0 ? 'Fully Paid' : 'Make Receive'}
                          disabled={(row.rawPending || 0) <= 0}
                          onClick={() => setPayingSite(row.raw || row)}
                        >
                          <CreditCard size={13} />
                          <span>Make Receive</span>
                        </button>
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

        {/* 5. Dynamic Pagination Footer */}
        <TablePagination
          currentPage={activePage}
          pageSize={pageSize}
          totalRecords={totalRecords}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {/* Make Site Client Payment Modal */}
      {payingSite && (
        <MakeSitePaymentModal
          isOpen={Boolean(payingSite)}
          site={payingSite}
          onClose={() => setPayingSite(null)}
          onPaymentSuccess={() => {
            setPayingSite(null)
            if (onSitesChanged) onSitesChanged()
            if (onRefreshAccounts) onRefreshAccounts()
          }}
          showNotification={showNotification}
        />
      )}

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
                  <span className="site-view-label">Pending</span>
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
              <div className="modal-body">
                {/* â”€â”€ Section A: Site & Owner Details â”€â”€ */}
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

              {/* â”€â”€ Section B: Project Financial Details â”€â”€ */}
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
                    onChange={(e) => setEditFormData({ ...editFormData, totalReceived: e.target.value })}
                    min="0"
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
                  <label className="form-label">Pending (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={
                      Math.max(
                        0,
                        Number(editFormData.projectValue || 0) -
                          Number(editFormData.totalReceived || 0)
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
              </div>{/* end modal-body */}

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

      {/* Delete Confirmation Modal Popup */}
      {deleteConfirmSite && (
        <div className="modal-overlay" onClick={() => !deletingId && setDeleteConfirmSite(null)}>
          <div
            className="modal-container"
            style={{ maxWidth: '440px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#172033' }}>
                  Delete Site?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748B' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.5', margin: '0 0 20px' }}>
              Are you sure you want to delete site{' '}
              <strong style={{ color: '#0F172A' }}>"{deleteConfirmSite.name || 'this site'}"</strong>?
              Please ensure it has no attached expenses or active records.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmSite(null)}
                disabled={Boolean(deletingId)}
                style={{
                  backgroundColor: '#F1F5F9',
                  color: '#475569',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1.5px solid #CBD5E1',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(deletingId)}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: deletingId ? 'default' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deletingId ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete Site</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
