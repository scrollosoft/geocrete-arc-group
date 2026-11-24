import React, { useState, useEffect, useMemo } from 'react'
import { ArrowRightLeft, Calendar, AlertCircle, Loader2, X } from 'lucide-react'
import { bankAccountService } from '../services/bankAccountService.js'

export default function BankTransferForm({
  bankAccounts = [],
  cashAccount = null,
  allAccounts = [],
  onTransferSuccess,
  onClose,
  showNotification,
}) {
  const today = new Date().toISOString().slice(0, 10)

  // Dynamically fetched accounts fallback if cash or accounts missing
  const [dynamicAccounts, setDynamicAccounts] = useState([])

  useEffect(() => {
    const hasCashInProps =
      (allAccounts || []).some((b) => b.isCash || String(b.id || b._id).toLowerCase() === 'cash') ||
      (bankAccounts || []).some((b) => b.isCash || String(b.id || b._id).toLowerCase() === 'cash') ||
      Boolean(cashAccount)

    if (!hasCashInProps || (!allAccounts?.length && !bankAccounts?.length)) {
      bankAccountService
        .getAll()
        .then((data) => {
          if (Array.isArray(data)) {
            setDynamicAccounts(data)
          }
        })
        .catch((err) => console.error('Failed to load accounts for transfer form:', err))
    }
  }, [allAccounts, bankAccounts, cashAccount])

  // Combine bank accounts and Cash Account dynamically
  const availableBanks = useMemo(() => {
    let source = []
    if (Array.isArray(allAccounts) && allAccounts.length > 0) {
      source = [...allAccounts]
    } else if (Array.isArray(bankAccounts) && bankAccounts.length > 0) {
      source = [...bankAccounts]
    } else if (dynamicAccounts.length > 0) {
      source = [...dynamicAccounts]
    }

    // Ensure Cash Account is present
    const hasCash = source.some((b) => b.isCash || String(b.id || b._id).toLowerCase() === 'cash')
    if (!hasCash) {
      const cashObj =
        cashAccount ||
        dynamicAccounts.find((b) => b.isCash || String(b.id || b._id).toLowerCase() === 'cash')
      if (cashObj) {
        source.unshift(cashObj)
      }
    }

    // Standardize representation of accounts
    return source.map((b) => {
      const isCash = b.isCash || String(b.id || b._id).toLowerCase() === 'cash'
      if (isCash) {
        return {
          ...b,
          id: 'cash',
          _id: 'cash',
          bankName: 'Cash Account (Cash in Hand)',
          bank_name: 'Cash Account (Cash in Hand)',
          isCash: true,
        }
      }
      return b
    })
  }, [bankAccounts, cashAccount, allAccounts, dynamicAccounts])

  const [formData, setFormData] = useState({
    date: today,
    amount: '',
    fromBankId: '',
    toBankId: '',
    otherAccount: '',
    remark: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const selectedFromBank = availableBanks.find(
    (b) => String(b.id || b._id).toLowerCase() === String(formData.fromBankId).toLowerCase()
  )
  const fromBalance = Number(selectedFromBank?.balance || 0)

  // Destination banks list excludes the currently selected From bank
  const destinationBanks = availableBanks.filter(
    (b) => String(b.id || b._id).toLowerCase() !== String(formData.fromBankId).toLowerCase()
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    if (errorMessage) setErrorMessage('')

    setFormData((prev) => {
      const updated = { ...prev, [name]: value }

      // Mutual exclusivity: selecting To Bank clears Other Account; typing Other Account clears To Bank
      if (name === 'toBankId' && value) {
        updated.otherAccount = ''
      } else if (name === 'otherAccount' && value.trim()) {
        updated.toBankId = ''
      } else if (name === 'fromBankId') {
        // If From bank matches current To bank, reset To bank
        if (String(value) === String(prev.toBankId)) {
          updated.toBankId = ''
        }
      }

      return updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')

    // 1. Validate Date
    if (!formData.date) {
      setErrorMessage('Transfer date is required.')
      return
    }

    // 2. Validate From Bank
    if (!formData.fromBankId) {
      setErrorMessage('Please select a From bank account.')
      return
    }

    // 3. Validate Amount
    const numAmount = Number(formData.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than zero.')
      return
    }

    // 4. Validate Destination (either To Bank or Other Account, not both, not neither)
    const cleanOther = (formData.otherAccount || '').trim()
    const hasToBank = Boolean(formData.toBankId)
    const hasOther = Boolean(cleanOther)

    if (!hasToBank && !hasOther) {
      setErrorMessage('Please select a destination To Bank or enter an Other Account.')
      return
    }

    if (hasToBank && hasOther) {
      setErrorMessage('Please select either a destination To Bank or an Other Account, not both.')
      return
    }

    // 5. From and To cannot be the same bank
    if (hasToBank && String(formData.fromBankId).toLowerCase() === String(formData.toBankId).toLowerCase()) {
      setErrorMessage('From and To bank accounts cannot be the same.')
      return
    }

    // 6. Balance check
    if (selectedFromBank && fromBalance < numAmount) {
      setErrorMessage(
        `Transfer amount (₹${Math.round(numAmount).toLocaleString('en-IN')}) exceeds available balance in ${selectedFromBank.bankName || selectedFromBank.bank_name || 'selected account'} (₹${Math.round(fromBalance).toLocaleString('en-IN')}).`
      )
      return
    }

    try {
      setSubmitting(true)
      const isFromCash = String(formData.fromBankId || '').toLowerCase() === 'cash'
      const isToCash = String(formData.toBankId || '').toLowerCase() === 'cash'

      const payload = {
        date: formData.date,
        amount: numAmount,
        fromBankId: isFromCash ? 'cash' : Number(formData.fromBankId),
        toBankId: hasToBank ? (isToCash ? 'cash' : Number(formData.toBankId)) : null,
        otherAccount: hasOther ? cleanOther : null,
        remark: (formData.remark || '').trim(),
      }

      const res = await bankAccountService.transfer(payload)

      if (showNotification) {
        showNotification({
          type: 'success',
          message: res.message || `Transfer of ₹${numAmount.toLocaleString('en-IN')} completed successfully!`,
        })
      }

      // Reset form fields
      setFormData((prev) => ({
        ...prev,
        date: today,
        amount: '',
        toBankId: '',
        otherAccount: '',
        remark: '',
      }))

      if (onTransferSuccess) {
        await onTransferSuccess()
      }

      if (onClose) {
        onClose()
      }
    } catch (err) {
      console.error('Failed to execute bank transfer:', err)
      setErrorMessage(err.message || 'Failed to complete bank transfer. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="daily-expense-section" id="bank-transfer-form" style={{ marginTop: '24px' }}>
      <div className="section-header-compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowRightLeft size={16} strokeWidth={2.4} />
          </div>
          <div>
            <h2 className="section-title">Bank Transfer</h2>
            <p className="section-subtitle">
              Transfer funds between internal bank accounts or to a personal account.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#70829F',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close form"
            aria-label="Close transfer form"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="form-alert form-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="daily-expense-form" onSubmit={handleSubmit}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {/* 1. Date */}
          <div className="form-group">
            <label className="form-label">
              Date <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <div className="input-with-icon">
              <input
                type="date"
                name="date"
                className="form-input"
                value={formData.date}
                onChange={handleChange}
                required
              />
              <Calendar size={16} className="input-icon-right" />
            </div>
          </div>

          {/* 2. Amount */}
          <div className="form-group">
            <label className="form-label">
              Amount (₹) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="number"
              name="amount"
              className="form-input"
              placeholder="e.g. 25000"
              min="1"
              step="any"
              value={formData.amount}
              onChange={handleChange}
              required
            />
          </div>

          {/* 3. From Bank */}
          <div className="form-group">
            <label className="form-label">
              From <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              name="fromBankId"
              className="form-select"
              value={formData.fromBankId}
              onChange={handleChange}
              required
            >
              <option value="">Select From Bank...</option>
              {availableBanks.map((b) => {
                const isCash = b.isCash || String(b.id || b._id).toLowerCase() === 'cash'
                const displayName = isCash
                  ? 'Cash Account (Cash in Hand)'
                  : (b.bankName || b.bank_name)
                return (
                  <option key={b.id || b._id} value={b.id || b._id}>
                    {displayName} (Bal: ₹{Number(b.balance || 0).toLocaleString('en-IN')})
                  </option>
                )
              })}
            </select>
            {selectedFromBank && (
              <span style={{ fontSize: '11px', color: '#0284C7', marginTop: '3px', display: 'block' }}>
                Available balance: ₹{Number(selectedFromBank.balance || 0).toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* 4. To Bank (Internal) */}
          <div className="form-group">
            <label className="form-label">
              To <span style={{ fontSize: '11px', color: '#70829F', fontWeight: 400 }}>(Internal Bank)</span>
            </label>
            <select
              name="toBankId"
              className="form-select"
              value={formData.toBankId}
              onChange={handleChange}
              disabled={Boolean(formData.otherAccount && formData.otherAccount.trim())}
              style={{
                opacity: Boolean(formData.otherAccount && formData.otherAccount.trim()) ? 0.6 : 1,
              }}
            >
              <option value="">Select To Bank...</option>
              {destinationBanks.map((b) => {
                const isCash = b.isCash || String(b.id || b._id).toLowerCase() === 'cash'
                const label = isCash
                  ? `Cash Account (Cash in Hand) (Bal: ₹${Number(b.balance || 0).toLocaleString('en-IN')})`
                  : `${b.bankName || b.bank_name}${b.accountNumber ? ` (•••• ${String(b.accountNumber).slice(-4)})` : ''}`
                return (
                  <option key={b.id || b._id} value={b.id || b._id}>
                    {label}
                  </option>
                )
              })}
            </select>
            <span style={{ fontSize: '11px', color: '#70829F', marginTop: '3px', display: 'block' }}>
              Choose internal bank OR enter Other Account
            </span>
          </div>

          {/* 5. Other Account (Personal Account) */}
          <div className="form-group">
            <label className="form-label">
              Other Account <span style={{ fontSize: '11px', color: '#70829F', fontWeight: 400 }}>(Personal Account)</span>
            </label>
            <input
              type="text"
              name="otherAccount"
              className="form-input"
              placeholder="e.g. Personal Account Name"
              value={formData.otherAccount}
              onChange={handleChange}
              disabled={Boolean(formData.toBankId)}
              style={{
                opacity: Boolean(formData.toBankId) ? 0.6 : 1,
              }}
            />
            <span style={{ fontSize: '11px', color: '#70829F', marginTop: '3px', display: 'block' }}>
              Personal account name (leave blank if selecting To Bank)
            </span>
          </div>

          {/* 6. Remark */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Remark (Optional)</label>
            <input
              type="text"
              name="remark"
              className="form-input"
              placeholder="e.g. Monthly transfer, personal withdrawal, rebalance"
              value={formData.remark}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* 7. Submit Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          {onClose && (
            <button
              type="button"
              className="btn btn-secondary-action"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary-action"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284C7',
              borderColor: '#0284C7',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="spin-animate" />
                <span>Transferring...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft size={16} strokeWidth={2.4} />
                <span>Transfer</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
