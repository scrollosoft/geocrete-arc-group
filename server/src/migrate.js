/**
 * migrate.js  –  One-shot MongoDB → MySQL data migration
 *
 * Run ONLY when you want to copy existing MongoDB records into MySQL.
 * Safe to run multiple times: skips tables that already have rows.
 *
 * Prerequisites:
 *   1. XAMPP MySQL is running.
 *   2. The geocrete_arc database and tables exist (run schema.sql first).
 *   3. Both MONGODB_URI and DB_* variables are set in server/.env
 *
 * Usage (from the project root):
 *   node server/src/migrate.js
 */

import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env', import.meta.url).pathname })

import mongoose from 'mongoose'
import mysql from 'mysql2/promise'

// ── MongoDB connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/construction_management'

// ── MySQL connection ─────────────────────────────────────────────────────────
const mysqlConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'geocrete_arc',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  timezone: '+00:00',
  multipleStatements: false,
}

// ── Mongoose schemas (minimal – just enough for migration) ───────────────────
const Schema = mongoose.Schema

const bankAccountSchema = new Schema({
  accountNumber: String, accountNumberTag: String, bankName: String,
  accountCode: String, balance: Number, credit: Number,
  accentColor: String, isActive: Boolean,
}, { timestamps: true })

const siteSchema = new Schema({
  name: String, location: String, siteOwner: String,
  totalBudget: Number, totalSpent: Number, status: String,
  startDate: Date, expectedCompletionDate: Date,
  description: String, budgetAlertCount: Number,
}, { timestamps: true })

const supplierSchema = new Schema({
  name: String, companyName: String, phone: String,
  email: String, address: String, isActive: Boolean,
}, { timestamps: true })

const expenseSchema = new Schema({
  date: Date, site: { type: Schema.Types.ObjectId, ref: 'Site' },
  supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  material: String, category: String, description: String,
  quantity: Number, unit: String, ratePerUnit: Number, amount: Number,
  paidAmount: Number, pendingAmount: Number,
  paymentMethod: String, remark: String, status: String,
}, { timestamps: true })

const labourSchema = new Schema({
  name: String, phone: String, trade: String,
  site: { type: Schema.Types.ObjectId, ref: 'Site' },
  dailyRate: Number, wagesEarned: Number, totalPaid: Number,
  joiningDate: Date, paymentType: String,
  address: String, remarks: String, status: String,
}, { timestamps: true })

const MongoBankAccount = mongoose.model('BankAccount', bankAccountSchema)
const MongoSite        = mongoose.model('Site',        siteSchema)
const MongoSupplier    = mongoose.model('Supplier',    supplierSchema)
const MongoExpense     = mongoose.model('Expense',     expenseSchema)
const MongoLabour      = mongoose.model('Labour',      labourSchema)

// ── Helpers ──────────────────────────────────────────────────────────────────
const toDateStr = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const toDatetime = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ')
}

// ── Main ─────────────────────────────────────────────────────────────────────
const migrate = async () => {
  console.log('=== GeoCrete ARC – MongoDB → MySQL Migration ===\n')

  // 1. Connect to MongoDB
  console.log('Connecting to MongoDB…')
  await mongoose.connect(MONGO_URI)
  console.log('MongoDB connected.\n')

  // 2. Connect to MySQL
  console.log('Connecting to MySQL…')
  const conn = await mysql.createConnection(mysqlConfig)
  console.log('MySQL connected.\n')

  // ID maps: MongoDB ObjectId string → MySQL integer id
  const siteIdMap     = {}
  const supplierIdMap = {}

  try {
    // ── Bank Accounts ──────────────────────────────────────────────────────
    const [existingAccounts] = await conn.query('SELECT COUNT(*) AS cnt FROM bank_accounts')
    if (existingAccounts[0].cnt > 0) {
      console.log('bank_accounts: already has rows – skipping.')
    } else {
      const accounts = await MongoBankAccount.find().lean()
      console.log(`Migrating ${accounts.length} bank account(s)…`)
      for (const a of accounts) {
        await conn.query(
          `INSERT INTO bank_accounts
            (account_number, account_number_tag, bank_name, account_code,
             balance, credit, accent_color, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            a.accountNumber || '', a.accountNumberTag || 'ACCOUNT #01',
            a.bankName, (a.accountCode || '').toUpperCase(),
            Number(a.balance) || 0, Number(a.credit) || 0,
            a.accentColor || '#3980FF', a.isActive !== false ? 1 : 0,
            toDatetime(a.createdAt), toDatetime(a.updatedAt),
          ],
        )
      }
      console.log(`  ✓ Inserted ${accounts.length} bank account(s).\n`)
    }

    // ── Sites ──────────────────────────────────────────────────────────────
    const [existingSites] = await conn.query('SELECT COUNT(*) AS cnt FROM sites')
    if (existingSites[0].cnt > 0) {
      console.log('sites: already has rows – skipping.')
      // Still populate ID map for expenses / labours
      const mongoSites = await MongoSite.find().lean()
      const [mysqlSites] = await conn.query('SELECT id, name FROM sites')
      for (const ms of mongoSites) {
        const match = mysqlSites.find((r) => r.name === ms.name)
        if (match) siteIdMap[ms._id.toString()] = match.id
      }
    } else {
      const sites = await MongoSite.find().lean()
      console.log(`Migrating ${sites.length} site(s)…`)
      for (const s of sites) {
        const [result] = await conn.query(
          `INSERT INTO sites
            (name, location, site_owner, total_budget, total_spent, status,
             start_date, expected_completion_date, description, budget_alert_count,
             created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.name, s.location, s.siteOwner,
            Number(s.totalBudget) || 0, Number(s.totalSpent) || 0,
            s.status || 'Active',
            toDateStr(s.startDate), toDateStr(s.expectedCompletionDate),
            s.description || '', Number(s.budgetAlertCount) || 1,
            toDatetime(s.createdAt), toDatetime(s.updatedAt),
          ],
        )
        siteIdMap[s._id.toString()] = result.insertId
      }
      console.log(`  ✓ Inserted ${sites.length} site(s).\n`)
    }

    // ── Suppliers ──────────────────────────────────────────────────────────
    const [existingSuppliers] = await conn.query('SELECT COUNT(*) AS cnt FROM suppliers')
    if (existingSuppliers[0].cnt > 0) {
      console.log('suppliers: already has rows – skipping.')
      const mongoSuppliers = await MongoSupplier.find().lean()
      const [mysqlSuppliers] = await conn.query('SELECT id, name FROM suppliers')
      for (const ms of mongoSuppliers) {
        const match = mysqlSuppliers.find((r) => r.name === ms.name)
        if (match) supplierIdMap[ms._id.toString()] = match.id
      }
    } else {
      const suppliers = await MongoSupplier.find().lean()
      console.log(`Migrating ${suppliers.length} supplier(s)…`)
      for (const s of suppliers) {
        const [result] = await conn.query(
          `INSERT INTO suppliers
            (name, company_name, phone, email, address, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.name, s.companyName || '', s.phone || '',
            (s.email || '').toLowerCase(), s.address || '',
            s.isActive !== false ? 1 : 0,
            toDatetime(s.createdAt), toDatetime(s.updatedAt),
          ],
        )
        supplierIdMap[s._id.toString()] = result.insertId
      }
      console.log(`  ✓ Inserted ${suppliers.length} supplier(s).\n`)
    }

    // ── Expenses ───────────────────────────────────────────────────────────
    const [existingExpenses] = await conn.query('SELECT COUNT(*) AS cnt FROM expenses')
    if (existingExpenses[0].cnt > 0) {
      console.log('expenses: already has rows – skipping.')
    } else {
      const expenses = await MongoExpense.find().lean()
      console.log(`Migrating ${expenses.length} expense(s)…`)
      let skipped = 0
      for (const e of expenses) {
        const siteId     = e.site     ? siteIdMap[e.site.toString()]         : null
        const supplierId = e.supplier ? supplierIdMap[e.supplier.toString()] : null

        if (!siteId) {
          console.warn(`  ⚠ Expense ${e._id} skipped – site ${e.site} not found in MySQL.`)
          skipped++
          continue
        }

        await conn.query(
          `INSERT INTO expenses
            (date, site_id, supplier_id, material, category, description,
             quantity, unit, rate_per_unit, amount, paid_amount, pending_amount,
             payment_method, remark, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            toDateStr(e.date), siteId, supplierId || null,
            e.material || '', e.category || 'Material', e.description || '',
            Number(e.quantity) || 0, e.unit || 'Units',
            Number(e.ratePerUnit) || 0, Number(e.amount) || 0,
            Number(e.paidAmount) || 0, Number(e.pendingAmount) || 0,
            e.paymentMethod || 'Bank Transfer', e.remark || '',
            e.status || 'Completed',
            toDatetime(e.createdAt), toDatetime(e.updatedAt),
          ],
        )
      }
      console.log(`  ✓ Inserted ${expenses.length - skipped} expense(s) (${skipped} skipped).\n`)
    }

    // ── Labours ────────────────────────────────────────────────────────────
    const [existingLabours] = await conn.query('SELECT COUNT(*) AS cnt FROM labours')
    if (existingLabours[0].cnt > 0) {
      console.log('labours: already has rows – skipping.')
    } else {
      const labours = await MongoLabour.find().lean()
      console.log(`Migrating ${labours.length} labour record(s)…`)
      for (const l of labours) {
        const siteId = l.site ? siteIdMap[l.site.toString()] : null
        await conn.query(
          `INSERT INTO labours
            (name, phone, trade, site_id, daily_rate, wages_earned, total_paid,
             joining_date, payment_type, address, remarks, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            l.name, l.phone || '+91234567892', l.trade || 'Mason',
            siteId || null,
            Number(l.dailyRate) || 1000, Number(l.wagesEarned) || 0, Number(l.totalPaid) || 0,
            toDateStr(l.joiningDate) || new Date().toISOString().slice(0, 10),
            l.paymentType || 'Daily', l.address || '', l.remarks || '',
            l.status || 'Active',
            toDatetime(l.createdAt), toDatetime(l.updatedAt),
          ],
        )
      }
      console.log(`  ✓ Inserted ${labours.length} labour record(s).\n`)
    }

    // ── Verification ───────────────────────────────────────────────────────
    console.log('── Verification ────────────────────────────────')
    const tables = ['bank_accounts', 'sites', 'suppliers', 'expenses', 'labours']
    for (const t of tables) {
      const [r] = await conn.query(`SELECT COUNT(*) AS cnt FROM ${t}`)
      console.log(`  ${t}: ${r[0].cnt} row(s)`)
    }

    console.log('\n✅  Migration complete. MongoDB data is now in MySQL.')
    console.log('   You may now switch the backend to MySQL exclusively.')
    console.log('   IMPORTANT: Do NOT drop the MongoDB database until you have verified the application.\n')
  } finally {
    await conn.end()
    await mongoose.disconnect()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
