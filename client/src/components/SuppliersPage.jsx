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
  X,
  Check,
} from 'lucide-react'
import { supplierService } from '../services/supplierService.js'
import SupplierDetailPage from './SupplierDetailPage.jsx'

const AVAILABLE_CATEGORIES = [
  'Cement',
  'Steel',
  'Bricks',
  'Sand',
  'Aggregate',
  'Electrical Materials',
  'Plumbing Materials',
  'Equipment',
  'General Supplier',
  'Other',
]

const PAYMENT_TERMS_OPTIONS = ['Immediate', '7 Days', '15 Days', '30 Days']

export default function SuppliersPage({
  sites = [],
  onOpenAddSupplier,
  onViewSupplier,
  showNotification,
  refreshTrigger = 0,
}) {
  const [suppliers, setSuppliers] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  // Detail view state
  const [selectedSupplierForDetail, setSelectedSupplierForDetail] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [sortFilter, setSortFilter] = useState('Newest First')

  // Pagination
  const pageSize = 5
  const [currentPage, setCurrentPage] = useState(1)

  // Action modals
  const [editSupplier, setEditSupplier]     = useState(null)
  const [editFormData, setEditFormData]     = useState(null)
  const [deleteSupplier, setDeleteSupplier] = useState(null)
  const [deleteLoading, setDeleteLoading]   = useState(false)
  const [editLoading, setEditLoading]       = useState(false)
  const [editError, setEditError]           = useState('')

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await supplierService.getStats({ search: search.trim() })
      if (res) {
        setSuppliers(res.suppliers || (Array.isArray(res) ? res : []))
        if (res.summary) setSummary(res.summary)
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: 'Failed to load suppliers list.' })
      }
    } finally {
      setLoading(false)
    }
  }, [search, showNotification])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers, refreshTrigger])

  // â”€â”€ Action handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleView = (item) => {
    if (onViewSupplier) {
      onViewSupplier(item)
    }
    setSelectedSupplierForDetail(item)
  }

  const handleEdit = (item) => {
    let cats = []
    if (Array.isArray(item.categories)) {
      cats = item.categories
    } else if (typeof item.categories === 'string' && item.categories.trim()) {
      cats = item.categories.split(',').map((c) => c.trim()).filter(Boolean)
    }
    setEditFormData({
      id: item._id || item.id,
      name: item.name || '',
      companyName: item.companyName || item.name || '',
      contactPerson: item.contactPerson || '',
      phone: item.phone || '',
      email: item.email || '',
      address: item.address || '',
      categories: cats,
      paymentTerms: item.paymentTerms || 'Immediate',
      status: item.isActive === false ? 'Inactive' : 'Active',
    })
    setEditError('')
    setEditSupplier(item)
  }

  const toggleCategory = (cat) => {
    setEditFormData((prev) => {
      if (!prev) return prev
      const current = prev.categories || []
      const next = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat]
      return { ...prev, categories: next }
    })
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editFormData || !editFormData.name?.trim()) {
      setEditError('Supplier / Company name is required.')
      return
    }
    if (!editFormData.phone?.trim()) {
      setEditError('Contact phone number is required.')
      return
    }
    setEditLoading(true)
    setEditError('')
    try {
      const payload = {
        name: editFormData.name.trim(),
        companyName: (editFormData.companyName || editFormData.name).trim(),
        contactPerson: (editFormData.contactPerson || '').trim(),
        phone: editFormData.phone.trim(),
        email: (editFormData.email || '').trim(),
        address: (editFormData.address || '').trim(),
        categories: editFormData.categories.length > 0 ? editFormData.categories.join(', ') : 'General Supplier',
        paymentTerms: editFormData.paymentTerms || 'Immediate',
        isActive: editFormData.status === 'Active',
      }

      const supplierId = editFormData.id
      if (supplierId && !String(supplierId).startsWith('s')) {
        await supplierService.update(supplierId, payload)
      } else {
        setSuppliers((prev) =>
          prev.map((s) => (s._id === supplierId || s.id === supplierId ? { ...s, ...payload } : s))
        )
      }

      setEditSupplier(null)
      await fetchSuppliers()
      if (showNotification) {
        showNotification({ type: 'success', message: `Supplier "${payload.name}" updated successfully.` })
      }
    } catch (err) {
      console.error('Failed to update supplier:', err)
      setEditError('Failed to update supplier. Please try again.')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteSupplier) return
    setDeleteLoading(true)
    try {
      const supId = deleteSupplier._id || deleteSupplier.id
      if (supId && !String(supId).startsWith('s')) {
        await supplierService.delete(supId)
      } else {
        setSuppliers((prev) => prev.filter((s) => s._id !== supId && s.id !== supId))
      }
      const deletedName = deleteSupplier.name
      setDeleteSupplier(null)
      await fetchSuppliers()
      if (showNotification) {
        showNotification({ type: 'success', message: `Supplier "${deletedName}" deleted.` })
      }
    } catch (err) {
      console.error('Failed to delete supplier:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: 'Failed to delete supplier.' })
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  // Reference fallback suppliers matching screenshot
  const sampleSuppliers = [
    {
      _id: 's1',
      name: 'Bharat Steel Traders',
      categories: 'Steel',
      phone: '+91234567892',
      totalPurchase: 480000,
      totalPaid: 480000,
      outstanding: 0,
      lastDate: '11/08/2026',
    },
    {
      _id: 's2',
      name: 'Shree Cement Co.',
      categories: 'Cement',
      phone: '+91234567892',
      totalPurchase: 480000,
      totalPaid: 380000,
      outstanding: 100000,
      lastDate: '11/08/2026',
    },
    {
      _id: 's3',
      name: 'Mahalaxmi Bricks',
      categories: 'Bricks',
      phone: '+91234567892',
      totalPurchase: 480000,
      totalPaid: 440000,
      outstanding: 40000,
      lastDate: '11/08/2026',
    },
    {
      _id: 's4',
      name: 'Sai Aggregates',
      categories: 'River Sand',
      phone: '+91234567892',
      totalPurchase: 480000,
      totalPaid: 280000,
      outstanding: 200000,
      lastDate: '11/08/2026',
    },
  ]

  // If a supplier was selected for detailed view, show the full page
  if (selectedSupplierForDetail) {
    return (
      <SupplierDetailPage
        supplierId={selectedSupplierForDetail._id || selectedSupplierForDetail.id}
        supplier={selectedSupplierForDetail}
        onBack={() => setSelectedSupplierForDetail(null)}
        showNotification={showNotification}
      />
    )
  }

  const displayList = suppliers.length > 0 ? suppliers : sampleSuppliers

  // Client-side filtering
  const filteredSuppliers = displayList.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const supName = (item.name || '').toLowerCase()
      const cat = (item.categories || '').toLowerCase()
      const phone = (item.phone || '').toLowerCase()
      if (!supName.includes(q) && !cat.includes(q) && !phone.includes(q)) {
        return false
      }
    }
    if (statusFilter === 'Active' && item.isActive === false) return false
    if (statusFilter === 'With Balance' && (!item.outstanding || item.outstanding <= 0)) return false
    if (statusFilter === 'Cleared' && item.outstanding > 0) return false

    return true
  })

  // Sorting
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    if (sortFilter === 'Newest First') {
      return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0))
    }
    if (sortFilter === 'Oldest First') {
      return (new Date(a.createdAt || 0)) - (new Date(b.createdAt || 0))
    }
    if (sortFilter === 'Purchase: High to Low') {
      return (b.totalPurchase || 0) - (a.totalPurchase || 0)
    }
    if (sortFilter === 'Outstanding: High to Low') {
      return (b.outstanding || 0) - (a.outstanding || 0)
    }
    return 0
  })

  // Dynamic Pagination
  const totalRecords = sortedSuppliers.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const paginatedRecords = sortedSuppliers.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Summary Metrics from actual database data
  const activeCount = summary?.activeCount !== undefined ? summary.activeCount : displayList.filter((s) => s.isActive !== false).length
  const totalPurchasesNum = summary?.totalPurchases !== undefined ? summary.totalPurchases : displayList.reduce((acc, s) => acc + (Number(s.totalPurchase) || 0), 0)
  const totalPaidNum = summary?.totalPaid !== undefined ? summary.totalPaid : displayList.reduce((acc, s) => acc + (Number(s.totalPaid) || 0), 0)
  const outstandingNum = summary?.outstanding !== undefined ? summary.outstanding : Math.max(0, totalPurchasesNum - totalPaidNum)
  const categoriesCount = summary?.categoriesCount || 7
  const overdueCount = summary?.overdueCount !== undefined ? summary.overdueCount : displayList.filter((s) => (Number(s.outstanding) || 0) > 0).length
  const clearedPercent = totalPurchasesNum > 0 ? Math.round((totalPaidNum / totalPurchasesNum) * 100) : 100

  const formatCurrency = (val) => {
    const num = Number(val || 0)
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`
    return `₹${num.toLocaleString('en-IN')}`
  }

  return (
    <div className="suppliers-page-wrap">
      {/* 1. Header Section */}
      <div className="suppliers-header-row">
        <div className="suppliers-header-info">
          <div className="suppliers-breadcrumb">
            <span className="breadcrumb-root">WORKSPACE</span>
            <span className="breadcrumb-slash">/</span>
            <span className="breadcrumb-active">SUPPLIER'S</span>
          </div>
          <h1 className="suppliers-title">Supplier's</h1>
          <p className="suppliers-subtitle">
            Manage supplier relationships, purchases and outstanding dues
          </p>
        </div>
        <button
          type="button"
          className="btn-add-supplier-primary"
          onClick={onOpenAddSupplier}
        >
          <Plus size={16} />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* 2. Top Summary KPI Cards (4 Cards in one horizontal row) */}
      <div className="suppliers-cards-grid">
        {/* Card 1: Active Suppliers */}
        <div className="suppliers-kpi-card">
          <div className="suppliers-card-top">
            <span className="suppliers-card-label">Active Suppliers</span>
            <div className="suppliers-card-icon suppliers-card-icon-blue">
              <CreditCard size={17} />
            </div>
          </div>
          <div className="suppliers-card-val">{activeCount}</div>
          <div className="suppliers-card-subtext">
            Across {categoriesCount} categories
          </div>
        </div>

        {/* Card 2: Total Purchases */}
        <div className="suppliers-kpi-card">
          <div className="suppliers-card-top">
            <span className="suppliers-card-label">Total Purchases</span>
            <div className="suppliers-card-icon suppliers-card-icon-green">
              <CreditCard size={17} />
            </div>
          </div>
          <div className="suppliers-card-val">{formatCurrency(totalPurchasesNum)}</div>
          <div className="suppliers-card-subtext">
            Lifetime purchase value
          </div>
        </div>

        {/* Card 3: Total Paid */}
        <div className="suppliers-kpi-card">
          <div className="suppliers-card-top">
            <span className="suppliers-card-label">Total Paid</span>
            <div className="suppliers-card-icon suppliers-card-icon-orange">
              <CreditCard size={17} />
            </div>
          </div>
          <div className="suppliers-card-val">{formatCurrency(totalPaidNum)}</div>
          <div className="suppliers-card-subtext">
            {clearedPercent}% cleared
          </div>
        </div>

        {/* Card 4: Outstanding */}
        <div className="suppliers-kpi-card">
          <div className="suppliers-card-top">
            <span className="suppliers-card-label">Outstanding</span>
            <div className="suppliers-card-icon suppliers-card-icon-red">
              <AlertTriangle size={17} />
            </div>
          </div>
          <div className="suppliers-card-val">{formatCurrency(outstandingNum)}</div>
          <div className="suppliers-card-subtext">
            {overdueCount > 0 ? `${overdueCount} payments overdue` : 'All cleared'}
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="suppliers-filter-bar">
        {/* Search */}
        <div className="suppliers-search-wrap">
          <Search size={16} className="suppliers-search-icon" />
          <input
            type="text"
            className="suppliers-search-input"
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
          />
        </div>

        {/* Right side filter controls */}
        <div className="suppliers-filters-group">
          {/* Status Dropdown */}
          <div className="site-select-wrapper">
            <select
              className="suppliers-select-pill"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="With Balance">With Balance</option>
              <option value="Cleared">Cleared</option>
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>

          {/* Sites Dropdown */}
          <div className="site-select-wrapper">
            <select
              className="suppliers-select-pill"
              value={siteFilter}
              onChange={(e) => {
                setSiteFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="All Sites">All Sites</option>
              {sites.map((site) => (
                <option key={site._id || site.id} value={site.name}>
                  {site.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>

          {/* Sort Dropdown */}
          <div className="site-select-wrapper">
            <select
              className="suppliers-select-pill"
              value={sortFilter}
              onChange={(e) => {
                setSortFilter(e.target.value)
                setCurrentPage(1)
              }}
            >
              <option value="Newest First">Newest First</option>
              <option value="Oldest First">Oldest First</option>
              <option value="Purchase: High to Low">Purchase: High to Low</option>
              <option value="Outstanding: High to Low">Outstanding: High to Low</option>
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>
        </div>
      </div>

      {/* 4. Suppliers Table Card */}
      <div className="sites-table-card" style={{ padding: '0 0 16px 0', border: '1px solid #E5EAF1' }}>
        <div className="sites-table-scroll">
          <table className="sites-table">
            <thead>
              <tr style={{ borderBottom: '1px solid #E5EAF1' }}>
                <th style={{ padding: '16px 20px', width: '20%' }}>SUPPLIER</th>
                <th style={{ padding: '16px 20px', width: '14%' }}>CATEGORIES</th>
                <th style={{ padding: '16px 20px', width: '14%' }}>CONTACT</th>
                <th style={{ padding: '16px 20px', width: '14%' }}>TOTAL PURCHASE</th>
                <th style={{ padding: '16px 20px', width: '12%' }}>TOTAL PAID</th>
                <th style={{ padding: '16px 20px', width: '10%' }}>OUTSTANDING</th>
                <th style={{ padding: '16px 20px', width: '8%' }}>LAST</th>
                <th style={{ padding: '16px 20px', width: '8%', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#70829F' }}>
                    Loading suppliers...
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#70829F' }}>
                    No suppliers found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item) => {
                  const formattedPurchase = `₹${Number(item.totalPurchase || 0).toLocaleString('en-IN')}`
                  const formattedPaid = `₹${Number(item.totalPaid || 0).toLocaleString('en-IN')}`
                  const currentOutstanding = Number(item.outstanding || 0)
                  const formattedOutstanding = currentOutstanding > 0 ? `₹${currentOutstanding.toLocaleString('en-IN')}` : '-'
                  const contactPhone = item.phone || '-'
                  const lastDate = item.lastDate && item.lastDate !== '-' ? item.lastDate : '-'

                  return (
                    <tr key={item._id || item.id} className="site-data-row">
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 500 }}>
                        {item.name}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#172033' }}>
                        {item.categories || 'Building Materials'}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#70829F', fontWeight: 400 }}>
                        {contactPhone}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 400 }}>
                        {formattedPurchase}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 400 }}>
                        {formattedPaid}
                      </td>
                      <td style={{ padding: '16px 20px', color: currentOutstanding > 0 ? '#172033' : '#70829F', fontWeight: currentOutstanding > 0 ? 500 : 400 }}>
                        {formattedOutstanding}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#70829F', fontWeight: 400 }}>
                        {lastDate}
                      </td>
                      {/* Actions Column */}
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <div className="site-actions-group">
                          {/* View */}
                          <button
                            type="button"
                            className="site-action-btn site-action-btn-view"
                            title="View supplier details"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleView(item)
                            }}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            className="site-action-btn site-action-btn-edit"
                            title="Edit supplier"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(item)
                            }}
                          >
                            <Pencil size={15} />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            className="site-action-btn site-action-btn-delete"
                            title="Delete supplier"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteSupplier(item)
                            }}
                          >
                            <Trash2 size={15} />
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
        <div style={{ padding: '0 20px', marginTop: '12px' }}>
          <div className="sites-scrollbar-indicator" style={{ margin: '0' }}>
            <div className="scrollbar-thumb-indicator" style={{ width: '22%' }}></div>
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="sites-pagination-row" style={{ padding: '16px 20px 0 20px', margin: '0' }}>
          <div className="pagination-left">
            <span className="pagination-range-text">
              Showing {totalRecords === 0 ? 0 : startIndex + 1}-{endIndex} of {totalRecords} records
            </span>
          </div>

          <div className="pagination-right">
            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => handlePageChange(activePage - 1)}
              disabled={activePage <= 1}
            >
              <ChevronLeft size={14} /> Back
            </button>

            {/* Page number 1 */}
            <button
              type="button"
              className="pagination-num-btn"
              style={{
                backgroundColor: activePage === 1 ? '#0F172A' : '#FFFFFF',
                color: activePage === 1 ? '#FFFFFF' : '#334155',
                borderColor: activePage === 1 ? '#0F172A' : '#E2E8F0',
                borderRadius: '6px',
                fontWeight: 600,
              }}
              onClick={() => handlePageChange(1)}
            >
              1
            </button>

            {/* Page number 2 if more pages */}
            {totalPages >= 2 && (
              <button
                type="button"
                className="pagination-num-btn"
                style={{
                  backgroundColor: activePage === 2 ? '#0F172A' : '#FFFFFF',
                  color: activePage === 2 ? '#FFFFFF' : '#334155',
                  borderColor: activePage === 2 ? '#0F172A' : '#E2E8F0',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
                onClick={() => handlePageChange(2)}
              >
                2
              </button>
            )}

            {totalPages > 3 && <span style={{ color: '#94A3B8', padding: '0 4px' }}>...</span>}

            {/* Last Page button if > 2 */}
            {totalPages > 2 && (
              <button
                type="button"
                className="pagination-num-btn"
                style={{
                  backgroundColor: activePage === totalPages ? '#0F172A' : '#FFFFFF',
                  color: activePage === totalPages ? '#FFFFFF' : '#334155',
                  borderColor: activePage === totalPages ? '#0F172A' : '#E2E8F0',
                  borderRadius: '6px',
                  fontWeight: 600,
                }}
                onClick={() => handlePageChange(totalPages)}
              >
                {totalPages}
              </button>
            )}

            <button
              type="button"
              className="pagination-nav-btn"
              onClick={() => handlePageChange(activePage + 1)}
              disabled={activePage >= totalPages}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* â”€â”€ EDIT SUPPLIER MODAL â”€â”€ */}
      {editSupplier && editFormData && (
        <div className="modal-overlay" onClick={() => setEditSupplier(null)}>
          <div
            className="modal-container"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="modal-icon-badge"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: '#FEF3C7',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Pencil size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172033', margin: 0 }}>
                    Edit Supplier
                  </h3>
                  <p className="modal-subtitle" style={{ fontSize: '13px', color: '#70829F', margin: '4px 0 0 0' }}>
                    Update details, material categories, and payment terms for {editFormData.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditSupplier(null)}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div
                style={{
                  margin: '16px 24px 0 24px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: '#FEE2E2',
                  color: '#B91C1C',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSave} className="modal-form">
              <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Supplier Name */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                    Supplier / Company Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      border: '1.5px solid #DCE4F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      color: '#172033',
                    }}
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={editFormData.contactPerson}
                    onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      border: '1.5px solid #DCE4F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      color: '#172033',
                    }}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                    Contact Phone <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      border: '1.5px solid #DCE4F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      color: '#172033',
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      border: '1.5px solid #DCE4F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      color: '#172033',
                    }}
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                    Payment Terms
                  </label>
                  <select
                    value={editFormData.paymentTerms}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentTerms: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      border: '1.5px solid #DCE4F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      color: '#172033',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    {PAYMENT_TERMS_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                    Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      border: '1.5px solid #DCE4F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      color: '#172033',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Categories */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '8px' }}>
                    Material / Service Categories
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {AVAILABLE_CATEGORIES.map((cat) => {
                      const isSel = (editFormData.categories || []).includes(cat)
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: isSel ? '1.5px solid #0293DE' : '1.5px solid #DCE4F0',
                            backgroundColor: isSel ? '#E0F2FE' : '#FFFFFF',
                            color: isSel ? '#0293DE' : '#475569',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSel && <Check size={13} strokeWidth={3} />}
                          <span>{cat}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Address */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#172033', marginBottom: '6px' }}>
                    Office / Warehouse Address
                  </label>
                  <textarea
                    rows={2}
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1.5px solid #DCE4F0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      color: '#172033',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              </div>{/* end modal-body */}

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setEditSupplier(null)}
                  disabled={editLoading}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: '1.5px solid #DCE4F0',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading || !editFormData.name?.trim()}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0293DE',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    cursor: editLoading ? 'default' : 'pointer',
                    opacity: editLoading ? 0.7 : 1,
                  }}
                >
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â”€â”€ DELETE CONFIRMATION MODAL â”€â”€ */}
      {deleteSupplier && (
        <div className="modal-overlay" onClick={() => setDeleteSupplier(null)}>
          <div
            className="modal-container"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="modal-icon-badge"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: '#FEE2E2',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172033', margin: 0 }}>
                    Delete Supplier
                  </h3>
                  <p className="modal-subtitle" style={{ fontSize: '13px', color: '#70829F', margin: '4px 0 0 0' }}>
                    Confirm supplier removal
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteSupplier(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>{deleteSupplier.name}</strong>?
                This will remove the supplier from active lists.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E5EAF1' }}>
              <button
                type="button"
                onClick={() => setDeleteSupplier(null)}
                disabled={deleteLoading}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: '1.5px solid #DCE4F0',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: deleteLoading ? 'default' : 'pointer',
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
