import React from 'react'

export default function WelcomeSection() {
  return (
    <div className="welcome-section">
      <div className="welcome-text">
        <span className="welcome-date">MONDAY, 26 MAY</span>
        <h1 className="welcome-title">Good morning, Lorem</h1>
      </div>
      <div className="welcome-badge">
        <span className="live-pulse" />
        <span className="live-text">Live financial overview</span>
      </div>
    </div>
  )
}
