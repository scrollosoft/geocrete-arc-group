import React from 'react'

export default function BankAccountCard({ account, index }) {
  const defaultColors = ['#3980FF', '#00B67A', '#07577A', '#FF9900']
  const accent = account.accentColor || defaultColors[index % defaultColors.length]
  const tag = account.accountNumberTag || `ACCOUNT #${String(index + 1).padStart(2, '0')}`
  const code = account.accountCode || `B${index + 1}`

  // Format number: if it's 100000, keep 100000 or clean number format as in reference image
  const displayBalance = account.balance !== undefined ? account.balance : 100000
  const displayCredit = account.credit !== undefined ? account.credit : 50000

  return (
    <div
      className="bank-account-card"
      style={{
        '--card-accent': accent,
        borderTop: `3.5px solid ${accent}`,
      }}
    >
      <div className="account-header">
        <span className="account-tag">{tag}</span>
        <span
          className="account-code-badge"
          style={{
            color: accent,
            backgroundColor: `${accent}15`,
          }}
        >
          {code}
        </span>
      </div>

      <div className="account-name-title">{account.bankName}</div>

      <div className="account-financial-rows">
        <div className="account-fin-row">
          <span className="fin-label">bal.</span>
          <span className="fin-val bal-val">{displayBalance}</span>
        </div>
        <div className="account-fin-row">
          <span className="fin-label">credit.</span>
          <span className="fin-val credit-val">{displayCredit}</span>
        </div>
      </div>
    </div>
  )
}
