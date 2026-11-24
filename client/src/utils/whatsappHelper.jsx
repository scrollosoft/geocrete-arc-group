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
    description: expense.description || expense.remark || expense.remarks || '-',
    quantity: expense.quantity || '',
    unit: expense.unit || 'Units',
    totalAmount: total,
    paidAmount: paid,
    outstandingAmount: outstanding,
    paymentStatus,
    paymentDate: expense.paymentDate
      ? new Date(expense.paymentDate).toLocaleDateString('en-GB')
      : expense.date
      ? new Date(expense.date).toLocaleDateString('en-GB')
      : expense.createdAt
      ? new Date(expense.createdAt).toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB'),
  }
}

/**
 * Generate Expense Payment Details WhatsApp message.
 *
 * Template:
 * *Expense Payment Details*
 *
 * Hello [Name],
 *
 * Your expense/payment entry has been recorded successfully.
 *
 * - Site Name: [Site Name]
 * - Expense Category: [Category]
 * - Description: [Description]
 * - Total Amount: ₹[Total Amount]
 * - Paid Amount: ₹[Paid Amount]
 * - Pending Amount: ₹[Pending Amount]
 * - Payment Date: [Payment Date]
 *
 * Thank you.
 */
export function generateWhatsAppPaymentMessage(details) {
  const {
    supplierName,
    clientName,
    material,
    description,
    totalAmount,
    paidAmount,
    outstandingAmount,
    paymentDate,
  } = details

  const name = supplierName || 'Sir/Madam'
  const siteName = clientName || 'Not specified'
  const category = material || 'Material'
  const desc = description || '-'
  const totalFormatted = Math.round(Number(totalAmount || 0)).toLocaleString('en-IN')
  const paidFormatted = Math.round(Number(paidAmount || 0)).toLocaleString('en-IN')
  const pendingFormatted = Math.round(Number(outstandingAmount || 0)).toLocaleString('en-IN')
  const dateStr = paymentDate || new Date().toLocaleDateString('en-GB')

  return `*Expense Payment Details*

Hello ${name},

Your expense/payment entry has been recorded successfully.

- Site Name: ${siteName}
- Expense Category: ${category}
- Description: ${desc}
- Total Amount: ₹${totalFormatted}
- Paid Amount: ₹${paidFormatted}
- Pending Amount: ₹${pendingFormatted}
- Payment Date: ${dateStr}

Thank you.`
}

/**
 * Generate Labour Payment Details WhatsApp message.
 *
 * Template:
 * *Labour Payment Details*
 *
 * Hello [Labour Name],
 *
 * Your labour payment details have been updated successfully.
 *
 * - Labour Name: [Labour Name]
 * - Site Name: [Site Name]
 * - Total Amount: ₹[Total Amount]
 * - Advance Payment: ₹[Advance Payment]
 * - Last Paid Amount: ₹[Last Paid Amount]
 * - Total Paid Amount: ₹[Total Paid Amount]
 * - Pending Amount: ₹[Pending Amount]
 * - Payment Date: [Payment Date]
 *
 * Thank you.
 */
export function generateLabourWhatsAppMessage({
  labourName,
  siteName,
  totalAmount,
  advancePayment,
  lastPaidAmount,
  totalPaidAmount,
  pendingAmount,
  paymentDate,
}) {
  const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN')
  const dateStr = paymentDate || '-'

  return `*Labour Payment Details*

Hello ${labourName || 'Sir/Madam'},

Your labour payment details have been updated successfully.

- Labour Name: ${labourName || '-'}
- Site Name: ${siteName || 'Not specified'}
- Total Amount: ₹${fmt(totalAmount)}
- Advance Payment: ₹${fmt(advancePayment)}
- Last Paid Amount: ₹${fmt(lastPaidAmount)}
- Total Paid Amount: ₹${fmt(totalPaidAmount)}
- Pending Amount: ₹${fmt(pendingAmount)}
- Payment Date: ${dateStr}

Thank you.`
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

/**
 * Generate Consulting Details WhatsApp message.
 *
 * Template:
 * *Consulting Payment Details*
 *
 * Hello [Owner Name],
 *
 * Your consulting payment details have been recorded successfully.
 *
 * Date: [Date]
 * Owner Name: [Owner Name]
 * Total Amount: ₹[Total Amount]
 * Received Amount: ₹[Received Amount]
 * Pending Amount: ₹[Pending Amount]
 * Payment Mode: [Payment Mode]
 * Remark: [Remark]
 *
 * Thank you.
 */
export function generateConsultingDetailsWhatsAppMessage({
  ownerName,
  date,
  totalAmount,
  receivedAmount,
  pendingAmount,
  paymentMode,
  remark,
}) {
  const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN')

  return `*Consulting Payment Details*

Hello ${ownerName || 'Client'},

Your consulting payment details have been recorded successfully.

Date: ${date || '-'}
Owner Name: ${ownerName || '-'}
Total Amount: ₹${fmt(totalAmount)}
Received Amount: ₹${fmt(receivedAmount)}
Pending Amount: ₹${fmt(pendingAmount)}
Payment Mode: ${paymentMode || 'UPI'}
Remark: ${remark || '-'}

Thank you.`
}

/**
 * Generate Consulting Payment Confirmation WhatsApp message.
 *
 * Template:
 * *Consulting Payment Confirmation*
 *
 * Hello [Owner Name],
 *
 * Your consulting payment has been recorded successfully.
 *
 * Total Consulting Amount: ₹[Total Amount]
 * Previously Received Amount: ₹[Previous Received Amount]
 * New Payment Received: ₹[New Payment Amount]
 * Total Received Amount: ₹[Updated Total Received Amount]
 * Remaining Pending Amount: ₹[Remaining Pending Amount]
 * Payment Date: [Payment Date]
 * Payment Mode: [Payment Mode]
 *
 * Thank you.
 */
export function generateConsultingPaymentConfirmationWhatsAppMessage({
  ownerName,
  totalAmount,
  previousReceivedAmount,
  newPaymentAmount,
  updatedTotalReceivedAmount,
  remainingPendingAmount,
  paymentDate,
  paymentMode,
}) {
  const fmt = (n) => Math.round(Number(n || 0)).toLocaleString('en-IN')

  return `*Consulting Payment Confirmation*

Hello ${ownerName || 'Client'},

Your consulting payment has been recorded successfully.

Total Consulting Amount: ₹${fmt(totalAmount)}
Previously Received Amount: ₹${fmt(previousReceivedAmount)}
New Payment Received: ₹${fmt(newPaymentAmount)}
Total Received Amount: ₹${fmt(updatedTotalReceivedAmount)}
Remaining Pending Amount: ₹${fmt(remainingPendingAmount)}
Payment Date: ${paymentDate || '-'}
Payment Mode: ${paymentMode || 'UPI'}

Thank you.`
}

/**
 * Share Consulting Details on WhatsApp
 */
export function shareConsultingOnWhatsApp(consulting, showNotification = null) {
  if (!consulting) return { success: false, error: 'No consulting record selected' }

  const normalizedPhone = normalizeIndianPhoneNumber(consulting.mobileNumber)
  if (!normalizedPhone) {
    const errorMsg = 'Please provide a valid 10-digit mobile number for WhatsApp sharing.'
    if (showNotification) {
      showNotification({ type: 'error', message: errorMsg })
    } else {
      alert(errorMsg)
    }
    return { success: false, error: errorMsg }
  }

  const message = generateConsultingDetailsWhatsAppMessage({
    ownerName: consulting.ownerName,
    date: consulting.date,
    totalAmount: consulting.totalAmount,
    receivedAmount: consulting.receivedAmount,
    pendingAmount: consulting.pendingAmount,
    paymentMode: consulting.paymentMode,
    remark: consulting.remark,
  })

  const opened = openWhatsAppClickToChat({ phone: normalizedPhone, message })
  return { success: opened, phone: normalizedPhone, message }
}

/**
 * Share Consulting Payment Confirmation on WhatsApp
 */
export function shareConsultingPaymentConfirmationOnWhatsApp({
  consulting,
  newPaymentAmount,
  previousReceivedAmount,
  updatedTotalReceivedAmount,
  remainingPendingAmount,
  paymentDate,
  paymentMode,
  showNotification = null,
}) {
  if (!consulting) return { success: false, error: 'No consulting record selected' }

  const normalizedPhone = normalizeIndianPhoneNumber(consulting.mobileNumber)
  if (!normalizedPhone) {
    const errorMsg = 'Please provide a valid 10-digit mobile number for WhatsApp sharing.'
    if (showNotification) {
      showNotification({ type: 'error', message: errorMsg })
    } else {
      alert(errorMsg)
    }
    return { success: false, error: errorMsg }
  }

  const message = generateConsultingPaymentConfirmationWhatsAppMessage({
    ownerName: consulting.ownerName,
    totalAmount: consulting.totalAmount,
    previousReceivedAmount,
    newPaymentAmount,
    updatedTotalReceivedAmount,
    remainingPendingAmount,
    paymentDate,
    paymentMode,
  })

  const opened = openWhatsAppClickToChat({ phone: normalizedPhone, message })
  return { success: opened, phone: normalizedPhone, message }
}


