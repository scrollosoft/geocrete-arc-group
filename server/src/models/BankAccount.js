import { getPool } from '../config/db.js'
import { withId, fmtDate } from './helpers.js'

const toApi = (row) => {
  if (!row) return null
  return {
    ...withId(row),
    accountNumber:     row.account_number,
    accountNumberTag:  row.account_number_tag,
    bankName:          row.bank_name,
    accountHolderName: row.account_holder_name || '',
    ifscCode:          row.ifsc_code || '',
    accountCode:       row.account_code,
    balance:           Number(row.balance),
    credit:            Number(row.credit),
    accentColor:       row.accent_color,
    isActive:          Boolean(row.is_active),
    createdAt:         fmtDate(row.created_at),
    updatedAt:         fmtDate(row.updated_at),
    // remove raw snake_case keys
    account_number:      undefined,
    account_number_tag:  undefined,
    bank_name:           undefined,
    account_holder_name: undefined,
    ifsc_code:           undefined,
    account_code:        undefined,
    accent_color:        undefined,
    is_active:           undefined,
    created_at:          undefined,
    updated_at:          undefined,
  }
}

export const BankAccount = {
  async findActive() {
    const [rows] = await getPool().query(
      'SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY created_at ASC',
    )
    return rows.map(toApi)
  },

  async findById(id) {
    const [rows] = await getPool().query(
      'SELECT * FROM bank_accounts WHERE id = ?',
      [id],
    )
    return toApi(rows[0] || null)
  },

  async findByAccountNumber(accountNumber) {
    if (!accountNumber) return null
    const [rows] = await getPool().query(
      'SELECT * FROM bank_accounts WHERE account_number = ? AND is_active = 1 LIMIT 1',
      [accountNumber],
    )
    return toApi(rows[0] || null)
  },

  async create(data) {
    const {
      accountNumber,
      accountNumberTag,
      bankName,
      accountHolderName,
      ifscCode,
      accountCode,
      balance,
      credit,
      accentColor,
    } = data

    const total = await this.count()
    const palette = ['#3980FF', '#00B67A', '#07577A', '#FF9900']
    const color = accentColor || palette[total % palette.length]
    const tag = accountNumberTag || `ACCOUNT #${String(total + 1).padStart(2, '0')}`
    const code = (accountCode || `B${total + 1}`).toUpperCase()

    const [result] = await getPool().query(
      `INSERT INTO bank_accounts
        (account_number, account_number_tag, bank_name, account_holder_name, ifsc_code, account_code, balance, credit, accent_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accountNumber || '',
        tag,
        bankName,
        accountHolderName || '',
        (ifscCode || '').toUpperCase().trim(),
        code,
        Number(balance) || 0,
        Number(credit) || 0,
        color,
      ],
    )
    return this.findById(result.insertId)
  },

  async update(id, data) {
    const existing = await this.findById(id)
    if (!existing) return null

    const fields = {
      account_number:      data.accountNumber     !== undefined ? data.accountNumber     : existing.accountNumber,
      account_number_tag:  data.accountNumberTag  !== undefined ? data.accountNumberTag  : existing.accountNumberTag,
      bank_name:           data.bankName          !== undefined ? data.bankName          : existing.bankName,
      account_holder_name: data.accountHolderName !== undefined ? data.accountHolderName : existing.accountHolderName,
      ifsc_code:           data.ifscCode          !== undefined ? (data.ifscCode || '').toUpperCase().trim() : existing.ifscCode,
      account_code:        data.accountCode       !== undefined ? (data.accountCode || '').toUpperCase() : existing.accountCode,
      balance:             data.balance           !== undefined ? Number(data.balance)   : existing.balance,
      credit:              data.credit            !== undefined ? Number(data.credit)    : existing.credit,
      accent_color:        data.accentColor       !== undefined ? data.accentColor       : existing.accentColor,
      is_active:           data.isActive          !== undefined ? (data.isActive ? 1 : 0) : (existing.isActive ? 1 : 0),
    }

    await getPool().query(
      `UPDATE bank_accounts SET
        account_number=?, account_number_tag=?, bank_name=?, account_holder_name=?, ifsc_code=?, account_code=?,
        balance=?, credit=?, accent_color=?, is_active=?
       WHERE id=?`,
      [...Object.values(fields), id],
    )
    return this.findById(id)
  },

  async delete(id) {
    const existing = await this.findById(id)
    if (!existing) return null
    await getPool().query('DELETE FROM bank_accounts WHERE id = ?', [id])
    return existing
  },

  async count() {
    const [rows] = await getPool().query('SELECT COUNT(*) AS cnt FROM bank_accounts')
    return rows[0].cnt
  },

  async deleteAll() {
    await getPool().query('DELETE FROM bank_accounts')
  },

  async insertMany(records) {
    const inserted = []
    for (const r of records) {
      inserted.push(await this.create(r))
    }
    return inserted
  },
}
