import React, { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export default function NotificationToast({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => {
      onClose()
    }, 4500)
    return () => clearTimeout(timer)
  }, [notification, onClose])

  if (!notification) return null

  const isSuccess = notification.type === 'success'

  return (
    <div className={`toast-notification ${isSuccess ? 'toast-success' : 'toast-error'}`}>
      <div className="toast-icon">
        {isSuccess ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      </div>
      <div className="toast-message">{notification.message}</div>
      <button type="button" className="toast-close" onClick={onClose}>
        <X size={15} />
      </button>
    </div>
  )
}
