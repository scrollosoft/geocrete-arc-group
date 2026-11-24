import React, { useState, useEffect, useMemo } from 'react'
import { settingService } from '../services/settingService.js'
import { siteService } from '../services/siteService.js'

function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return '₹0'
  return `₹${Math.round(Number(amount)).toLocaleString('en-IN')}`
}

export default function WelcomeSection({ ownerProfile, sites: propSites }) {
  const [profile, setProfile] = useState(ownerProfile || null)
  const [internalSites, setInternalSites] = useState([])

  useEffect(() => {
    if (ownerProfile) {
      setProfile(ownerProfile)
    }
  }, [ownerProfile])

  useEffect(() => {
    if (!ownerProfile) {
      let isMounted = true
      settingService
        .getSettings()
        .then((data) => {
          if (isMounted && data?.ownerProfile) {
            setProfile(data.ownerProfile)
          }
        })
        .catch(() => {})
      return () => {
        isMounted = false
      }
    }
  }, [ownerProfile])

  // Fallback fetch of sites if propSites is not supplied
  useEffect(() => {
    if (propSites === undefined) {
      let isMounted = true
      siteService
        .getAll()
        .then((data) => {
          if (isMounted && Array.isArray(data)) {
            setInternalSites(data)
          }
        })
        .catch(() => {})
      return () => {
        isMounted = false
      }
    }
  }, [propSites])

  const sitesList = propSites !== undefined ? propSites : internalSites

  const totalProjectBudget = useMemo(() => {
    if (!Array.isArray(sitesList) || sitesList.length === 0) return 0
    const seenIds = new Set()
    return sitesList.reduce((sum, site) => {
      if (!site) return sum
      const id = site.id ?? site._id
      if (id !== undefined && id !== null) {
        if (seenIds.has(id)) return sum
        seenIds.add(id)
      }
      const budget = Number(
        site.totalBudget !== undefined && site.totalBudget !== null
          ? site.totalBudget
          : (site.projectValue !== undefined && site.projectValue !== null
              ? site.projectValue
              : (site.total_budget || 0))
      )
      return sum + (isNaN(budget) ? 0 : budget)
    }, 0)
  }, [sitesList])

  const today = new Date()
  const dateStr = today
    .toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })
    .toUpperCase()

  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = profile?.fullName?.trim()?.split(/\s+/)[0] || 'User'

  return (
    <div className="welcome-section">
      <div className="welcome-text">
        <span className="welcome-date">{dateStr}</span>
        <h1 className="welcome-title">{greeting}, {displayName}</h1>
      </div>
      <div className="welcome-header-actions">
        <div className="total-project-budget-compact">
          <span className="total-project-budget-label">Total Project Budget</span>
          <span className="total-project-budget-amount">{formatIndianCurrency(totalProjectBudget)}</span>
        </div>
        <div className="welcome-badge">
          <span className="live-pulse" />
          <span className="live-text">Live financial overview</span>
        </div>
      </div>
    </div>
  )
}
