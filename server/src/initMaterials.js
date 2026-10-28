import { connectDB, getPool } from './config/db.js'

async function setup() {
  await connectDB()
  const pool = getPool()

  // 1. Create table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ref_number    VARCHAR(50)   NOT NULL UNIQUE,
      purchase_date DATE          NOT NULL,
      site_id       INT UNSIGNED  NOT NULL,
      supplier_id   INT UNSIGNED  NULL DEFAULT NULL,
      material_name VARCHAR(255)  NOT NULL,
      category      VARCHAR(100)  NOT NULL DEFAULT 'Other',
      quantity      DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
      unit          VARCHAR(50)   NOT NULL DEFAULT 'Units',
      unit_price    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      total_cost    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      paid_amount   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      quantity_used DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
      payment_status ENUM('Pending','Partial','Paid') NOT NULL DEFAULT 'Pending',
      notes         TEXT          NOT NULL DEFAULT '',
      created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_material_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_material_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL ON UPDATE CASCADE,
      INDEX idx_site_id (site_id),
      INDEX idx_supplier_id (supplier_id),
      INDEX idx_purchase_date (purchase_date),
      INDEX idx_category (category),
      INDEX idx_payment_status (payment_status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('Materials table is ready.')

  // Check if suppliers exist, if not add Bharat Steel Traders and Sai Aggregates
  const [existingSuppliers] = await pool.query('SELECT id, name FROM suppliers')
  const supplierMap = {}
  for (const s of existingSuppliers) {
    supplierMap[s.name] = s.id
  }

  if (!supplierMap['Bharat Steel Traders']) {
    const [res] = await pool.query(
      'INSERT INTO suppliers (name, company_name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      ['Bharat Steel Traders', 'Bharat Steel Traders Pvt Ltd', '+91 98221 23456', 'sales@bharatsteel.com', 'Market Yard, Pune']
    )
    supplierMap['Bharat Steel Traders'] = res.insertId
  }

  if (!supplierMap['Sai Aggregates']) {
    const [res] = await pool.query(
      'INSERT INTO suppliers (name, company_name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      ['Sai Aggregates', 'Sai Aggregates & Sand Suppliers', '+91 98222 34567', 'contact@saiaggregates.com', 'Hadapsar, Pune']
    )
    supplierMap['Sai Aggregates'] = res.insertId
  }

  if (!supplierMap['Mahalaxmi Bricks']) {
    if (supplierMap['Mahalaxmi Bricks & Aggregates']) {
      supplierMap['Mahalaxmi Bricks'] = supplierMap['Mahalaxmi Bricks & Aggregates']
    } else {
      const [res] = await pool.query(
        'INSERT INTO suppliers (name, company_name, phone, email, address) VALUES (?, ?, ?, ?, ?)',
        ['Mahalaxmi Bricks', 'Mahalaxmi Building Supplies', '+91 91234 56789', 'info@mahalaxmisupplies.in', 'Wagholi, Pune']
      )
      supplierMap['Mahalaxmi Bricks'] = res.insertId
    }
  }

  // Get site map
  const [existingSites] = await pool.query('SELECT id, name FROM sites')
  const siteMap = {}
  for (const s of existingSites) {
    siteMap[s.name] = s.id
  }

  // Check if materials count > 0
  const [mCount] = await pool.query('SELECT COUNT(*) as count FROM materials')
  if (mCount[0].count === 0) {
    console.log('Seeding initial materials matching reference screenshot...')
    const sampleItems = [
      {
        ref_number: 'MAT-20261001-0001',
        purchase_date: '2026-10-01',
        site_id: siteMap['Aarav Heights'] || existingSites[0].id,
        supplier_id: supplierMap['Bharat Steel Traders'] || existingSuppliers[0].id,
        material_name: 'TMT Steel Fe500',
        category: 'Steel',
        quantity: 12.5,
        unit: 'T',
        unit_price: 38400,
        total_cost: 480000,
        quantity_used: 8.2,
        payment_status: 'Paid',
        notes: 'Grade Fe500 high-tensile steel bars for foundation & beams',
      },
      {
        ref_number: 'MAT-20261004-0002',
        purchase_date: '2026-10-04',
        site_id: siteMap['Aarav Heights'] || existingSites[0].id,
        supplier_id: supplierMap['Shree Cement Co.'] || existingSuppliers[0].id,
        material_name: 'Portland Cement',
        category: 'Cement',
        quantity: 600,
        unit: 'bags',
        unit_price: 800,
        total_cost: 480000,
        quantity_used: 480,
        payment_status: 'Pending',
        notes: 'Grade 53 OPC Cement bags delivered to site',
      },
      {
        ref_number: 'MAT-20261008-0003',
        purchase_date: '2026-10-08',
        site_id: siteMap['Orchid Business Park'] || existingSites[0].id,
        supplier_id: supplierMap['Mahalaxmi Bricks'] || existingSuppliers[0].id,
        material_name: 'Red Clay Bricks',
        category: 'Bricks',
        quantity: 24000,
        unit: 'pcs',
        unit_price: 20,
        total_cost: 480000,
        quantity_used: 10000,
        payment_status: 'Partial',
        notes: 'First quality red clay kiln-burnt bricks for partition walls',
      },
      {
        ref_number: 'MAT-20261012-0004',
        purchase_date: '2026-10-12',
        site_id: siteMap['Greenfield Villa'] || existingSites[0].id,
        supplier_id: supplierMap['Sai Aggregates'] || existingSuppliers[0].id,
        material_name: 'River Sand',
        category: 'Sand',
        quantity: 42,
        unit: 'tonnes',
        unit_price: 11428.57,
        total_cost: 480000,
        quantity_used: 24,
        payment_status: 'Pending',
        notes: 'Washed river sand for plastering and concrete mix',
      },
      {
        ref_number: 'MAT-20261015-0005',
        purchase_date: '2026-10-15',
        site_id: siteMap['Aarav Heights'] || existingSites[0].id,
        supplier_id: supplierMap['Bharat Steel Traders'] || existingSuppliers[0].id,
        material_name: 'Crushed Aggregate 20mm',
        category: 'Aggregate',
        quantity: 35,
        unit: 'tonnes',
        unit_price: 8500,
        total_cost: 297500,
        quantity_used: 32,
        payment_status: 'Paid',
        notes: 'Blue metal 20mm coarse aggregate',
      },
    ]

    for (const item of sampleItems) {
      await pool.query(
        `INSERT INTO materials
         (ref_number, purchase_date, site_id, supplier_id, material_name, category,
          quantity, unit, unit_price, total_cost, quantity_used, payment_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.ref_number,
          item.purchase_date,
          item.site_id,
          item.supplier_id,
          item.material_name,
          item.category,
          item.quantity,
          item.unit,
          item.unit_price,
          item.total_cost,
          item.quantity_used,
          item.payment_status,
          item.notes,
        ]
      )
    }
    console.log('Seeded 5 sample material purchase rows.')
  }

  process.exit(0)
}

setup().catch((err) => {
  console.error(err)
  process.exit(1)
})
