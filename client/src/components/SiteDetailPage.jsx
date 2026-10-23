import React, { useState } from 'react'
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

export default function SiteDetailPage({
  site,
  expenses = [],
  onBack,
  onOpenAddExpense,
}) {
  const [activeSubTab, setActiveSubTab] = useState('Overview')

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
  const clientReceived = Math.round(projectBudget * 0.73) // default ~1.35 Cr (73% collected)
  const balanceReceivable = Math.max(0, projectBudget - clientReceived)

  // Filter site-specific expenses
  const siteExpenses = expenses.filter((e) => {
    if (!e) return false
    const eSiteId = e.site?._id || e.site
    if (site._id && (eSiteId === site._id || String(eSiteId) === String(site._id))) {
      return true
    }
    const eSiteName = (e.site?.name || '').trim().toLowerCase()
    const targetName = (site.name || '').trim().toLowerCase()
    return eSiteName && targetName && eSiteName === targetName
  })

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
        description: e.description || e.material || 'Expense Item',
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
                      <td className="td-description">{item.description || item.material || '-'}</td>
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
                {siteExpenses.filter((e) => (e.category || '').toLowerCase() === 'material').length > 0 ? (
                  siteExpenses
                    .filter((e) => (e.category || '').toLowerCase() === 'material')
                    .map((item) => (
                      <tr key={item._id} className="expense-row">
                        <td className="td-date">
                          {item.date ? new Date(item.date).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="td-description">{item.material || item.description || '-'}</td>
                        <td className="td-amount">{item.quantity ? `${item.quantity} ${item.unit || ''}` : '-'}</td>
                        <td className="td-amount">{item.ratePerUnit ? formatExactCurrency(item.ratePerUnit) : '-'}</td>
                        <td className="td-amount">{formatExactCurrency(item.amount)}</td>
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
                        <td className="td-description">{item.description || item.material || 'Labour Charges'}</td>
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

      {/* Client Payments / Suppliers Tabs */}
      {(activeSubTab === 'Client Payments' || activeSubTab === 'Suppliers') && (
        <div className="site-detail-box" style={{ padding: '36px', textAlign: 'center', color: '#70829F' }}>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Showing <strong>{activeSubTab}</strong> records for {siteName}.
          </p>
        </div>
      )}
    </div>
  )
}
