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
      materialService.getAll({ siteId }).catch(() => ({ materials: [] })),
      supplierService.getAll().catch(() => []),
      expenseService.getAll({ siteId }).catch(() => ({ expenses: [] })),
      siteService.getPayments(siteId).catch(() => []),
      labourService.getAll({ siteId }).catch(() => ({ workers: [] })),
    ])
      .then(([matRes, supRes, expRes, payRes, labRes]) => {
        if (!active) return
        setSiteMaterials(matRes?.materials || (Array.isArray(matRes) ? matRes : []))
        setAllSuppliers(Array.isArray(supRes) ? supRes : (supRes?.suppliers || []))
        const loadedExpenses = expRes?.expenses || (Array.isArray(expRes) ? expRes : [])
        if (loadedExpenses.length > 0) {
          setSiteExpensesData(loadedExpenses)
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

  // Filter site-specific expenses (uses fresh siteExpensesData if loaded)
  const baseExpenses = siteExpensesData.length > 0 ? siteExpensesData : expenses
  const siteExpenses = baseExpenses.filter((e) => {
    if (!site || !e) return false
    const eSiteId = e.site?._id || e.site
    if (site._id && (eSiteId === site._id || String(eSiteId) === String(site._id))) {
      return true
    }
    const eSiteName = (e.site?.name || '').trim().toLowerCase()
    const targetName = (site.name || '').trim().toLowerCase()
    return eSiteName && targetName && eSiteName === targetName
  })

  // Material purchase records for the Materials tab (siteMaterials is the primary source of truth)
  const materialRecords = siteMaterials.length > 0
    ? siteMaterials
    : siteExpenses.filter((e) => e.category && !['labour', 'equipment', 'transport', 'fuel', 'utilities'].includes(e.category.toLowerCase()))

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

  // Indian Currency Formatter (Cr, L, or formatted string)
  const formatIndianCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0'
    const num = Number(amount)
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`
    return `₹${num.toLocaleString('en-IN')}`
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
  const totalSpent = site.totalSpent !== undefined && site.totalSpent !== null ? Number(site.totalSpent) : expenses.filter((e) => e.site?._id === site._id || e.site === site._id).reduce((s, e) => s + (e.amount || 0), 0)

  const spentPercent = projectBudget > 0 ? Math.min(100, Math.round((totalSpent / projectBudget) * 100)) : 0

  // Client Received & Balance Receivable calculations
  const clientReceived = Number(site.totalReceived || 0) // default ~1.35 Cr (73% collected)
  const balanceReceivable = Math.max(0, projectBudget - clientReceived)

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
      const attendanceDays = Array.isArray(w.attendance)
        ? w.attendance.filter((a) => a && (a.status === 'Present' || a.status === 'Active' || !a.status)).length
        : Number(w.attendanceDays || w.daysWorked || 0)
      const wagesFromAttendance = attendanceDays > 0 ? attendanceDays * dailyRate : 0
      const recordWagesEarned = Number(w.wagesEarned || 0)
      const totalWagesEarned = wagesFromAttendance > 0 ? wagesFromAttendance : recordWagesEarned
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

      {/* 3. Top Summary Metric Cards (4 Cards in a Row) */}
      <div className="site-detail-stat-grid">
        {/* Card 1: Project Budget */}
        <div className="site-detail-card">
          <span className="site-card-label">Project Budget</span>
          <div className="site-card-val">{formatIndianCurrency(projectBudget)}</div>
          <span className="site-card-desc">Total contract value</span>
        </div>

        {/* Card 2: Total Spent */}
        <div className="site-detail-card">
          <span className="site-card-label">Total Spent</span>
          <div className="site-card-val">{formatIndianCurrency(totalSpent)}</div>
          <span className="site-card-desc">{spentPercent}% utilized</span>
        </div>

        {/* Card 3: Client Received */}
        <div className="site-detail-card">
          <span className="site-card-label">Client Received</span>
          <div className="site-card-val">{formatIndianCurrency(clientReceived)}</div>
          <span className="site-card-desc">73% collected</span>
        </div>

        {/* Card 4: Pending (Highlighted in Teal/Blue) */}
        <div className="site-detail-card site-card-highlight">
          <span className="site-card-label">Pending</span>
          <div className="site-card-val site-card-val-cyan">{formatIndianCurrency(balanceReceivable)}</div>
          <span className="site-card-desc">Next due 06 Jun</span>
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
                  siteExpenses.map((item) => (
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
        </div>
      )}

      {/* Materials Tab */}
      {activeSubTab === 'Materials' && (
        <div className="site-detail-box" style={{ padding: '0', overflow: 'hidden' }}>
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
                {materialRecords.length > 0 ? (
                  materialRecords.map((item) => (
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
                      No material expenses currently recorded for {siteName}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Labour Tab */}
      {activeSubTab === 'Labour' && (
        <div className="site-detail-box" style={{ padding: '0', overflow: 'hidden' }}>
          {/* Sub-navigation bar inside Labour section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px 0 24px',
              borderBottom: '1px solid #E5EAF1',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '28px' }}>
              {[
                { id: 'Worker List', label: `Worker List (${totalLabourWorkers})` },
                { id: 'Attendance', label: 'Attendance' },
                { id: 'Labour Expenses', label: `Labour Expenses (${allLabourExpenses.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`site-detail-tab-btn ${activeLabourTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveLabourTab(tab.id)}
                  style={{ paddingBottom: '12px', fontSize: '13.5px' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick workforce financial summary */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                paddingBottom: '12px',
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

          {/* Subtab 1: Worker List */}
          {activeLabourTab === 'Worker List' && (
            <div className="sites-table-scroll">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th className="th-desc" style={{ padding: '14px 20px', width: '28%' }}>WORKER</th>
                    <th className="th-cat" style={{ padding: '14px 20px', width: '18%' }}>TRADE</th>
                    <th className="th-amount" style={{ padding: '14px 20px', width: '18%', textAlign: 'right' }}>DAILY RATE</th>
                    <th className="th-paid" style={{ padding: '14px 20px', width: '18%', textAlign: 'right' }}>TOTAL PAID</th>
                    <th className="th-pending" style={{ padding: '14px 20px', width: '18%', textAlign: 'right' }}>PENDING</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLabour ? (
                    <tr>
                      <td colSpan={5} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                        Loading labour records for {siteName}...
                      </td>
                    </tr>
                  ) : workersWithMetrics.length > 0 ? (
                    workersWithMetrics.map((w) => (
                      <tr key={w._id || w.id} className="expense-row">
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
                          {formatExactCurrency(w.dailyRate)}
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
                      <td colSpan={5} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                        No labour records currently registered for {siteName}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Subtab 2: Attendance */}
          {activeLabourTab === 'Attendance' && (
            <div className="sites-table-scroll">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th className="th-date" style={{ padding: '14px 20px', width: '16%' }}>DATE</th>
                    <th className="th-desc" style={{ padding: '14px 20px', width: '26%' }}>WORKER</th>
                    <th className="th-cat" style={{ padding: '14px 20px', width: '16%' }}>TRADE</th>
                    <th className="th-amount" style={{ padding: '14px 20px', width: '14%', textAlign: 'center' }}>STATUS</th>
                    <th className="th-amount" style={{ padding: '14px 20px', width: '14%', textAlign: 'right' }}>DAILY WAGE</th>
                    <th className="th-desc" style={{ padding: '14px 20px', width: '14%' }}>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {siteWorkers.length > 0 ? (
                    siteWorkers.map((w) => (
                      <tr key={`att-${w._id || w.id}`} className="expense-row">
                        <td className="td-date" style={{ padding: '14px 20px' }}>
                          {w.joiningDate
                            ? new Date(w.joiningDate).toLocaleDateString('en-GB')
                            : new Date().toLocaleDateString('en-GB')}
                        </td>
                        <td className="td-description" style={{ padding: '14px 20px', fontWeight: 600, color: '#172033' }}>
                          {w.name}
                        </td>
                        <td className="td-category" style={{ padding: '14px 20px' }}>
                          {w.trade || 'Worker'}
                        </td>
                        <td className="td-amount" style={{ padding: '14px 20px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#DCFCE7',
                              color: '#15803D',
                            }}
                          >
                            {w.status || 'Active'}
                          </span>
                        </td>
                        <td className="td-amount" style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 500, color: '#172033' }}>
                          {formatExactCurrency(w.dailyRate)}
                        </td>
                        <td className="td-description" style={{ padding: '14px 20px', color: '#64748B', fontSize: '12.5px' }}>
                          {w.remarks || 'Regular daily shift'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                        No attendance records currently available for {siteName}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Subtab 3: Labour Expenses */}
          {activeLabourTab === 'Labour Expenses' && (
            <div className="sites-table-scroll">
              <table className="expenses-table">
                <thead>
                  <tr>
                    <th className="th-date">DATE</th>
                    <th className="th-desc">LABOUR DESCRIPTION</th>
                    <th className="th-amount">AMOUNT</th>
                    <th className="th-paid">PAID</th>
                    <th className="th-pending">PENDING</th>
                  </tr>
                </thead>
                <tbody>
                  {allLabourExpenses.length > 0 ? (
                    allLabourExpenses.map((item) => (
                      <tr key={item._id} className="expense-row">
                        <td className="td-date">
                          {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="td-description">
                          {item.remark || item.category || 'Labour Charges'}
                          {item.workerName && (
                            <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>
                              ({item.trade || 'Worker'})
                            </span>
                          )}
                        </td>
                        <td className="td-amount">{formatExactCurrency(item.amount)}</td>
                        <td className="td-paid">{item.paidAmount ? formatExactCurrency(item.paidAmount) : '-'}</td>
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
                      <td colSpan={5} className="td-empty" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
                        No labour expenses currently recorded for {siteName}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                  siteSuppliers.map((item, idx) => (
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
                  clientPayments.map((payment) => (
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
        </div>
      )}
    </div>
  )
}
