import React from 'react'
import BankAccountCard from './BankAccountCard.jsx'

export default function BankAccounts({ accounts = [], loading = false }) {
  return (
    <section className="bank-accounts-section">
      <div className="section-header">
        <h2 className="section-title">Bank Accounts</h2>
        <span className="section-subtitle-right">
          {accounts.length} accounts active
        </span>
      </div>

      <div className="bank-accounts-grid">
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="bank-account-card skeleton-card">
              <div className="skeleton-line" style={{ width: '40%' }} />
              <div className="skeleton-line" style={{ width: '70%', height: '18px' }} />
              <div className="skeleton-line" style={{ width: '90%' }} />
            </div>
          ))
        ) : accounts.length > 0 ? (
          accounts.map((acc, index) => (
            <BankAccountCard key={acc._id || index} account={acc} index={index} />
          ))
        ) : (
          <div className="empty-state">No bank accounts found</div>
        )}
      </div>
    </section>
  )
}
