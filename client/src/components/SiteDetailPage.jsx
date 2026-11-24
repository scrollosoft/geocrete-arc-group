import React, { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  MapPin,
  User,
  Plus,
  Package,
  Wrench,
} from 'lucide-react'
import { materialService } from '../services/materialService.js'
import { supplierService } from '../services/supplierService.js'
import { expenseService } from '../services/expenseService.js'
import { siteService } from '../services/siteService.js'
import { labourService } from '../services/labourService.js'
import TablePagination from './TablePagination.jsx'

export default function SiteDetailPage({
  site,
  expenses = [],
  onBack,
  onOpenAddExpense,
  onOpenAddWorker,
  onSiteChanged,
  onRefreshAccounts,
}) {
  const [activeSubTab, setActiveSubTab] = useState('Overview')
  const [activeLabourTab, setActiveLabourTab] = useState('Worker List')

  // Pagination states for sub-tabs
  const [expensesPage, setExpensesPage] = useState(1)
  const [expensesPageSize, setExpensesPageSize] = useState(10)

  const [matPage, setMatPage] = useState(1)
  const [matPageSize, setMatPageSize] = useState(10)

  const [labourPage, setLabourPage] = useState(1)
  const [labourPageSize, setLabourPageSize] = useState(10)

  const [suppPage, setSuppPage] = useState(1)
  const [suppPageSize, setSuppPageSize] = useState(10)

  const [clientPayPage, setClientPayPage] = useState(1)
  const [clientPayPageSize, setClientPayPageSize] = useState(10)
  const [materialFilter, setMaterialFilter] = useState('All Materials')

  useEffect(() => {
    setMatPage(1)
  }, [materialFilter])
  const [siteMaterials, setSiteMaterials] = useState([])
  const [allSuppliers, setAllSuppliers] = useState([])
  const [siteExpensesData, setSiteExpensesData] = useState([])
  const [clientPayments, setClientPayments] = useState([])
  const [siteWorkers, setSiteWorkers] = useState([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [loadingLabour, setLoadingLabour] = useState(false)

  // Load site-specific materials, suppliers, expenses, and client payments
  useEffect(() => {
    let active = true
    const siteId = site?._id || site?.id
    if (!siteId) return

    setLoadingSuppliers(true)
    setLoadingPayments(true)
    setLoadingLabour(true)
    Promise.all([
      materialService.getAll({ siteId, grouped: false }).catch(() => ({ materials: [] })),
      supplierService.getAll().catch(() => []),
      expenseService.getAll({ siteId }).catch(() => ({ expenses: [] })),
      siteService.getPayments(siteId).catch(() => []),
      labourService.getAll({ siteId }).catch(() => ({ workers: [] })),
    ])
      .then(([matRes, supRes, expRes, payRes, labRes]) => {
        if (!active) return
        const isRejectedRecord = (item) => {
          if (!item) return false
          const status = String(item.approvalStatus || item.approval_status || '').trim().toLowerCase()
          return status === 'rejected'
        }
        const loadedMaterials = matRes?.materials || (Array.isArray(matRes) ? matRes : [])
        setSiteMaterials(loadedMaterials.filter((m) => !isRejectedRecord(m)))
        setAllSuppliers(Array.isArray(supRes) ? supRes : (supRes?.suppliers || []))
        const loadedExpenses = expRes?.expenses || (Array.isArray(expRes) ? expRes : [])
        const nonRejectedExpenses = loadedExpenses.filter((e) => !isRejectedRecord(e))
        if (nonRejectedExpenses.length > 0) {
          setSiteExpensesData(nonRejectedExpenses)
        }
        setClientPayments(Array.isArray(payRes) ? payRes : [])

        // Site-specific labour workers
        const rawWorkers = labRes?.workers || (Array.isArray(labRes) ? labRes : [])
        const filteredWorkers = rawWorkers.filter((w) => {
          if (!w) return false
          const wSiteId = w.site?._id || w.site?.id || (typeof w.site === 'object' ? null : w.site) || w.siteId
          if (wSiteId && String(wSiteId) === String(siteId)) return true
          const wSiteName = (w.site?.name || w.siteName || '').trim().toLowerCase()
          const targetName = (site.name || '').trim().toLowerCase()
          return Boolean(wSiteName && targetName && wSiteName === targetName)
        })
        setSiteWorkers(filteredWorkers)
      })
      .finally(() => {
        if (active) {
          setLoadingSuppliers(false)
          setLoadingPayments(false)
          setLoadingLabour(false)
        }
      })

    return () => {
      active = false
    }
  }, [site?._id, site?.id])

  // Keep site expenses in sync when expenses prop updates from App
  useEffect(() => {
    if (expenses && expenses.length > 0) {
      const siteId = site?._id || site?.id
      const relevant = expenses.filter((e) => {
        if (!e) return false
        const eSiteId = e.site?._id || e.site?.id || (typeof e.site === 'object' ? null : e.site) || e.siteId
        if (siteId && String(eSiteId) === String(siteId)) return true
        const eSiteName = (e.site?.name || e.siteName || '').trim().toLowerCase()
        const targetName = (site?.name || '').trim().toLowerCase()
        return Boolean(eSiteName && targetName && eSiteName === targetName)
      })
      if (relevant.length > 0) {
        setSiteExpensesData(relevant)
      }
    }
  }, [expenses, site?._id, site?.id, site?.name])

  // Filter site-specific expenses (uses fresh siteExpensesData if loaded)
  const isRejectedRecord = (item) => {
    if (!item) return false
    const status = String(item.approvalStatus || item.approval_status || '').trim().toLowerCase()
    return status === 'rejected'
  }

  const baseExpenses = siteExpensesData.length > 0 ? siteExpensesData : expenses
  const siteExpenses = baseExpenses.filter((e) => {
    if (!site || !e) return false
    if (isRejectedRecord(e)) return false
    const eSiteId = e.site?._id || e.site?.id || (typeof e.site === 'object' ? null : e.site) || e.siteId
    if (site._id && (String(eSiteId) === String(site._id) || String(eSiteId) === String(site.id))) {
      return true
    }
    const eSiteName = (e.site?.name || e.siteName || '').trim().toLowerCase()
    const targetName = (site.name || '').trim().toLowerCase()
    return Boolean(eSiteName && targetName && eSiteName === targetName)
  })

  // Material purchase records for the Materials tab — use individual expense records
  // so that multiple purchases of the same material on different dates show as separate rows.
  // siteMaterials (grouped API data) is still used for the Suppliers tab aggregation below.
  const validSiteMaterials = siteMaterials.filter((m) => !isRejectedRecord(m))
  const materialExpenseRecords = siteExpenses.filter(
    (e) => !isRejectedRecord(e) && e.category && !['labour', 'equipment', 'transport', 'fuel', 'utilities'].includes(e.category.toLowerCase())
  )
  const materialRecords = materialExpenseRecords.length > 0
    ? materialExpenseRecords
    : validSiteMaterials

  // Unique material names for the Materials filter dropdown
  const uniqueMaterialNames = useMemo(() => {
    const seen = new Set()
    const names = []
    materialRecords.forEach((item) => {
      const name = (item.category || item.materialName || '').trim()
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        names.push(name)
      }
    })
    return names.sort((a, b) => a.localeCompare(b))
  }, [materialRecords])

  // Filtered material records based on the selected material filter
  const filteredMaterialRecords = useMemo(() => {
    if (materialFilter === 'All Materials') return materialRecords
    return materialRecords.filter((item) => {
      const name = (item.category || item.materialName || '').trim().toLowerCase()
      return name === materialFilter.toLowerCase()
    })
  }, [materialRecords, materialFilter])

  // Material summary cards — grouped by material name across all records (not filtered)
  const materialSummaryCards = useMemo(() => {
    const map = new Map()
    materialRecords.forEach((item) => {
      const name = (item.category || item.materialName || '').trim()
      if (!name) return
      const key = name.toLowerCase()
      const total = Number(item.totalCost !== undefined ? item.totalCost : item.amount) || 0
      const paid = Number(item.paidAmount) || 0
      if (map.has(key)) {
        const existing = map.get(key)
        existing.totalAmount += total
        existing.paidAmount += paid
      } else {
        map.set(key, { name, totalAmount: total, paidAmount: paid })
      }
    })
    return Array.from(map.values())
      .map((entry) => ({
        name: entry.name,
        totalAmount: entry.totalAmount,
        paidAmount: entry.paidAmount,
        pendingAmount: Math.max(0, entry.totalAmount - entry.paidAmount),
        remainingPercent: entry.totalAmount > 0
          ? Math.round(((entry.totalAmount - entry.paidAmount) / entry.totalAmount) * 100)
          : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [materialRecords])

  // Aggregate supplier records for this site across materials & expenses
  const siteSuppliers = useMemo(() => {
    if (!site) return []
    const map = new Map()

    const getSupplierKeyAndName = (sup) => {
      if (!sup) return null
      if (typeof sup === 'object') {
        const id = sup._id || sup.id
        const name = sup.name || ''
        return { id: id ? String(id) : null, name }
      }
      return { id: null, name: String(sup) }
    }

    siteMaterials.forEach((m) => {
      if (!m.supplier) return
      const supInfo = getSupplierKeyAndName(m.supplier)
      if (!supInfo || (!supInfo.id && !supInfo.name)) return

      const key = supInfo.id || supInfo.name.toLowerCase()
      if (!map.has(key)) {
        const matchedSup = allSuppliers.find(
          (s) => String(s._id || s.id) === String(supInfo.id) || s.name?.toLowerCase() === supInfo.name.toLowerCase()
        )
        map.set(key, {
          id: supInfo.id || matchedSup?._id || matchedSup?.id,
          name: supInfo.name || matchedSup?.name || 'Unknown Supplier',
          companyName: matchedSup?.companyName || m.supplier?.companyName || '',
          contactPerson: matchedSup?.contactPerson || '',
          phone: matchedSup?.phone || '',
          categories: new Set(),
          totalPurchase: 0,
          totalPaid: 0,
          lastDate: null,
        })
      }

      const entry = map.get(key)
      if (m.category) entry.categories.add(m.category)
      const cost = Number(m.totalCost || 0)
      const rawPaid = m.paidAmount !== undefined && m.paidAmount !== null
        ? Number(m.paidAmount)
        : (m.paymentStatus === 'Paid' ? cost : 0)
      const paid = Math.min(cost, Math.max(0, rawPaid))
      const rowOutstanding = Math.max(0, cost - paid)

      entry.totalPurchase += cost
      entry.totalPaid += paid
      entry.outstanding = (entry.outstanding || 0) + rowOutstanding
      if (m.purchaseDate) {
        if (!entry.lastDate || new Date(m.purchaseDate) > new Date(entry.lastDate)) {
          entry.lastDate = m.purchaseDate
        }
      }
    })

    siteExpenses.forEach((e) => {
      if (!e.supplier || e.appliedToMaterial) return
      // Skip expenses that are already accounted for in material summaries for this site
      const isAlreadyInMat = siteMaterials.some(
        (m) =>
          String(m._id) === `grp-exp-${e.id}` ||
          (m.materialName && e.category && m.materialName.toLowerCase() === e.category.trim().toLowerCase() && String(m.supplier?.id || m.supplier?._id) === String(e.supplier?.id || e.supplier?._id || e.supplier))
      )
      if (isAlreadyInMat) return

      const supInfo = getSupplierKeyAndName(e.supplier)
      if (!supInfo || (!supInfo.id && !supInfo.name)) return

      const key = supInfo.id || supInfo.name.toLowerCase()
      if (!map.has(key)) {
        const matchedSup = allSuppliers.find(
          (s) => String(s._id || s.id) === String(supInfo.id) || s.name?.toLowerCase() === supInfo.name.toLowerCase()
        )
        map.set(key, {
          id: supInfo.id || matchedSup?._id || matchedSup?.id,
          name: supInfo.name || matchedSup?.name || 'Unknown Supplier',
          companyName: matchedSup?.companyName || '',
          contactPerson: matchedSup?.contactPerson || '',
          phone: matchedSup?.phone || '',
          categories: new Set(),
          totalPurchase: 0,
          totalPaid: 0,
          outstanding: 0,
          lastDate: null,
        })
      }

      const entry = map.get(key)
      if (e.category) entry.categories.add(e.category)

      const amt = Number(e.amount || 0)
      const rawPaid = Number(e.paidAmount || (e.status === 'Paid' ? amt : 0))
      const paid = Math.min(amt, Math.max(0, rawPaid))
      const rowOutstanding = Math.max(0, amt - paid)

      entry.totalPurchase += amt
      entry.totalPaid += paid
      entry.outstanding = (entry.outstanding || 0) + rowOutstanding
      if (e.date) {
        if (!entry.lastDate || new Date(e.date) > new Date(entry.lastDate)) {
          entry.lastDate = e.date
        }
      }
    })

    return Array.from(map.values()).map((entry) => ({
      ...entry,
      outstanding: entry.outstanding !== undefined ? entry.outstanding : Math.max(0, entry.totalPurchase - entry.totalPaid),
      categoriesStr: Array.from(entry.categories).join(', ') || 'General',
    }))
  }, [site, siteMaterials, siteExpenses, allSuppliers])

  if (!site) return null

  // Full Indian Currency Formatter (without L / Cr abbreviations)
  const formatIndianCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0'
    const num = Number(amount)
    const isNegative = num < 0
    const absNum = Math.abs(num)
    const formatted = `₹${absNum.toLocaleString('en-IN')}`
    return isNegative ? `-${formatted}` : formatted
  }

  // Exact number formatter like ₹4,80,000
  const formatExactCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0'
    return `₹${Number(amount).toLocaleString('en-IN')}`
  }

  // Format Date (e.g. 24 May 2025)
  const formatTransactionDate = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    const day = d.getDate()
    const month = d.toLocaleString('en-GB', { month: 'short' })
    const year = d.getFullYear()
    return `${day} ${month} ${year}`
  }

  // Site core metrics
  const siteName = site.name || 'Site'
  const location = site.location || '-'
  const clientName = site.siteOwner || site.particulars || site.clientName || '-'

  // Dynamic calculations based on actual site & expenses
  const projectBudget = Number(site.totalBudget !== undefined ? site.totalBudget : (site.projectValue || 0))
  const calculatedExpensesSpent = siteExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const calculatedMaterialsSpent = materialRecords.reduce((s, m) => s + Number(m.totalCost || m.amount || 0), 0)
  const dynamicTotalSpent = Math.max(calculatedExpensesSpent, calculatedMaterialsSpent)
  const totalSpent = dynamicTotalSpent > 0 ? dynamicTotalSpent : Number(site.totalSpent || 0)

  const spentPercent = projectBudget > 0 ? Math.min(100, Math.round((totalSpent / projectBudget) * 100)) : 0

  // Total amount paid for expenses / material purchases associated with the selected construction site
  const totalSitePaid = siteExpenses.reduce((sum, e) => {
    const rawPaid = e.paidAmount !== undefined && e.paidAmount !== null
      ? Number(e.paidAmount)
      : (e.status === 'Paid' ? Number(e.amount || 0) : 0)
    return sum + (isNaN(rawPaid) ? 0 : rawPaid)
  }, 0)

  const paidPercent = totalSpent > 0 ? Math.min(100, Math.round((totalSitePaid / totalSpent) * 100)) : 0

  // Client Received & Pending calculations
  const clientPaymentsSum = clientPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
  const clientReceived = clientPayments.length > 0 ? clientPaymentsSum : Number(site.totalReceived || 0)
  const pendingAmount = clientReceived - totalSitePaid
  const projectPending = Math.max(0, projectBudget - clientReceived)

  // Real site transactions only

  const displayTransactions = (siteExpenses || []).slice(0, 5).map((e) => ({
        _id: e._id,
        description: e.category || e.remark || 'Expense Item',
        date: e.date,
        category: e.category || 'Material',
        amount: e.amount || 0,
        iconType: e.category?.toLowerCase() === 'labour' ? 'labour' : 'material',
      }))

  // Site-specific labour expenses from expenses dataset
  const directLabourExpenses = siteExpenses.filter(
    (e) => (e.category || '').toLowerCase() === 'labour'
  )

  // Calculate each worker's metrics cleanly
  // Formula: Outstanding = Total Wages Earned - Total Paid
  const workersWithMetrics = useMemo(() => {
    return siteWorkers.map((w) => {
      const dailyRate = Number(w.dailyRate || 0)
      const totalWagesEarned = Number(
        w.wagesEarned !== undefined && w.wagesEarned !== '' && Number(w.wagesEarned) > 0
          ? w.wagesEarned
          : (w.totalAmount || dailyRate || 0)
      )
      const totalPaid = Number(w.totalPaid !== undefined ? w.totalPaid : (w.advanceAmount || 0))
      const outstanding = Math.max(0, totalWagesEarned - totalPaid)

      return {
        ...w,
        dailyRate,
        wagesEarned: totalWagesEarned,
        totalPaid,
        outstanding,
      }
    })
  }, [siteWorkers])

  // Worker advance payments / wages paid for this site
  const workerAdvanceExpenses = workersWithMetrics
    .filter((w) => Number(w.advanceAmount) > 0 || Number(w.totalPaid) > 0)
    .map((w) => ({
      _id: `worker-adv-${w._id || w.id}`,
      date: w.joiningDate || w.createdAt,
      category: 'Labour',
      remark: w.remarks || `Advance payment to ${w.name} (${w.trade || 'Worker'})`,
      amount: Number(w.totalPaid || w.advanceAmount || 0),
      paidAmount: Number(w.totalPaid || w.advanceAmount || 0),
      pendingAmount: w.outstanding,
      paymentMethod: w.bankName || 'Bank Transfer',
      isWorkerPayment: true,
      workerName: w.name,
      trade: w.trade,
    }))

  // Combined site labour expenses
  const allLabourExpenses = [...directLabourExpenses, ...workerAdvanceExpenses]

  // Labour workforce metrics
  const totalLabourWorkers = siteWorkers.length
  const totalWagesEarned = workersWithMetrics.reduce((acc, w) => acc + w.wagesEarned, 0)
  const totalWorkersPaid = workersWithMetrics.reduce((acc, w) => acc + w.totalPaid, 0)
  const totalWorkersOutstanding = workersWithMetrics.reduce((acc, w) => acc + w.outstanding, 0)

  // Direct labour expenses (if any exist in expenses table)
  const totalExpensePaid = directLabourExpenses.reduce((acc, e) => acc + Number(e.paidAmount || 0), 0)
  const totalExpensePending = directLabourExpenses.reduce((acc, e) => acc + Number(e.pendingAmount || 0), 0)

  // Total Paid and Total Pending amounts for the Labour summary
  const totalLabourPaid = totalWorkersPaid + totalExpensePaid
  const totalLabourPending = totalWorkersOutstanding + totalExpensePending

  // Category breakdown calculation
  const materialSpent = siteExpenses
    .filter((e) => (e.category || '').toLowerCase() === 'material')
    .reduce((s, e) => s + (e.amount || 0), 0)
  const labourSpent = totalLabourPaid > 0
    ? totalLabourPaid
    : directLabourExpenses.reduce((s, e) => s + (e.amount || 0), 0)

  const materialsPercent = totalSpent > 0 && materialSpent > 0
    ? Math.min(100, Math.round((materialSpent / totalSpent) * 100))
    : 0
  const labourPercent = totalSpent > 0 && labourSpent > 0
    ? Math.min(100, Math.round((labourSpent / totalSpent) * 100))
    : 0

  const subTabs = ['Overview', 'Expenses', 'Materials', 'Labour', 'Client Payments', 'Suppliers']

  const getTxIcon = (type) => {
    switch (type) {
      case 'labour':
        return <User size={16} />
      case 'equipment':
        return <Wrench size={16} />
      case 'material':
      default:
        return <Package size={16} />
    }
  }

  return (
    <div className="site-detail-page">
      {/* 1. Back to all sites Link */}
      <button type="button" className="site-detail-back-btn" onClick={onBack}>
        <ArrowLeft size={15} />
        <span>Back to all sites</span>
      </button>

      {/* 2. Page Header: Title + Meta and Top Action Buttons */}
      <div className="site-detail-header-row">
        <div className="site-detail-title-col">
          <h1 className="site-detail-title">{siteName}</h1>
          <div className="site-detail-meta-row">
            <span className="site-detail-meta-item">
              <MapPin size={13} className="site-meta-icon" />
              <span>{location}</span>
            </span>
            <span className="site-detail-meta-item">
              <User size={13} className="site-meta-icon" />
              <span>{clientName}</span>
            </span>
          </div>
        </div>

        <div className="site-detail-actions-col">
          <button
            type="button"
            className="site-detail-action-btn site-btn-outline"
            onClick={onOpenAddWorker || onOpenAddExpense}
          >
            <Plus size={15} />
            <span>Add Labour</span>
          </button>
          <button
            type="button"
            className="site-detail-action-btn site-btn-outline"
            onClick={onOpenAddExpense}
          >
            <Plus size={15} />
            <span>Add Material</span>
          </button>
          <button
            type="button"
            className="site-detail-action-btn site-btn-solid-blue"
            onClick={onOpenAddExpense}
          >
            <Plus size={15} />
            <span>Add Expenses</span>
          </button>
        </div>
      </div>

      {/* 3. Top Summary Metric Cards */}
      <div className="site-detail-stat-grid">

        {/* Card 1: Total Spent */}
        <div className="site-detail-card">
          <span className="site-card-label">Total Spent</span>
          <div className="site-card-val">{formatIndianCurrency(totalSpent)}</div>
          <span className="site-card-desc">{spentPercent}% utilized</span>
        </div>

        {/* Card 2: Paid Amount */}
        <div className="site-detail-card">
          <span className="site-card-label">Paid Amount</span>
          <div className="site-card-val">{formatIndianCurrency(totalSitePaid)}</div>
          <span className="site-card-desc">
            {totalSpent > 0 ? `${paidPercent}% of spent` : 'Total expenses paid'}
          </span>
        </div>

        {/* Card 3: Client Received */}
        <div className="site-detail-card">
          <span className="site-card-label">Client Received</span>
          <div className="site-card-val">{formatIndianCurrency(clientReceived)}</div>
          <span className="site-card-desc">73% collected</span>
        </div>

        {/* Card 4: Pending */}
        <div className="site-detail-card site-card-highlight">
          <span className="site-card-label">Pending</span>
          <div className="site-card-val site-card-val-red">{formatIndianCurrency(pendingAmount)}</div>
          <span className="site-card-desc">Client Receive − Paid Amount</span>
        </div>

        {/* Card 5: Client Pending (Project Budget - Client Received) */}
        <div className="site-detail-card site-card-highlight">
          <span className="site-card-label">Client Pending</span>
          <div className="site-card-val site-card-val-cyan">{formatIndianCurrency(projectPending)}</div>
          <span className="site-card-desc">Project Budget − Client Received</span>
        </div>
      </div>

      {/* 4. Sub-Navigation Tabs */}
      <div className="site-detail-subnav-section">
        <h2 className="site-detail-subnav-heading">{siteName}</h2>
        <div className="site-detail-tabs-bar">
          {subTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`site-detail-tab-btn ${activeSubTab === tab ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Main Content Area: Split 2-Column Overview */}
      {activeSubTab === 'Overview' && (
        <div className="site-detail-overview-grid">
          {/* Left Box: Expense breakdown */}
          <div className="site-detail-box site-breakdown-box">
            <h3 className="site-box-title">Expense breakdown</h3>

            <div className="breakdown-list">
              {/* Materials Bar */}
              <div className="breakdown-item">
                <span className="breakdown-name">Materials</span>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill breakdown-fill-navy"
                    style={{ width: `${materialsPercent}%` }}
                  />
                </div>
                <span className="breakdown-percent">{materialsPercent}%</span>
              </div>

              {/* Labour Bar */}
              <div className="breakdown-item">
                <span className="breakdown-name">
                  Labour{totalLabourWorkers > 0 ? ` (${totalLabourWorkers} ${totalLabourWorkers === 1 ? 'Worker' : 'Workers'})` : ''}
                </span>
                <div className="breakdown-bar-track">
                  <div
                    className="breakdown-bar-fill breakdown-fill-orange"
                    style={{ width: `${labourPercent}%` }}
                  />
                </div>
                <span className="breakdown-percent">{labourPercent}%</span>
              </div>
            </div>
          </div>

          {/* Right Box: Recent Transactions */}
          <div className="site-detail-box site-transactions-box">
            <div className="site-box-header-row">
              <div>
                <h3 className="site-box-title">Recent Transactions</h3>
                <p className="site-box-subtitle">Latest activity on this site</p>
              </div>
              <button
                type="button"
                className="site-box-link"
                onClick={() => setActiveSubTab('Expenses')}
              >
                View all
              </button>
            </div>

            <div className="transactions-list">
              {displayTransactions.map((tx) => (
                <div key={tx._id} className="transaction-item">
                  <div className="tx-icon-box">
                    {getTxIcon(tx.iconType)}
                  </div>
                  <div className="tx-details">
                    <span className="tx-name">{tx.description}</span>
                    <span className="tx-meta">
                      {formatTransactionDate(tx.date)} · {tx.category}
                    </span>
                  </div>
                  <div className="tx-amount">{formatExactCurrency(tx.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab: Shows actual expense records assigned to this site */}
      {activeSubTab === 'Expenses' && (
        <div className="site-detail-box" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="sites-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th className="th-date">DATE</th>
                  <th className="th-desc">DESCRIPTION</th>
                  <th className="th-cat">CATEGORY</th>
                  <th className="th-amount">AMOUNT</th>
                  <th className="th-paid">PAID</th>
                  <th className="th-pending">PENDING</th>
                </tr>
              </thead>
              <tbody>
                {siteExpenses.length > 0 ? (
                  siteExpenses
                    .slice((expensesPage - 1) * expensesPageSize, expensesPage * expensesPageSize)
                    .map((item) => (
                    <tr key={item._id} className="expense-row">
                      <td className="td-date">
                        {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="td-description">{item.category || item.remark || '-'}</td>
                      <td className="td-category">{item.category || 'Material'}</td>
                      <td className="td-amount">{formatExactCurrency(item.amount)}</td>
                      <td className="td-paid">
                        {item.paidAmount ? formatExactCurrency(item.paidAmount) : '-'}
                      </td>
                      <td className="td-pending">
                        {item.pendingAmount ? (
                          <span style={{ color: '#E11D48', fontWeight: 600 }}>
                            {formatExactCurrency(item.pendingAmount)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      No expenses currently recorded for {siteName}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {siteExpenses.length > 0 && (
            <TablePagination
              currentPage={expensesPage}
              pageSize={expensesPageSize}
              totalRecords={siteExpenses.length}
              onPageChange={setExpensesPage}
              onPageSizeChange={(newSize) => {
                setExpensesPageSize(newSize)
                setExpensesPage(1)
              }}
              style={{ padding: '14px 20px', borderTop: '1px solid #E5EAF1', margin: 0 }}
            />
          )}
        </div>
      )}

      {/* Materials Tab */}
      {activeSubTab === 'Materials' && (
        <>
        <div className="site-detail-box" style={{ padding: '0', overflow: 'hidden' }}>

          {/* Material Filter Row */}
          <div className="sdp-mat-filter-row">
            <label className="sdp-mat-filter-label" htmlFor="sdp-mat-filter-select">
              Filter by Material:
            </label>
            <select
              id="sdp-mat-filter-select"
              className="sdp-mat-filter-select form-input"
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
            >
              <option value="All Materials">All Materials</option>
              {uniqueMaterialNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {materialFilter !== 'All Materials' && (
              <button
                type="button"
                className="sdp-mat-filter-clear"
                onClick={() => setMaterialFilter('All Materials')}
                title="Reset filter"
              >
                Clear
              </button>
            )}
            <span className="sdp-mat-filter-count">
              {filteredMaterialRecords.length} record{filteredMaterialRecords.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="sites-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th className="th-date">DATE</th>
                  <th className="th-desc">MATERIAL / ITEM</th>
                  <th className="th-amount">QUANTITY</th>
                  <th className="th-amount">RATE</th>
                  <th className="th-amount">AMOUNT</th>
                  <th className="th-paid">PAID</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterialRecords.length > 0 ? (
                  filteredMaterialRecords
                    .slice((matPage - 1) * matPageSize, matPage * matPageSize)
                    .map((item) => (
                    <tr key={item._id || item.id} className="expense-row">
                      <td className="td-date">
                        {item.purchaseDate || item.date
                          ? new Date(item.purchaseDate || item.date).toLocaleDateString('en-GB')
                          : '-'}
                      </td>
                      <td className="td-description">{item.category || '-'}</td>
                      <td className="td-amount">{item.quantity ? `${item.quantity} ${item.unit || ''}` : '-'}</td>
                      <td className="td-amount">
                        {item.ratePerUnit || item.unitPrice
                          ? formatExactCurrency(item.ratePerUnit || item.unitPrice)
                          : item.quantity && (item.totalCost || item.amount)
                          ? formatExactCurrency((item.totalCost || item.amount) / item.quantity)
                          : '-'}
                      </td>
                      <td className="td-amount">
                        {formatExactCurrency(item.totalCost !== undefined ? item.totalCost : item.amount)}
                      </td>
                      <td className="td-paid">{item.paidAmount ? formatExactCurrency(item.paidAmount) : '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      {materialFilter === 'All Materials'
                        ? `No material expenses currently recorded for ${siteName}.`
                        : `No records found for "${materialFilter}".`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredMaterialRecords.length > 0 && (
            <TablePagination
              currentPage={matPage}
              pageSize={matPageSize}
              totalRecords={filteredMaterialRecords.length}
              onPageChange={setMatPage}
              onPageSizeChange={(newSize) => {
                setMatPageSize(newSize)
                setMatPage(1)
              }}
              style={{ padding: '14px 20px', borderTop: '1px solid #E5EAF1', margin: 0 }}
            />
          )}
        </div>

        {/* Material Summary Cards – below the Materials table */}
        {materialSummaryCards.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              fontSize: '13.5px',
              fontWeight: 700,
              color: '#172033',
              marginBottom: '12px',
              letterSpacing: '0.1px',
            }}>
              Material-wise Summary
            </div>
            <div className="mat-summary-cards-grid">
              {materialSummaryCards.map((card) => (
                <div key={card.name} className="mat-summary-card">
                  {/* Card Header */}
                  <div className="mat-summary-card-header">
                    <div className="mat-summary-card-name" title={card.name}>
                      {card.name}
                    </div>
                    <div className="mat-summary-card-pct-badge" style={{
                      backgroundColor: card.remainingPercent === 0 ? '#ECFDF5' : '#FFF7ED',
                      color: card.remainingPercent === 0 ? '#16A34A' : '#D97706',
                    }}>
                      {card.remainingPercent}% pending
                    </div>
                  </div>

                  {/* Total Amount */}
                  <div style={{ marginTop: '12px' }}>
                    <div className="mat-summary-card-label">Total Amount</div>
                    <div className="mat-summary-card-total">{formatExactCurrency(card.totalAmount)}</div>
                  </div>

                  {/* Progress bar */}
                  <div className="mat-summary-progress-bg">
                    <div
                      className="mat-summary-progress-fill"
                      style={{
                        width: `${Math.min(100, card.totalAmount > 0 ? Math.round((card.paidAmount / card.totalAmount) * 100) : 0)}%`,
                      }}
                    />
                  </div>

                  {/* Paid / Pending row */}
                  <div className="mat-summary-card-row">
                    <div>
                      <div className="mat-summary-card-label">Paid</div>
                      <div className="mat-summary-card-paid">{formatExactCurrency(card.paidAmount)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mat-summary-card-label">Pending</div>
                      <div className="mat-summary-card-pending" style={{
                        color: card.pendingAmount === 0 ? '#16A34A' : '#DC2626',
                      }}>
                        {formatExactCurrency(card.pendingAmount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      )}

      {/* Labour Tab */}
      {activeSubTab === 'Labour' && (
        <div className="site-detail-box" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Labour summary header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: '1px solid #E5EAF1',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Quick workforce financial summary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '12.5px',
                color: '#64748B',
              }}
            >
              <span>
                Total Paid:{' '}
                <strong style={{ color: '#16A34A', fontWeight: 600 }}>
                  {formatExactCurrency(totalLabourPaid)}
                </strong>
              </span>
              <span>•</span>
              <span>
                Pending:{' '}
                <strong style={{ color: totalLabourPending > 0 ? '#E11D48' : '#172033', fontWeight: 600 }}>
                  {formatExactCurrency(totalLabourPending)}
                </strong>
              </span>
            </div>
          </div>

          {/* Combined Labour Table */}
          <div className="sites-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th className="th-date" style={{ padding: '14px 20px' }}>DATE</th>
                  <th className="th-desc" style={{ padding: '14px 20px', width: '22%' }}>WORKER</th>
                  <th className="th-cat" style={{ padding: '14px 20px', width: '15%' }}>TRADE</th>
                  <th className="th-amount" style={{ padding: '14px 20px', textAlign: 'right' }}>TOTAL AMOUNT</th>
                  <th className="th-paid" style={{ padding: '14px 20px', textAlign: 'right' }}>PAID AMOUNT</th>
                  <th className="th-pending" style={{ padding: '14px 20px', textAlign: 'right' }}>PENDING</th>
                </tr>
              </thead>
              <tbody>
                {loadingLabour ? (
                  <tr>
                    <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      Loading labour records for {siteName}...
                    </td>
                  </tr>
                ) : workersWithMetrics.length > 0 ? (
                  workersWithMetrics
                    .slice((labourPage - 1) * labourPageSize, labourPage * labourPageSize)
                    .map((w) => (
                    <tr key={w._id || w.id} className="expense-row">
                      <td className="td-date" style={{ padding: '14px 20px' }}>
                        {w.joiningDate || w.createdAt
                          ? new Date(w.joiningDate || w.createdAt).toLocaleDateString('en-GB')
                          : '-'}
                      </td>
                      <td className="td-description" style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#172033', fontSize: '13.5px' }}>{w.name}</div>
                        {w.phone && (
                          <div style={{ fontSize: '12px', color: '#70829F', marginTop: '2px' }}>
                            {w.phone}
                          </div>
                        )}
                      </td>
                      <td className="td-category" style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            backgroundColor: '#F1F5F9',
                            color: '#334155',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          {w.trade || 'Worker'}
                        </span>
                      </td>
                      <td className="td-amount" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500, color: '#172033' }}>
                        {formatExactCurrency(w.wagesEarned)}
                      </td>
                      <td className="td-paid" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600, color: '#16A34A' }}>
                        {formatExactCurrency(w.totalPaid)}
                      </td>
                      <td className="td-pending" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 600 }}>
                        <span style={{ color: w.outstanding > 0 ? '#E11D48' : '#172033' }}>
                          {formatExactCurrency(w.outstanding)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      No labour records currently registered for {siteName}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {workersWithMetrics.length > 0 && (
            <TablePagination
              currentPage={labourPage}
              pageSize={labourPageSize}
              totalRecords={workersWithMetrics.length}
              onPageChange={setLabourPage}
              onPageSizeChange={(newSize) => {
                setLabourPageSize(newSize)
                setLabourPage(1)
              }}
              style={{ padding: '14px 20px', borderTop: '1px solid #E5EAF1', margin: 0 }}
            />
          )}
        </div>
      )}

      {/* Suppliers Tab */}
      {activeSubTab === 'Suppliers' && (
        <div className="site-detail-box" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="sites-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th className="th-desc" style={{ padding: '16px 20px', width: '22%' }}>SUPPLIER</th>
                  <th className="th-cat" style={{ padding: '16px 20px', width: '18%' }}>CATEGORIES</th>
                  <th className="th-desc" style={{ padding: '16px 20px', width: '16%' }}>CONTACT</th>
                  <th className="th-amount" style={{ padding: '16px 20px', width: '14%', textAlign: 'right' }}>TOTAL PURCHASE</th>
                  <th className="th-paid" style={{ padding: '16px 20px', width: '12%', textAlign: 'right' }}>TOTAL PAID</th>
                  <th className="th-pending" style={{ padding: '16px 20px', width: '10%', textAlign: 'right' }}>PENDING</th>
                  <th className="th-date" style={{ padding: '16px 20px', width: '8%', textAlign: 'center' }}>LAST</th>
                </tr>
              </thead>
              <tbody>
                {loadingSuppliers ? (
                  <tr>
                    <td colSpan={7} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      Loading suppliers for {siteName}...
                    </td>
                  </tr>
                ) : siteSuppliers.length > 0 ? (
                  siteSuppliers
                    .slice((suppPage - 1) * suppPageSize, suppPage * suppPageSize)
                    .map((item, idx) => (
                    <tr key={item.id || idx} className="expense-row">
                      <td className="td-description" style={{ padding: '16px 20px', fontWeight: 600, color: '#172033' }}>
                        <div>{item.name}</div>
                        {item.companyName && (
                          <div style={{ fontSize: '12px', color: '#70829F', fontWeight: 400, marginTop: '2px' }}>
                            {item.companyName}
                          </div>
                        )}
                      </td>
                      <td className="td-category" style={{ padding: '16px 20px', color: '#70829F' }}>
                        {item.categoriesStr}
                      </td>
                      <td className="td-description" style={{ padding: '16px 20px', color: '#70829F' }}>
                        <div>{item.phone || '—'}</div>
                        {item.contactPerson && (
                          <div style={{ fontSize: '12px', color: '#94A3B8' }}>{item.contactPerson}</div>
                        )}
                      </td>
                      <td className="td-amount" style={{ padding: '16px 20px', fontWeight: 600, color: '#172033', textAlign: 'right' }}>
                        {formatExactCurrency(item.totalPurchase)}
                      </td>
                      <td className="td-paid" style={{ padding: '16px 20px', fontWeight: 600, color: '#16A34A', textAlign: 'right' }}>
                        {formatExactCurrency(item.totalPaid)}
                      </td>
                      <td className="td-pending" style={{ padding: '16px 20px', fontWeight: 600, textAlign: 'right' }}>
                        {item.outstanding > 0 ? (
                          <span style={{ color: '#E11D48' }}>{formatExactCurrency(item.outstanding)}</span>
                        ) : (
                          <span style={{ color: '#70829F' }}>—</span>
                        )}
                      </td>
                      <td className="td-date" style={{ padding: '16px 20px', textAlign: 'center', color: '#70829F' }}>
                        {item.lastDate ? new Date(item.lastDate).toLocaleDateString('en-GB') : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      No suppliers currently associated with {siteName}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {siteSuppliers.length > 0 && (
            <TablePagination
              currentPage={suppPage}
              pageSize={suppPageSize}
              totalRecords={siteSuppliers.length}
              onPageChange={setSuppPage}
              onPageSizeChange={(newSize) => {
                setSuppPageSize(newSize)
                setSuppPage(1)
              }}
              style={{ padding: '14px 20px', borderTop: '1px solid #E5EAF1', margin: 0 }}
            />
          )}
        </div>
      )}

      {/* Client Payments Tab: Shows actual client payment records for this site */}
      {activeSubTab === 'Client Payments' && (
        <div className="site-detail-box" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="sites-table-scroll">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th className="th-date" style={{ padding: '16px 20px', width: '15%' }}>PAYMENT DATE</th>
                  <th className="th-desc" style={{ padding: '16px 20px', width: '20%' }}>CLIENT NAME</th>
                  <th className="th-amount" style={{ padding: '16px 20px', width: '15%', textAlign: 'right' }}>AMOUNT</th>
                  <th className="th-cat" style={{ padding: '16px 20px', width: '16%' }}>PAYMENT METHOD</th>
                  <th className="th-desc" style={{ padding: '16px 20px', width: '18%' }}>BANK ACCOUNT</th>
                  <th className="th-desc" style={{ padding: '16px 20px', width: '16%' }}>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {loadingPayments ? (
                  <tr>
                    <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      Loading client payments for {siteName}...
                    </td>
                  </tr>
                ) : clientPayments.length > 0 ? (
                  clientPayments
                    .slice((clientPayPage - 1) * clientPayPageSize, clientPayPage * clientPayPageSize)
                    .map((payment) => (
                    <tr key={payment.id || payment._id} className="expense-row">
                      <td className="td-date" style={{ padding: '16px 20px' }}>
                        {payment.paymentDate ? formatTransactionDate(payment.paymentDate) : '—'}
                      </td>
                      <td className="td-description" style={{ padding: '16px 20px', fontWeight: 600, color: '#172033' }}>
                        {payment.clientName || clientName || '—'}
                      </td>
                      <td className="td-amount" style={{ padding: '16px 20px', fontWeight: 600, color: '#16A34A', textAlign: 'right' }}>
                        +{formatExactCurrency(payment.amount)}
                      </td>
                      <td className="td-category" style={{ padding: '16px 20px', color: '#70829F' }}>
                        {payment.paymentMethod || 'Bank transfer'}
                      </td>
                      <td className="td-description" style={{ padding: '16px 20px', color: '#172033' }}>
                        <div>{payment.bankName || '—'}</div>
                        {payment.accountNumber && (
                          <div style={{ fontSize: '12px', color: '#70829F', marginTop: '2px' }}>
                            •••• {String(payment.accountNumber).slice(-4)}
                          </div>
                        )}
                      </td>
                      <td className="td-description" style={{ padding: '16px 20px', color: '#70829F' }}>
                        {payment.remark || payment.reference || payment.title || '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                      No client payments found for this site.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {clientPayments.length > 0 && (
            <TablePagination
              currentPage={clientPayPage}
              pageSize={clientPayPageSize}
              totalRecords={clientPayments.length}
              onPageChange={setClientPayPage}
              onPageSizeChange={(newSize) => {
                setClientPayPageSize(newSize)
                setClientPayPage(1)
              }}
              style={{ padding: '14px 20px', borderTop: '1px solid #E5EAF1', margin: 0 }}
            />
          )}
        </div>
      )}
    </div>
  )
}
