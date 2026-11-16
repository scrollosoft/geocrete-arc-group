import React, { useState, useEffect } from 'react'
import {
  LayoutGrid,
  Building2,
  Receipt,
  HardHat,
  Package,
  Truck,
  UserCheck,
  Wallet,
  Settings,
  MoreHorizontal,
  X,
  ChevronRight,
} from 'lucide-react'

export default function Sidebar({ activeTab, setActiveTab }) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'sites', label: 'Sites', icon: Building2 },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'labour', label: 'Labour', icon: HardHat },
    { id: 'materials', label: 'Materials', icon: Package },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'site-owners', label: 'Site Owners', icon: UserCheck },
    { id: 'payments', label: 'Payments', icon: Wallet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const primaryItems = menuItems.slice(0, 4)
  const moreItems = menuItems.slice(4)

  const isItemActive = (item) => {
    return (
      activeTab === item.id ||
      (item.id === 'suppliers' && activeTab === 'supplier-detail') ||
      (item.id === 'sites' && activeTab === 'site-detail')
    )
  }

  const isMoreActive = moreItems.some((item) => isItemActive(item))

  // Close more menu when active tab changes
  useEffect(() => {
    setIsMoreOpen(false)
  }, [activeTab])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMoreOpen(false)
    }
    if (isMoreOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMoreOpen])

  const handleSelectMoreItem = (id) => {
    setActiveTab(id)
    setIsMoreOpen(false)
  }

  return (
    <>
      <aside className="sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-logo-wrap">
            <img
              src="/logo.png"
              alt="Geocrete Arch Group - Where Creativity & Honesty Amalgamate!"
              className="brand-logo-img"
            />
          </div>
        </div>

        {/* Workspace Menu */}
        <div className="sidebar-nav-container">
          <div className="sidebar-section-title">WORKSPACE</div>
          <nav className="sidebar-nav">
            {/* First 4 items: always in navigation */}
            {primaryItems.map((item) => {
              const Icon = item.icon
              const isActive = isItemActive(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <div className="sidebar-nav-icon">
                    <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
                  </div>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="sidebar-nav-badge">{item.badge}</span>
                  )}
                </button>
              )
            })}

            {/* Remaining items: visible on desktop, hidden on mobile */}
            {moreItems.map((item) => {
              const Icon = item.icon
              const isActive = isItemActive(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-nav-item sidebar-nav-item--desktop-only ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.id)}
                >
                  <div className="sidebar-nav-icon">
                    <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
                  </div>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="sidebar-nav-badge">{item.badge}</span>
                  )}
                </button>
              )
            })}

            {/* "More" 5th item: hidden on desktop, visible on mobile */}
            <button
              type="button"
              className={`sidebar-nav-item sidebar-nav-item--more ${isMoreActive ? 'active' : ''} ${isMoreOpen ? 'more-open' : ''}`}
              onClick={() => setIsMoreOpen((prev) => !prev)}
              aria-label="More navigation options"
              aria-expanded={isMoreOpen}
            >
              <div className="sidebar-nav-icon">
                <MoreHorizontal size={18} strokeWidth={isMoreActive || isMoreOpen ? 2.3 : 1.8} />
              </div>
              <span className="sidebar-nav-label">More</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Mobile "More" Bottom Sheet / Popup Backdrop */}
      {isMoreOpen && (
        <div
          className="mobile-more-backdrop"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      {/* Mobile "More" Bottom Sheet / Popup */}
      {isMoreOpen && (
        <div className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="More Menu">
          <div className="mobile-more-header">
            <span className="mobile-more-title">More Workspace Options</span>
            <button
              type="button"
              className="mobile-more-close-btn"
              onClick={() => setIsMoreOpen(false)}
              aria-label="Close more menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mobile-more-grid">
            {moreItems.map((item) => {
              const Icon = item.icon
              const isActive = isItemActive(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`mobile-more-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectMoreItem(item.id)}
                >
                  <div className="mobile-more-item-icon">
                    <Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} />
                  </div>
                  <span className="mobile-more-item-label">{item.label}</span>
                  <ChevronRight size={15} className="mobile-more-item-arrow" />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
