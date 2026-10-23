import React, { useState } from 'react'
import { X, Building2 } from 'lucide-react'
import { siteService } from '../services/siteService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

export default function AddSiteModal({ isOpen, onClose, onSiteCreated, showNotification }) {
  const [formData, setFormData] = useState(() => ({
    name: '',
    location: '',
    siteOwner: '',
    totalBudget: '',
    startDate: getTodayString(),
    expectedCompletionDate: '',
    status: 'Active',
    description: '',
  }))
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

    if (!formData.name || !formData.location || !formData.siteOwner || !formData.totalBudget) {
      setError('Please fill in all required fields.')
      return
    }

    try {
      setSubmitting(true)
      const newSite = await siteService.create({
        ...formData,
        totalBudget: Number(formData.totalBudget),
      })

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Site "${newSite.name}" added successfully and saved to MongoDB!`,
        })
      }

      setFormData({
        name: '',
        location: '',
        siteOwner: '',
        totalBudget: '',
        startDate: getTodayString(),
        expectedCompletionDate: '',
        status: 'Active',
        description: '',
      })
      if (onSiteCreated) onSiteCreated(newSite)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create site')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="modal-title">+ Add New Construction Site</h3>
              <p className="modal-subtitle">Create a project and configure budget parameters</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {error && <div className="form-alert form-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-grid">
            <div className="form-group">
              <label className="form-label">Site Name *</label>
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder="e.g. Aarav Heights"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location *</label>
              <input
                type="text"
                name="location"
                className="form-input"
                placeholder="e.g. Baner, Pune"
                value={formData.location}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Site Owner / Client *</label>
              <input
                type="text"
                name="siteOwner"
                className="form-input"
                placeholder="e.g. Rajesh Mehta"
                value={formData.siteOwner}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Total Budget (₹) *</label>
              <input
                type="number"
                name="totalBudget"
                className="form-input"
                placeholder="e.g. 18500000"
                value={formData.totalBudget}
                onChange={handleChange}
                required
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                name="startDate"
                className="form-input"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expected Completion</label>
              <input
                type="date"
                name="expectedCompletionDate"
                className="form-input"
                value={formData.expectedCompletionDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Project Status</label>
              <select
                name="status"
                className="form-select"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description / Remarks</label>
              <input
                type="text"
                name="description"
                className="form-input"
                placeholder="Project brief, contractor note"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary-action"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary-action"
              disabled={submitting}
            >
              {submitting ? 'Saving to Database...' : 'Save Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
