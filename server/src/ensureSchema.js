import { getPool } from './config/db.js'

async function columnExists(pool, table, column) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column],
  )
  return rows.length > 0
}

/**
 * Ensure columns needed for Materials ↔ Expense sync exist on older databases.
 */
export async function ensureSchema() {
  const pool = getPool()

  if (!(await columnExists(pool, 'materials', 'paid_amount'))) {
    await pool.query(
      `ALTER TABLE materials
       ADD COLUMN paid_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00
       AFTER total_cost`,
    )
    // Backfill paid_amount from payment_status for existing rows
    await pool.query(
      `UPDATE materials
       SET paid_amount = CASE
         WHEN payment_status = 'Paid' THEN total_cost
         ELSE 0
       END
       WHERE paid_amount = 0`,
    )
    console.log('Added materials.paid_amount column')
  }

  if (!(await columnExists(pool, 'materials', 'payment_method'))) {
    await pool.query(
      `ALTER TABLE materials
       ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer'
       AFTER payment_status`,
    )
    console.log('Added materials.payment_method column')
  }

  if (!(await columnExists(pool, 'expenses', 'applied_to_material'))) {
    await pool.query(
      `ALTER TABLE expenses
       ADD COLUMN applied_to_material TINYINT(1) NOT NULL DEFAULT 0
       AFTER status`,
    )
    console.log('Added expenses.applied_to_material column')
  }

  if (!(await columnExists(pool, 'bank_accounts', 'account_holder_name'))) {
    await pool.query(
      `ALTER TABLE bank_accounts
       ADD COLUMN account_holder_name VARCHAR(255) NOT NULL DEFAULT '' AFTER bank_name`,
    )
    console.log('Added bank_accounts.account_holder_name column')
  }

  if (!(await columnExists(pool, 'bank_accounts', 'ifsc_code'))) {
    await pool.query(
      `ALTER TABLE bank_accounts
       ADD COLUMN ifsc_code VARCHAR(20) NOT NULL DEFAULT '' AFTER account_holder_name`,
    )
    console.log('Added bank_accounts.ifsc_code column')
  }

  // Ensure unified client / site columns on sites table
  if (!(await columnExists(pool, 'sites', 'contact_number'))) {
    await pool.query(`ALTER TABLE sites ADD COLUMN contact_number VARCHAR(50) NOT NULL DEFAULT '' AFTER site_owner`)
    console.log('Added sites.contact_number column')
  }

  if (!(await columnExists(pool, 'sites', 'email'))) {
    await pool.query(`ALTER TABLE sites ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '' AFTER contact_number`)
    console.log('Added sites.email column')
  }

  if (!(await columnExists(pool, 'sites', 'address'))) {
    await pool.query(`ALTER TABLE sites ADD COLUMN address TEXT NOT NULL DEFAULT '' AFTER email`)
    console.log('Added sites.address column')
  }

  if (!(await columnExists(pool, 'sites', 'advance_amount'))) {
    await pool.query(`ALTER TABLE sites ADD COLUMN advance_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER total_budget`)
    console.log('Added sites.advance_amount column')
  }

  if (!(await columnExists(pool, 'sites', 'total_received'))) {
    await pool.query(`ALTER TABLE sites ADD COLUMN total_received DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER advance_amount`)
    console.log('Added sites.total_received column')
  }

  if (!(await columnExists(pool, 'sites', 'bank_account_id'))) {
    await pool.query(`ALTER TABLE sites ADD COLUMN bank_account_id INT UNSIGNED NULL DEFAULT NULL AFTER total_received`)
    console.log('Added sites.bank_account_id column')
  }

  // Ensure bank_account_id column on client_payments table
  if (!(await columnExists(pool, 'client_payments', 'bank_account_id'))) {
    await pool.query(`ALTER TABLE client_payments ADD COLUMN bank_account_id INT UNSIGNED NULL DEFAULT NULL AFTER site_id`)
    console.log('Added client_payments.bank_account_id column')
  }

  // Ensure type column on client_payments table ('credit' or 'debit')
  if (!(await columnExists(pool, 'client_payments', 'type'))) {
    await pool.query(`ALTER TABLE client_payments ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'credit' AFTER status`)
    console.log('Added client_payments.type column')
  }

  // Ensure client_payments.client_id can be NULL if site has no owner
  try {
    await pool.query(`ALTER TABLE client_payments MODIFY COLUMN client_id INT UNSIGNED NULL DEFAULT NULL`)
  } catch (err) {
    // ignore
  }

  // Ensure worker_payments.site_id can be NULL if worker has no assigned site
  try {
    await pool.query(`ALTER TABLE worker_payments MODIFY COLUMN site_id INT UNSIGNED NULL DEFAULT NULL`)
  } catch (err) {
    // ignore
  }

  // Ensure worker_payments.payment_type is VARCHAR(50) to allow all payment types
  try {
    await pool.query(`ALTER TABLE worker_payments MODIFY COLUMN payment_type VARCHAR(50) NOT NULL DEFAULT 'Wage Payment'`)
  } catch (err) {
    // ignore
  }

  // Ensure bank_account_id column on expenses table
  if (!(await columnExists(pool, 'expenses', 'bank_account_id'))) {
    await pool.query(`ALTER TABLE expenses ADD COLUMN bank_account_id INT UNSIGNED NULL DEFAULT NULL AFTER supplier_id`)
    console.log('Added expenses.bank_account_id column')
  }

  // Ensure material_id column on expenses table
  if (!(await columnExists(pool, 'expenses', 'material_id'))) {
    await pool.query('ALTER TABLE expenses ADD COLUMN material_id INT UNSIGNED NULL DEFAULT NULL AFTER id, ADD INDEX idx_material_id (material_id)')
    console.log('Added expenses.material_id column')
  }

  // Link historical material expenses to materials
  try {
    await pool.query(`
      UPDATE expenses e
      JOIN materials m ON LOWER(TRIM(e.category)) = LOWER(TRIM(m.category))
                      AND e.site_id = m.site_id
                      AND (e.supplier_id = m.supplier_id OR (e.supplier_id IS NULL AND m.supplier_id IS NULL))
                      AND e.applied_to_material = 1
      SET e.material_id = m.id
      WHERE e.material_id IS NULL
    `)
  } catch (err) {
    console.warn('Material link check skipped:', err.message)
  }

  // Ensure bank_account_id column on materials table
  if (!(await columnExists(pool, 'materials', 'bank_account_id'))) {
    await pool.query(`ALTER TABLE materials ADD COLUMN bank_account_id INT UNSIGNED NULL DEFAULT NULL AFTER supplier_id`)
    console.log('Added materials.bank_account_id column')
  }

  // Repair historical material rows where quantity was stored as 0 but matching expenses have quantity
  try {
    const [repairResult] = await pool.query(`
      UPDATE materials m
      JOIN (
        SELECT
          LOWER(TRIM(category)) AS mat_name,
          site_id,
          supplier_id,
          SUM(quantity) AS total_qty
        FROM expenses
        WHERE category IS NOT NULL AND TRIM(category) != ''
          AND LOWER(category) NOT IN ('labour', 'equipment', 'transport', 'fuel', 'utilities')
        GROUP BY LOWER(TRIM(category)), site_id, supplier_id
      ) e ON LOWER(TRIM(m.category)) = e.mat_name
         AND m.site_id = e.site_id
         AND (m.supplier_id = e.supplier_id OR (m.supplier_id IS NULL AND e.supplier_id IS NULL))
      SET m.quantity = e.total_qty
      WHERE m.quantity = 0 AND e.total_qty > 0
    `)
    if (repairResult?.affectedRows > 0) {
      console.log(`Repaired ${repairResult.affectedRows} historical material row(s) with correct expense quantities`)
    }
  } catch (err) {
    console.warn('Historical quantity repair check skipped:', err.message)
  }

  // Ensure expense_payments table exists for tracking individual and partial expense payments
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expense_payments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        expense_id INT UNSIGNED NOT NULL,
        site_id INT UNSIGNED NOT NULL,
        supplier_id INT UNSIGNED NULL DEFAULT NULL,
        bank_account_id INT UNSIGNED NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
        reference VARCHAR(100) NULL DEFAULT '',
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ep_expense (expense_id),
        INDEX idx_ep_site (site_id),
        INDEX idx_ep_bank (bank_account_id),
        INDEX idx_ep_date (payment_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Backfill any existing expenses with paid_amount > 0 into expense_payments if not already there
    await pool.query(`
      INSERT INTO expense_payments (expense_id, site_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference, notes)
      SELECT e.id, e.site_id, e.supplier_id, e.bank_account_id, e.paid_amount, e.date, e.payment_method, e.remark, 'Initial Expense Payment'
      FROM expenses e
      WHERE e.paid_amount > 0 
        AND e.bank_account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM expense_payments ep WHERE ep.expense_id = e.id)
    `)
  } catch (err) {
    console.warn('expense_payments table init skipped:', err.message)
  }

  // Ensure cash table exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cash (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description VARCHAR(255) NOT NULL DEFAULT 'Cash Added',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cash_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)
    console.log('Ensured cash table exists')
  } catch (err) {
    console.warn('cash table init skipped:', err.message)
  }

  // Ensure expense_payments.bank_account_id and worker_payments.bank_account_id can be NULL for Cash payments
  try {
    await pool.query('ALTER TABLE expense_payments MODIFY COLUMN bank_account_id INT UNSIGNED NULL DEFAULT NULL')
  } catch (err) {
    // ignore
  }
  try {
    await pool.query('ALTER TABLE worker_payments MODIFY COLUMN bank_account_id INT UNSIGNED NULL DEFAULT NULL')
  } catch (err) {
    // ignore
  }
}
