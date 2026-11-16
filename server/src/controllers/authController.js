import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'geocrete_arc_jwt_secret_key_2026'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// Credentials are stored securely via env vars; fallback to hashed defaults
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'GeoCrete-Arch'
// Pre-hashed password for GeoCrete-Arch@2026 (bcrypt, cost 12)
const ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ||
  '$2b$12$Bpvu7Cl/1Cw2vZGBNEUl2u0yzQ67QwsNylbt3hp2jRLJk8n.eIMN6'

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body || {}

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' })
    }

    // Case-sensitive username check
    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    // Secure bcrypt comparison — never expose hash
    const isMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    // Issue JWT
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    return res.json({
      token,
      username,
      expiresIn: JWT_EXPIRES_IN,
    })
  } catch (err) {
    console.error('[auth] Login error:', err)
    return res.status(500).json({ error: 'Internal server error.' })
  }
}

/**
 * GET /api/auth/verify
 * Requires Authorization: Bearer <token>
 * Returns 200 { valid: true } or 401
 */
export function verify(req, res) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: 'No token provided.' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    return res.json({ valid: true, username: decoded.username })
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

