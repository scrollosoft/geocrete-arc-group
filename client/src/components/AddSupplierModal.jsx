import React, { useState, useRef, useEffect } from 'react'
import { X, Truck, Check } from 'lucide-react'
import { supplierService } from '../services/supplierService.js'

const AVAILABLE_CATEGORIES = [
  'Cement',
  'Steel',
  'Bricks',
  'Sand',
  'Aggregate',
  'Electrical Materials',
  'Plumbing Materials',
  'Equipment',
  'General Supplier',
  'Other',
]

export default function AddSupplierModal({
  isOpen,
  onClose,
  onSupplierCreated,
  showNotification,
}) {
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    paymentTerms: 'Immediate',
    customPaymentTerms: '',
    status: 'Active',
  })

  const [selectedCategories, setSelectedCategories] = useState([])
  const [customCategory, setCustomCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const containerRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      if (containerRef.current) containerRef.current.scrollTop = 0
      if (formRef.current) formRef.current.scrollTop = 0
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const toggleCategory = (cat) => {
    if (error) setError('')
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) {
        return prev.filter((c) => c !== cat)
      } else {
        return [...prev, cat]
      }
    })
  }

  const validatePhone = (phoneStr) => {
    const digits = phoneStr.replace(/\D/g, '')
    return digits.length >= 10
  }

  const validateEmail = (emailStr) => {
    if (!emailStr) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedName = formData.name.trim()
    const trimmedPhone = formData.phone.trim()
    const trimmedEmail = formData.email.trim()

    // Required fields check
    if (!trimmedName) {
      setError('Supplier / Company Name is required.')
      return
    }

    if (selectedCategories.length === 0) {
      setError('Please select at least one Supplier Category.')
      return
    }

    if (selectedCategories.includes('Other') && !customCategory.trim()) {
      setError('Please specify the custom category for "Other".')
      return
    }

    if (!trimmedPhone) {
      setError('Contact Number is required.')
      return
    }

    if (!validatePhone(trimmedPhone)) {
      setError('Please enter a valid contact number (at least 10 digits).')
      return
    }

    if (trimmedEmail && !validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    // Assemble categories list
    const finalCategories = selectedCategories.map((c) =>
      c === 'Other' ? (customCategory.trim() || 'Other') : c
    )

    const finalPaymentTerms =
      formData.paymentTerms === 'Custom' && formData.customPaymentTerms.trim()
        ? formData.customPaymentTerms.trim()
        : formData.paymentTerms

    try {
      setSubmitting(true)

      const payload = {
        name: trimmedName,
        companyName: trimmedName,
        contactPerson: formData.contactPerson.trim(),
        phone: trimmedPhone,
        email: trimmedEmail,
        address: formData.address.trim(),
        categories: finalCategories,
        paymentTerms: finalPaymentTerms,
        status: formData.status,
        isActive: formData.status === 'Active',
      }

      const res = await supplierService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Supplier "${res.name || trimmedName}" added successfully!`,
        })
      }

      // Reset form
      setFormData({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        paymentTerms: 'Immediate',
        customPaymentTerms: '',
        status: 'Active',
      })
      setSelectedCategories([])
      setCustomCategory('')

      if (onSupplierCreated) {
        onSupplierCreated(res)
      }
      onClose()
    } catch (err) {
      console.error('Failed to create supplier:', err)
      setError(err.message || 'Failed to save supplier. Please check your inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className="modal-container"
        style={{
          maxWidth: '640px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #E5EAF1', flexShrink: 0 }}>
          <div className="modal-title-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="modal-icon-badge"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#E0F2FE',
                color: '#0293DE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Truck size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700, color: '#172033', margin: 0 }}>
                Add New Supplier
              </h3>
              <p className="modal-subtitle" style={{ fontSize: '13px', color: '#70829F', margin: '4px 0 0 0' }}>
                Enter supplier details, material categories, and payment terms
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#70829F',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="form-alert form-alert-error"
            style={{
              margin: '16px 24px 0 24px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#FEE2E2',
              color: '#B91C1C',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {/* Form Body */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="modal-form"
        >
          <div className="modal-body">
          <div className="modal-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* 1. Supplier / Company Name */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label
                className="form-label"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '17.31px',
                  color: '#172033',
                  marginBottom: '6px',
                }}
              >
                Supplier / Company Name *
              </label>
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder="e.g. Apex Heavy Earthmovers"
                value={formData.name}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E5EAF1',
                  fontSize: '14px',
                  color: '#172033',
                  outline: 'none',
                }}
              />
            </div>

            {/* 2. Supplier Categories (Multiple Selection Chips) */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label
                className="form-label"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '17.31px',
                  color: '#172033',
                  marginBottom: '8px',
                }}
              >
                Material Categories * <span style={{ fontSize: '12px', fontWeight: 400, color: '#70829F' }}>(select one or more)</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: selectedCategories.includes('Other') ? '10px' : '0',
                }}
              >
                {AVAILABLE_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: isSelected ? '1.5px solid #0293DE' : '1px solid #E5EAF1',
                        background: isSelected ? '#E0F2FE' : '#F8FAFC',
                        color: isSelected ? '#0293DE' : '#475569',
                        fontSize: '13px',
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} />}
                      <span>{cat}</span>
                    </button>
                  )
                })}
              </div>

              {/* If "Other" category is chosen, display custom category input */}
              {selectedCategories.includes('Other') && (
                <div style={{ marginTop: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Specify custom category..."
                    value={customCategory}
                    onChange={(e) => {
                      setCustomCategory(e.target.value)
                      if (error) setError('')
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #0293DE',
                      fontSize: '13px',
                      color: '#172033',
                    }}
                  />
                </div>
              )}
            </div>

            {/* 3. Contact Number */}
            <div className="form-group">
              <label
                className="form-label"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '17.31px',
                  color: '#172033',
                  marginBottom: '6px',
                }}
              >
                Contact Number *
              </label>
              <input
                type="tel"
                name="phone"
                className="form-input"
                placeholder="e.g. +91 94220 55667"
                value={formData.phone}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E5EAF1',
                  fontSize: '14px',
                  color: '#172033',
                }}
              />
            </div>

            {/* 4. Contact Person */}
            <div className="form-group">
              <label
                className="form-label"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '17.31px',
                  color: '#172033',
                  marginBottom: '6px',
                }}
              >
                Contact Person
              </label>
              <input
                type="text"
                name="contactPerson"
                className="form-input"
                placeholder="e.g. Ramesh Patel"
                value={formData.contactPerson}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E5EAF1',
                  fontSize: '14px',
                  color: '#172033',
                }}
              />
            </div>

            {/* 5. Email Address */}
            <div className="form-group">
              <label
                className="form-label"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '17.31px',
                  color: '#172033',
                  marginBottom: '6px',
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="e.g. rentals@apexmachinery.com"
                value={formData.email}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E5EAF1',
                  fontSize: '14px',
                  color: '#172033',
                }}
              />
            </div>

            {/* 6. Status */}
            <div className="form-group">
              <label
                className="form-label"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '17.31px',
                  color: '#172033',
                  marginBottom: '6px',
                }}
              >
                Status
              </label>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '42px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#172033' }}>
                  <input
                    type="radio"
                    name="status"
                    value="Active"
                    checked={formData.status === 'Active'}
                    onChange={handleChange}
                  />
                  <span>Active</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#172033' }}>
                  <input
                    type="radio"
                    name="status"
                    value="Inactive"
                    checked={formData.status === 'Inactive'}
                    onChange={handleChange}
                  />
                  <span>Inactive</span>
                </label>
              </div>
            </div>

            {/* 7. Address */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label
                className="form-label"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '17.31px',
                  color: '#172033',
                  marginBottom: '6px',
                }}
              >
                Address / Location
              </label>
              <textarea
                name="address"
                className="form-textarea"
                rows="2"
                placeholder="e.g. Katraj Bypass, Pune"
                value={formData.address}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #E5EAF1',
                  fontSize: '14px',
                  color: '#172033',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          </div>{/* end modal-body */}

          {/* Modal Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #E5EAF1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: '#0293DE',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
