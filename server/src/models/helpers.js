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
  // MySQL DATE columns can come back as 'YYYY-MM-DD' strings or Date objects
  if (val instanceof Date) return val.toISOString()
  // Treat as UTC midnight to avoid timezone shifting
  const d = new Date(`${val}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/** Expose the integer `id` as string `_id` and keep both for convenience. */
export const withId = (row) => {
  if (!row) return null
  const { id, ...rest } = row
  return { _id: String(id), id: String(id), ...rest }
}
