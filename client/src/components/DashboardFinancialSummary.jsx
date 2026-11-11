import React from 'react'

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatIndianBudget(amount) {
  if (!amount && amount !== 0) return '₹0'
  const num = Number(amount)
  if (isNaN(num)) return '₹0'
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`
  return `₹${num.toLocaleString('en-IN')}`
}

// ── Summary Card ──────────────────────────────────────────────────────────────
const SummaryCard = ({ icon, iconClass, label, value, desc }) => (
  <div className="site-stat-card dfs-stat-card">
    <div className={`stat-icon-wrap ${iconClass}`}>{icon}</div>
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    {desc && <div className="stat-desc">{desc}</div>}
  </div>
)

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton = ({ width = '100%', height = '20px', style = {} }) => (
  <div
    style={{
      width,
      height,
      borderRadius: 6,
      background: 'linear-gradient(90deg,#f0f4f8 25%,#e2e8f0 50%,#f0f4f8 75%)',
      backgroundSize: '200% 100%',
      animation: 'dfs-shimmer 1.5s infinite',
      ...style,
    }}
  />
)

const SkeletonCard = () => (
  <div className="site-stat-card dfs-stat-card">
    <Skeleton width={32} height={32} style={{ borderRadius: 8 }} />
    <Skeleton width="60%" height={12} style={{ marginTop: 8 }} />
    <Skeleton width="80%" height={28} />
    <Skeleton width="50%" height={10} />
  </div>
)

// ── Four Summary Cards (Single Horizontal Row) ────────────────────────────────
export default function DashboardFinancialSummary({
  sites = [],
  expenses = [],
  loading = false,
}) {
  // Derived values
  const activeSites = sites.filter((s) =>
    ['Active', 'In Progress'].includes(s.status)
  ).length

  const totalReceived = sites.reduce(
    (sum, s) => sum + (Number(s.totalReceived) || 0),
    0
  )

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  )

  const pending = sites.reduce(
    (sum, s) =>
      sum +
      Math.max(
        0,
        (Number(s.totalBudget) || Number(s.projectValue) || 0) -
          (Number(s.totalReceived) || 0)
      ),
    0
  )

  return (
    <>
      {/* Shimmer keyframe */}
      <style>{`
        @keyframes dfs-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 4 Summary Cards in One Horizontal Row: Active Sites, Total Received, Total Expenses, Pending */}
      <div className="dashboard-financial-summary">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {/* 1. Active Sites */}
            <SummaryCard
              iconClass="stat-icon-blue"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
              }
              label="Active Sites"
              value={activeSites}
              desc={`${sites.length} total site${sites.length !== 1 ? 's' : ''}`}
            />

            {/* 2. Total Received */}
            <SummaryCard
              iconClass="stat-icon-green"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
              label="Total Received"
              value={formatIndianBudget(totalReceived)}
              desc="From clients across all sites"
            />

            {/* 3. Total Expenses */}
            <SummaryCard
              iconClass="stat-icon-orange"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
              label="Total Expenses"
              value={formatIndianBudget(totalExpenses)}
              desc="Spent across all sites"
            />

            {/* 4. Pending */}
            <SummaryCard
              iconClass="stat-icon-rose"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
              label="Pending"
              value={formatIndianBudget(pending)}
              desc="Outstanding from clients"
            />
          </>
        )}
      </div>
    </>
  )
}

// ── Bank Accounts Chart (Placed to the right of Forms) ────────────────────────
export function BankAccountsChart({
  accounts = [],
  loading = false,
}) {
  const maxBalance = Math.max(
    ...accounts.map((a) => Number(a.balance) || 0),
    1
  )

  return (
    <div className="dfs-chart-col dashboard-form-chart-card">
      <div className="dfs-chart-header">
        <span className="dfs-chart-title">Bank Accounts</span>
        <span className="dfs-chart-subtitle">
          {loading ? '—' : `${accounts.length} account${accounts.length !== 1 ? 's' : ''} active`}
        </span>
      </div>

      <div className="dfs-chart-body">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="dfs-bank-bar-row">
              <div className="dfs-bank-label">
                <Skeleton width="45%" height={13} />
                <Skeleton width="25%" height={13} />
              </div>
              <div className="dfs-bank-track">
                <div className="dfs-bank-fill" style={{ width: i === 0 ? '70%' : '45%' }} />
              </div>
            </div>
          ))
        ) : accounts.length === 0 ? (
          <p className="dfs-chart-empty">No bank accounts found.</p>
        ) : (
          accounts.map((acc, i) => {
            const bal = Number(acc.balance) || 0
            const pct = maxBalance > 0 ? (bal / maxBalance) * 100 : 0
            const name = acc.bankName || acc.accountName || `Account #${i + 1}`
            return (
              <div key={acc._id || i} className="dfs-bank-bar-row">
                <div className="dfs-bank-label">
                  <span>{name}</span>
                  <span>{formatIndianBudget(bal)}</span>
                </div>
                <div className="dfs-bank-track">
                  <div
                    className="dfs-bank-fill"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
