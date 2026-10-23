import React, { useState } from 'react'
import { X, UserCheck, Phone, Mail, MapPin, Building2, IndianRupee, FileText } from 'lucide-react'
import { siteOwnerService } from '../services/siteOwnerService.js'

export default function AddClientModal({
  isOpen,
  onClose,
  sites = [],
  onClientCreated,
  showNotification,
}) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    siteId: '',
    status: 'On schedule',
    projectValue: '',
    advanceAmount: '',
    totalReceived: '',
    notes: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Client name is required.')
      return
    }
    if (!formData.phone.trim()) {
      setError('Contact number is required.')
      return
    }
    if (!formData.projectValue) {
      setError('Project value is required.')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        siteId: formData.siteId ? Number(formData.siteId) : null,
        status: formData.status || 'On schedule',
        projectValue: Number(formData.projectValue) || 0,
        advanceAmount: Number(formData.advanceAmount) || 0,
        totalReceived: Number(formData.totalReceived) || 0,
        notes: formData.notes.trim(),
      }

      const res = await siteOwnerService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Site Owner "${res.name || formData.name}" added successfully!`,
        })
      }

      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        siteId: '',
        status: 'On schedule',
        projectValue: '',
        advanceAmount: '',
        totalReceived: '',
        notes: '',
      })

      if (onClientCreated) {
        onClientCreated(res)
      }
      onClose()
    } catch (err) {
      console.error('Failed to create site owner:', err)
      setError(err.message || 'Failed to add client. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge" style={{ background: '#E0F2FE', color: '#0293DE' }}>
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="modal-title">+ Add Client / Site Owner</h3>
              <p className="modal-subtitle">
                Enter client contact details and project financials
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="form-alert form-alert-error">{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* Client Name */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Client / Owner Name *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="e.g. Rajesh Mehta"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Contact Number */}
            <div className="form-group">
              <label className="form-label">Contact Number *</label>
              <input
                type="tel"
                name="phone"
                className="form-input"
                placeholder="e.g. +91 98220 11001"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="e.g. client@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            {/* Associated Site */}
            <div className="form-group">
              <label className="form-label">Associated Site</label>
              <select
                name="siteId"
                className="form-select"
                value={formData.siteId}
                onChange={handleChange}
              >
                <option value="">-- Select Site --</option>
                {sites.map((site) => (
                  <option key={site._id || site.id} value={site.id || site._id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                name="status"
                className="form-select"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="On schedule">On schedule</option>
                <option value="Payment due">Payment due</option>
                <option value="Completed">Completed</option>
                <option value="On hold">On hold</option>
              </select>
            </div>

            {/* Project Value */}
            <div className="form-group">
              <label className="form-label">Project Value (₹) *</label>
              <input
                type="number"
                name="projectValue"
                className="form-input"
                placeholder="e.g. 8500000"
                min="0"
                step="any"
                value={formData.projectValue}
                onChange={handleChange}
                required
              />
            </div>

            {/* Advance Amount */}
            <div className="form-group">
              <label className="form-label">Advance Amount (₹)</label>
              <input
                type="number"
                name="advanceAmount"
                className="form-input"
                placeholder="e.g. 6500000"
                min="0"
                step="any"
                value={formData.advanceAmount}
                onChange={handleChange}
              />
            </div>

            {/* Total Received */}
            <div className="form-group">
              <label className="form-label">Total Received (₹)</label>
              <input
                type="number"
                name="totalReceived"
                className="form-input"
                placeholder="e.g. 13500000"
                min="0"
                step="any"
                value={formData.totalReceived}
                onChange={handleChange}
              />
            </div>

            {/* Address */}
            <div className="form-group">
              <label className="form-label">Address / City</label>
              <input
                type="text"
                name="address"
                className="form-input"
                placeholder="e.g. Pune, Maharashtra"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            {/* Notes */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Notes / Description</label>
              <textarea
                name="notes"
                className="form-textarea"
                rows="2"
                placeholder="Contract details, milestones, or instructions..."
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ background: '#0293DE', borderColor: '#0293DE' }}
            >
              {submitting ? 'Saving...' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
