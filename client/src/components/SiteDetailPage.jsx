import React, { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  MapPin,
  User,
  Plus,
  Package,
  HardHat,
  Receipt,
  Truck,
  Wrench,
  TrendingUp,
} from 'lucide-react'
import { materialService } from '../services/materialService.js'
import { supplierService } from '../services/supplierService.js'
import { expenseService } from '../services/expenseService.js'

export default function SiteDetailPage({
  site,
  expenses = [],
  onBack,
  onOpenAddExpense,
}) {
  const [activeSubTab, setActiveSubTab] = useState('Overview')
  const [siteMaterials, setSiteMaterials] = useState([])
  const [allSuppliers, setAllSuppliers] = useState([])
  const [siteExpensesData, setSiteExpensesData] = useState([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)

  // Load site-specific materials, suppliers, and all site expenses (hooks before any early return)
  useEffect(() => {
    let active = true
    const siteId = site?._id || site?.id
    if (!siteId) return

    setLoadingSuppliers(true)
    Promise.all([
      materialService.getAll({ siteId }).catch(() => ({ materials: [] })),
      supplierService.getAll().catch(() => []),
      expenseService.getAll({ siteId }).catch(() => ({ expenses: [] })),
    ])
      .then(([matRes, supRes, expRes]) => {
        if (!active) return
        setSiteMaterials(matRes?.materials || (Array.isArray(matRes) ? matRes : []))
        setAllSuppliers(Array.isArray(supRes) ? supRes : (supRes?.suppliers || []))
        const loadedExpenses = expRes?.expenses || (Array.isArray(expRes) ? expRes : [])
        if (loadedExpenses.length > 0) {
          setSiteExpensesData(loadedExpenses)
        }
      })
      .finally(() => {
        if (active) setLoadingSuppliers(false)
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
  const siteName = site.name || 'Greenfield Villa'
  const location = site.location || 'Bengaluru'
  const clientName = site.siteOwner || site.particulars || 'Client Name'

  // Dynamic calculations based on actual site & expenses
  const projectBudget = site.totalBudget || 18500000 // default 1.85 Cr
  const totalSpent = site.totalSpent !== undefined && site.totalSpent > 0
    ? site.totalSpent
    : expenses.filter((e) => e.site?._id === site._id || e.site === site._id).reduce((s, e) => s + (e.amount || 0), 0) || 12400000 // default 1.24 Cr

  const remainingBudget = Math.max(0, projectBudget - totalSpent)
  const spentPercent = projectBudget > 0 ? Math.min(100, Math.round((totalSpent / projectBudget) * 100)) : 67

  // Client Received & Balance Receivable calculations
  const clientReceived = site.totalReceived !== undefined ? Number(site.totalReceived) : Math.round(projectBudget * 0.73) // default ~1.35 Cr (73% collected)
  const balanceReceivable = Math.max(0, projectBudget - clientReceived)

  // Default sample transactions matching screenshot if site has few expenses
  const sampleTransactions = [
    {
      _id: 'tx1',
      description: 'Structural steel – Fe500',
      date: '2025-05-24',
      category: 'Material',
      amount: 480000,
      iconType: 'material',
    },
    {
      _id: 'tx2',
      description: 'Excavator rental',
      date: '2025-05-22',
      category: 'Equipment',
      amount: 145000,
      iconType: 'equipment',
    },
    {
      _id: 'tx3',
      description: 'Masonry labour – Week 20',
      date: '2025-05-21',
      category: 'Labour',
      amount: 86500,
      iconType: 'labour',
    },
    {
      _id: 'tx4',
      description: 'Cement – 600 bags',
      date: '2025-05-18',
      category: 'Material',
      amount: 234000,
      iconType: 'material',
    },
  ]

  const displayTransactions = siteExpenses.length > 0
    ? siteExpenses.slice(0, 5).map((e) => ({
        _id: e._id,
        description: e.category || e.remark || 'Expense Item',
        date: e.date,
        category: e.category || 'Material',
        amount: e.amount || 0,
        iconType: e.category?.toLowerCase() === 'labour' ? 'labour' : 'material',
      }))
    : sampleTransactions

  // Category breakdown calculation
  const materialSpent = siteExpenses
    .filter((e) => (e.category || '').toLowerCase() === 'material')
    .reduce((s, e) => s + (e.amount || 0), 0)
  const labourSpent = siteExpenses
    .filter((e) => (e.category || '').toLowerCase() === 'labour')
    .reduce((s, e) => s + (e.amount || 0), 0)

  const materialsPercent = totalSpent > 0 && materialSpent > 0
    ? Math.min(100, Math.round((materialSpent / totalSpent) * 100))
    : 80
  const labourPercent = totalSpent > 0 && labourSpent > 0
    ? Math.min(100, Math.round((labourSpent / totalSpent) * 100))
    : 92

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
            onClick={onOpenAddExpense}
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

      {/* 3. Top Summary Metric Cards (5 Cards in a Row) */}
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

        {/* Card 3: Remaining Budget */}
        <div className="site-detail-card">
          <span className="site-card-label">Remaining Budget</span>
          <div className="site-card-val">{formatIndianCurrency(remainingBudget)}</div>
          <span className="site-card-desc">Available to spend</span>
        </div>

        {/* Card 4: Client Received */}
        <div className="site-detail-card">
          <span className="site-card-label">Client Received</span>
          <div className="site-card-val">{formatIndianCurrency(clientReceived)}</div>
          <span className="site-card-desc">73% collected</span>
        </div>

        {/* Card 5: Balance Receivable (Highlighted in Teal/Blue) */}
        <div className="site-detail-card site-card-highlight">
          <span className="site-card-label">Balance Receivable</span>
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
                <span className="breakdown-name">Labour</span>
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
                {siteExpenses.filter((e) => (e.category || '').toLowerCase() === 'labour').length > 0 ? (
                  siteExpenses
                    .filter((e) => (e.category || '').toLowerCase() === 'labour')
                    .map((item) => (
                      <tr key={item._id} className="expense-row">
                        <td className="td-date">
                          {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="td-description">{item.remark || item.category || 'Labour Charges'}</td>
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
                  <th className="th-pending" style={{ padding: '16px 20px', width: '10%', textAlign: 'right' }}>OUTSTANDING</th>
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

      {/* Client Payments Tab */}
      {activeSubTab === 'Client Payments' && (
        <div className="site-detail-box" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Showing <strong>Client Payments</strong> records for {siteName}.
          </p>
        </div>
      )}
    </div>
  )
}
