import React, { useState, useEffect } from 'react'
import {
  User,
  Building2,
  CreditCard,
  Bell,
  ChevronRight,
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Building,
} from 'lucide-react'
import { settingService } from '../services/settingService.js'

const SECTIONS = [
  { id: 'ownerProfile',         label: 'Owner Profile',         icon: User       },
  { id: 'businessDetails',      label: 'Business Details',      icon: Building2  },
  { id: 'financialPreferences', label: 'Financial Preferences', icon: CreditCard },
  { id: 'notifications',        label: 'Notifications',         icon: Bell       },
]

export default function SettingsPage({ showNotification }) {
  const [settings, setSettings]     = useState(null)
  const [draft, setDraft]           = useState(null)
  const [activeSection, setActive]  = useState('ownerProfile')
  const [saving, setSaving]         = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'saved' | 'error' | null
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    settingService.getSettings()
      .then(data => {
        setSettings(data)
        setDraft(JSON.parse(JSON.stringify(data)))
      })
      .catch(() => {
        if (showNotification) showNotification({ type: 'error', message: 'Failed to load settings' })
      })
      .finally(() => setLoading(false))
  }, [])

  const updateDraft = (section, field, value) => {
    setSaveStatus(null)
    setDraft(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await settingService.updateSettings(draft)
      setSettings(result.settings || draft)
      setSaveStatus('saved')
      if (showNotification) showNotification({ type: 'success', message: 'Settings saved successfully!' })
    } catch {
      setSaveStatus('error')
      if (showNotification) showNotification({ type: 'error', message: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setDraft(JSON.parse(JSON.stringify(settings)))
    setSaveStatus(null)
  }

  const isDirty = settings && draft && JSON.stringify(settings) !== JSON.stringify(draft)

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="settings-spinner" />
        <p>Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="settings-page">
      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <span className="breadcrumb-workspace">WORKSPACE</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">SETTING</span>
      </div>

      {/* Page Title */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Personalize your owner workspace and business preferences.</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Left Nav Panel */}
        <aside className="settings-nav-panel">
          <div className="settings-nav-section-title">YOUR WORKSPACE</div>
          <nav className="settings-nav">
            {SECTIONS.map(s => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  type="button"
                  className={'settings-nav-item' + (activeSection === s.id ? ' active' : '')}
                  onClick={() => setActive(s.id)}
                >
                  <Icon size={16} strokeWidth={1.8} className="settings-nav-icon-svg" />
                  <span className="settings-nav-label">{s.label}</span>
                  <ChevronRight size={14} className="settings-nav-arrow" />
                </button>
              )
            })}
          </nav>

          {/* Promo card */}
          <div className="settings-promo-card">
            <div className="settings-promo-icon">
              <Building size={20} />
            </div>
            <div className="settings-promo-title">A workspace built for you</div>
            <div className="settings-promo-desc">
              No employee accounts. Labour records are managed by the business owner.
            </div>
          </div>
        </aside>

        {/* Right Content Panel */}
        <div className="settings-content-panel">
          {activeSection === 'ownerProfile'         && draft && <OwnerProfileSection draft={draft} updateDraft={updateDraft} />}
          {activeSection === 'businessDetails'      && draft && <BusinessDetailsSection draft={draft} updateDraft={updateDraft} />}
          {activeSection === 'financialPreferences' && draft && <FinancialPreferencesSection draft={draft} updateDraft={updateDraft} />}
          {activeSection === 'notifications'        && draft && <NotificationsSection draft={draft} updateDraft={updateDraft} />}

          {/* Footer */}
          <div className="settings-footer">
            <div className="settings-save-status">
              {saveStatus === 'saved' && !isDirty && (
                <><CheckCircle2 size={14} className="save-status-icon success" /><span>All changes saved</span></>
              )}
              {saveStatus === 'error' && (
                <><AlertCircle size={14} className="save-status-icon error" /><span>Failed to save</span></>
              )}
              {!saveStatus && !isDirty && (
                <span className="save-status-hint">
                  Preferences are stored on this device. Notification delivery and report configuration require a backend
                  integration; changing these preferences does not send messages or alter existing reports.
                </span>
              )}
            </div>
            <div className="settings-footer-actions">
              <button
                type="button"
                className="btn btn-settings-discard"
                onClick={handleDiscard}
                disabled={!isDirty || saving}
              >
                <RotateCcw size={14} />
                Discard Changes
              </button>
              <button
                type="button"
                className="btn btn-settings-save"
                onClick={handleSave}
                disabled={!isDirty || saving}
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
   Shared sub-components
──────────────────────────────────────── */

function SectionHeader({ title, subtitle, avatarInitials, avatarName }) {
  return (
    <div className="settings-section-header">
      <div className="settings-section-title-row">
        <h2 className="settings-section-title">{title}</h2>
        <Settings size={18} className="settings-section-gear" strokeWidth={1.5} />
      </div>
      <p className="settings-section-subtitle">{subtitle}</p>
      {avatarInitials && (
        <div className="settings-avatar-row">
          <div className="settings-avatar">{avatarInitials}</div>
          <div>
            <div className="settings-avatar-name">{avatarName}</div>
            <div className="settings-avatar-role">Workspace owner · Full access</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="settings-field">
      <label className="settings-field-label">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, readOnly }) {
  return (
    <input
      type="text"
      className={'settings-input' + (readOnly ? ' settings-input-readonly' : '')}
      value={value || ''}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  )
}

/* ────────────────────────────────────────
   Section pages
──────────────────────────────────────── */

function OwnerProfileSection({ draft, updateDraft }) {
  const p = draft.ownerProfile || {}
  const initials = (p.fullName || 'AM')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="settings-section">
      <SectionHeader
        title="Owner Profile"
        subtitle="Your contact information and account identity."
        avatarInitials={initials}
        avatarName={p.fullName || 'Arjun Mehta'}
      />
      <div className="settings-form-grid">
        <Field label="Full Name">
          <TextInput value={p.fullName} onChange={v => updateDraft('ownerProfile', 'fullName', v)} placeholder="Full name" />
        </Field>
        <Field label="Email Address">
          <TextInput value={p.email} onChange={v => updateDraft('ownerProfile', 'email', v)} placeholder="Email address" />
        </Field>
        <Field label="Mobile Number">
          <TextInput value={p.mobileNumber} onChange={v => updateDraft('ownerProfile', 'mobileNumber', v)} placeholder="Mobile number" />
        </Field>
        <Field label="Role">
          <TextInput value={p.role} readOnly placeholder="Role" />
        </Field>
      </div>
    </div>
  )
}

function BusinessDetailsSection({ draft, updateDraft }) {
  const b = draft.businessDetails || {}
  return (
    <div className="settings-section">
      <SectionHeader title="Business Details" subtitle="Your company and registration information." />
      <div className="settings-form-grid">
        <Field label="Company Name">
          <TextInput value={b.companyName} onChange={v => updateDraft('businessDetails', 'companyName', v)} placeholder="Company name" />
        </Field>
        <Field label="GSTIN">
          <TextInput value={b.gstin} onChange={v => updateDraft('businessDetails', 'gstin', v)} placeholder="GST number" />
        </Field>
        <Field label="Registration Number">
          <TextInput value={b.registrationNumber} onChange={v => updateDraft('businessDetails', 'registrationNumber', v)} placeholder="Registration number" />
        </Field>
        <Field label="Currency">
          <TextInput value={b.currency} onChange={v => updateDraft('businessDetails', 'currency', v)} placeholder="Currency" />
        </Field>
        <Field label="Address">
          <TextInput value={b.address} onChange={v => updateDraft('businessDetails', 'address', v)} placeholder="Business address" />
        </Field>
      </div>
    </div>
  )
}

function FinancialPreferencesSection({ draft, updateDraft }) {
  const f = draft.financialPreferences || {}
  return (
    <div className="settings-section">
      <SectionHeader title="Financial Preferences" subtitle="Configure payment terms and currency settings." />
      <div className="settings-form-grid">
        <Field label="Default Payment Terms">
          <select
            className="settings-input settings-select"
            value={f.defaultPaymentTerms || 'Immediate'}
            onChange={e => updateDraft('financialPreferences', 'defaultPaymentTerms', e.target.value)}
          >
            {['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 60'].map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Fiscal Year">
          <select
            className="settings-input settings-select"
            value={f.fiscalYear || 'April - March'}
            onChange={e => updateDraft('financialPreferences', 'fiscalYear', e.target.value)}
          >
            {['April - March', 'January - December', 'July - June'].map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Currency Symbol">
          <TextInput value={f.currencySymbol} onChange={v => updateDraft('financialPreferences', 'currencySymbol', v)} placeholder="₹" />
        </Field>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-info">
        <div className="settings-toggle-label">{label}</div>
        {description && <div className="settings-toggle-desc">{description}</div>}
      </div>
      <button
        type="button"
        className={'settings-toggle' + (checked ? ' on' : '')}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="settings-toggle-thumb" />
      </button>
    </div>
  )
}

function NotificationsSection({ draft, updateDraft }) {
  const n = draft.notifications || {}
  return (
    <div className="settings-section">
      <SectionHeader title="Notifications" subtitle="Configure how and when you receive alerts." />
      <div className="settings-toggles">
        <ToggleRow
          label="Daily Email Summary"
          description="Receive a daily summary of expenses and site activity."
          checked={!!n.emailDailySummary}
          onChange={v => updateDraft('notifications', 'emailDailySummary', v)}
        />
        <ToggleRow
          label="Low Balance Alerts"
          description="Get notified when a bank account balance falls below the threshold."
          checked={!!n.lowBalanceAlerts}
          onChange={v => updateDraft('notifications', 'lowBalanceAlerts', v)}
        />
        <ToggleRow
          label="Payment Reminders"
          description="Reminders for pending supplier or labour payments."
          checked={!!n.paymentReminders}
          onChange={v => updateDraft('notifications', 'paymentReminders', v)}
        />
      </div>
    </div>
  )
}
