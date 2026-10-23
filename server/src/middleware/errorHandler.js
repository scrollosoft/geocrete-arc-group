export const errorHandler = (err, _req, res, _next) => {
  console.error('API Error:', err)

  // mysql2 duplicate-entry error
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with that value already exists.' })
  }

  // mysql2 FK violation
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Operation violates a database relationship constraint.' })
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
}
