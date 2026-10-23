import { getPool } from '../config/db.js'

const DEFAULT_SETTINGS = {
  ownerProfile: {
    fullName: 'Arjun Mehta',
    email: 'arjun@mehtaconstructions.in',
    mobileNumber: '9845012345',
    role: 'Business Owner',
  },
  businessDetails: {
    companyName: 'GeoCrete Arch Group',
    gstin: '27AABCU9603R1ZM',
    registrationNumber: 'MH-PUN-2024-8841',
    address: 'Office 402, Trade Centre, Bund Garden Road, Pune, Maharashtra 411001',
    currency: 'INR (₹)',
  },
  financialPreferences: {
    defaultPaymentTerms: 'Immediate',
    fiscalYear: 'April - March',
    currencySymbol: '₹',
  },
  notifications: {
    emailDailySummary: true,
    lowBalanceAlerts: true,
    paymentReminders: true,
  },
}

export const getSettings = async (req, res, next) => {
  try {
    const [rows] = await getPool().query(
      'SELECT value_json FROM settings WHERE key_name = ?',
      ['app_settings']
    )
    if (rows.length === 0) {
      return res.json(DEFAULT_SETTINGS)
    }
    const parsed = typeof rows[0].value_json === 'string'
      ? JSON.parse(rows[0].value_json)
      : rows[0].value_json
    res.json({ ...DEFAULT_SETTINGS, ...parsed })
  } catch (error) {
    next(error)
  }
}

export const updateSettings = async (req, res, next) => {
  try {
    const newSettings = req.body
    await getPool().query(
      `INSERT INTO settings (key_name, value_json)
       VALUES ('app_settings', ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)`,
      [JSON.stringify(newSettings)]
    )
    res.json({ success: true, settings: newSettings })
  } catch (error) {
    next(error)
  }
}
