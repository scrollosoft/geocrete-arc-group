import React, { useState } from 'react'
import { Plus, Building2 } from 'lucide-react'
import AddBankModal from './AddBankModal.jsx'
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
  const [txnRefreshTrigger, setTxnRefreshTrigger] = useState(0)

  const defaultColors = ['#3980FF', '#00B67A', '#07577A', '#FF9900']

  // Show up to 4 bank account cards
  const displayAccounts = (accounts || []).slice(0, 4)
  const emptySlotsCount = Math.max(0, 4 - displayAccounts.length)

  const handleBankCreated = async () => {
    if (onRefreshAccounts) {
      await onRefreshAccounts()
    }
    setTxnRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="payments-page-wrap">
      {/* 1. Header with Breadcrumb and + Add Bank Button */}
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

        <button
          type="button"
          className="btn btn-primary-action btn-add-site-header"
          onClick={() => setIsAddBankOpen(true)}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add Bank</span>
        </button>
      </div>

      {/* 2. Four Bank Account Cards in a Single Horizontal Row */}
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
            {displayAccounts.map((account, index) => {
              const accent = account.accentColor || defaultColors[index % defaultColors.length]
              const tag = account.accountNumberTag || `ACCOUNT #${String(index + 1).padStart(2, '0')}`
              const code = account.accountCode || `B${index + 1}`

              return (
                <div
                  key={account._id || account.id || index}
                  className="payment-bank-card"
                  style={{
                    borderTop: `3.5px solid ${accent}`,
                  }}
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

            {/* Empty Card Placeholders to ensure 4 cards are represented */}
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

      {/* 3. Google Pay-Style Bank Transaction History */}
      <TransactionHistory
        accounts={accounts}
        refreshTrigger={txnRefreshTrigger}
      />

      {/* Add Bank Modal */}
      <AddBankModal
        isOpen={isAddBankOpen}
        onClose={() => setIsAddBankOpen(false)}
        onBankCreated={handleBankCreated}
        existingAccounts={accounts}
        showNotification={showNotification}
      />
    </div>
  )
}

