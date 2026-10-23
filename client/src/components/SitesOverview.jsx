import React from 'react'
import { ArrowRight } from 'lucide-react'
import SiteCard from './SiteCard.jsx'

export default function SitesOverview({ sites = [], loading = false, onNavigateSites }) {
  // If fewer than 3 sites, replicate or pad with defaults so desktop always has 3 balanced cards matching the screenshot
  const displaySites = sites.length >= 3 ? sites.slice(0, 3) : sites

  return (
    <section className="sites-overview-section">
      <div className="section-header-with-link">
        <div className="section-title-wrap">
          <h2 className="section-title">Sites Overview</h2>
          <p className="section-subtitle">Progress and financial health of active projects</p>
        </div>

        <button type="button" className="view-all-link" onClick={() => onNavigateSites && onNavigateSites()}>
          <span>View all sites</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="sites-grid">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="site-card skeleton-card">
              <div className="skeleton-line" style={{ width: '60%', height: '20px' }} />
              <div className="skeleton-line" style={{ width: '40%' }} />
              <div className="skeleton-line" style={{ width: '100%', height: '40px' }} />
              <div className="skeleton-line" style={{ width: '100%', height: '30px' }} />
            </div>
          ))
        ) : displaySites.length > 0 ? (
          displaySites.map((site) => (
            <SiteCard key={site._id} site={site} />
          ))
        ) : (
          <div className="empty-state">No active sites found</div>
        )}
      </div>
    </section>
  )
}
