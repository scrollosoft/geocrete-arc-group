import React from 'react'
import {
  LayoutGrid,
  Building2,
  Receipt,
  HardHat,
  Package,
  Truck,
  UserCheck,
  Wallet,
  BarChart3,
  Settings,
} from 'lucide-react'

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'sites', label: 'Sites', icon: Building2 },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'labour', label: 'Labour', icon: HardHat },
    { id: 'materials', label: 'Materials', icon: Package },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'site-owners', label: 'Site Owners', icon: UserCheck },
    { id: 'payments', label: 'Payments', icon: Wallet, badge: 5 },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
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
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive =
              activeTab === item.id ||
              (item.id === 'suppliers' && activeTab === 'supplier-detail') ||
              (item.id === 'sites' && activeTab === 'site-detail')
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
        </nav>
      </div>
    </aside>
  )
}
