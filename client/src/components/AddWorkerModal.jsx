import React, { useState, useEffect } from 'react'
import { X, HardHat } from 'lucide-react'
import { labourService } from '../services/labourService.js'
import { bankAccountService } from '../services/bankAccountService.js'

const getTodayString = () => new Date().toISOString().split('T')[0]

const TRADES = [
  'Mason',
  'Helper',
  'Carpenter',
  'Electrician',
  'Plumber',
  'Painter',
  'General Construction Worker',
  'Supervisor',
  'Other',
]

export default function AddWorkerModal({
  isOpen,
  onClose,
  sites = [],
  bankAccounts: initialBankAccounts = [],
  onWorkerCreated,
  showNotification,
  embeddedMode = false,
}) {
  const [formData, setFormData] = useState(() => ({
    name: '',
    phone: '',
    trade: 'Mason',
    otherTrade: '',
    site: sites[0]?._id || '',
    joiningDate: getTodayString(),
    dailyRate: '',
    advanceAmount: '',
    bankAccountId: '',
    address: '',
  }))

  const [bankAccounts, setBankAccounts] = useState(initialBankAccounts || [])
  const [loadingBanks, setLoadingBanks] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  // Load bank accounts if not supplied or empty
  useEffect(() => {
    if (isOpen) {
      if (initialBankAccounts && initialBankAccounts.length > 0) {
        setBankAccounts(initialBankAccounts)
      } else {
        setLoadingBanks(true)
        bankAccountService
          .getAll()
          .then((res) => {
            const list = Array.isArray(res) ? res : res?.data || []
            setBankAccounts(list)
          })
          .catch((err) => {
            console.error('Failed to load bank accounts:', err)
          })
          .finally(() => setLoadingBanks(false))
      }
    }
  }, [isOpen, initialBankAccounts])

  if (!isOpen && !embeddedMode) return null

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    if (serverError) setServerError('')
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name || !formData.name.trim()) {
      newErrors.name = 'Worker Full Name is required.'
    }

    if (!embeddedMode) {
      if (!formData.phone || !formData.phone.trim()) {
        newErrors.phone = 'Phone Number is required.'
      } else {
        const cleanPhone = formData.phone.trim()
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/
        if (!phoneRegex.test(cleanPhone)) {
          newErrors.phone = 'Please enter a valid telephone number.'
        }
      }
    }

    if (!formData.trade) {
      newErrors.trade = 'Worker Trade / Role is required.'
    } else if (formData.trade === 'Other' && (!formData.otherTrade || !formData.otherTrade.trim())) {
      newErrors.otherTrade = 'Please specify the trade.'
    }

    if (!formData.site) {
      newErrors.site = 'A valid construction site must be selected.'
    }

    if (!embeddedMode) {
      if (!formData.joiningDate) {
        newErrors.joiningDate = 'Joining Date is required.'
      }
    }

    if (!formData.dailyRate || Number(formData.dailyRate) <= 0) {
      newErrors.dailyRate = 'Daily Wage must be greater than zero.'
    }

    // Validate Advance Payment and Bank Selection
    if (formData.advanceAmount !== '' && formData.advanceAmount !== undefined) {
      const adv = Number(formData.advanceAmount)
      if (isNaN(adv) || adv < 0) {
        newErrors.advanceAmount = 'Advance payment must be a valid, non-negative number.'
      } else if (adv > 0) {
        if (!formData.bankAccountId) {
          newErrors.bankAccountId = 'Please select a bank account for advance payment.'
        } else {
          const selectedBank = bankAccounts.find(
            (b) => String(b.id || b._id) === String(formData.bankAccountId),
          )
          if (selectedBank) {
            const bal = Number(selectedBank.balance || 0)
            if (bal < adv) {
              newErrors.bankAccountId =
                'Insufficient bank balance. Please select another account or reduce the advance amount.'
            }
          }
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    if (!validate()) {
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        trade: formData.trade,
        otherTrade: formData.trade === 'Other' ? formData.otherTrade.trim() : undefined,
        site: formData.site,
        joiningDate: formData.joiningDate,
        dailyRate: Number(formData.dailyRate),
        advanceAmount: formData.advanceAmount !== '' ? Number(formData.advanceAmount) : 0,
        bankAccountId: formData.bankAccountId ? Number(formData.bankAccountId) : null,
        address: formData.address ? formData.address.trim() : '',
      }

      const newWorker = await labourService.create(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: `Worker "${newWorker.name}" added successfully and saved to database!`,
        })
      }

      // Reset form
      setFormData({
        name: '',
        phone: '',
        trade: 'Mason',
        otherTrade: '',
        site: sites[0]?._id || '',
        joiningDate: getTodayString(),
        dailyRate: '',
        advanceAmount: '',
        bankAccountId: '',
        address: '',
      })

      if (onWorkerCreated) {
        onWorkerCreated(newWorker)
      }

      onClose()
    } catch (err) {
      setServerError(err.message || 'Failed to create worker. Please check the inputs.')
    } finally {
      setSubmitting(false)
    }
  }

  if (embeddedMode) {
    return (
      <section className="daily-expense-section" id="add-worker-form">
        <div className="section-header-compact">
          <h2 className="section-title">Add Worker</h2>
          <p className="section-subtitle">Register a worker and assign them to a construction site.</p>
        </div>

        {serverError && (
          <div className="form-alert form-alert-error">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="daily-expense-form">
          <div className="dashboard-worker-form-grid">
            <div className="form-group">
              <label className="form-label labour-form-label">Worker Full Name *</label>
              <input
                type="text"
                name="name"
                className={`form-input ${errors.name ? 'input-error' : ''}`}
                placeholder="e.g. Ramesh Kumar"
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && <span className="field-error-msg">{errors.name}</span>}
            </div>

            {/* Phone Number — hidden in Dashboard embedded form */}
            {!embeddedMode && (
            <div className="form-group">
              <label className="form-label labour-form-label">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                className={`form-input ${errors.phone ? 'input-error' : ''}`}
                placeholder="e.g. +91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
              />
              {errors.phone && <span className="field-error-msg">{errors.phone}</span>}
            </div>
            )}

            <div className="form-group">
              <label className="form-label labour-form-label">Worker Trade / Role *</label>
              <select
                name="trade"
                className={`form-select ${errors.trade ? 'input-error' : ''}`}
                value={formData.trade}
                onChange={handleChange}
              >
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.trade && <span className="field-error-msg">{errors.trade}</span>}
            </div>

            {formData.trade === 'Other' && (
              <div className="form-group">
                <label className="form-label labour-form-label">Specify Trade *</label>
                <input
                  type="text"
                  name="otherTrade"
                  className={`form-input ${errors.otherTrade ? 'input-error' : ''}`}
                  placeholder="Specify role / trade"
                  value={formData.otherTrade}
                  onChange={handleChange}
                />
                {errors.otherTrade && <span className="field-error-msg">{errors.otherTrade}</span>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label labour-form-label">Construction Site *</label>
              <select
                name="site"
                className={`form-select ${errors.site ? 'input-error' : ''}`}
                value={formData.site}
                onChange={handleChange}
              >
                <option value="">Select a construction site...</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.location ? `(${s.location})` : ''}
                  </option>
                ))}
              </select>
              {errors.site && <span className="field-error-msg">{errors.site}</span>}
            </div>

            {/* Joining Date — hidden in Dashboard embedded form */}
            {!embeddedMode && (
            <div className="form-group">
              <label className="form-label labour-form-label">Joining Date *</label>
              <input
                type="date"
                name="joiningDate"
                className={`form-input ${errors.joiningDate ? 'input-error' : ''}`}
                value={formData.joiningDate}
                onChange={handleChange}
              />
              {errors.joiningDate && <span className="field-error-msg">{errors.joiningDate}</span>}
            </div>
            )}

            <div className="form-group">
              <label className="form-label labour-form-label">Total Amount (₹) *</label>
              <div className="input-with-currency-wrap">
                <span className="input-currency-prefix">₹</span>
                <input
                  type="number"
                  name="totalAmount"
                  className={`form-input input-with-prefix ${errors.totalAmount ? 'input-error' : ''}`}
                  placeholder="1000"
                  min="1"
                  step="any"
                  value={formData.totalAmount}
                  onChange={handleChange}
                />
              </div>
              {errors.totalAmount && <span className="field-error-msg">{errors.totalAmount}</span>}
            </div>

            <div className="form-group">
              <label className="form-label labour-form-label">Advance Payment</label>
              <div className="input-with-currency-wrap">
                <span className="input-currency-prefix">₹</span>
                <input
                  type="number"
                  name="advanceAmount"
                  className={`form-input input-with-prefix ${errors.advanceAmount ? 'input-error' : ''}`}
                  placeholder="0"
                  min="0"
                  step="any"
                  value={formData.advanceAmount}
                  onChange={handleChange}
                />
              </div>
              {errors.advanceAmount && <span className="field-error-msg">{errors.advanceAmount}</span>}
            </div>

            <div className="form-group">
              <label className="form-label labour-form-label">
                Bank Name {Number(formData.advanceAmount) > 0 && <span style={{ color: '#EF4444' }}>*</span>}
              </label>
              <select
                name="bankAccountId"
                className={`form-select ${errors.bankAccountId ? 'input-error' : ''}`}
                value={formData.bankAccountId}
                onChange={handleChange}
                disabled={loadingBanks}
              >
                <option value="">
                  {loadingBanks
                    ? 'Loading banks...'
                    : bankAccounts.length === 0
                      ? 'No bank accounts available'
                      : 'Select Bank Name...'}
                </option>
                {bankAccounts.map((b) => (
                  <option key={b.id || b._id} value={b.id || b._id}>
                    {b.bankName}
                  </option>
                ))}
              </select>
              {errors.bankAccountId && <span className="field-error-msg">{errors.bankAccountId}</span>}
            </div>

            {/* Address — hidden in Dashboard embedded form */}
            {!embeddedMode && (
            <div className="form-group dashboard-worker-address">
              <label className="form-label labour-form-label">Address</label>
              <textarea
                name="address"
                className="form-input form-textarea"
                rows={2}
                placeholder="Worker residential address or native place..."
                value={formData.address}
                onChange={handleChange}
              />
            </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="submit"
              className="btn btn-primary-action"
              disabled={submitting}
            >
              {submitting ? 'Adding Worker...' : 'Add Worker'}
            </button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ width: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge" style={{ backgroundColor: '#E0F2FE', color: '#0284C7' }}>
              <HardHat size={20} />
            </div>
            <div>
              <h3 className="modal-title">Add Worker</h3>
              <p className="modal-subtitle">Register a worker and assign them to a construction site.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {serverError && <div className="form-alert form-alert-error" style={{ margin: '16px 24px 0 24px' }}>{serverError}</div>}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
            <div className="modal-form-grid">
              {/* 1. Worker Full Name * */}
              <div className="form-group">
                <label className="form-label labour-form-label">Worker Full Name *</label>
                <input
                  type="text"
                  name="name"
                  className={`form-input ${errors.name ? 'input-error' : ''}`}
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={handleChange}
                />
                {errors.name && <span className="field-error-msg">{errors.name}</span>}
              </div>

              {/* 2. Phone Number * */}
              <div className="form-group">
                <label className="form-label labour-form-label">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  className={`form-input ${errors.phone ? 'input-error' : ''}`}
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                />
                {errors.phone && <span className="field-error-msg">{errors.phone}</span>}
              </div>

              {/* 3. Worker Trade / Role * */}
              <div className="form-group">
                <label className="form-label labour-form-label">Worker Trade / Role *</label>
                <select
                  name="trade"
                  className={`form-select ${errors.trade ? 'input-error' : ''}`}
                  value={formData.trade}
                  onChange={handleChange}
                >
                  {TRADES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.trade && <span className="field-error-msg">{errors.trade}</span>}
              </div>

              {/* 3b. If Other is selected, display specify trade field */}
              {formData.trade === 'Other' && (
                <div className="form-group">
                  <label className="form-label labour-form-label">Specify Trade *</label>
                  <input
                    type="text"
                    name="otherTrade"
                    className={`form-input ${errors.otherTrade ? 'input-error' : ''}`}
                    placeholder="Specify role / trade"
                    value={formData.otherTrade}
                    onChange={handleChange}
                  />
                  {errors.otherTrade && <span className="field-error-msg">{errors.otherTrade}</span>}
                </div>
              )}

              {/* 4. Construction Site * (Loaded from actual sites) */}
              <div className="form-group">
                <label className="form-label labour-form-label">Construction Site *</label>
                <select
                  name="site"
                  className={`form-select ${errors.site ? 'input-error' : ''}`}
                  value={formData.site}
                  onChange={handleChange}
                >
                  <option value="">Select a construction site...</option>
                  {sites.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} {s.location ? `(${s.location})` : ''}
                    </option>
                  ))}
                </select>
                {errors.site && <span className="field-error-msg">{errors.site}</span>}
              </div>

              {/* 5. Joining Date * */}
              <div className="form-group">
                <label className="form-label labour-form-label">Joining Date *</label>
                <input
                  type="date"
                  name="joiningDate"
                  className={`form-input ${errors.joiningDate ? 'input-error' : ''}`}
                  value={formData.joiningDate}
                  onChange={handleChange}
                />
                {errors.joiningDate && <span className="field-error-msg">{errors.joiningDate}</span>}
              </div>

              {/* 6. Daily Wage * with ₹ prefix */}
              <div className="form-group">
                <label className="form-label labour-form-label">Total Amount *</label>
                <div className="input-with-currency-wrap">
                  <span className="input-currency-prefix">₹</span>
                  <input
                    type="number"
                    name="dailyRate"
                    className={`form-input input-with-prefix ${errors.dailyRate ? 'input-error' : ''}`}
                    placeholder="1000"
                    min="1"
                    step="any"
                    value={formData.dailyRate}
                    onChange={handleChange}
                  />
                </div>
                {errors.dailyRate && <span className="field-error-msg">{errors.dailyRate}</span>}
              </div>

              {/* 7. Advance Payment */}
              <div className="form-group">
                <label className="form-label labour-form-label">Advance Payment</label>
                <div className="input-with-currency-wrap">
                  <span className="input-currency-prefix">₹</span>
                  <input
                    type="number"
                    name="advanceAmount"
                    className={`form-input input-with-prefix ${errors.advanceAmount ? 'input-error' : ''}`}
                    placeholder="0"
                    min="0"
                    step="any"
                    value={formData.advanceAmount}
                    onChange={handleChange}
                  />
                </div>
                {errors.advanceAmount && <span className="field-error-msg">{errors.advanceAmount}</span>}
              </div>

              {/* 8. Bank Name */}
              <div className="form-group">
                <label className="form-label labour-form-label">
                  Bank Name {Number(formData.advanceAmount) > 0 && <span style={{ color: '#EF4444' }}>*</span>}
                </label>
                <select
                  name="bankAccountId"
                  className={`form-select ${errors.bankAccountId ? 'input-error' : ''}`}
                  value={formData.bankAccountId}
                  onChange={handleChange}
                  disabled={loadingBanks}
                >
                  <option value="">
                    {loadingBanks
                      ? 'Loading banks...'
                      : bankAccounts.length === 0
                        ? 'No bank accounts available'
                        : 'Select Bank Name...'}
                  </option>
                  {bankAccounts.map((b) => (
                    <option key={b.id || b._id} value={b.id || b._id}>
                      {b.bankName}
                    </option>
                  ))}
                </select>
                {errors.bankAccountId && <span className="field-error-msg">{errors.bankAccountId}</span>}
              </div>

              {/* 9. Address (optional textarea) */}
              <div className="form-group full-span">
                <label className="form-label labour-form-label">Address</label>
                <textarea
                  name="address"
                  className="form-input form-textarea"
                  rows={2}
                  placeholder="Worker residential address or native place..."
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>{/* end modal-body */}

          {/* Buttons at the bottom: Cancel and Add Worker */}
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
              {submitting ? 'Adding Worker...' : 'Add Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
