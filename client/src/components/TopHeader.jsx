import React from 'react'
import { Search, Plus, Bell, ChevronDown } from 'lucide-react'

export default function TopHeader({
  searchQuery,
  setSearchQuery,
  onOpenAddExpense,
  onOpenAddSite,
}) {
  return (
    <header className="top-header">
      {/* Search Input */}
      <div className="header-search">
        <Search className="search-icon" size={17} />
        <input
          type="text"
          className="search-input"
          placeholder="Search sites, clients, suppliers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Action Buttons & Profile */}
      <div className="header-actions">
        <button
          type="button"
          className="btn btn-secondary-action"
          onClick={onOpenAddExpense}
        >
          <Plus size={16} />
          <span>Add Expense</span>
        </button>

        <button
          type="button"
          className="btn btn-primary-action"
          onClick={onOpenAddSite}
        >
          <Plus size={16} />
          <span>Add Site</span>
        </button>

        <div className="header-divider" />

        <button type="button" className="notification-btn" title="Notifications">
          <Bell size={18} />
          <span className="notification-dot" />
        </button>

        <div className="user-profile">
          <div className="profile-avatar">LI</div>
          <div className="profile-info">
            <span className="profile-name">Lorem Ipsum</span>
            <span className="profile-role">Business Owner</span>
          </div>
          <ChevronDown size={15} className="profile-chevron" />
        </div>
      </div>
    </header>
  )
}
