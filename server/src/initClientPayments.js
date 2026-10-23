import { connectDB, getPool } from './config/db.js'

export async function initClientPayments() {
  await connectDB()
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_payments (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      client_id INT UNSIGNED NOT NULL,
      site_id INT UNSIGNED NULL,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      payment_date DATE NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Project milestone payment',
      payment_method VARCHAR(100) NOT NULL DEFAULT 'Bank transfer',
      reference VARCHAR(255) NOT NULL DEFAULT 'Reference verified',
      status VARCHAR(50) NOT NULL DEFAULT 'Paid',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_client_id (client_id),
      INDEX idx_payment_date (payment_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)

  const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM client_payments WHERE client_id = 1')
  if (existing[0].cnt === 0) {
    await pool.query(`
      INSERT INTO client_payments (client_id, site_id, amount, payment_date, title, payment_method, reference, status)
      VALUES
        (1, 1, 234000.00, '2025-05-24', 'Project milestone payment', 'Bank transfer', 'Reference verified', 'Paid'),
        (1, 1, 1500000.00, '2025-04-18', 'Project milestone payment', 'Bank transfer', 'Reference verified', 'Paid'),
        (1, 1, 2000000.00, '2025-03-06', 'Project milestone payment', 'Bank transfer', 'Reference verified', 'Paid'),
        (1, 1, 3266000.00, '2025-02-15', 'Project milestone payment', 'Bank transfer', 'Reference verified', 'Paid'),
        (1, 1, 6500000.00, '2025-01-12', 'Project advance received', 'Bank transfer', 'Reference verified', 'Paid')
    `)
    console.log('Seeded client_payments for client 1')
  }

  const [rows] = await pool.query('SELECT * FROM client_payments WHERE client_id = 1 ORDER BY payment_date DESC')
  console.log('client_payments count:', rows.length)
}

if (process.argv[1]?.endsWith('initClientPayments.js')) {
  initClientPayments().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); })
}
