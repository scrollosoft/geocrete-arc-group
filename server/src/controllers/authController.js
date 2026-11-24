import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { getPool } from '../config/db.js'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'geocrete_arc_jwt_secret_key_2026'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// Credentials are stored securely via env vars; fallback to hashed defaults
const DEFAULT_ADMIN_USERNAME = 'geocrete'
// Pre-hashed password for Geocrete@2026 (bcrypt, cost 12)
const DEFAULT_ADMIN_PASSWORD_HASH =
  '$2b$12$p9440QhgInqrzXXrHZOyrOU/4wacK6NSwH4a1SkqPjW5pGSSmTup6'

const DEFAULT_MANAGER_USERNAME = 'manager'
// Pre-hashed password for Manager@2026 (bcrypt, cost 12)
const DEFAULT_MANAGER_PASSWORD_HASH =
  '$2b$12$oMBVuprOojcJ5SJHWjsI8udawD12YEYeaJZpejgQoc74ZJIleuJo.'

/**
 * Helper: Retrieve admin credentials.
 * Checks the database (settings table) first for custom updated password,
 * then falls back to environment variables or default hash.
 */
async function getAdminCredentials() {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT value_json FROM settings WHERE key_name = ?',
      ['admin_credentials']
    )
    if (rows && rows.length > 0) {
      const data = typeof rows[0].value_json === 'string'
        ? JSON.parse(rows[0].value_json)
        : rows[0].value_json
      if (data && data.passwordHash) {
        return {
          username: data.username || process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME,
          passwordHash: data.passwordHash,
          role: 'Admin',
        }
      }
    }
  } catch (err) {
    console.error('[auth] Error fetching admin credentials from DB:', err)
  }

  return {
    username: process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME,
    passwordHash: process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH,
    role: 'Admin',
  }
}

/**
 * Helper: Retrieve manager credentials.
 * Checks the database (settings table) first for custom updated manager password,
 * then falls back to default manager credentials.
 */
async function getManagerCredentials() {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT value_json FROM settings WHERE key_name = ?',
      ['manager_credentials']
    )
    if (rows && rows.length > 0) {
      const data = typeof rows[0].value_json === 'string'
        ? JSON.parse(rows[0].value_json)
        : rows[0].value_json
      if (data && data.passwordHash) {
        return {
          username: data.username || DEFAULT_MANAGER_USERNAME,
          passwordHash: data.passwordHash,
          role: 'Manager',
        }
      }
    }
  } catch (err) {
    console.error('[auth] Error fetching manager credentials from DB:', err)
  }

  return {
    username: DEFAULT_MANAGER_USERNAME,
    passwordHash: DEFAULT_MANAGER_PASSWORD_HASH,
    role: 'Manager',
  }
}

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

    const adminCreds = await getAdminCredentials()
    const managerCreds = await getManagerCredentials()

    let matchedUser = null

    // Case-sensitive username check
    if (username === adminCreds.username) {
      matchedUser = adminCreds
    } else if (username === managerCreds.username) {
      matchedUser = managerCreds
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    // Secure bcrypt comparison — never expose hash
    const isMatch = await bcrypt.compare(password, matchedUser.passwordHash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    // Issue JWT with role and username
    const token = jwt.sign(
      { username: matchedUser.username, role: matchedUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    return res.json({
      token,
      username: matchedUser.username,
      role: matchedUser.role,
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
 * Returns 200 { valid: true, username, role } or 401
 */
export function verify(req, res) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({ error: 'No token provided.' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    return res.json({
      valid: true,
      username: decoded.username,
      role: decoded.role || (decoded.username === DEFAULT_MANAGER_USERNAME ? 'Manager' : 'Admin'),
    })
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' })
  }
}

/**
 * POST /api/auth/change-password
 * Requires Authorization: Bearer <token> (protected by requireAuth middleware)
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export async function changePassword(req, res) {
  try {
    // Only Admin can change their own password. Manager cannot change their password.
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Managers are not permitted to change passwords. Please contact the Business Owner.' })
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {}
    const username = req.user?.username || process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME

    // 1. Validate required fields
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required.' })
    }
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required.' })
    }
    if (!confirmPassword) {
      return res.status(400).json({ error: 'Please confirm your new password.' })
    }

    // 2. Validate confirmation match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and Confirm password do not match.' })
    }

    // 3. Password strength validation (minimum 6 characters)
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' })
    }

    // 4. Ensure new password is not identical to current password
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password cannot be the same as the current password.' })
    }

    // 5. Verify current password against stored credentials
    const currentCreds = await getAdminCredentials()
    const isCurrentValid = await bcrypt.compare(currentPassword, currentCreds.passwordHash)
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password is incorrect.' })
    }

    // 6. Securely hash the new password using bcrypt (cost factor 12)
    const saltRounds = 12
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // 7. Save updated credentials to database in settings table
    const pool = getPool()
    const credentialsToSave = {
      username,
      passwordHash: hashedNewPassword,
      role: 'Admin',
      updatedAt: new Date().toISOString(),
    }

    await pool.query(
      `INSERT INTO settings (key_name, value_json)
       VALUES ('admin_credentials', ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
      [JSON.stringify(credentialsToSave)]
    )

    return res.json({
      success: true,
      message: 'Password changed successfully! Please use your new password for future sign-ins.',
    })
  } catch (err) {
    console.error('[auth] Change password error:', err)
    return res.status(500).json({ error: 'Failed to update password. Please try again.' })
  }
}

/**
 * POST /api/auth/update-manager-password
 * Admin only: updates the manager account password
 * Body: { newPassword, confirmPassword }
 */
export async function updateManagerPassword(req, res) {
  try {
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can update the manager password.' })
    }

    const { newPassword, confirmPassword } = req.body || {}

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required.' })
    }
    if (!confirmPassword) {
      return res.status(400).json({ error: 'Please confirm the new password.' })
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and Confirm password do not match.' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' })
    }

    const saltRounds = 12
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    const pool = getPool()
    const credentialsToSave = {
      username: DEFAULT_MANAGER_USERNAME,
      passwordHash: hashedNewPassword,
      role: 'Manager',
      updatedAt: new Date().toISOString(),
    }

    await pool.query(
      `INSERT INTO settings (key_name, value_json)
       VALUES ('manager_credentials', ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
      [JSON.stringify(credentialsToSave)]
    )

    return res.json({
      success: true,
      message: 'Manager password updated successfully!',
    })
  } catch (err) {
    console.error('[auth] Update manager password error:', err)
    return res.status(500).json({ error: 'Failed to update manager password. Please try again.' })
  }
}

