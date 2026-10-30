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

  // Ensure bank_account_id column on expenses table
  if (!(await columnExists(pool, 'expenses', 'bank_account_id'))) {
    await pool.query(`ALTER TABLE expenses ADD COLUMN bank_account_id INT UNSIGNED NULL DEFAULT NULL AFTER supplier_id`)
    console.log('Added expenses.bank_account_id column')
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
}
