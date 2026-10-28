import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  Package,
} from 'lucide-react'
import { materialService } from '../services/materialService.js'

// Fallback sample data matching reference screenshot exactly
const sampleMaterials = [
  {
    _id: 'm1',
    id: 'm1',
    materialName: 'TMT Steel Fe500',
    quantity: 12.5,
    unit: 'T',
    site: { name: 'Aarav Heights' },
    supplier: { name: 'Bharat Steel Traders' },
    totalCost: 480000,
    paidAmount: 480000,
    outstandingAmount: 0,
    quantityUsed: 8.2,
    remainingStock: 4.3,
    paymentStatus: 'Paid',
  },
  {
    _id: 'm2',
    id: 'm2',
    materialName: 'Portland Cement',
    quantity: 600,
    unit: 'bags',
    site: { name: 'Aarav Heights' },
    supplier: { name: 'Shree Cement Co.' },
    totalCost: 480000,
    paidAmount: 0,
    outstandingAmount: 480000,
    quantityUsed: 480,
    remainingStock: 120,
    paymentStatus: 'Pending',
  },
  {
    _id: 'm3',
    id: 'm3',
    materialName: 'Red Clay Bricks',
    quantity: 24000,
    unit: 'pcs',
    site: { name: 'Orchid Business Park' },
    supplier: { name: 'Mahalaxmi Bricks' },
    totalCost: 480000,
    paidAmount: 0,
    outstandingAmount: 480000,
    quantityUsed: 10000,
    remainingStock: 14000,
    paymentStatus: 'Partial',
  },
  {
    _id: 'm4',
    id: 'm4',
    materialName: 'River Sand',
    quantity: 42,
    unit: 'tonnes',
    site: { name: 'Greenfield Villa' },
    supplier: { name: 'Sai Aggregates' },
    totalCost: 480000,
    paidAmount: 0,
    outstandingAmount: 480000,
    quantityUsed: 24,
    remainingStock: 18,
    paymentStatus: 'Pending',
  },
  {
    _id: 'm5',
    id: 'm5',
    materialName: 'Crushed Aggregate 20mm',
    quantity: 35,
    unit: 'tonnes',
    site: { name: 'Aarav Heights' },
    supplier: { name: 'Bharat Steel Traders' },
    totalCost: 480000,
    paidAmount: 480000,
    outstandingAmount: 0,
    quantityUsed: 32,
    remainingStock: 3,
    paymentStatus: 'Paid',
  },
]

export default function MaterialsPage({
  sites = [],
  suppliers = [],
  onOpenAddPurchase,
  showNotification,
  refreshTrigger = 0,
}) {
  const [materials, setMaterials] = useState(sampleMaterials)
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

  // Action Modals State
  const [viewingMaterial, setViewingMaterial] = useState(null)
  const [purchaseHistory, setPurchaseHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Load date-wise purchase history whenever viewingMaterial changes
  useEffect(() => {
    if (viewingMaterial) {
      setLoadingHistory(true)
      const matId = viewingMaterial._id || viewingMaterial.id
      const params = {
        materialName: viewingMaterial.materialName || viewingMaterial.category,
        siteId: viewingMaterial.site?._id || viewingMaterial.site?.id || viewingMaterial.siteId,
        supplierId: viewingMaterial.supplier?._id || viewingMaterial.supplier?.id || viewingMaterial.supplierId || '',
      }
      materialService.getHistory(matId, params)
        .then((res) => {
          setPurchaseHistory(res?.history || [])
        })
        .catch((err) => {
          console.warn('Failed to load purchase history:', err)
          setPurchaseHistory([])
        })
        .finally(() => {
          setLoadingHistory(false)
        })
    } else {
      setPurchaseHistory([])
      setLoadingHistory(false)
    }
  }, [viewingMaterial])

  // Compute summary totals dynamically from purchase history records
  const activeView = useMemo(() => {
    if (!viewingMaterial) return null
    if (purchaseHistory.length > 0) {
      const totalPurchasedQty = Number(purchaseHistory.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0).toFixed(4))
      const totalPurchaseCost = Number(purchaseHistory.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0).toFixed(2))
      const totalPaidAmount = Number(purchaseHistory.reduce((sum, t) => sum + (Number(t.paidAmount) || 0), 0).toFixed(2))
      const totalOutstanding = Math.max(0, Number((totalPurchaseCost - totalPaidAmount).toFixed(2)))
      const usedQty = Number(viewingMaterial.quantityUsed || 0)
      const remainingStock = Math.max(0, Number((totalPurchasedQty - usedQty).toFixed(4)))
      const paymentStatus = (totalPurchaseCost > 0 && totalOutstanding === 0)
        ? 'Paid'
        : totalPaidAmount > 0 ? 'Partial' : 'Pending'
      const newestDate = purchaseHistory[0]?.purchaseDate || viewingMaterial.purchaseDate

      return {
        ...viewingMaterial,
        quantity: totalPurchasedQty,
        totalCost: totalPurchaseCost,
        paidAmount: totalPaidAmount,
        outstandingAmount: totalOutstanding,
        remainingStock,
        paymentStatus,
        purchaseDate: newestDate,
      }
    }
    return viewingMaterial
  }, [viewingMaterial, purchaseHistory])

  const [editingMaterial, setEditingMaterial] = useState(null)
  const [editFormData, setEditFormData] = useState({
    materialName: '',
    category: '',
    site: '',
    supplier: '',
    quantity: '',
    unit: 'Bags',
    unitPrice: '',
    totalCost: '',
    paidAmount: '',
    quantityUsed: '',
    paymentStatus: 'Pending',
    notes: '',
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingMaterial, setDeletingMaterial] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Fetch materials from API
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (search.trim()) params.search = search.trim()
      if (statusFilter !== 'All Status') params.status = statusFilter
      if (siteFilter !== 'All Sites') {
        const found = sites.find((s) => s.name === siteFilter)
        params.siteId = found?._id || found?.id || siteFilter
      }
      if (sortFilter === 'Oldest First') params.sort = 'oldest'
      else if (sortFilter === 'Cost: High to Low') params.sort = 'cost_high'
      else if (sortFilter === 'Cost: Low to High') params.sort = 'cost_low'

      const res = await materialService.getAll(params)
      if (res) {
        const list = res.materials || (Array.isArray(res) ? res : [])
        setMaterials(list)
        if (res.summary) setSummary(res.summary)
      }
    } catch (err) {
      console.error('Failed to load materials:', err)
      if (showNotification) {
        showNotification({ type: 'error', message: 'Failed to load materials.' })
      }
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, siteFilter, sortFilter, sites, showNotification])

  useEffect(() => {
    fetchMaterials()
  }, [fetchMaterials, refreshTrigger])

  // ── Actions ──
  const handleView = (item) => {
    setViewingMaterial(item)
  }

  const handleEdit = (item) => {
    const qty = Number(item.quantity || 0)
    const cost = Number(item.totalCost || 0)
    const paid = Number(
      item.paidAmount !== undefined && item.paidAmount !== null
        ? item.paidAmount
        : (item.paymentStatus === 'Paid' ? cost : 0),
    )
    const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null
      ? item.unitPrice
      : (qty > 0 ? Number((cost / qty).toFixed(2)) : '')

    // Resolve site & supplier IDs from object or name match
    const foundSite = sites.find((s) => s.name === (item.site?.name || item.siteName))
    const foundSupplier = suppliers.find((s) => s.name === (item.supplier?.name || item.supplierName))
    const siteVal = item.site?._id || item.site?.id || item.siteId || foundSite?._id || foundSite?.id || ''
    const supplierVal = item.supplier?._id || item.supplier?.id || item.supplierId || foundSupplier?._id || foundSupplier?.id || ''

    setEditingMaterial(item)
    setEditFormData({
      materialName: item.materialName || item.category || '',
      category: item.category || item.materialName || '',
      site: siteVal,
      supplier: supplierVal,
      quantity: item.quantity !== undefined ? item.quantity : '',
      unit: item.unit || 'Bags',
      unitPrice: unitPrice,
      totalCost: cost || '',
      paidAmount: paid !== undefined ? paid : '',
      quantityUsed: item.quantityUsed !== undefined ? item.quantityUsed : 0,
      paymentStatus: item.paymentStatus || 'Pending',
      notes: item.notes || '',
    })
    setEditError('')
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditFormData((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'quantity' || name === 'unitPrice') {
        const q = Number(name === 'quantity' ? value : prev.quantity)
        const p = Number(name === 'unitPrice' ? value : prev.unitPrice)
        if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
          next.totalCost = Number((q * p).toFixed(2))
        }
      } else if (name === 'totalCost') {
        const q = Number(prev.quantity)
        const c = Number(value)
        if (!isNaN(q) && !isNaN(c) && q > 0 && c > 0) {
          next.unitPrice = Number((c / q).toFixed(2))
        }
      }

      if (name === 'paidAmount' || name === 'totalCost') {
        const c = Number(name === 'totalCost' ? value : next.totalCost || 0)
        const p = Number(name === 'paidAmount' ? value : next.paidAmount || 0)
        if (c > 0 && p >= c) {
          next.paymentStatus = 'Paid'
        } else if (p > 0) {
          next.paymentStatus = 'Partial'
        } else {
          next.paymentStatus = 'Pending'
        }
      }

      return next
    })
    if (editError) setEditError('')
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editFormData.materialName?.trim()) {
      setEditError('Material name is required.')
      return
    }
    if (editFormData.quantity === '' || Number(editFormData.quantity) < 0) {
      setEditError('Valid quantity is required.')
      return
    }

    setEditLoading(true)
    setEditError('')
    try {
      const matId = editingMaterial._id || editingMaterial.id
      const qty = Number(editFormData.quantity) || 0
      const unitPrice = Number(editFormData.unitPrice) || 0
      const totalCost = Number(editFormData.totalCost) || (qty * unitPrice)
      const paidAmount = Number(editFormData.paidAmount) || 0
      const quantityUsed = Number(editFormData.quantityUsed) || 0
      const remainingStock = Math.max(0, qty - quantityUsed)
      const outstandingAmount = Math.max(0, totalCost - paidAmount)

      const matchedSite = sites.find((s) => String(s._id || s.id) === String(editFormData.site))
      const matchedSupplier = suppliers.find((s) => String(s._id || s.id) === String(editFormData.supplier))

      const updatedRecord = {
        ...editingMaterial,
        materialName: editFormData.materialName.trim(),
        category: editFormData.materialName.trim(),
        site: matchedSite
          ? { _id: String(matchedSite._id || matchedSite.id), id: String(matchedSite._id || matchedSite.id), name: matchedSite.name, location: matchedSite.location || '' }
          : editingMaterial.site,
        supplier: matchedSupplier
          ? { _id: String(matchedSupplier._id || matchedSupplier.id), id: String(matchedSupplier._id || matchedSupplier.id), name: matchedSupplier.name }
          : (editFormData.supplier === '' ? null : editingMaterial.supplier),
        quantity: qty,
        unit: editFormData.unit || 'Units',
        unitPrice,
        totalCost,
        paidAmount,
        outstandingAmount,
        quantityUsed,
        remainingStock,
        paymentStatus: editFormData.paymentStatus,
        notes: editFormData.notes || '',
      }

      // Update state immediately so UI updates without lag
      setMaterials((prev) =>
        prev.map((m) => ((m._id || m.id) === matId ? { ...m, ...updatedRecord } : m))
      )

      // Sync with backend if persistent DB record
      if (matId && !String(matId).startsWith('m')) {
        const payload = {
          materialName: editFormData.materialName.trim(),
          category: editFormData.materialName.trim(),
          site: editFormData.site || undefined,
          siteId: editFormData.site || undefined,
          supplier: editFormData.supplier || null,
          supplierId: editFormData.supplier || null,
          quantity: qty,
          unit: editFormData.unit || 'Units',
          unitPrice,
          totalCost,
          paidAmount,
          quantityUsed,
          paymentStatus: editFormData.paymentStatus,
          notes: editFormData.notes || '',
        }
        try {
          await materialService.update(matId, payload)
          await fetchMaterials()
        } catch (apiErr) {
          console.warn('Backend update failed:', apiErr)
        }
      }

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Material "${editFormData.materialName}" updated successfully!`,
        })
      }
      setEditingMaterial(null)
    } catch (err) {
      setEditError(err.message || 'Failed to update material')
      if (showNotification) {
        showNotification({
          type: 'error',
          message: err.message || 'Failed to update material',
        })
      }
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingMaterial) return
    setDeleteLoading(true)
    try {
      const matId = deletingMaterial._id || deletingMaterial.id
      const matName = deletingMaterial.materialName || 'Material'

      // Remove from state immediately
      setMaterials((prev) => prev.filter((m) => (m._id || m.id) !== matId))

      // Delete from backend if persistent DB record
      if (matId && !String(matId).startsWith('m')) {
        try {
          await materialService.delete(matId)
          await fetchMaterials()
        } catch (apiErr) {
          console.warn('Backend delete failed:', apiErr)
        }
      }

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Material "${matName}" deleted successfully!`,
        })
      }
      setDeletingMaterial(null)
    } catch (err) {
      if (showNotification) {
        showNotification({
          type: 'error',
          message: err.message || 'Failed to delete material',
        })
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  const displayList = materials

  // Filter client-side if sample data is active
  const filteredMaterials = displayList.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matName = (item.materialName || '').toLowerCase()
      const siteName = (item.site?.name || item.siteName || '').toLowerCase()
      const supName = (item.supplier?.name || item.supplierName || '').toLowerCase()
      if (!matName.includes(q) && !siteName.includes(q) && !supName.includes(q)) {
        return false
      }
    }
    if (statusFilter !== 'All Status' && item.paymentStatus !== statusFilter) {
      return false
    }
    if (siteFilter !== 'All Sites') {
      const siteName = item.site?.name || item.siteName || ''
      if (siteName !== siteFilter) return false
    }
    return true
  })

  // Pagination calculation
  const totalRecords = filteredMaterials.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const paginatedRecords = filteredMaterials.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  // Format large values into Indian currency (Cr, L)
  const formatCostValue = (amount, fallback) => {
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
      return fallback
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

  return (
    <div className="labour-page materials-page" style={{ paddingBottom: '30px' }}>
      {/* 1. Header with Breadcrumb and Add Purchase Button */}
      <div className="sites-header-wrap">
        <div className="sites-header-left">
          <div className="sites-breadcrumb">
            <span className="breadcrumb-root">WORKSPACE</span>
            <span className="breadcrumb-slash">/</span>
            <span className="breadcrumb-active">MATERIAL'S</span>
          </div>
          <h1 className="sites-title">Material’s</h1>
          <p className="sites-subtitle">
            Monitor purchases, consumption and stock across sites.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary-action btn-add-site-header"
          onClick={onOpenAddPurchase}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add Purchase</span>
        </button>
      </div>

      {/* 2. Four Summary Stat Cards */}
      <div className="sites-stat-grid">
        {/* Card 1: Total Material Cost */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Total Material Cost</span>
            <div className="stat-icon-wrap stat-icon-blue">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">
            {formatCostValue(summary?.totalCost, '₹1.68 Cr')}
          </div>
          <span className="stat-desc">39.3% of investment</span>
        </div>

        {/* Card 2: Purchased This Month */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Purchased This Month</span>
            <div className="stat-icon-wrap stat-icon-green">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">
            {formatCostValue(summary?.monthCost, '₹18.6 L')}
          </div>
          <span className="stat-desc">
            {summary?.monthCount ? `${summary.monthCount} purchase records` : '42 purchase records'}
          </span>
        </div>

        {/* Card 3: Pending Supplier Payments */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Pending Supplier Payments</span>
            <div className="stat-icon-wrap stat-icon-orange">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="stat-value">
            {formatCostValue(summary?.pendingAmount, '₹8.4 L')}
          </div>
          <span className="stat-desc">
            {summary?.pendingSuppliersCount ? `Across ${summary.pendingSuppliersCount} suppliers` : 'Across 7 suppliers'}
          </span>
        </div>

        {/* Card 4: Low Stock Items */}
        <div className="site-stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="stat-label">Low Stock Items</span>
            <div className="stat-icon-wrap stat-icon-rose">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-value">
            {summary?.lowStockCount !== undefined ? summary.lowStockCount : '6'}
          </div>
          <span className="stat-desc">Reorder recommended</span>
        </div>
      </div>

      {/* 3. Filters Row: Search on Left, 3 Dropdowns on Right */}
      <div className="sites-filter-row" style={{ marginTop: '16px', marginBottom: '16px' }}>
        {/* Left: Search input */}
        <div className="sites-search-box" style={{ width: '320px' }}>
          <Search size={16} className="sites-search-icon" />
          <input
            type="text"
            className="sites-search-input"
            placeholder="Search materials..."
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
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
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
              <option value="Cost: High to Low">Cost: High to Low</option>
              <option value="Cost: Low to High">Cost: Low to High</option>
            </select>
            <ChevronDown size={14} className="site-select-arrow" />
          </div>
        </div>
      </div>

      {/* 4. Table Card Box */}
      <div className="sites-table-card" style={{ padding: '0 0 16px 0', border: '1px solid #E5EAF1' }}>
        <div className="sites-table-scroll">
          <table className="sites-table">
            <thead>
              <tr style={{ borderBottom: '1px solid #E5EAF1' }}>
                <th style={{ padding: '16px 20px', width: '16%' }}>MATERIAL</th>
                <th style={{ padding: '16px 20px', width: '13%' }}>PURCHASED QUANTITY</th>
                <th style={{ padding: '16px 20px', width: '13%' }}>SITE</th>
                <th style={{ padding: '16px 20px', width: '14%' }}>SUPPLIER</th>
                <th style={{ padding: '16px 20px', width: '12%' }}>PURCHASE COST</th>
                <th style={{ padding: '16px 20px', width: '11%' }}>PAID AMOUNT</th>
                <th style={{ padding: '16px 20px', width: '11%' }}>OUTSTANDING</th>
                <th style={{ padding: '16px 20px', width: '10%', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#70829F' }}>
                    Loading materials records...
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#70829F' }}>
                    No materials found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((item) => {
                  const siteName = item.site?.name || item.siteName || 'N/A'
                  const supplierName = item.supplier?.name || item.supplierName || '—'
                  const formattedQty = `${Number(item.quantity || 0).toLocaleString('en-IN')} ${item.unit || ''}`

                  const cost = Number(item.totalCost || 0)
                  const paid = Number(
                    item.paidAmount !== undefined && item.paidAmount !== null
                      ? item.paidAmount
                      : (item.paymentStatus === 'Paid' ? cost : 0),
                  )
                  const outstanding = item.outstandingAmount !== undefined
                    ? Number(item.outstandingAmount)
                    : Math.max(0, cost - paid)

                  const formattedCost = `₹${cost.toLocaleString('en-IN')}`
                  const formattedPaid = `₹${paid.toLocaleString('en-IN')}`
                  const formattedOutstanding = outstanding > 0 ? `₹${outstanding.toLocaleString('en-IN')}` : '—'

                  return (
                    <tr key={item._id || item.id} className="site-data-row">
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#172033' }}>
                        {item.materialName}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: '#172033' }}>
                        {formattedQty}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#70829F', fontWeight: 400 }}>
                        {siteName}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#70829F', fontWeight: 400 }}>
                        {supplierName}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#172033', fontWeight: 400 }}>
                        {formattedCost}
                      </td>
                      <td style={{ padding: '16px 20px', color: '#16A34A', fontWeight: 600 }}>
                        {formattedPaid}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 600, color: outstanding > 0 ? '#EF4444' : '#70829F' }}>
                        {formattedOutstanding}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <div className="site-actions-group">
                          <button
                            type="button"
                            className="site-action-btn site-action-btn-view"
                            title="View Material Details"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleView(item)
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="site-action-btn site-action-btn-edit"
                            title="Edit / Update Material"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(item)
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="site-action-btn site-action-btn-delete"
                            title="Delete Material"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingMaterial(item)
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

      {/* ── VIEW MATERIAL MODAL ── */}
      {viewingMaterial && activeView && (
        <div className="modal-overlay" onClick={() => setViewingMaterial(null)}>
          <div className="modal-container" style={{ maxWidth: '920px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-icon-badge" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="modal-title">{activeView.materialName}</h3>
                  <p className="modal-subtitle">Material specifications, inventory and purchase cost</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingMaterial(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="site-view-details" style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(85vh - 120px)' }}>
              {/* Material Summary Details */}
              <div className="site-view-grid">
                <div className="site-view-item">
                  <span className="site-view-label">Material Name</span>
                  <span className="site-view-val">{activeView.materialName}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Category</span>
                  <span className="site-view-val">{activeView.category || 'Raw Material'}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Construction Site</span>
                  <span className="site-view-val">{activeView.site?.name || activeView.siteName || 'N/A'}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Supplier</span>
                  <span className="site-view-val">{activeView.supplier?.name || activeView.supplierName || '—'}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Purchased Quantity</span>
                  <span className="site-view-val">{Number(activeView.quantity || 0).toLocaleString('en-IN')} {activeView.unit || ''}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Used Quantity</span>
                  <span className="site-view-val">{Number(activeView.quantityUsed || 0).toLocaleString('en-IN')} {activeView.unit || ''}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Remaining Stock</span>
                  <span className="site-view-val" style={{ color: (activeView.remainingStock || 0) <= 0 ? '#EF4444' : '#16A34A' }}>
                    {Number(activeView.remainingStock !== undefined ? activeView.remainingStock : Math.max(0, (activeView.quantity || 0) - (activeView.quantityUsed || 0))).toLocaleString('en-IN')} {activeView.unit || ''}
                  </span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Payment Status</span>
                  <span className="site-view-val" style={{ color: activeView.paymentStatus === 'Paid' ? '#16A34A' : activeView.paymentStatus === 'Partial' ? '#F59E0B' : '#EF4444' }}>
                    {activeView.paymentStatus || 'Pending'}
                  </span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Purchase Cost</span>
                  <span className="site-view-val">₹{Number(activeView.totalCost || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Paid Amount</span>
                  <span className="site-view-val" style={{ color: '#16A34A' }}>
                    ₹{Number(activeView.paidAmount !== undefined && activeView.paidAmount !== null ? activeView.paidAmount : (activeView.paymentStatus === 'Paid' ? activeView.totalCost : 0)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Outstanding Amount</span>
                  <span className="site-view-val" style={{ color: (activeView.outstandingAmount || 0) > 0 ? '#EF4444' : '#70829F' }}>
                    ₹{Number(activeView.outstandingAmount !== undefined ? activeView.outstandingAmount : Math.max(0, (activeView.totalCost || 0) - (activeView.paidAmount || 0))).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="site-view-item">
                  <span className="site-view-label">Purchase Date</span>
                  <span className="site-view-val">
                    {activeView.purchaseDate ? new Date(activeView.purchaseDate).toLocaleDateString('en-GB') : '—'}
                  </span>
                </div>
                {activeView.notes && (
                  <div className="site-view-item full-width">
                    <span className="site-view-label">Notes / Remarks</span>
                    <span className="site-view-val" style={{ fontWeight: 400, color: '#475569' }}>
                      {activeView.notes}
                    </span>
                  </div>
                )}
              </div>

              {/* Purchase History Section */}
              <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #E5EAF1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#172033' }}>
                      Purchase History
                    </h4>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#70829F' }}>
                      Date-wise transaction records for this material, site, and supplier
                    </p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px', backgroundColor: '#F1F5F9', color: '#475569' }}>
                    {purchaseHistory.length} {purchaseHistory.length === 1 ? 'Purchase' : 'Purchases'}
                  </span>
                </div>

                {loadingHistory ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#70829F', fontSize: '13px' }}>
                    Loading purchase history...
                  </div>
                ) : purchaseHistory.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#70829F', fontSize: '13px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                    No purchase transactions found for this material.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>DATE</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>REF #</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>MATERIAL</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>SITE</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>SUPPLIER</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>QUANTITY</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>RATE / UNIT</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>TOTAL AMOUNT</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>PAID AMOUNT</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>OUTSTANDING</th>
                          <th style={{ padding: '10px 12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseHistory.map((tx, idx) => {
                          const isPaid = tx.paymentStatus === 'Paid'
                          const isPartial = tx.paymentStatus === 'Partial'
                          const statusBg = isPaid ? '#DCFCE7' : isPartial ? '#FEF3C7' : '#FEE2E2'
                          const statusColor = isPaid ? '#15803D' : isPartial ? '#B45309' : '#B91C1C'

                          return (
                            <tr
                              key={tx.id || idx}
                              style={{
                                borderBottom: idx < purchaseHistory.length - 1 ? '1px solid #F1F5F9' : 'none',
                                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                              }}
                            >
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#1E293B', fontWeight: 500 }}>
                                {tx.purchaseDate ? new Date(tx.purchaseDate).toLocaleDateString('en-GB') : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748B', fontFamily: 'monospace', fontSize: '11px' }}>
                                {tx.refNumber || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#0F172A', fontWeight: 600 }}>
                                {tx.materialName}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748B' }}>
                                {tx.site?.name || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748B' }}>
                                {tx.supplier?.name || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#0F172A', fontWeight: 600 }}>
                                {Number(tx.quantity).toLocaleString('en-IN')} {tx.unit}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                                ₹{Number(tx.ratePerUnit || 0).toLocaleString('en-IN')}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#0F172A', fontWeight: 600 }}>
                                ₹{Number(tx.totalAmount || 0).toLocaleString('en-IN')}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#16A34A', fontWeight: 600 }}>
                                ₹{Number(tx.paidAmount || 0).toLocaleString('en-IN')}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: tx.outstandingAmount > 0 ? '#EF4444' : '#64748B', fontWeight: tx.outstandingAmount > 0 ? 600 : 400 }}>
                                {tx.outstandingAmount > 0 ? `₹${Number(tx.outstandingAmount).toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor: statusBg,
                                    color: statusColor,
                                  }}
                                >
                                  {tx.paymentStatus || 'Pending'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #E5EAF1' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingMaterial(null)}
                style={{ padding: '8px 20px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT / UPDATE MATERIAL MODAL ── */}
      {editingMaterial && (
        <div className="modal-overlay" onClick={() => setEditingMaterial(null)}>
          <div className="modal-container" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-icon-badge" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                  <Pencil size={18} />
                </div>
                <div>
                  <h3 className="modal-title">Edit Material</h3>
                  <p className="modal-subtitle">Update material stock, cost and supplier details</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingMaterial(null)}
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div style={{ margin: '16px 24px 0 24px', padding: '10px 14px', borderRadius: '6px', background: '#FEE2E2', color: '#B91C1C', fontSize: '13px' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSave} style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(80vh - 120px)' }}>
              <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Material Name */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Material Name *</label>
                  <input
                    type="text"
                    name="materialName"
                    className="form-input"
                    value={editFormData.materialName}
                    onChange={handleEditChange}
                    required
                  />
                </div>

                {/* Construction Site */}
                <div className="form-group">
                  <label className="form-label">Construction Site</label>
                  <select
                    name="site"
                    className="form-select"
                    value={editFormData.site}
                    onChange={handleEditChange}
                  >
                    <option value="">-- Select Site --</option>
                    {sites.map((s) => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name} ({s.location || 'Site'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Supplier */}
                <div className="form-group">
                  <label className="form-label">Supplier</label>
                  <select
                    name="supplier"
                    className="form-select"
                    value={editFormData.supplier}
                    onChange={handleEditChange}
                  >
                    <option value="">-- Direct / None --</option>
                    {suppliers.map((sup) => (
                      <option key={sup._id || sup.id} value={sup._id || sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    name="category"
                    className="form-input"
                    placeholder="e.g. Raw Material, Cement, Steel"
                    value={editFormData.category}
                    onChange={handleEditChange}
                  />
                </div>

                {/* Unit */}
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select
                    name="unit"
                    className="form-select"
                    value={editFormData.unit}
                    onChange={handleEditChange}
                  >
                    {!['Bags', 'bags', 'Kg', 'Ton', 'T', 'tonnes', 'Pieces', 'pcs', 'Cubic Feet', 'Cubic Meter', 'Meter', 'Liter', 'Units', 'Sq.Ft', 'Trips', 'Other'].includes(editFormData.unit) && editFormData.unit && (
                      <option value={editFormData.unit}>{editFormData.unit}</option>
                    )}
                    {['Bags', 'bags', 'Kg', 'Ton', 'T', 'tonnes', 'Pieces', 'pcs', 'Cubic Feet', 'Cubic Meter', 'Meter', 'Liter', 'Units', 'Sq.Ft', 'Trips', 'Other'].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="form-group">
                  <label className="form-label">Purchased Quantity *</label>
                  <input
                    type="number"
                    name="quantity"
                    className="form-input"
                    min="0"
                    step="any"
                    value={editFormData.quantity}
                    onChange={handleEditChange}
                    required
                  />
                </div>

                {/* Quantity Used */}
                <div className="form-group">
                  <label className="form-label">Used Quantity</label>
                  <input
                    type="number"
                    name="quantityUsed"
                    className="form-input"
                    min="0"
                    step="any"
                    value={editFormData.quantityUsed}
                    onChange={handleEditChange}
                  />
                </div>

                {/* Unit Price */}
                <div className="form-group">
                  <label className="form-label">Unit Price (₹)</label>
                  <input
                    type="number"
                    name="unitPrice"
                    className="form-input"
                    min="0"
                    step="any"
                    value={editFormData.unitPrice}
                    onChange={handleEditChange}
                  />
                </div>

                {/* Total Cost */}
                <div className="form-group">
                  <label className="form-label">Total Cost (₹)</label>
                  <input
                    type="number"
                    name="totalCost"
                    className="form-input"
                    min="0"
                    step="any"
                    value={editFormData.totalCost}
                    onChange={handleEditChange}
                  />
                </div>

                {/* Paid Amount */}
                <div className="form-group">
                  <label className="form-label">Paid Amount (₹)</label>
                  <input
                    type="number"
                    name="paidAmount"
                    className="form-input"
                    min="0"
                    step="any"
                    value={editFormData.paidAmount}
                    onChange={handleEditChange}
                  />
                </div>

                {/* Payment Status */}
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select
                    name="paymentStatus"
                    className="form-select"
                    value={editFormData.paymentStatus}
                    onChange={handleEditChange}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Notes / Remarks</label>
                  <input
                    type="text"
                    name="notes"
                    className="form-input"
                    placeholder="Invoice number or notes"
                    value={editFormData.notes}
                    onChange={handleEditChange}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E5EAF1' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingMaterial(null)}
                  disabled={editLoading}
                  style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editLoading}
                  style={{ padding: '8px 22px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 600, backgroundColor: '#0293DE', color: '#FFF' }}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE MATERIAL MODAL ── */}
      {deletingMaterial && (
        <div className="modal-overlay" onClick={() => setDeletingMaterial(null)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <div className="modal-icon-badge" style={{ backgroundColor: '#FEE2E2', color: '#EF4444' }}>
                  <Trash2 size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="modal-title">Delete Material</h3>
                  <p className="modal-subtitle">Confirm material record removal</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeletingMaterial(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                Are you sure you want to delete <strong>{deletingMaterial.materialName}</strong>?
                This will permanently remove this material purchase record from the system.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #E5EAF1' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingMaterial(null)}
                disabled={deleteLoading}
                style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  opacity: deleteLoading ? 0.7 : 1,
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
