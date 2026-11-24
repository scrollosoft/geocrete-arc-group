import React, { useState, useEffect } from 'react'
import {
  User,
  Building2,
  Lock,
  ChevronRight,
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Building,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { settingService } from '../services/settingService.js'
import { authService } from '../services/authService.js'

const SECTIONS = [
  { id: 'ownerProfile',         label: 'Owner Profile',         icon: User       },
  { id: 'businessDetails',      label: 'Business Details',      icon: Building2  },
  { id: 'changePassword',       label: 'Change Password',       icon: Lock       },
]

export default function SettingsPage({ showNotification, onProfileUpdated }) {
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
      const updated = result.settings || draft
      setSettings(updated)
      setSaveStatus('saved')
      if (showNotification) showNotification({ type: 'success', message: 'Settings saved successfully!' })
      if (onProfileUpdated && updated?.ownerProfile) {
        onProfileUpdated(updated.ownerProfile)
      }
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
          {activeSection === 'changePassword'       && <ChangePasswordSection showNotification={showNotification} />}

          {/* Footer for profile and business details */}
          {activeSection !== 'changePassword' && (
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
                    Settings are saved to your workspace profile and synced across your account.
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
          )}
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

function PasswordInputField({ value, onChange, placeholder, disabled, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <input
        type={show ? 'text' : 'password'}
        className="settings-input"
        style={{ width: '100%', paddingRight: '42px', boxSizing: 'border-box' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete || 'new-password'}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        style={{
          position: 'absolute',
          right: '8px',
          background: 'none',
          border: 'none',
          color: '#70829F',
          cursor: 'pointer',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
        }}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

function ChangePasswordSection({ showNotification }) {
  const [passwordTarget, setPasswordTarget] = useState('admin') // 'admin' | 'manager'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [managerNewPassword, setManagerNewPassword] = useState('')
  const [managerConfirmPassword, setManagerConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleAdminSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!currentPassword) {
      setErrorMsg('Please enter your current password.')
      return
    }
    if (!newPassword) {
      setErrorMsg('Please enter a new password.')
      return
    }
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and Confirm password do not match.')
      return
    }
    if (currentPassword === newPassword) {
      setErrorMsg('New password cannot be the same as the current password.')
      return
    }

    try {
      setSubmitting(true)
      const res = await authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })

      const msg = res?.message || 'Password changed successfully! Please use your new password for future sign-ins.'
      setSuccessMsg(msg)
      if (showNotification) {
        showNotification({ type: 'success', message: msg })
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update password. Please check your current password.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleManagerSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!managerNewPassword) {
      setErrorMsg('Please enter a new password for Manager.')
      return
    }
    if (managerNewPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.')
      return
    }
    if (managerNewPassword !== managerConfirmPassword) {
      setErrorMsg('New password and Confirm password do not match.')
      return
    }

    try {
      setSubmitting(true)
      const res = await authService.updateManagerPassword({
        newPassword: managerNewPassword,
        confirmPassword: managerConfirmPassword,
      })

      const msg = res?.message || "Manager's password updated successfully!"
      setSuccessMsg(msg)
      if (showNotification) {
        showNotification({ type: 'success', message: msg })
      }

      setManagerNewPassword('')
      setManagerConfirmPassword('')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update manager password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="settings-section">
      <SectionHeader
        title="Change Password"
        subtitle="Update credentials to keep your business workspace secure."
      />

      {/* Target Selector Tabs: Admin Password vs Manager Password */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => {
            setPasswordTarget('admin')
            setErrorMsg('')
            setSuccessMsg('')
          }}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: passwordTarget === 'admin' ? '#0284C7' : '#F1F5F9',
            color: passwordTarget === 'admin' ? '#FFFFFF' : '#475569',
            transition: 'all 0.15s ease',
          }}
        >
          Admin Password
        </button>
        <button
          type="button"
          onClick={() => {
            setPasswordTarget('manager')
            setErrorMsg('')
            setSuccessMsg('')
          }}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: passwordTarget === 'manager' ? '#0284C7' : '#F1F5F9',
            color: passwordTarget === 'manager' ? '#FFFFFF' : '#475569',
            transition: 'all 0.15s ease',
          }}
        >
          Manager Password
        </button>
      </div>

      {errorMsg && (
        <div
          className="form-alert form-alert-error"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            color: '#B91C1C',
            fontSize: '13.5px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          className="form-alert form-alert-success"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            padding: '12px 16px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '8px',
            color: '#15803D',
            fontSize: '13.5px',
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {passwordTarget === 'admin' ? (
        <form onSubmit={handleAdminSubmit} style={{ maxWidth: '480px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <Field label="Current Password">
              <PasswordInputField
                value={currentPassword}
                onChange={(val) => {
                  setCurrentPassword(val)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Enter current password"
                disabled={submitting}
                autoComplete="current-password"
              />
            </Field>

            <Field label="New Password">
              <PasswordInputField
                value={newPassword}
                onChange={(val) => {
                  setNewPassword(val)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Enter at least 6 characters"
                disabled={submitting}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm New Password">
              <PasswordInputField
                value={confirmPassword}
                onChange={(val) => {
                  setConfirmPassword(val)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Re-enter new password"
                disabled={submitting}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="submit"
              className="btn-settings-save"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                fontWeight: 600,
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  <span>Updating Password…</span>
                </>
              ) : (
                <>
                  <Lock size={15} />
                  <span>Change Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleManagerSubmit} style={{ maxWidth: '480px' }}>
          <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748B' }}>
            Set a new password for the Manager account (username: <strong>manager</strong>).
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <Field label="New Manager Password">
              <PasswordInputField
                value={managerNewPassword}
                onChange={(val) => {
                  setManagerNewPassword(val)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Enter at least 6 characters"
                disabled={submitting}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm Manager Password">
              <PasswordInputField
                value={managerConfirmPassword}
                onChange={(val) => {
                  setManagerConfirmPassword(val)
                  if (errorMsg) setErrorMsg('')
                }}
                placeholder="Re-enter new password"
                disabled={submitting}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="submit"
              className="btn-settings-save"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                fontWeight: 600,
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  <span>Updating Manager Password…</span>
                </>
              ) : (
                <>
                  <Lock size={15} />
                  <span>Update Manager Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}


