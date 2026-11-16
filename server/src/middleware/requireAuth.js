import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'geocrete_arc_jwt_secret_key_2026'

/**
 * Express middleware: validates Bearer JWT on protected API routes.
 * Attaches decoded payload to req.user on success.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    return next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

