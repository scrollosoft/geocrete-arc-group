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
