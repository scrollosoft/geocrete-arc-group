/**
 * Shared helpers for mapping SQL snake_case rows to the camelCase / _id API
 * format that the existing React frontend already understands.
 *
 * Rule: the MySQL auto-increment `id` column is exposed as `_id` (string)
 * so the frontend receives the same shape it had with MongoDB ObjectIds.
 */

/** Format a JS Date or MySQL datetime string as an ISO string (or null). */
export const fmtDate = (val) => {
  if (!val) return null
  const d = val instanceof Date ? val : new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/** Convert a MySQL DATE column (YYYY-MM-DD string or Date) to ISO string. */
export const fmtDateOnly = (val) => {
  if (!val) return null
  // MySQL DATE columns can come back as Date objects
  if (val instanceof Date) return val.toISOString()
  const s = String(val).trim()
  // Already ISO / YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
  if (dmyMatch) {
    const d = new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00.000Z`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  // Fallback: try native parse
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Returns true if the given date value falls within the current calendar month.
 * Checks against both IST (+05:30) and UTC to avoid timezone boundary edge cases.
 * Falls back to fallbackVal if the primary value is null/unparseable.
 */
export const isCurrentMonth = (dateVal, fallbackVal) => {
  const tryParse = (v) => {
    if (!v) return null
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v
    const s = String(v).trim()
    // YYYY-MM-DD... or ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`)
      return isNaN(d.getTime()) ? null : d
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (dmyMatch) {
      const d = new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00.000Z`)
      return isNaN(d.getTime()) ? null : d
    }
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }

  const d = tryParse(dateVal) || tryParse(fallbackVal)
  if (!d) return false

  const now = new Date()
  // Check in UTC
  if (d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()) return true
  // Also check in IST (+05:30) to handle timezone boundary cases on hosted servers
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  const dIST = new Date(d.getTime() + IST_OFFSET_MS)
  const nowIST = new Date(now.getTime() + IST_OFFSET_MS)
  return dIST.getUTCFullYear() === nowIST.getUTCFullYear() && dIST.getUTCMonth() === nowIST.getUTCMonth()
}

/** Expose the integer `id` as string `_id` and keep both for convenience. */
export const withId = (row) => {
  if (!row) return null
  const { id, ...rest } = row
  return { _id: String(id), id: String(id), ...rest }
}
