import React, { useState, useEffect, useCallback } from 'react'
import './App.css'
import Sidebar from './components/Sidebar.jsx'
import TopHeader from './components/TopHeader.jsx'
import WelcomeSection from './components/WelcomeSection.jsx'
import BankAccounts from './components/BankAccounts.jsx'
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

import { bankAccountService } from './services/bankAccountService.js'
import { siteService } from './services/siteService.js'
import { supplierService } from './services/supplierService.js'
import { expenseService } from './services/expenseService.js'
import { dashboardService } from './services/dashboardService.js'
import { labourService } from './services/labourService.js'
import { settingService } from './services/settingService.js'

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

  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab)
    try {
      const newPath = newTab === 'dashboard' ? '/' : `/${newTab}`
      if (window.location.pathname !== newPath) {
        window.history.pushState({ tab: newTab }, '', newPath)
      }
    } catch {
      // ignore
    }
  }, [])

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
  const [settingsKey, setSettingsKey] = useState(0)
  const [ownerProfile, setOwnerProfile] = useState(null)

  const handleNavigateOwnerProfile = () => {
    handleTabChange('settings')
    setSettingsKey((k) => k + 1)
  }

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

  // 4. Fetch Expenses
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

  // Initial Data Load
  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        const [accData, allSites, overview, supData, labourData, settingsData] = await Promise.all([
          bankAccountService.getAll(),
          siteService.getAll(),
          dashboardService.getSiteOverview(),
          supplierService.getAll(),
          labourService.getAll(),
          settingService.getSettings().catch(() => null),
        ])
        if (!active) return
        setAccounts(accData || [])
        setSites(allSites || [])
        setSiteOverview(overview || [])
        setSuppliers(supData || [])
        setWorkers(labourData?.workers || [])
        setLabourSummary(labourData?.summary || {})
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

  // Callbacks for mutations
  const handleExpenseCreated = () => {
    loadExpenses()
    loadSites()
    loadBankAccounts()
    setSupplierRefreshTrigger((prev) => prev + 1)
    setMaterialsRefreshTrigger((prev) => prev + 1)
  }

  const handleSiteCreated = (newSite) => {
    loadSites()
    setSelectedSiteFilter(newSite._id)
  }

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
          {activeTab === 'sites' ? (
            <SitesPage
              sites={sites}
              expenses={expenses}
              onOpenAddSite={() => setIsAddSiteOpen(true)}
              onOpenAddExpense={handleScrollToAddExpense}
              loading={loadingSites}
              onSitesChanged={loadSites}
              showNotification={setNotification}
            />
          ) : activeTab === 'expenses' ? (
            <ExpensesPage
              expenses={expenses}
              sites={sites}
              onOpenAddExpense={handleScrollToAddExpense}
              loading={loadingExpenses}
            />
          ) : activeTab === 'labour' ? (
            <LabourPage
              workers={workers}
              summary={labourSummary}
              sites={sites}
              onOpenAddWorker={() => setIsAddWorkerOpen(true)}
              loading={loadingLabour}
            />
          ) : activeTab === 'materials' ? (
            <MaterialsPage
              sites={sites}
              suppliers={suppliers}
              onOpenAddPurchase={() => setIsAddPurchaseOpen(true)}
              showNotification={setNotification}
              refreshTrigger={materialsRefreshTrigger}
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
            />
          ) : activeTab === 'supplier-detail' && selectedSupplierId ? (
            <SupplierDetailPage
              supplierId={selectedSupplierId}
              onBack={() => handleTabChange('suppliers')}
              showNotification={setNotification}
            />
          ) : activeTab === 'site-owners' ? (
            <SiteOwnersPage
              sites={sites}
              onOpenAddClient={() => setIsAddClientOpen(true)}
              showNotification={setNotification}
              refreshTrigger={clientRefreshTrigger}
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
              <WelcomeSection />

              {/* Bank Accounts Section (4 cards in a row) */}
              <BankAccounts
                accounts={accounts}
                loading={loadingAccounts}
              />

              {/* Add Daily Expenses Form */}
              <DailyExpenseForm
                sites={sites}
                suppliers={suppliers}
                bankAccounts={accounts}
                onExpenseCreated={handleExpenseCreated}
                showNotification={setNotification}
              />

              {/* Recent Expense Entries Table */}
              <RecentExpenses
                expenses={expenses}
                sites={sites}
                selectedSiteFilter={selectedSiteFilter}
                setSelectedSiteFilter={setSelectedSiteFilter}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                loading={loadingExpenses}
              />

              {/* Sites Overview (3 cards in a row) */}
              <SitesOverview
                sites={siteOverview.length > 0 ? siteOverview : sites}
                loading={loadingSites}
                onNavigateSites={() => handleTabChange('sites')}
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
        onWorkerCreated={() => {
          loadLabour()
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
          setSupplierRefreshTrigger((prev) => prev + 1)
          if (newSup) {
            setSuppliers((prev) => [...prev, newSup])
          }
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
