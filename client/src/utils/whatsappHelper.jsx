import React from 'react'

/**
 * Standard WhatsApp SVG icon in brand green #25D366
 */
export const WhatsAppIcon = ({ size = 16, color = '#25D366', ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
    {...props}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
  </svg>
)

/**
 * Normalize Indian phone numbers into international format (91XXXXXXXXXX)
 * Removes spaces, hyphens, brackets, non-digits.
 */
export function normalizeIndianPhoneNumber(phone) {
  if (!phone) return null
  const cleaned = String(phone).replace(/\D/g, '')
  if (!cleaned) return null

  // 10-digit standard Indian mobile number
  if (cleaned.length === 10) {
    return `91${cleaned}`
  }
  // 11-digit starting with 0
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `91${cleaned.slice(1)}`
  }
  // 12-digit starting with 91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned
  }
  // Valid international number (10 to 15 digits)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return cleaned
  }
  return null
}

/**
 * Resolve supplier and client/site details for an expense record
 */
export function resolveExpenseDetails(expense, suppliers = [], sites = []) {
  if (!expense) return null

  // 1. Resolve Supplier
  let supplierObj = null
  const supId =
    typeof expense.supplier === 'object'
      ? expense.supplier?._id || expense.supplier?.id
      : expense.supplier
  const supName =
    typeof expense.supplier === 'object'
      ? expense.supplier?.name || expense.supplier?.companyName
      : null

  if (supId) {
    supplierObj = suppliers.find((s) => String(s._id || s.id) === String(supId))
  }
  if (!supplierObj && supName) {
    supplierObj = suppliers.find(
      (s) =>
        s.name?.toLowerCase() === supName.toLowerCase() ||
        s.companyName?.toLowerCase() === supName.toLowerCase()
    )
  }
  if (!supplierObj && typeof expense.supplier === 'object') {
    supplierObj = expense.supplier
  }

  const supplierName =
    supplierObj?.name ||
    supplierObj?.companyName ||
    supName ||
    'Supplier'
  const supplierPhone =
    supplierObj?.phone ||
    supplierObj?.contactPerson ||
    expense.supplier?.phone ||
    ''

  // 2. Resolve Client / Site
  let siteObj = null
  const siteId =
    typeof expense.site === 'object'
      ? expense.site?._id || expense.site?.id
      : expense.site
  const siteName =
    typeof expense.site === 'object' ? expense.site?.name : null

  if (siteId) {
    siteObj = sites.find((s) => String(s._id || s.id) === String(siteId))
  }
  if (!siteObj && siteName) {
    siteObj = sites.find(
      (s) => s.name?.toLowerCase() === siteName.toLowerCase()
    )
  }
  if (!siteObj && typeof expense.site === 'object') {
    siteObj = expense.site
  }

  // Client Name from site relationship
  const clientName =
    siteObj?.siteOwner ||
    siteObj?.clientName ||
    siteObj?.site_owner ||
    (siteObj?.name ? `${siteObj.name}` : 'Not specified')

  // 3. Financial calculations
  const total = Number(expense.amount || 0)
  const paid = Number(expense.paidAmount || 0)
  const outstanding =
    expense.pendingAmount !== undefined && expense.pendingAmount !== null
      ? Number(expense.pendingAmount)
      : Math.max(0, total - paid)

  let paymentStatus = expense.paymentStatus || expense.status
  if (!paymentStatus || paymentStatus === 'Completed' || paymentStatus === 'Paid') {
    paymentStatus = outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid'
  } else if (paymentStatus === 'Pending' || paymentStatus === 'Unpaid') {
    paymentStatus = paid > 0 ? 'Partial' : 'Unpaid'
  }

  return {
    supplierName,
    supplierPhone,
    clientName,
    material: expense.category || expense.material || 'Material',
    quantity: expense.quantity || '',
    unit: expense.unit || 'Units',
    totalAmount: total,
    paidAmount: paid,
    outstandingAmount: outstanding,
    paymentStatus,
  }
}

/**
 * Generate WhatsApp payment confirmation message according to required template:
 * 
 * Payment Confirmation
 * 
 * Hello [Supplier Name],
 * 
 * Your payment entry has been recorded successfully.
 * 
 * Client Name: [Client Name]
 * Material: [Material Name]
 * Quantity: [Quantity and Unit]
 * Total Amount: ₹[Total Amount]
 * Paid Amount: ₹[Paid Amount]
 * Outstanding Amount: ₹[Outstanding Amount]
 * Payment Status: [Paid / Partial / Unpaid]
 * 
 * Thank you!
 */
export function generateWhatsAppPaymentMessage(details) {
  const {
    supplierName,
    clientName,
    material,
    quantity,
    unit,
    totalAmount,
    paidAmount,
    outstandingAmount,
    paymentStatus,
  } = details

  const sName = supplierName || 'Supplier'
  const cName = clientName || 'Not specified'
  const mat = material || 'Material'
  const qtyUnit = quantity ? `${quantity} ${unit || 'Units'}` : (unit || '1 Units')
  const totalFormatted = Math.round(Number(totalAmount || 0)).toLocaleString('en-IN')
  const paidFormatted = Math.round(Number(paidAmount || 0)).toLocaleString('en-IN')
  const outstandingFormatted = Math.round(Number(outstandingAmount || 0)).toLocaleString('en-IN')

  return `Payment Confirmation

Hello ${sName},

Your payment entry has been recorded successfully.

Client Name: ${cName}
Material: ${mat}
Quantity: ${qtyUnit}
Total Amount: ₹${totalFormatted}
Paid Amount: ₹${paidFormatted}
Outstanding Amount: ₹${outstandingFormatted}
Payment Status: ${paymentStatus || 'Paid'}

Thank you!`
}

/**
 * Open WhatsApp Click-to-Chat with pre-filled message
 */
export function openWhatsAppClickToChat({ phone, message }) {
  const normalized = normalizeIndianPhoneNumber(phone)
  if (!normalized) return false

  const encodedMsg = encodeURIComponent(message)
  const url = `https://wa.me/${normalized}?text=${encodedMsg}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

/**
 * Full helper to share an expense on WhatsApp:
 * Returns { success: boolean, error?: string }
 */
export function shareExpenseOnWhatsApp(expense, suppliers = [], sites = [], showNotification = null) {
  const details = resolveExpenseDetails(expense, suppliers, sites)
  if (!details) {
    const msg = 'Expense details could not be resolved.'
    if (showNotification) showNotification({ type: 'error', message: msg })
    return { success: false, error: msg }
  }

  const normalizedPhone = normalizeIndianPhoneNumber(details.supplierPhone)
  if (!normalizedPhone) {
    const errorMsg = 'Supplier mobile number is not available. Please update the supplier details.'
    if (showNotification) {
      showNotification({ type: 'error', message: errorMsg })
    } else {
      alert(errorMsg)
    }
    return { success: false, error: errorMsg }
  }

  const message = generateWhatsAppPaymentMessage(details)
  const opened = openWhatsAppClickToChat({ phone: normalizedPhone, message })
  return { success: opened, phone: normalizedPhone, message }
}

