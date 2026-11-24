import React from 'react'
import { X, CheckCircle2, AlertTriangle, Send } from 'lucide-react'
import {
  WhatsAppIcon,
  resolveExpenseDetails,
  generateWhatsAppPaymentMessage,
  normalizeIndianPhoneNumber,
  openWhatsAppClickToChat,
} from '../utils/whatsappHelper.jsx'

export default function WhatsAppSharePromptModal({
  isOpen,
  onClose,
  expense,
  suppliers = [],
  sites = [],
  showNotification,
}) {
  if (!isOpen || !expense) return null

  const details = resolveExpenseDetails(expense, suppliers, sites) || {}
  const normalizedPhone = normalizeIndianPhoneNumber(details.supplierPhone)
  const message = generateWhatsAppPaymentMessage(details)

  const handleShare = () => {
    if (!normalizedPhone) {
      const errorMsg =
        'Supplier mobile number is not available. Please update the supplier details.'
      if (showNotification) {
        showNotification({ type: 'error', message: errorMsg })
      } else {
        alert(errorMsg)
      }
      return
    }

    openWhatsAppClickToChat({ phone: normalizedPhone, message })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="modal-container"
        style={{
          maxWidth: '520px',
          width: '92%',
          borderRadius: '12px',
          background: '#FFFFFF',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #E5EAF1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#ECFDF5',
                color: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <WhatsAppIcon size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#172033' }}>
                Share Payment Confirmation
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                Expense recorded successfully!
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px 22px' }}>
          {/* Supplier Info Bar */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 600, display: 'block' }}>
                Contact
              </span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                {details.supplierName}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 600, display: 'block' }}>
                Phone Number
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: normalizedPhone ? '#0F172A' : '#DC2626' }}>
                {details.supplierPhone ? details.supplierPhone : 'Not Available'}
              </span>
            </div>
          </div>

          {/* Missing Phone Warning */}
          {!normalizedPhone && (
            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#991B1B',
                fontSize: '12.5px',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>Supplier mobile number is not available. Please update the supplier details.</span>
            </div>
          )}

          {/* WhatsApp Message Preview */}
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
              Message Preview:
            </span>
            <pre
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#166534',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                maxHeight: '180px',
                overflowY: 'auto',
                margin: 0,
              }}
            >
              {message}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #E5EAF1',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: '#FAFCFE',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary-action"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!normalizedPhone}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: normalizedPhone ? '#25D366' : '#94A3B8',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '13px',
              cursor: normalizedPhone ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: normalizedPhone ? '0 2px 4px rgba(37, 211, 102, 0.25)' : 'none',
            }}
          >
            <WhatsAppIcon size={16} />
            <span>Share via WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  )
}

