import React, { useState } from 'react'
import { Eye, EyeOff, Lock, User, LogIn } from 'lucide-react'
import { authService } from '../services/authService.js'

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('Please enter your username.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      const res = await authService.login(username.trim(), password)
      onLoginSuccess(res)
    } catch (err) {
      setError(err.message || 'Invalid username or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <img src="/logo.png" alt="GeoCrete Arch" className="login-logo" onError={(e) => { e.target.style.display = 'none' }} />
          <h1 className="login-title">GeoCrete Arch</h1>
          <p className="login-subtitle">Construction Management System</p>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="login-field">
            <label htmlFor="login-username" className="login-label">Username</label>
            <div className="login-input-wrap">
              <span className="login-input-icon"><User size={16} /></span>
              <input
                id="login-username"
                type="text"
                className="login-input"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                autoComplete="username"
                autoFocus
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password" className="login-label">Password</label>
            <div className="login-input-wrap">
              <span className="login-input-icon"><Lock size={16} /></span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input login-input--has-toggle"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="login-error" role="alert">
              <span>⚠ {error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="login-btn-loading">
                <span className="login-spinner" />
                Signing in…
              </span>
            ) : (
              <span className="login-btn-content">
                <LogIn size={16} />
                Sign In
              </span>
            )}
          </button>
        </form>

        <p className="login-footer">GeoCrete Arch &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}

