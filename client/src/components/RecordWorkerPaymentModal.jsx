import React, { useState, useEffect } from 'react'
import { X, Receipt, Loader2, AlertTriangle } from 'lucide-react'
import { workerPaymentService } from '../services/workerPaymentService.js'
import { bankAccountService } from '../services/bankAccountService.js'

const PAYMENT_TYPES = [
  'Advance Payment',
  'Additional Advance',
  'Remaining Payment',
  'Wage Payment',
  'Final Settlement',
  'Other',
]

export default function RecordWorkerPaymentModal({ onClose, worker, workers = [], sites = [], onSuccess }) {
  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    workerId: worker?._id || worker?.id || '',
    siteId: worker?.siteId || worker?.site_id || worker?.site?._id || worker?.site?.id || (typeof worker?.site === 'string' ? worker?.site : '') || '',
    bankAccountId: '',
    amount: '',
    paymentDate: today,
    paymentType: 'Remaining Payment',
    remarks: '',
  })
  const [banks, setBanks] = useState([])
  const [loadingBanks, setLoadingBanks] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const activeWorker = worker || workers.find((w) => String(w._id || w.id) === String(form.workerId)) || null
  const outstanding = Number(activeWorker?.outstanding || 0)
  const selectedBank = banks.find((b) => String(b._id || b.id) === String(form.bankAccountId))

  useEffect(() => {
    bankAccountService
      .getAll()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setBanks(list)
      })
      .catch(() => setBanks([]))
      .finally(() => setLoadingBanks(false))
  }, [])

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaveError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaveError('')

    const amount = Number(form.amount)
    if (!form.workerId) { setSaveError('Worker is required.'); return }
    if (!form.bankAccountId) { setSaveError('Please select a bank account.'); return }
    if (!amount || amount <= 0) { setSaveError('Please enter a valid amount greater than zero.'); return }
    if (outstanding > 0 && amount > outstanding) {
      setSaveError(`Payment amount (₹${amount.toLocaleString('en-IN')}) cannot exceed the outstanding balance of ₹${outstanding.toLocaleString('en-IN')}.`)
      return
    }

    // Client-side bank balance check
    if (selectedBank) {
      const balance = Number(selectedBank.balance || 0)
      if (balance < amount) {
        setSaveError(
          `Insufficient bank balance in ${selectedBank.bankName || selectedBank.bank_name}. Available: ₹${balance.toLocaleString('en-IN')}, Requested: ₹${amount.toLocaleString('en-IN')}. Please select another account or reduce the amount.`
        )
        return
      }
    }

    setSaving(true)
    try {
      await workerPaymentService.create({
        workerId: form.workerId,
        siteId: form.siteId || null,
        bankAccountId: form.bankAccountId,
        amount,
        paymentDate: form.paymentDate,
        paymentType: form.paymentType,
        remarks: form.remarks,
        createdBy: 'Admin',
      })
      setSaveSuccess(true)
      if (onSuccess) onSuccess()
      setTimeout(() => onClose(), 1300)
    } catch (err) {
      setSaveError(err.message || 'Failed to record payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="modal-box"
        style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(15,23,42,0.18)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #E5EAF1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#F0FDF4', borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={20} color="#16A34A" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#172033' }}>Record Payment</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#70829F', marginTop: '2px' }}>
                {worker ? `Payment to ${worker.name}` : 'Record worker payment'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#70829F', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Worker Info Banner */}
        {activeWorker && (
          <div style={{ padding: '12px 24px', background: '#F8FAFC', borderBottom: '1px solid #E5EAF1', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#70829F', fontWeight: 600 }}>WORKER</span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#172033', marginTop: '2px' }}>{activeWorker.name}</div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#70829F', fontWeight: 600 }}>TRADE</span>
              <div style={{ fontSize: '14px', color: '#374151', marginTop: '2px' }}>{activeWorker.trade || '—'}</div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#70829F', fontWeight: 600 }}>PENDING</span>
              <div style={{ fontSize: '14px', fontWeight: 700, color: outstanding > 0 ? '#DC2626' : '#16A34A', marginTop: '2px' }}>
                ₹{outstanding.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Select Worker (if not preselected) */}
            {!worker && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Select Worker <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={form.workerId}
                  onChange={(e) => {
                    const selId = e.target.value
                    const selWorker = workers.find((w) => String(w._id || w.id) === String(selId))
                    setForm((prev) => ({
                      ...prev,
                      workerId: selId,
                      siteId: selWorker?.siteId || selWorker?.site_id || prev.siteId,
                    }))
                    setSaveError('')
                  }}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: form.workerId ? '#172033' : '#9CA3AF', background: '#fff' }}
                  required
                >
                  <option value="">Select a worker...</option>
                  {workers.map((w) => (
                    <option key={w._id || w.id} value={w._id || w.id}>
                      {w.name} {w.trade ? `(${w.trade})` : ''} — Pending: ₹{Number(w.outstanding || 0).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Type */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Payment Type</label>
              <select
                value={form.paymentType}
                onChange={(e) => handleChange('paymentType', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: '#172033', background: '#fff' }}
              >
                {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder={outstanding > 0 ? `e.g. ${outstanding}` : 'Enter amount'}
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: '#172033', background: '#fff', boxSizing: 'border-box' }}
                required
              />
              {outstanding > 0 && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#70829F' }}>
                  Outstanding amount: ₹{outstanding.toLocaleString('en-IN')}
                  <button
                    type="button"
                    style={{ marginLeft: '8px', fontSize: '11px', color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    onClick={() => handleChange('amount', String(outstanding))}
                  >
                    Pay full outstanding
                  </button>
                </div>
              )}
            </div>

            {/* Bank Account */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Bank Account <span style={{ color: '#EF4444' }}>*</span>
              </label>
              {loadingBanks ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#70829F', fontSize: '13px' }}>
                  <Loader2 size={14} className="spin" /> Loading banks...
                </div>
              ) : (
                <select
                  value={form.bankAccountId}
                  onChange={(e) => handleChange('bankAccountId', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: form.bankAccountId ? '#172033' : '#9CA3AF', background: '#fff' }}
                  required
                >
                  <option value="">Select bank account...</option>
                  {banks.map((b) => {
                    const id = b._id || b.id
                    const name = b.bankName || b.bank_name || 'Bank'
                    const balance = Number(b.balance || 0)
                    return (
                      <option key={id} value={id}>
                        {name} — ₹{balance.toLocaleString('en-IN')} available
                      </option>
                    )
                  })}
                </select>
              )}
              {selectedBank && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#70829F' }}>
                  Available balance: ₹{Number(selectedBank.balance || 0).toLocaleString('en-IN')}
                </div>
              )}
            </div>

            {/* Payment Date */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Payment Date</label>
              <input
                type="date"
                value={form.paymentDate}
                max={today}
                onChange={(e) => handleChange('paymentDate', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: '#172033', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>

            {/* Remarks */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Remarks (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Weekly wage payment, advance adjustment..."
                value={form.remarks}
                onChange={(e) => handleChange('remarks', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', color: '#172033', background: '#fff', boxSizing: 'border-box' }}
              />
            </div>

            {saveError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#B91C1C' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '13px' }}>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div style={{ padding: '12px 16px', background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '8px', color: '#15803D', fontWeight: 600, textAlign: 'center' }}>
                ✓ Payment recorded successfully!
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #E5EAF1', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#F8FAFC', borderRadius: '0 0 14px 14px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || saveSuccess}
              style={{
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                background: saving || saveSuccess ? '#6EE7B7' : '#16A34A',
                color: '#fff',
                fontWeight: 600,
                fontSize: '14px',
                cursor: saving || saveSuccess ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {saving && <Loader2 size={15} className="spin" />}
              {saving ? 'Saving...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

