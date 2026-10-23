import React from 'react'
import { Building2, MapPin, AlertTriangle, ArrowRight } from 'lucide-react'

export default function SiteCard({ site }) {
  const formatIndianCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0'
    const num = Number(amount)
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(1)} L`
    }
    return `₹${num.toLocaleString('en-IN')}`
  }

  const totalBudget = site.totalBudget || 18500000
  const totalSpent = site.totalSpent || 12400000
  const remaining = Math.max(0, totalBudget - totalSpent)

  // Percentages
  const spentPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  const remainingPercent = totalBudget > 0 ? Math.min(100, Math.round((remaining / totalBudget) * 100)) : 0

  return (
    <div className="site-card">
      {/* Top Header */}
      <div className="site-card-header">
        <div className="site-icon-box">
          <Building2 size={18} className="site-icon" />
        </div>
        <div className="site-title-info">
          <h3 className="site-name">{site.name || 'Aarav Heights'}</h3>
          <div className="site-location">
            <MapPin size={12} className="pin-icon" />
            <span>{site.location || 'Baner, Pune'}</span>
          </div>
        </div>
      </div>

      {/* Site Owner */}
      <div className="site-owner-row">
        <span className="owner-label">Site owner</span>
        <span className="owner-name">{site.siteOwner || 'Rajesh Mehta'}</span>
      </div>

      {/* Metrics Row: Total Budget | Total Spent | Remaining */}
      <div className="site-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Total Budget</span>
          <span className="metric-value">{formatIndianCurrency(totalBudget)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Total Spent</span>
          <span className="metric-value">{formatIndianCurrency(totalSpent)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Remaining</span>
          <span className="metric-value">{formatIndianCurrency(remaining)}</span>
        </div>
      </div>

      {/* 3 Progress Bars */}
      <div className="site-progress-stack">
        {/* Total Budget */}
        <div className="progress-group">
          <div className="progress-label-row">
            <span className="progress-name">Total Budget</span>
            <span className="progress-percent">100%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill fill-budget"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Total Spent */}
        <div className="progress-group">
          <div className="progress-label-row">
            <span className="progress-name">Total Spent</span>
            <span className="progress-percent">{spentPercent || 80}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill fill-spent"
              style={{ width: `${spentPercent || 80}%` }}
            />
          </div>
        </div>

        {/* Remaining */}
        <div className="progress-group">
          <div className="progress-label-row">
            <span className="progress-name">Remaining</span>
            <span className="progress-percent">{remainingPercent || 40}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill fill-remaining"
              style={{ width: `${remainingPercent || 40}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="site-card-footer">
        <div className="site-alert-notice">
          <AlertTriangle size={13} className="alert-icon" />
          <span>{site.budgetAlertCount || 1} budget alert</span>
        </div>
        <button type="button" className="site-view-link">
          <span>View Site</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}
