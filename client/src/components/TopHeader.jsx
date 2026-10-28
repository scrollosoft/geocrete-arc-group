import React, { useState, useRef, useEffect } from 'react'
import { Search, Plus, ChevronDown, User } from 'lucide-react'
import { settingService } from '../services/settingService.js'

/**
 * Returns initials from a display name:
 * - Uses the first letter of first and last name when multiple parts exist.
 * - Uses the first letter when only one word exists.
 * - Trims extra spaces and safely handles empty or missing names.
 */
export const getInitials = (name = '') => {
  if (!name || typeof name !== 'string') return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TopHeader({
  searchQuery,
  setSearchQuery,
  onOpenAddExpense,
  onOpenAddSite,
  onNavigateOwnerProfile,
  setActiveTab,
  ownerProfile,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [profile, setProfile] = useState(ownerProfile || null)
  const dropdownRef = useRef(null)

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleOwnerProfileClick = (e) => {
    e.stopPropagation()
    setIsOpen(false)
    if (onNavigateOwnerProfile) {
      onNavigateOwnerProfile()
    } else if (setActiveTab) {
      setActiveTab('settings')
    }
  }

  const displayName = profile?.fullName?.trim() || ''
  const displayRole = profile?.role?.trim() || 'Business Owner'
  const initials = getInitials(displayName)

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

        <div
          ref={dropdownRef}
          className="user-profile"
          onClick={() => setIsOpen((prev) => !prev)}
          role="button"
          tabIndex={0}
          aria-haspopup="true"
          aria-expanded={isOpen}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsOpen((prev) => !prev)
            }
          }}
        >
          <div className="profile-avatar">{initials}</div>
          <div className="profile-info">
            <span className="profile-name">{displayName}</span>
            <span className="profile-role">{displayRole}</span>
          </div>
          <ChevronDown
            size={15}
            className="profile-chevron"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />

          {isOpen && (
            <div
              className="profile-dropdown-menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="profile-dropdown-item"
                onClick={handleOwnerProfileClick}
              >
                <User size={15} />
                <span>Owner Profile</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
