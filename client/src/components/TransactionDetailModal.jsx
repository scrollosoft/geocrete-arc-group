import React, { useState } from 'react'
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Check,
  Building,
  Landmark,
  User,
  Calendar,
  CreditCard,
  FileText,
  Wallet,
} from 'lucide-react'

const formatRupee = (amt) => {
  if (amt === undefined || amt === null || isNaN(Number(amt))) return '₹0.00'
  return `₹${Number(amt).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function TransactionDetailModal({ isOpen, onClose, transaction }) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !transaction) return null

  const isCredit = transaction.type === 'credit'
  const accentColor = isCredit ? '#137333' : '#C5221F'
  const bgColor = isCredit ? '#E6F4EA' : '#FCE8E6'

  const handleCopyRef = () => {
    if (transaction.referenceId) {
      navigator.clipboard.writeText(transaction.referenceId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="gpay-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        <button
          type="button"
          className="gpay-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Google Pay Header Section */}
        <div className="gpay-modal-hero">
          <div
            className="gpay-hero-icon-bubble"
            style={{ backgroundColor: bgColor, color: accentColor }}
          >
            {isCredit ? (
              <ArrowDownLeft size={28} strokeWidth={2.4} />
            ) : (
              <ArrowUpRight size={28} strokeWidth={2.4} />
            )}
          </div>

          <div
            className="gpay-hero-amount"
            style={{ color: isCredit ? '#137333' : '#172033' }}
          >
            {isCredit ? `+${formatRupee(transaction.amount)}` : `−${formatRupee(transaction.amount)}`}
          </div>

          <div className="gpay-hero-status-pill">
            <CheckCircle2 size={13} strokeWidth={2.5} />
            <span>{transaction.status || 'Completed'}</span>
          </div>

          <div className="gpay-hero-party">
            {isCredit ? 'Received from' : 'Paid to'}{' '}
            <strong>{transaction.partyName || transaction.siteName || 'Account'}</strong>
          </div>
        </div>

        {/* Receipt Details Card */}
        <div className="gpay-receipt-card">
          <div className="gpay-receipt-title">Transaction Details</div>

          <div className="gpay-receipt-row">
            <span className="gpay-receipt-label">
              <FileText size={14} className="gpay-row-icon" />
              Transaction Type
            </span>
            <span className="gpay-receipt-val" style={{ fontWeight: 600, color: accentColor }}>
              {isCredit ? 'Money Received (Credit)' : 'Money Sent (Debit)'}
            </span>
          </div>

          <div className="gpay-receipt-row">
            <span className="gpay-receipt-label">
              <Building size={14} className="gpay-row-icon" />
              Category
            </span>
            <span className="gpay-receipt-val">{transaction.category || 'General'}</span>
          </div>

          <div className="gpay-receipt-row">
            <span className="gpay-receipt-label">
              <Landmark size={14} className="gpay-row-icon" />
              Bank Account
            </span>
            <span className="gpay-receipt-val">
              {transaction.bankName || 'Bank Account'}
              {transaction.accountNumber ? ` (•••• ${String(transaction.accountNumber).slice(-4)})` : ''}
            </span>
          </div>

          {transaction.siteName ? (
            <div className="gpay-receipt-row">
              <span className="gpay-receipt-label">
                <Building size={14} className="gpay-row-icon" />
                Construction Site
              </span>
              <span className="gpay-receipt-val">
                {transaction.siteName}
                {transaction.siteLocation ? ` (${transaction.siteLocation})` : ''}
              </span>
            </div>
          ) : null}

          {transaction.partyName ? (
            <div className="gpay-receipt-row">
              <span className="gpay-receipt-label">
                <User size={14} className="gpay-row-icon" />
                {transaction.partyType === 'Client' ? 'Client' : 'Supplier / Vendor'}
              </span>
              <span className="gpay-receipt-val">{transaction.partyName}</span>
            </div>
          ) : null}

          <div className="gpay-receipt-row">
            <span className="gpay-receipt-label">
              <CreditCard size={14} className="gpay-row-icon" />
              Payment Method
            </span>
            <span className="gpay-receipt-val">{transaction.paymentMethod || 'Bank Transfer'}</span>
          </div>

          <div className="gpay-receipt-row">
            <span className="gpay-receipt-label">
              <Calendar size={14} className="gpay-row-icon" />
              Date & Time
            </span>
            <span className="gpay-receipt-val">{transaction.dateTime}</span>
          </div>

          <div className="gpay-receipt-row">
            <span className="gpay-receipt-label">
              <FileText size={14} className="gpay-row-icon" />
              Reference ID
            </span>
            <div className="gpay-receipt-val gpay-ref-val">
              <span className="gpay-ref-text">{transaction.referenceId}</span>
              <button
                type="button"
                className="gpay-copy-btn"
                onClick={handleCopyRef}
                title="Copy Reference ID"
              >
                {copied ? <Check size={13} color="#137333" /> : <Copy size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {transaction.remark ? (
            <div className="gpay-receipt-row">
              <span className="gpay-receipt-label">
                <FileText size={14} className="gpay-row-icon" />
                Remark / Notes
              </span>
              <span className="gpay-receipt-val">{transaction.remark}</span>
            </div>
          ) : null}

          {/* Running Balance after Transaction */}
          {transaction.balanceAfter !== null && transaction.balanceAfter !== undefined ? (
            <div className="gpay-receipt-balance-box">
              <div className="gpay-balance-box-left">
                <Wallet size={16} />
                <span>Bank Balance After Transaction</span>
              </div>
              <div className="gpay-balance-box-val">
                {formatRupee(transaction.balanceAfter)}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="gpay-modal-footer">
          <button
            type="button"
            className="btn btn-primary-action gpay-done-btn"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

