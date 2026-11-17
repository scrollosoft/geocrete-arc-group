import React, { useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import AddBankModal from './AddBankModal.jsx'
import EditBankModal from './EditBankModal.jsx'
import AddCashModal from './AddCashModal.jsx'
import EditCashModal from './EditCashModal.jsx'
import ManageCashModal from './ManageCashModal.jsx'
import TransactionHistory from './TransactionHistory.jsx'

const maskAccountNumber = (accNum) => {
  if (!accNum) return '•••• ----'
  const str = String(accNum).trim()
  if (str.length <= 4) {
    return `•••• ${str}`
  }
  return `•••• •••• ${str.slice(-4)}`
}

const formatBalance = (amount) => {
  if (amount === undefined || amount === null || isNaN(Number(amount))) {
    return '₹0.00'
  }
  const num = Number(amount)
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function PaymentsPage({
  accounts = [],
  loading = false,
  onRefreshAccounts,
  showNotification,
}) {
  const [isAddBankOpen, setIsAddBankOpen] = useState(false)
  const [editingBank, setEditingBank] = useState(null)
  const [isAddCashOpen, setIsAddCashOpen] = useState(false)
  const [isEditCashOpen, setIsEditCashOpen] = useState(false)
  const [isManageCashOpen, setIsManageCashOpen] = useState(false)
  const [txnRefreshTrigger, setTxnRefreshTrigger] = useState(0)

  const defaultColors = ['#3980FF', '#00B67A', '#07577A', '#FF9900']

  // Separate Cash account from Bank accounts
  const cashAccount = (accounts || []).find((a) => a.isCash || a.id === 'cash')
  const bankAccounts = (accounts || []).filter((a) => !a.isCash && a.id !== 'cash')

  // Calculate empty bank slots to fill the standard row layout
  const displayBankAccounts = bankAccounts.slice(0, 4)
  const emptySlotsCount = Math.max(0, 3 - displayBankAccounts.length)

  const handleBankCreated = async () => {
    if (onRefreshAccounts) {
      await onRefreshAccounts()
    }
    setTxnRefreshTrigger((prev) => prev + 1)
  }

  const handleBankUpdated = async () => {
    if (onRefreshAccounts) {
      await onRefreshAccounts()
    }
    setTxnRefreshTrigger((prev) => prev + 1)
  }

  const handleBankDeleted = async () => {
    if (onRefreshAccounts) {
      await onRefreshAccounts()
    }
    setTxnRefreshTrigger((prev) => prev + 1)
  }

  const handleCashChanged = async () => {
    if (onRefreshAccounts) {
      await onRefreshAccounts()
    }
    setTxnRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="payments-page-wrap">
      {/* 1. Header with Breadcrumb, Add Cash Button, and Add Bank Button */}
      <div className="sites-header-wrap">
        <div className="sites-header-left">
          <div className="sites-breadcrumb">
            <span className="breadcrumb-root">WORKSPACE</span>
            <span className="breadcrumb-slash">/</span>
            <span className="breadcrumb-active">PAYMENTS</span>
          </div>
          <h1 className="sites-title">Payments</h1>
          <p className="sites-subtitle">
            Manage your bank accounts and payment information.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary-action btn-add-cash-header"
            onClick={() => setIsAddCashOpen(true)}
            style={{
              backgroundColor: '#10B981',
              borderColor: '#10B981',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Cash</span>
          </button>

          <button
            type="button"
            className="btn btn-primary-action btn-add-site-header"
            onClick={() => setIsAddBankOpen(true)}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Bank</span>
          </button>
        </div>
      </div>

      {/* 2. Account Cards Grid: Cash Account Card + Bank Account Cards */}
      <div className="payments-cards-grid">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="payment-bank-card skeleton-card">
              <div className="skeleton-line" style={{ width: '40%' }} />
              <div className="skeleton-line" style={{ width: '70%', height: '18px' }} />
              <div className="skeleton-line" style={{ width: '90%' }} />
            </div>
          ))
        ) : (
          <>
            {/* Cash Account Card */}
            {cashAccount && (
              <div
                className="payment-bank-card payment-cash-card"
                onClick={() => setIsEditCashOpen(true)}
                style={{
                  borderTop: '3.5px solid #10B981',
                  cursor: 'pointer',
                }}
                title="Click to edit or delete cash"
              >
                <div className="payment-bank-card-top">
                  <span className="payment-bank-tag" style={{ color: '#047857', fontWeight: 700 }}>
                    CASH ACCOUNT
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="payment-cash-manage-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsEditCashOpen(true)
                      }}
                      title="Manage cash (Edit / Delete)"
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#059669',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Manage
                    </button>
                    <span
                      className="payment-bank-badge"
                      style={{
                        color: '#10B981',
                        backgroundColor: '#10B98115',
                      }}
                    >
                      CASH
                    </span>
                  </div>
                </div>

                <div className="payment-bank-name" title="Cash in Hand" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wallet size={16} style={{ color: '#10B981', flexShrink: 0 }} />
                  <span>Cash in Hand</span>
                </div>

                <div className="payment-bank-meta">
                  <span className="payment-bank-accnum">Physical Cash</span>
                  <span className="payment-bank-ifsc" style={{ color: '#059669' }}>
                    Available Liquidity
                  </span>
                </div>

                <div className="payment-bank-balance-wrap">
                  <span className="payment-bank-balance-label">Available Cash</span>
                  <span className="payment-bank-balance-value" style={{ color: '#047857' }}>
                    {formatBalance(cashAccount.balance)}
                  </span>
                </div>
              </div>
            )}

            {/* Bank Account Cards */}
            {displayBankAccounts.map((account, index) => {
              const accent = account.accentColor || defaultColors[index % defaultColors.length]
              const tag = account.accountNumberTag || `ACCOUNT #${String(index + 1).padStart(2, '0')}`
              const code = account.accountCode || `B${index + 1}`

              return (
                <div
                  key={account._id || account.id || index}
                  className="payment-bank-card"
                  onClick={() => setEditingBank(account)}
                  style={{
                    borderTop: `3.5px solid ${accent}`,
                    cursor: 'pointer',
                  }}
                  title="Click to edit or delete bank account"
                >
                  <div className="payment-bank-card-top">
                    <span className="payment-bank-tag">{tag}</span>
                    <span
                      className="payment-bank-badge"
                      style={{
                        color: accent,
                        backgroundColor: `${accent}15`,
                      }}
                    >
                      {code}
                    </span>
                  </div>

                  <div className="payment-bank-name" title={account.bankName}>
                    {account.bankName}
                  </div>

                  <div className="payment-bank-meta">
                    <span className="payment-bank-accnum">
                      {maskAccountNumber(account.accountNumber)}
                    </span>
                    {account.ifscCode ? (
                      <span className="payment-bank-ifsc">
                        IFSC: {account.ifscCode}
                      </span>
                    ) : null}
                  </div>

                  <div className="payment-bank-balance-wrap">
                    <span className="payment-bank-balance-label">Balance</span>
                    <span className="payment-bank-balance-value">
                      {formatBalance(account.balance)}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Empty Card Placeholders to ensure full slots are represented */}
            {Array.from({ length: emptySlotsCount }).map((_, i) => (
              <button
                type="button"
                key={`empty-placeholder-${i}`}
                className="payment-bank-card payment-bank-card-empty"
                onClick={() => setIsAddBankOpen(true)}
              >
                <div className="payment-empty-icon-wrap">
                  <Plus size={20} strokeWidth={2.4} />
                </div>
                <span className="payment-empty-title">Add Bank</span>
                <span className="payment-empty-desc">Slot available</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* 3. Google Pay-Style Transaction History (Includes Bank & Cash Transactions) */}
      <TransactionHistory
        accounts={accounts}
        refreshTrigger={txnRefreshTrigger}
      />

      {/* Add Bank Modal */}
      <AddBankModal
        isOpen={isAddBankOpen}
        onClose={() => setIsAddBankOpen(false)}
        onBankCreated={handleBankCreated}
        existingAccounts={bankAccounts}
        showNotification={showNotification}
      />

      {/* Edit / Delete Bank Modal */}
      <EditBankModal
        isOpen={Boolean(editingBank)}
        account={editingBank}
        onClose={() => setEditingBank(null)}
        onBankUpdated={handleBankUpdated}
        onBankDeleted={handleBankDeleted}
        existingAccounts={bankAccounts}
        showNotification={showNotification}
      />

      {/* Add Cash Modal */}
      <AddCashModal
        isOpen={isAddCashOpen}
        onClose={() => setIsAddCashOpen(false)}
        onCashAdded={handleCashChanged}
        showNotification={showNotification}
      />

      {/* Manage Cash Modal */}
      <ManageCashModal
        isOpen={isManageCashOpen}
        onClose={() => setIsManageCashOpen(false)}
        onCashUpdated={handleCashChanged}
        showNotification={showNotification}
      />

      {/* Edit / Delete Cash Modal */}
      <EditCashModal
        isOpen={isEditCashOpen}
        onClose={() => setIsEditCashOpen(false)}
        cashAccount={cashAccount}
        onCashUpdated={handleCashChanged}
        onCashDeleted={handleCashChanged}
        showNotification={showNotification}
      />
    </div>
  )
}
