import React, { useState } from 'react'
import {
  CreditCard,
  AlertTriangle,
  Plus,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Receipt,
  Eye,
  Pencil,
  Trash2,
  X,
  ArrowLeft,
  MoreHorizontal,
} from 'lucide-react'
import { labourService } from '../services/labourService.js'

export default function LabourPage({
  workers = [],
  summary = {},
  sites = [],
  onOpenAddWorker,
  loading = false,
}) {
  const [activeTab, setActiveTab] = useState('Materials')
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('All Sites')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  // Local list so delete/edit reflects instantly
  const [localWorkers, setLocalWorkers] = useState(null)

  // View worker detail page
  const [viewWorker, setViewWorker] = useState(null)
  const [detailTab, setDetailTab] = useState('Materials')

  // Edit modal
  const [editWorker, setEditWorker] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete loading id
  const [deletingId, setDeletingId] = useState(null)

  const formatExactCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00'
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Fallback sample workers matching reference screenshot if DB has none
  const sampleWorkers = [
    {
      _id: 'w1',
      name: 'Ramesh Kumar',
      phone: '+91234567892',
      trade: 'Mason',
      siteName: 'Aarav Heights',
      dailyRate: 1000,
      wagesEarned: 19950,
      totalPaid: 15000,
      outstanding: 4950,
    },
    {
      _id: 'w2',
      name: 'Suresh Yadav',
      phone: '+91234567892',
      trade: 'Carpenter',
      siteName: 'Greenfield Villa',
      dailyRate: 1100,
      wagesEarned: 13325,
      totalPaid: 10000,
      outstanding: 3325,
    },
    {
      _id: 'w3',
      name: 'Ramesh Kumar',
      phone: '+91234567892',
      trade: 'Electrician',
      siteName: 'Orchid Business Park',
      dailyRate: 650,
      wagesEarned: 23100,
      totalPaid: 22000,
      outstanding: 1100,
    },
    {
      _id: 'w4',
      name: 'Ramesh Kumar',
      phone: '+91234567892',
      trade: 'Helper',
      siteName: 'Aarav Heights',
      dailyRate: 950,
      wagesEarned: 20000,
      totalPaid: 12000,
      outstanding: 8000,
    },
    {
      _id: 'w5',
      name: 'Mahesh Patil',
      phone: '+91234567892',
      trade: 'Plumber',
      siteName: 'Greenfield Villa',
      dailyRate: 1200,
      wagesEarned: 18000,
      totalPaid: 10000,
      outstanding: 8000,
    },
  ]

  // Use localWorkers after an edit/delete, otherwise use prop workers
  const baseWorkers = localWorkers !== null ? localWorkers : workers

  const displayWorkers = baseWorkers.length > 0
    ? baseWorkers.map((w) => ({
        _id: w._id,
        name: w.name,
        phone: w.phone || '+91234567892',
        trade: w.trade || 'Mason',
        siteName: w.site?.name || w.siteName || 'N/A',
        dailyRate: w.dailyRate || 1000,
        wagesEarned: w.wagesEarned || 0,
        totalPaid: w.totalPaid || 0,
        outstanding: Math.max(0, (w.wagesEarned || 0) - (w.totalPaid || 0)),
        paymentType: w.paymentType || 'Daily',
        status: w.status || 'Active',
        address: w.address || '',
        remarks: w.remarks || '',
      }))
    : sampleWorkers

  // Dynamic summary values from props or calculated from dataset
  const totalWorkersCount = summary?.totalWorkers !== undefined
    ? summary.totalWorkers
    : displayWorkers.length

  const totalWagesEarned = summary?.wagesEarned !== undefined
    ? summary.wagesEarned
    : displayWorkers.reduce((acc, w) => acc + (w.wagesEarned || 0), 0)

  const totalPaidAmount = summary?.totalPaid !== undefined
    ? summary.totalPaid
    : displayWorkers.reduce((acc, w) => acc + (w.totalPaid || 0), 0)

  const totalOutstanding = summary?.outstanding !== undefined
    ? summary.outstanding
    : Math.max(0, totalWagesEarned - totalPaidAmount)

  // Filter workers based on search and site filter
  const filteredWorkers = displayWorkers.filter((worker) => {
    const matchesSearch =
      !search ||
      worker.name.toLowerCase().includes(search.toLowerCase()) ||
      worker.trade.toLowerCase().includes(search.toLowerCase()) ||
      worker.phone.toLowerCase().includes(search.toLowerCase())

    const matchesSite =
      siteFilter === 'All Sites' ||
      worker.siteName.toLowerCase() === siteFilter.toLowerCase()

    return matchesSearch && matchesSite
  })

  // Sample Payments matching reference screenshot
  const samplePayments = [
    {
      id: 'p1',
      date: '11/08/2026',
      workerName: 'Ramesh Kumar',
      siteName: 'Aarav Heights',
      type: 'Paid',
      method: 'UPI',
      amount: 15000,
      remark: 'Weekly settlement',
    },
    {
      id: 'p2',
      date: '11/08/2026',
      workerName: 'Suresh Yadav',
      siteName: 'Greenfield Villa',
      type: 'Paid',
      method: 'Cash',
      amount: 10000,
      remark: 'Weekly settlement',
    },
    {
      id: 'p3',
      date: '11/08/2026',
      workerName: 'Ramesh Kumar',
      siteName: 'Orchid Business Park',
      type: 'Advance',
      method: 'UPI',
      amount: 22000,
      remark: 'Adjusted against earned wages',
    },
    {
      id: 'p4',
      date: '11/08/2026',
      workerName: 'Ramesh Kumar',
      siteName: 'Aarav Heights',
      type: 'Paid',
      method: 'Bank Transfer',
      amount: 12000,
      remark: 'Wages cleared',
    },
  ]

  // Add real DB worker payments if any
  const dbPayments = displayWorkers
    .filter((w) => Number(w.totalPaid) > 0)
    .map((w, idx) => ({
      id: `dbp-${w._id || idx}`,
      date: w.joiningDate ? new Date(w.joiningDate).toLocaleDateString('en-GB') : '11/08/2026',
      workerName: w.name,
      siteName: w.siteName || w.site?.name || 'Aarav Heights',
      type: 'Paid',
      method: w.paymentType === 'Daily' ? 'Cash' : 'Bank Transfer',
      amount: Number(w.totalPaid),
      remark: w.remarks || 'Weekly settlement',
    }))

  const allPayments = [
    ...samplePayments,
    ...dbPayments.filter((dbp) => !samplePayments.some((sp) => sp.workerName === dbp.workerName)),
  ]

  const filteredPayments = allPayments.filter((p) => {
    const matchesSearch =
      !search ||
      p.workerName.toLowerCase().includes(search.toLowerCase()) ||
      p.remark.toLowerCase().includes(search.toLowerCase()) ||
      p.method.toLowerCase().includes(search.toLowerCase()) ||
      p.type.toLowerCase().includes(search.toLowerCase())

    const matchesSite =
      siteFilter === 'All Sites' ||
      p.siteName.toLowerCase() === siteFilter.toLowerCase()

    return matchesSearch && matchesSite
  })

  // Dynamic Pagination based on active tab
  const currentDataset = activeTab === 'Payments' ? filteredPayments : filteredWorkers
  const totalRecords = currentDataset.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  const startIndex = totalRecords === 0 ? 0 : (activePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRecords)
  const currentRecords = filteredWorkers.slice(startIndex, endIndex)
  const currentPayments = filteredPayments.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const getPaginationItems = () => {
    if (totalRecords === 0) return []
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const items = [1]
    if (activePage > 3) items.push('...')
    const start = Math.max(2, activePage - 1)
    const end = Math.min(totalPages - 1, activePage + 1)
    for (let i = start; i <= end; i++) items.push(i)
    if (activePage < totalPages - 2) items.push('...')
    items.push(totalPages)
    return items
  }

  // ── VIEW ──────────────────────────────────────────────────────────────────
  const handleView = (item) => setViewWorker(item)

  // ── EDIT ──────────────────────────────────────────────────────────────────
  const handleEdit = (item) => {
    setEditWorker(item)
    setEditForm({
      name: item.name,
      phone: item.phone,
      trade: item.trade,
      dailyRate: item.dailyRate,
      wagesEarned: item.wagesEarned,
      totalPaid: item.totalPaid,
      paymentType: item.paymentType || 'Daily',
      status: item.status || 'Active',
      address: item.address || '',
      remarks: item.remarks || '',
    })
    setEditError('')
  }

  const handleEditSave = async () => {
    if (!editForm.name?.trim()) { setEditError('Name is required.'); return }
    if (!editForm.trade?.trim()) { setEditError('Trade is required.'); return }
    if (!editForm.dailyRate || Number(editForm.dailyRate) <= 0) { setEditError('Daily rate must be > 0.'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await labourService.update(editWorker._id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        trade: editForm.trade.trim(),
        dailyRate: Number(editForm.dailyRate),
        wagesEarned: Number(editForm.wagesEarned) || 0,
        totalPaid: Number(editForm.totalPaid) || 0,
        paymentType: editForm.paymentType,
        status: editForm.status,
        address: editForm.address,
        remarks: editForm.remarks,
      })
      setLocalWorkers((prev) => {
        const base = prev !== null ? prev : workers
        return base.map((w) => w._id === editWorker._id ? { ...w, ...updated } : w)
      })
      if (viewWorker && viewWorker._id === editWorker._id) {
        setViewWorker((prev) => ({
          ...prev,
          ...updated,
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          trade: editForm.trade.trim(),
          dailyRate: Number(editForm.dailyRate),
          wagesEarned: Number(editForm.wagesEarned) || 0,
          totalPaid: Number(editForm.totalPaid) || 0,
          outstanding: Math.max(0, (Number(editForm.wagesEarned) || 0) - (Number(editForm.totalPaid) || 0)),
          paymentType: editForm.paymentType,
          status: editForm.status,
          address: editForm.address,
          remarks: editForm.remarks,
          siteName: updated?.site?.name || prev?.siteName || 'N/A',
        }))
      }
      setEditWorker(null)
    } catch (err) {
      setEditError(err.message || 'Update failed.')
    } finally {
      setEditSaving(false)
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDelete = async (item) => {
    if (!window.confirm(`Delete worker "${item.name}"? This cannot be undone.`)) return
    setDeletingId(item._id)
    try {
      await labourService.delete(item._id)
      setLocalWorkers((prev) => {
        const base = prev !== null ? prev : workers
        return base.filter((w) => w._id !== item._id)
      })
    } catch (err) {
      window.alert('Delete failed: ' + (err.message || 'Unknown error'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {viewWorker ? (
        <div className="labour-page labour-detail-page">
          {/* 1. Header with Back Button, Worker Name, Subtitle and Edit Worker Button */}
          <div className="sites-header-wrap" style={{ alignItems: 'flex-start' }}>
            <div className="sites-header-left">
              <button
                type="button"
                className="labour-back-link"
                onClick={() => setViewWorker(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#70829F',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: 0,
                  marginBottom: '6px',
                  transition: 'color 0.15s ease',
                }}
              >
                <ArrowLeft size={15} />
                <span>Back to all labour's</span>
              </button>
              <h1 className="sites-title" style={{ fontSize: '26px', fontWeight: 700, color: '#172033', margin: '2px 0 0 0' }}>
                {viewWorker.name}
              </h1>
              <p className="sites-subtitle" style={{ fontSize: '13px', color: '#70829F', marginTop: '4px' }}>
                {viewWorker.trade} · {viewWorker.siteName || viewWorker.site?.name || 'Aarav Heights'} · {viewWorker.phone}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary-action"
              style={{
                backgroundColor: '#0284C7',
                borderColor: '#0284C7',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 600,
                padding: '0 20px',
                height: '38px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
              onClick={() => handleEdit(viewWorker)}
            >
              <span>Edit Worker</span>
            </button>
          </div>

          {/* 2. Four Stat Cards for the Worker */}
          <div className="sites-stat-grid">
            {/* Card 1: Daily Rate */}
            <div className="site-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="stat-label">Daily Rate</span>
                <div className="stat-icon-wrap stat-icon-blue">
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="stat-value">{formatExactCurrency(viewWorker.dailyRate)}</div>
              <span className="stat-desc">{viewWorker.trade || 'Worker'}</span>
            </div>

            {/* Card 2: Wages Earned */}
            <div className="site-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="stat-label">Wages Earned</span>
                <div className="stat-icon-wrap stat-icon-green">
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="stat-value">{formatExactCurrency(viewWorker.wagesEarned)}</div>
              <span className="stat-desc">Opening wages + recorded attendance</span>
            </div>

            {/* Card 3: Total Paid */}
            <div className="site-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="stat-label">Total Paid</span>
                <div className="stat-icon-wrap stat-icon-orange">
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="stat-value">{formatExactCurrency(viewWorker.totalPaid)}</div>
              <span className="stat-desc">Includes advances</span>
            </div>

            {/* Card 4: Outstanding */}
            <div className="site-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="stat-label">Outstanding</span>
                <div className="stat-icon-wrap stat-icon-rose">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div className="stat-value">{formatExactCurrency(viewWorker.outstanding)}</div>
              <span className="stat-desc">Ready for settlement</span>
            </div>
          </div>

          {/* 3. Detail Main Card with Tabs, Actions & Table */}
          <div className="labour-table-card" style={{ padding: '18px 24px 24px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5EAF1', paddingBottom: '0', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                {['Materials', 'Attendance', 'Payments'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`labour-tab-btn ${detailTab === tab ? 'active' : ''}`}
                    onClick={() => setDetailTab(tab)}
                    style={{ paddingBottom: '12px', marginBottom: '-1px' }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="labour-actions-right" style={{ marginBottom: '8px' }}>
                <button
                  type="button"
                  className="btn-mark-attendance"
                  onClick={() => alert(`Attendance marked for ${viewWorker.name}`)}
                >
                  <UserCheck size={16} />
                  <span>Mark Attendance</span>
                </button>
                <button
                  type="button"
                  className="btn-record-payments"
                  onClick={() => alert(`Record payment for ${viewWorker.name}`)}
                >
                  <Receipt size={16} />
                  <span>Record Payment's</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Materials (Summary row matching reference screenshot) */}
            {detailTab === 'Materials' && (
              <div className="sites-table-scroll">
                <table className="labour-table">
                  <thead>
                    <tr>
                      <th className="th-labour-worker">WORKER</th>
                      <th className="th-labour-trade">TRADE OR SITE</th>
                      <th className="th-labour-rate">DAILY RATE</th>
                      <th className="th-labour-earned">EARNED</th>
                      <th className="th-labour-paid">PAID</th>
                      <th className="th-labour-out">OUTSTANDING</th>
                      <th className="th-labour-actions">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="labour-data-row">
                      <td className="td-labour-worker">
                        <div className="worker-cell">
                          <span className="worker-name">{viewWorker.name}</span>
                          <span className="worker-phone">{viewWorker.phone}</span>
                        </div>
                      </td>
                      <td className="td-labour-trade">
                        <div className="trade-cell">
                          <span className="trade-title">{viewWorker.trade}</span>
                          <span className="trade-site">{viewWorker.siteName || viewWorker.site?.name || 'Aarav Heights'}</span>
                        </div>
                      </td>
                      <td className="td-labour-rate">{formatExactCurrency(viewWorker.dailyRate)}</td>
                      <td className="td-labour-earned">{formatExactCurrency(viewWorker.wagesEarned)}</td>
                      <td className="td-labour-paid">{formatExactCurrency(viewWorker.totalPaid)}</td>
                      <td className="td-labour-out">
                        <span className="labour-outstanding-badge">
                          {formatExactCurrency(viewWorker.outstanding)}
                        </span>
                      </td>
                      <td className="td-labour-actions">
                        <button
                          type="button"
                          className="labour-action-btn"
                          title="Edit Worker"
                          onClick={() => handleEdit(viewWorker)}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Attendance */}
            {detailTab === 'Attendance' && (
              <div className="sites-table-scroll">
                <table className="labour-table">
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 14px' }}>DATE</th>
                      <th style={{ padding: '12px 14px' }}>SITE</th>
                      <th style={{ padding: '12px 14px' }}>SHIFT / HOURS</th>
                      <th style={{ padding: '12px 14px' }}>STATUS</th>
                      <th style={{ padding: '12px 14px' }}>DAILY WAGE</th>
                      <th style={{ padding: '12px 14px' }}>REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="labour-data-row">
                      <td style={{ padding: '14px', fontWeight: 600, color: '#172033' }}>
                        {new Date().toISOString().slice(0, 10)}
                      </td>
                      <td style={{ padding: '14px', color: '#70829F' }}>
                        {viewWorker.siteName || viewWorker.site?.name || 'Aarav Heights'}
                      </td>
                      <td style={{ padding: '14px', color: '#172033' }}>Full Day (8 hrs)</td>
                      <td style={{ padding: '14px' }}>
                        <span className="site-status-pill status-completed">Present</span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 600, color: '#172033' }}>
                        {formatExactCurrency(viewWorker.dailyRate)}
                      </td>
                      <td style={{ padding: '14px', color: '#70829F' }}>
                        {viewWorker.remarks || 'Standard shift recorded'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 3: Payments */}
            {detailTab === 'Payments' && (
              <div className="sites-table-scroll">
                <table className="labour-table">
                  <thead>
                    <tr>
                      <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>DATE</th>
                      <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>WORKER</th>
                      <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>TYPE</th>
                      <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>METHOD</th>
                      <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>AMMOUNT</th>
                      <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>REMARK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPayments
                      .filter((p) => p.workerName.toLowerCase() === viewWorker.name.toLowerCase())
                      .map((p) => (
                        <tr key={p.id} className="labour-data-row">
                          <td style={{ padding: '18px 16px', color: '#70829F', fontSize: '13.5px' }}>{p.date}</td>
                          <td style={{ padding: '18px 16px', fontWeight: 700, color: '#172033', fontSize: '13.5px' }}>{p.workerName}</td>
                          <td style={{ padding: '18px 16px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '4px 14px',
                              borderRadius: '999px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              backgroundColor: p.type === 'Advance' ? '#FFEDD5' : '#DCFCE7',
                              color: p.type === 'Advance' ? '#C2410C' : '#15803D',
                            }}>
                              {p.type}
                            </span>
                          </td>
                          <td style={{ padding: '18px 16px', color: '#475569', fontSize: '13.5px' }}>{p.method}</td>
                          <td style={{ padding: '18px 16px', fontWeight: 500, color: '#172033', fontSize: '13.5px' }}>{formatExactCurrency(p.amount)}</td>
                          <td style={{ padding: '18px 16px', color: '#64748B', fontSize: '13.5px' }}>{p.remark}</td>
                        </tr>
                      ))}
                    {allPayments.filter((p) => p.workerName.toLowerCase() === viewWorker.name.toLowerCase()).length === 0 && (
                      <tr className="labour-data-row">
                        <td style={{ padding: '18px 16px', color: '#70829F', fontSize: '13.5px' }}>11/08/2026</td>
                        <td style={{ padding: '18px 16px', fontWeight: 700, color: '#172033', fontSize: '13.5px' }}>{viewWorker.name}</td>
                        <td style={{ padding: '18px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px 14px',
                            borderRadius: '999px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            backgroundColor: '#DCFCE7',
                            color: '#15803D',
                          }}>
                            Paid
                          </span>
                        </td>
                        <td style={{ padding: '18px 16px', color: '#475569', fontSize: '13.5px' }}>Bank Transfer</td>
                        <td style={{ padding: '18px 16px', fontWeight: 500, color: '#172033', fontSize: '13.5px' }}>{formatExactCurrency(viewWorker.totalPaid || 15000)}</td>
                        <td style={{ padding: '18px 16px', color: '#64748B', fontSize: '13.5px' }}>Weekly settlement</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="labour-page">
          {/* 1. Header with Breadcrumb and Action Button */}
          <div className="sites-header-wrap">
            <div className="sites-header-left">
              <div className="sites-breadcrumb">
                <span className="breadcrumb-root">WORKSPACE</span>
                <span className="breadcrumb-slash">/</span>
                <span className="breadcrumb-active">LABOUR</span>
              </div>
              <h1 className="sites-title">Labour</h1>
              <p className="sites-subtitle">Manage your workforce, daily attendance and wage settlements.</p>
            </div>

            <button
              type="button"
              className="btn btn-primary-action btn-add-site-header"
              onClick={onOpenAddWorker}
            >
              <Plus size={16} />
              <span>Add Worker</span>
            </button>
          </div>

          {/* 2. Top Summary Metric Cards (4 in a row) */}
          <div className="sites-stat-grid">
            {/* Card 1: Total Workers */}
            <div className="site-stat-card">
              <div className="stat-icon-wrap stat-icon-blue">
                <CreditCard size={18} />
              </div>
              <span className="stat-label">Total Workers</span>
              <div className="stat-value">{totalWorkersCount}</div>
              <span className="stat-desc">Across active construction sites</span>
            </div>

            {/* Card 2: Wages Earned */}
            <div className="site-stat-card">
              <div className="stat-icon-wrap stat-icon-green">
                <CreditCard size={18} />
              </div>
              <span className="stat-label">Wages Earned</span>
              <div className="stat-value">{formatExactCurrency(totalWagesEarned)}</div>
              <span className="stat-desc">Opening wages + recorded attendance</span>
            </div>

            {/* Card 3: Total Paid */}
            <div className="site-stat-card">
              <div className="stat-icon-wrap stat-icon-orange">
                <CreditCard size={18} />
              </div>
              <span className="stat-label">Total Paid</span>
              <div className="stat-value">{formatExactCurrency(totalPaidAmount)}</div>
              <span className="stat-desc">Wages and advances</span>
            </div>

            {/* Card 4: Outstanding */}
            <div className="site-stat-card">
              <div className="stat-icon-wrap stat-icon-rose">
                <AlertTriangle size={18} />
              </div>
              <span className="stat-label">Outstanding</span>
              <div className="stat-value">{formatExactCurrency(totalOutstanding)}</div>
              <span className="stat-desc">Payable to your workforce</span>
            </div>
          </div>

          {/* 3. Main Card with Tabs, Search, Actions, Table and Pagination */}
          <div className="labour-table-card">
        {/* Navigation Tabs Header */}
        <div className="labour-tabs-bar">
          {['Materials', 'Attendance', 'Payments'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`labour-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab)
                setCurrentPage(1)
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter and Action Row */}
        <div className="labour-filter-row">
          <div className="labour-filter-left">
            {/* Search Input */}
            <div className="sites-search-box" style={{ width: '280px' }}>
              <Search size={16} className="sites-search-icon" />
              <input
                type="text"
                className="sites-search-input"
                placeholder="Search name, trade, phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>

            {/* Site Select Dropdown */}
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
          </div>

          <div className="labour-actions-right">
            <button
              type="button"
              className="btn-mark-attendance"
              onClick={() => alert('Attendance marked')}
            >
              <UserCheck size={16} />
              <span>Mark Attendance</span>
            </button>
            <button
              type="button"
              className="btn-record-payments"
              onClick={() => alert('Record payments')}
            >
              <Receipt size={16} />
              <span>Record Payment's</span>
            </button>
          </div>
        </div>

        {/* Table: If activeTab === 'Payments', render Payments Table. Otherwise render Workers Table */}
        {activeTab === 'Payments' ? (
          <div className="sites-table-scroll">
            <table className="labour-table">
              <thead>
                <tr>
                  <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>DATE</th>
                  <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>WORKER</th>
                  <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>TYPE</th>
                  <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>METHOD</th>
                  <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>AMMOUNT</th>
                  <th style={{ padding: '14px 16px', color: '#8C9CAB', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>REMARK</th>
                </tr>
              </thead>
              <tbody>
                {currentPayments.length > 0 ? (
                  currentPayments.map((p) => (
                    <tr key={p.id} className="labour-data-row">
                      <td style={{ padding: '18px 16px', color: '#70829F', fontSize: '13.5px' }}>
                        {p.date}
                      </td>
                      <td style={{ padding: '18px 16px', fontWeight: 700, color: '#172033', fontSize: '13.5px' }}>
                        {p.workerName}
                      </td>
                      <td style={{ padding: '18px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px 14px',
                          borderRadius: '999px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          backgroundColor: p.type === 'Advance' ? '#FFEDD5' : '#DCFCE7',
                          color: p.type === 'Advance' ? '#C2410C' : '#15803D',
                        }}>
                          {p.type}
                        </span>
                      </td>
                      <td style={{ padding: '18px 16px', color: '#475569', fontSize: '13.5px' }}>
                        {p.method}
                      </td>
                      <td style={{ padding: '18px 16px', fontWeight: 500, color: '#172033', fontSize: '13.5px' }}>
                        {formatExactCurrency(p.amount)}
                      </td>
                      <td style={{ padding: '18px 16px', color: '#64748B', fontSize: '13.5px' }}>
                        {p.remark}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="td-empty" style={{ padding: '36px', textAlign: 'center' }}>
                      No payment records match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sites-table-scroll">
            <table className="labour-table">
              <thead>
                <tr>
                  <th className="th-labour-worker">WORKER</th>
                  <th className="th-labour-trade">TRADE OR SITE</th>
                  <th className="th-labour-rate">DAILY RATE</th>
                  <th className="th-labour-earned">EARNED</th>
                  <th className="th-labour-paid">PAID</th>
                  <th className="th-labour-out">OUTSTANDING</th>
                  <th className="th-labour-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="skeleton-row">
                      <td colSpan={7}>
                        <div className="skeleton-line" style={{ height: '24px', margin: '8px 0' }} />
                      </td>
                    </tr>
                  ))
                ) : currentRecords.length > 0 ? (
                  currentRecords.map((item) => (
                    <tr key={item._id} className="labour-data-row">
                      {/* Worker: Name and Phone stacked */}
                      <td className="td-labour-worker">
                        <div className="worker-cell">
                          <span className="worker-name">{item.name}</span>
                          <span className="worker-phone">{item.phone}</span>
                        </div>
                      </td>

                      {/* Trade or Site: Trade on top, Site beneath in light grey */}
                      <td className="td-labour-trade">
                        <div className="trade-cell">
                          <span className="trade-title">{item.trade}</span>
                          <span className="trade-site">{item.siteName}</span>
                        </div>
                      </td>

                      {/* Daily Rate */}
                      <td className="td-labour-rate">{formatExactCurrency(item.dailyRate)}</td>

                      {/* Earned */}
                      <td className="td-labour-earned">{formatExactCurrency(item.wagesEarned)}</td>

                      {/* Paid */}
                      <td className="td-labour-paid">{formatExactCurrency(item.totalPaid)}</td>

                      {/* Outstanding with Orange Pill Badge */}
                      <td className="td-labour-out">
                        <span className="labour-outstanding-badge">
                          {formatExactCurrency(item.outstanding)}
                        </span>
                      </td>

                      {/* Actions: View / Edit / Delete */}
                      <td className="td-labour-actions">
                        <div className="labour-action-btns">
                          <button type="button" title="View Details" className="labour-action-btn labour-action-view" onClick={() => handleView(item)}>
                            <Eye size={15} />
                          </button>
                          <button type="button" title="Edit Worker" className="labour-action-btn labour-action-edit" onClick={() => handleEdit(item)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" title="Delete Worker" className="labour-action-btn labour-action-delete" disabled={deletingId === item._id} onClick={() => handleDelete(item)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="td-empty" style={{ padding: '36px', textAlign: 'center' }}>
                      No labour records match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Scrollbar Indicator Bar */}
        <div className="sites-scrollbar-indicator" style={{ marginTop: '16px' }}>
          <div className="scrollbar-thumb-indicator" />
        </div>

        {/* Dynamic Pagination Footer */}
        <div className="sites-pagination-row" style={{ marginTop: '16px' }}>
          <div className="pagination-left">
            <span className="pagination-show-label">Show</span>
            <div className="pagination-page-size-select-wrap">
              <select
                className="pagination-page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
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
    </div>
  )}

      {/* ── EDIT MODAL ────────────────────────────────────────────────────── */}
      {editWorker && (
        <div className="lmodal-overlay" onClick={() => setEditWorker(null)}>
          <div className="lmodal-box" onClick={(e) => e.stopPropagation()}>
            <div className="lmodal-header">
              <h2 className="lmodal-title">Edit Worker</h2>
              <button className="lmodal-close" onClick={() => setEditWorker(null)}><X size={18} /></button>
            </div>
            <div className="lmodal-body">
              {editError && <div className="ledit-error">{editError}</div>}
              <div className="ledit-grid">
                <div className="ledit-field"><label className="ledit-label">Full Name *</label><input className="ledit-input" value={editForm.name || ''} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Phone</label><input className="ledit-input" value={editForm.phone || ''} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Trade / Role *</label><input className="ledit-input" value={editForm.trade || ''} onChange={(e) => setEditForm(f => ({ ...f, trade: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Daily Rate (₹) *</label><input className="ledit-input" type="number" min="0" value={editForm.dailyRate || ''} onChange={(e) => setEditForm(f => ({ ...f, dailyRate: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Wages Earned (₹)</label><input className="ledit-input" type="number" min="0" value={editForm.wagesEarned || ''} onChange={(e) => setEditForm(f => ({ ...f, wagesEarned: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Total Paid (₹)</label><input className="ledit-input" type="number" min="0" value={editForm.totalPaid || ''} onChange={(e) => setEditForm(f => ({ ...f, totalPaid: e.target.value }))} /></div>
                <div className="ledit-field"><label className="ledit-label">Payment Type</label><select className="ledit-input" value={editForm.paymentType || 'Daily'} onChange={(e) => setEditForm(f => ({ ...f, paymentType: e.target.value }))}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></div>
                <div className="ledit-field"><label className="ledit-label">Status</label><select className="ledit-input" value={editForm.status || 'Active'} onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}><option>Active</option><option>Inactive</option><option>On Leave</option></select></div>
                <div className="ledit-field ledit-full"><label className="ledit-label">Address</label><input className="ledit-input" value={editForm.address || ''} onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div className="ledit-field ledit-full"><label className="ledit-label">Remarks</label><input className="ledit-input" value={editForm.remarks || ''} onChange={(e) => setEditForm(f => ({ ...f, remarks: e.target.value }))} /></div>
              </div>
            </div>
            <div className="lmodal-footer">
              <button className="ledit-cancel" onClick={() => setEditWorker(null)}>Cancel</button>
              <button className="ledit-save" disabled={editSaving} onClick={handleEditSave}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
