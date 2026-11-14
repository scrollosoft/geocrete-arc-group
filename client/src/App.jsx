import React, { useState, useEffect, useCallback } from 'react'
import './App.css'
import Sidebar from './components/Sidebar.jsx'
import TopHeader from './components/TopHeader.jsx'
import WelcomeSection from './components/WelcomeSection.jsx'
import BankAccounts from './components/BankAccounts.jsx'
import DashboardFinancialSummary, { BankAccountsChart } from './components/DashboardFinancialSummary.jsx'
import DailyExpenseForm from './components/DailyExpenseForm.jsx'
import RecentExpenses from './components/RecentExpenses.jsx'
import SitesOverview from './components/SitesOverview.jsx'
import AddClientSiteModal from './components/AddClientSiteModal.jsx'
import AddWorkerModal from './components/AddWorkerModal.jsx'
import NotificationToast from './components/NotificationToast.jsx'
import SitesPage from './components/SitesPage.jsx'
import ExpensesPage from './components/ExpensesPage.jsx'

import LabourPage from './components/LabourPage.jsx'
import MaterialsPage from './components/MaterialsPage.jsx'
import SuppliersPage from './components/SuppliersPage.jsx'
import AddPurchaseModal from './components/AddPurchaseModal.jsx'
import SiteOwnersPage from './components/SiteOwnersPage.jsx'
import AddSupplierModal from './components/AddSupplierModal.jsx'
import AddExpenseModal from './components/AddExpenseModal.jsx'
import SettingsPage from './components/SettingsPage.jsx'
import SupplierDetailPage from './components/SupplierDetailPage.jsx'
import PaymentsPage from './components/PaymentsPage.jsx'
import SiteDetailPage from './components/SiteDetailPage.jsx'
import ConsultingForm from './components/ConsultingForm.jsx'
import ConsultingTable from './components/ConsultingTable.jsx'
import OtherForm from './components/OtherForm.jsx'
import OtherTable from './components/OtherTable.jsx'

import { bankAccountService } from './services/bankAccountService.js'
import { siteService } from './services/siteService.js'
import { supplierService } from './services/supplierService.js'
import { expenseService } from './services/expenseService.js'
import { dashboardService } from './services/dashboardService.js'
import { labourService } from './services/labourService.js'
import { settingService } from './services/settingService.js'
import { consultingService } from './services/consultingService.js'
import { otherTransactionService } from './services/otherTransactionService.js'

const getInitialTab = () => {
  try {
    const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase()
    const searchParams = new URLSearchParams(window.location.search)
    const tabParam = searchParams.get('tab')?.toLowerCase()

    const validTabs = [
      'dashboard',
      'sites',
      'expenses',
      'labour',
      'materials',
      'suppliers',
      'site-owners',
      'payments',
      'reports',
      'settings',
    ]

    if (validTabs.includes(tabParam)) return tabParam
    if (validTabs.includes(pathname)) return pathname
    if (validTabs.includes(hash)) return hash
  } catch {
    // fallback
  }
  return 'dashboard'
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')


  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const [accounts, setAccounts] = useState([])
  const [sites, setSites] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [siteOverview, setSiteOverview] = useState([])
  const [workers, setWorkers] = useState([])
  const [labourSummary, setLabourSummary] = useState({})

  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [loadingSites, setLoadingSites] = useState(true)
  const [loadingExpenses, setLoadingExpenses] = useState(true)
  const [loadingLabour, setLoadingLabour] = useState(true)
  const [consultingList, setConsultingList] = useState([])
  const [loadingConsulting, setLoadingConsulting] = useState(true)
  const [otherTransactions, setOtherTransactions] = useState([])
  const [loadingOther, setLoadingOther] = useState(true)

  const [isAddSiteOpen, setIsAddSiteOpen] = useState(false)
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false)
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false)
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false)
  const [supplierRefreshTrigger, setSupplierRefreshTrigger] = useState(0)
  const [materialsRefreshTrigger, setMaterialsRefreshTrigger] = useState(0)
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [clientRefreshTrigger, setClientRefreshTrigger] = useState(0)
  const [notification, setNotification] = useState(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [selectedSiteForDetail, setSelectedSiteForDetail] = useState(null)
  const [siteDetailReturnTab, setSiteDetailReturnTab] = useState('sites')
  const [selectedWorkerForDetail, setSelectedWorkerForDetail] = useState(null)
  const [workerDetailReturnTab, setWorkerDetailReturnTab] = useState('labour')
  const [selectedExpenseForDetail, setSelectedExpenseForDetail] = useState(null)
  const [expenseDetailReturnTab, setExpenseDetailReturnTab] = useState('expenses')
  const [settingsKey, setSettingsKey] = useState(0)
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [dashboardTab, setDashboardTab] = useState('expenses')

  // Global modal background scroll lock: locks document.body and restores scroll position
  useEffect(() => {
    let scrollY = 0
    let isLocked = false

    const checkModals = () => {
      const activeModal = document.querySelector(
        '.modal-overlay, .lmodal-overlay, .mep-modal-overlay, .txn-modal-overlay'
      )
      if (activeModal && !isLocked) {
        scrollY = window.scrollY || window.pageYOffset || 0
        document.body.style.position = 'fixed'
        document.body.style.top = `-${scrollY}px`
        document.body.style.width = '100%'
        document.body.style.overflow = 'hidden'
        isLocked = true
      } else if (!activeModal && isLocked) {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
        isLocked = false
      }
    }

    const observer = new MutationObserver(() => {
      checkModals()
    })

    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (isLocked) {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [])

  // 1. Fetch Bank Accounts
  const loadBankAccounts = useCallback(async () => {
    try {
      const data = await bankAccountService.getAll()
      setAccounts(data || [])
    } catch (err) {
      console.error('Failed to load bank accounts:', err)
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  // 2. Fetch Sites & Site Overview
  const loadSites = useCallback(async () => {
    try {
      const [allSites, overview] = await Promise.all([
        siteService.getAll(),
        dashboardService.getSiteOverview(),
      ])
      setSites(allSites || [])
      setSiteOverview(overview || [])
    } catch (err) {
      console.error('Failed to load sites:', err)
    } finally {
      setLoadingSites(false)
    }
  }, [])

  // 3. Fetch Labour
  const loadLabour = useCallback(async () => {
    try {
      const res = await labourService.getAll()
      setWorkers(res.workers || [])
      setLabourSummary(res.summary || {})
    } catch (err) {
      console.error('Failed to load labour:', err)
    } finally {
      setLoadingLabour(false)
    }
  }, [])

  // 4. Fetch Suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      const data = await supplierService.getAll()
      setSuppliers(data || [])
    } catch (err) {
      console.error('Failed to load suppliers:', err)
    }
  }, [])

  // 5. Fetch Expenses
  const loadExpenses = useCallback(async () => {
    try {
      const params = {}
      if (selectedSiteFilter && selectedSiteFilter !== 'all') {
        params.siteId = selectedSiteFilter
      }
      if (dateFilter) {
        params.startDate = dateFilter
        params.endDate = dateFilter
      }
      if (searchQuery) {
        params.search = searchQuery
      }

      const res = await expenseService.getAll(params)
      setExpenses(res.expenses || res || [])
    } catch (err) {
      console.error('Failed to load expenses:', err)
    } finally {
      setLoadingExpenses(false)
    }
  }, [selectedSiteFilter, dateFilter, searchQuery])

  // 6. Fetch Consulting
  const loadConsulting = useCallback(async () => {
    try {
      setLoadingConsulting(true)
      const data = await consultingService.getAll()
      setConsultingList(data || [])
    } catch (err) {
      console.error('Failed to load consulting records:', err)
    } finally {
      setLoadingConsulting(false)
    }
  }, [])

  // 7. Fetch Other Transactions
  const loadOtherTransactions = useCallback(async () => {
    try {
      setLoadingOther(true)
      const data = await otherTransactionService.getAll()
      setOtherTransactions(data || [])
    } catch (err) {
      console.error('Failed to load other transactions:', err)
    } finally {
      setLoadingOther(false)
    }
  }, [])

  const constructionSites = React.useMemo(
    () => sites.filter((s) => !s.description?.includes('[CONSULTING]')),
    [sites]
  )

  // Initial Data Load
  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        const [accData, allSites, overview, supData, labourData, settingsData, consultData, otherData] = await Promise.all([
          bankAccountService.getAll(),
          siteService.getAll(),
          dashboardService.getSiteOverview(),
          supplierService.getAll(),
          labourService.getAll(),
          settingService.getSettings().catch(() => null),
          consultingService.getAll().catch(() => []),
          otherTransactionService.getAll().catch(() => []),
        ])
        if (!active) return
        setAccounts(accData || [])
        setSites(allSites || [])
        setSiteOverview(overview || [])
        setSuppliers(supData || [])
        setWorkers(labourData?.workers || [])
        setLabourSummary(labourData?.summary || {})
        setConsultingList(consultData || [])
        setOtherTransactions(otherData || [])
        if (settingsData?.ownerProfile) {
          setOwnerProfile(settingsData.ownerProfile)
        }
      } catch (e) {
        console.error('Initialization error:', e)
      } finally {
        if (active) {
          setLoadingAccounts(false)
          setLoadingSites(false)
          setLoadingLabour(false)
          setLoadingConsulting(false)
          setLoadingOther(false)
        }
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  // Reload expenses when filter or search changes
  useEffect(() => {
    let active = true
    const fetchFilteredExpenses = async () => {
      try {
        const params = {}
        if (selectedSiteFilter && selectedSiteFilter !== 'all') {
          params.siteId = selectedSiteFilter
        }
        if (dateFilter) {
          params.startDate = dateFilter
          params.endDate = dateFilter
        }
        if (searchQuery) {
          params.search = searchQuery
        }

        const res = await expenseService.getAll(params)
        if (active) {
          setExpenses(res.expenses || res || [])
        }
      } catch (err) {
        console.error('Failed to load expenses:', err)
      } finally {
        if (active) {
          setLoadingExpenses(false)
        }
      }
    }

    fetchFilteredExpenses()
    return () => {
      active = false
    }
  }, [selectedSiteFilter, dateFilter, searchQuery])

  const handleTabChange = useCallback((newTab) => {
    if (newTab === 'sites') {
      setSelectedSiteForDetail(null)
      loadSites()
    } else if (newTab === 'labour') {
      setSelectedWorkerForDetail(null)
      loadLabour()
    } else if (newTab === 'expenses') {
      setSelectedExpenseForDetail(null)
      loadExpenses()
    } else if (newTab === 'payments') {
      loadBankAccounts()
    } else if (newTab === 'materials') {
      setMaterialsRefreshTrigger((prev) => prev + 1)
    } else if (newTab === 'suppliers') {
      loadSuppliers()
      setSupplierRefreshTrigger((prev) => prev + 1)
    } else if (newTab === 'site-owners') {
      setClientRefreshTrigger((prev) => prev + 1)
    } else if (newTab === 'dashboard') {
      setSelectedSiteForDetail(null)
      setSelectedWorkerForDetail(null)
      setSelectedExpenseForDetail(null)
      loadSites()
      loadBankAccounts()
      loadExpenses()
    }
    setActiveTab(newTab)
    try {
      const newPath = newTab === 'dashboard' ? '/' : `/${newTab}`
      if (window.location.pathname !== newPath) {
        window.history.pushState({ tab: newTab }, '', newPath)
      }
    } catch {
      // ignore
    }
  }, [loadSites, loadLabour, loadExpenses, loadBankAccounts, loadSuppliers])

  const handleViewSite = useCallback((site) => {
    const siteId = site?._id || site?.id
    const fullSite = sites.find((s) => String(s._id || s.id) === String(siteId)) || site
    setSiteDetailReturnTab(activeTab === 'dashboard' ? 'dashboard' : 'sites')
    setSelectedSiteForDetail(fullSite)
    handleTabChange('site-detail')
  }, [sites, handleTabChange, activeTab])

  const handleViewWorker = useCallback((worker) => {
    const wId = worker?._id || worker?.id
    const fullWorker = (workers || []).find((w) => String(w._id || w.id) === String(wId)) || worker
    setWorkerDetailReturnTab(activeTab === 'dashboard' ? 'dashboard' : 'labour')
    setSelectedWorkerForDetail(fullWorker)
    setActiveTab('labour')
    try {
      if (window.location.pathname !== '/labour') {
        window.history.pushState({ tab: 'labour' }, '', '/labour')
      }
    } catch {
      // ignore
    }
  }, [workers, activeTab])

  const handleViewExpense = useCallback((expense) => {
    const expId = expense?._id || expense?.id
    const fullExpense = (expenses || []).find((e) => String(e._id || e.id) === String(expId)) || expense
    setExpenseDetailReturnTab(activeTab === 'dashboard' ? 'dashboard' : 'expenses')
    setSelectedExpenseForDetail(fullExpense)
    setActiveTab('expenses')
    try {
      if (window.location.pathname !== '/expenses') {
        window.history.pushState({ tab: 'expenses' }, '', '/expenses')
      }
    } catch {
      // ignore
    }
  }, [expenses, activeTab])

  const handleNavigateOwnerProfile = () => {
    handleTabChange('settings')
    setSettingsKey((k) => k + 1)
  }

  // Callbacks for mutations
  const handleExpenseCreated = () => {
    loadExpenses()
    loadSites()
    loadBankAccounts()
    setSupplierRefreshTrigger((prev) => prev + 1)
    setMaterialsRefreshTrigger((prev) => prev + 1)
  }

  // Refresh financial & project data after any payment or major mutation
  const handlePaymentCompleted = useCallback(() => {
    loadBankAccounts()
    loadSites()
    loadExpenses()
    loadLabour()
    loadSuppliers()
    setMaterialsRefreshTrigger((prev) => prev + 1)
    setSupplierRefreshTrigger((prev) => prev + 1)
    setClientRefreshTrigger((prev) => prev + 1)
  }, [loadBankAccounts, loadSites, loadExpenses, loadLabour, loadSuppliers])

  const handleScrollToAddExpense = () => {
    setIsAddExpenseOpen(true)
  }

  return (
    <div className="app-container">
      {/* 1. Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />

      {/* 2. Main Content Layout */}
      <div className="main-layout">
        {/* Top Header */}
        <TopHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenAddExpense={handleScrollToAddExpense}
          onOpenAddSite={() => setIsAddSiteOpen(true)}
          onNavigateOwnerProfile={handleNavigateOwnerProfile}
          ownerProfile={ownerProfile}
        />

        {/* Dashboard, Sites or Expenses Page Body */}
        <main className="content-body">
          {activeTab === 'site-detail' && selectedSiteForDetail ? (
            <SiteDetailPage
              site={sites.find((s) => String(s._id || s.id) === String(selectedSiteForDetail._id || selectedSiteForDetail.id)) || selectedSiteForDetail}
              expenses={expenses}
              onBack={() => {
                setSelectedSiteForDetail(null)
                handleTabChange(siteDetailReturnTab || 'sites')
              }}
              onOpenAddExpense={handleScrollToAddExpense}
              onOpenAddWorker={() => setIsAddWorkerOpen(true)}
              onSiteChanged={loadSites}
              onRefreshAccounts={loadBankAccounts}
            />
          ) : activeTab === 'sites' || activeTab === 'site-detail' ? (
            <SitesPage
              sites={constructionSites}
              expenses={expenses}
              onOpenAddSite={() => setIsAddSiteOpen(true)}
              onOpenAddExpense={handleScrollToAddExpense}
              loading={loadingSites}
              onSitesChanged={loadSites}
              onRefreshAccounts={loadBankAccounts}
              showNotification={setNotification}
              onViewSite={handleViewSite}
            />
          ) : activeTab === 'expenses' ? (
            <ExpensesPage
              expenses={expenses}
              sites={sites}
              suppliers={suppliers}
              bankAccounts={accounts}
              onOpenAddExpense={handleScrollToAddExpense}
              loading={loadingExpenses}
              onExpenseChanged={handlePaymentCompleted}
              showNotification={setNotification}
              initialExpense={selectedExpenseForDetail}
              onBackFromDetail={() => {
                setSelectedExpenseForDetail(null)
                if (expenseDetailReturnTab === 'dashboard') {
                  handleTabChange('dashboard')
                }
              }}
            />
          ) : activeTab === 'labour' ? (
            <LabourPage
              workers={workers}
              summary={labourSummary}
              sites={sites}
              bankAccounts={accounts}
              onOpenAddWorker={() => setIsAddWorkerOpen(true)}
              loading={loadingLabour}
              onLabourChanged={loadLabour}
              onRefreshAccounts={loadBankAccounts}
              initialWorker={selectedWorkerForDetail}
              onBackFromDetail={() => {
                setSelectedWorkerForDetail(null)
                if (workerDetailReturnTab === 'dashboard') {
                  handleTabChange('dashboard')
                }
              }}
              showNotification={setNotification}
            />
          ) : activeTab === 'materials' ? (
            <MaterialsPage
              sites={sites}
              suppliers={suppliers}
              bankAccounts={accounts}
              onOpenAddPurchase={() => setIsAddPurchaseOpen(true)}
              showNotification={setNotification}
              refreshTrigger={materialsRefreshTrigger}
              onMaterialsChanged={() => {
                loadSites()
                loadExpenses()
                loadBankAccounts()
                setSupplierRefreshTrigger((prev) => prev + 1)
              }}
              onRefreshAccounts={loadBankAccounts}
            />
          ) : activeTab === 'suppliers' ? (
            <SuppliersPage
              sites={sites}
              onOpenAddSupplier={() => setIsAddSupplierOpen(true)}
              onViewSupplier={(supplier) => {
                setSelectedSupplierId(supplier._id || supplier.id)
                handleTabChange('supplier-detail')
              }}
              showNotification={setNotification}
              refreshTrigger={supplierRefreshTrigger}
              onSuppliersChanged={loadSuppliers}
            />
          ) : activeTab === 'supplier-detail' && selectedSupplierId ? (
            <SupplierDetailPage
              supplierId={selectedSupplierId}
              onBack={() => handleTabChange('suppliers')}
              showNotification={setNotification}
              onPaymentRecorded={handlePaymentCompleted}
            />
          ) : activeTab === 'site-owners' ? (
            <SiteOwnersPage
              sites={sites}
              bankAccounts={accounts}
              onOpenAddClient={() => setIsAddClientOpen(true)}
              showNotification={setNotification}
              refreshTrigger={clientRefreshTrigger}
              onPaymentRecorded={handlePaymentCompleted}
              onClientsChanged={() => {
                loadSites()
                setClientRefreshTrigger((prev) => prev + 1)
              }}
            />
          ) : activeTab === 'payments' ? (
            <PaymentsPage
              accounts={accounts}
              loading={loadingAccounts}
              onRefreshAccounts={loadBankAccounts}
              showNotification={setNotification}
            />
          ) : activeTab === 'settings' ? (
            <SettingsPage
              key={settingsKey}
              showNotification={setNotification}
              onProfileUpdated={setOwnerProfile}
            />
          ) : (
            <>
              {/* Welcome Section */}
              <WelcomeSection ownerProfile={ownerProfile} />

              {/* Financial Summary (4 stat cards in a single horizontal row) */}
              <DashboardFinancialSummary
                sites={constructionSites}
                expenses={expenses}
                loading={loadingSites || loadingExpenses}
              />

              {/* ── Dashboard Tabs: Expenses | Labour | Consulting | Other | Site ── */}
              <div className="dashboard-tabs-section">
                {/* Tab Navigation */}
                <div className="dashboard-tab-nav">
                  {[
                    { key: 'expenses', label: 'Expenses' },
                    { key: 'labour', label: 'Labour' },
                    { key: 'consulting', label: 'Consulting' },
                    { key: 'other', label: 'Other' },
                    { key: 'site', label: 'Site' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`dashboard-tab-btn ${dashboardTab === tab.key ? 'dashboard-tab-btn--active' : ''}`}
                      onClick={() => setDashboardTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="dashboard-tab-content">
                  {/* Two-Column Layout: Form on Left, Bank Accounts Chart on Right */}
                  <div className="dashboard-form-chart-row">
                    <div className="dashboard-form-col">
                      {dashboardTab === 'expenses' && (
                        <DailyExpenseForm
                          sites={constructionSites}
                          suppliers={suppliers}
                          bankAccounts={accounts}
                          onExpenseCreated={handleExpenseCreated}
                          showNotification={setNotification}
                        />
                      )}
                      {dashboardTab === 'labour' && (
                        <AddWorkerModal
                          isOpen={false}
                          embeddedMode={true}
                          onClose={() => {}}
                          sites={constructionSites}
                          bankAccounts={accounts}
                          onWorkerCreated={() => {
                            loadLabour()
                            loadBankAccounts()
                          }}
                          showNotification={setNotification}
                        />
                      )}
                      {dashboardTab === 'consulting' && (
                        <ConsultingForm
                          bankAccounts={accounts}
                          onConsultingCreated={() => {
                            loadConsulting()
                            loadBankAccounts()
                          }}
                          showNotification={setNotification}
                        />
                      )}
                      {dashboardTab === 'other' && (
                        <OtherForm
                          bankAccounts={accounts}
                          onTransactionCreated={() => {
                            loadOtherTransactions()
                            loadBankAccounts()
                          }}
                          showNotification={setNotification}
                        />
                      )}
                      {dashboardTab === 'site' && (
                        <AddClientSiteModal
                          isOpen={false}
                          embeddedMode={true}
                          onClose={() => {}}
                          bankAccounts={accounts}
                          onCreated={(newSite) => {
                            loadSites()
                            loadBankAccounts()
                            setClientRefreshTrigger((prev) => prev + 1)
                          }}
                          showNotification={setNotification}
                        />
                      )}
                    </div>

                    <div className="dashboard-chart-col">
                      <BankAccountsChart
                        accounts={accounts}
                        loading={loadingAccounts}
                      />
                    </div>
                  </div>

                  {/* Tables Section below Form + Chart */}
                  <div className="dashboard-tables-container">
                    {dashboardTab === 'expenses' && (
                      <ExpensesPage
                        expenses={expenses}
                        sites={constructionSites}
                        suppliers={suppliers}
                        bankAccounts={accounts}
                        onOpenAddExpense={handleScrollToAddExpense}
                        loading={loadingExpenses}
                        onExpenseChanged={handlePaymentCompleted}
                        showNotification={setNotification}
                        hideHeader={true}
                        onViewExpense={handleViewExpense}
                      />
                    )}
                    {dashboardTab === 'labour' && (
                      <LabourPage
                        workers={workers}
                        summary={labourSummary}
                        sites={constructionSites}
                        bankAccounts={accounts}
                        onOpenAddWorker={() => setIsAddWorkerOpen(true)}
                        loading={loadingLabour}
                        onLabourChanged={loadLabour}
                        onRefreshAccounts={loadBankAccounts}
                        hideHeader={true}
                        onViewWorker={handleViewWorker}
                        showNotification={setNotification}
                      />
                    )}
                    {dashboardTab === 'consulting' && (
                      <ConsultingTable
                        consultingList={consultingList}
                        loading={loadingConsulting}
                        bankAccounts={accounts}
                        onConsultingChanged={() => {
                          loadConsulting()
                          loadBankAccounts()
                        }}
                        showNotification={setNotification}
                      />
                    )}
                    {dashboardTab === 'other' && (
                      <OtherTable
                        transactions={otherTransactions}
                        loading={loadingOther}
                        bankAccounts={accounts}
                        onTransactionChanged={() => {
                          loadOtherTransactions()
                          loadBankAccounts()
                        }}
                        showNotification={setNotification}
                      />
                    )}
                    {dashboardTab === 'site' && (
                      <SitesPage
                        sites={constructionSites}
                        expenses={expenses}
                        onOpenAddSite={() => setIsAddSiteOpen(true)}
                        onOpenAddExpense={handleScrollToAddExpense}
                        loading={loadingSites}
                        onSitesChanged={loadSites}
                        onRefreshAccounts={loadBankAccounts}
                        showNotification={setNotification}
                        hideHeader={true}
                        onViewSite={handleViewSite}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Sites Overview (3 cards in a row) — always visible */}
              <SitesOverview
                sites={siteOverview.length > 0 ? siteOverview : constructionSites}
                loading={loadingSites}
                onNavigateSites={() => handleTabChange('sites')}
                onViewSite={handleViewSite}
              />
            </>
          )}
        </main>
      </div>

      {/* Unified Add Client / Site Owner & Construction Site Modal */}
      <AddClientSiteModal
        isOpen={isAddSiteOpen || isAddClientOpen}
        onClose={() => {
          setIsAddSiteOpen(false)
          setIsAddClientOpen(false)
        }}
        bankAccounts={accounts}
        onCreated={(newSite) => {
          loadSites()
          loadBankAccounts()
          setClientRefreshTrigger((prev) => prev + 1)
          if (newSite) {
            setSelectedSiteFilter(newSite._id || newSite.id)
          }
        }}
        showNotification={setNotification}
      />

      {/* Add Worker Modal */}
      <AddWorkerModal
        isOpen={isAddWorkerOpen}
        onClose={() => setIsAddWorkerOpen(false)}
        sites={sites}
        bankAccounts={accounts}
        onWorkerCreated={() => {
          loadLabour()
          loadBankAccounts()
        }}
        showNotification={setNotification}
      />

      {/* Add Purchase Modal */}
      <AddPurchaseModal
        isOpen={isAddPurchaseOpen}
        onClose={() => setIsAddPurchaseOpen(false)}
        sites={sites}
        suppliers={suppliers}
        bankAccounts={accounts}
        onPurchaseCreated={() => {
          loadSites()
          loadExpenses()
          loadBankAccounts()
          setMaterialsRefreshTrigger((prev) => prev + 1)
          setSupplierRefreshTrigger((prev) => prev + 1)
        }}
        showNotification={setNotification}
      />

      {/* Add Supplier Modal */}
      <AddSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        onSupplierCreated={(newSup) => {
          loadSuppliers()
          setSupplierRefreshTrigger((prev) => prev + 1)
        }}
        showNotification={setNotification}
      />

      {/* Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        sites={sites}
        suppliers={suppliers}
        bankAccounts={accounts}
        onExpenseCreated={handleExpenseCreated}
        showNotification={setNotification}
      />

      {/* Notification Toast */}
      <NotificationToast
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  )
}
