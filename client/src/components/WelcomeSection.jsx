import React, { useState, useEffect } from 'react'
import { settingService } from '../services/settingService.js'

export default function WelcomeSection({ ownerProfile }) {
  const [profile, setProfile] = useState(ownerProfile || null)

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
      <div className="welcome-badge">
        <span className="live-pulse" />
        <span className="live-text">Live financial overview</span>
      </div>
    </div>
  )
}
