import { BankAccount } from './models/BankAccount.js'
import { Site } from './models/Site.js'
import { Supplier } from './models/Supplier.js'
import { Expense } from './models/Expense.js'

export const seedDatabase = async (force = false) => {
  const existingAccounts = await BankAccount.count()
  if (existingAccounts > 0 && !force) {
    console.log('Database already has records, skipping seed.')
    return { skipped: true }
  }

  if (force) {
    // Disable FK checks so we can truncate in any order
    const { getPool } = await import('./config/db.js')
    const pool = getPool()
    await pool.query('SET FOREIGN_KEY_CHECKS = 0')
    await Expense.deleteAll()
    await BankAccount.deleteAll()
    await Site.deleteAll()
    await Supplier.deleteAll()
    await pool.query('SET FOREIGN_KEY_CHECKS = 1')
  }

  // 1. Bank Accounts
  const bankAccounts = await BankAccount.insertMany([
    { accountNumber: 'ACC-001', accountNumberTag: 'ACCOUNT #01', bankName: 'Bank One',   accountCode: 'B1', balance: 100000, credit: 50000, accentColor: '#3980FF', isActive: true },
    { accountNumber: 'ACC-002', accountNumberTag: 'ACCOUNT #02', bankName: 'Bank Two',   accountCode: 'B2', balance: 100000, credit: 50000, accentColor: '#00B67A', isActive: true },
    { accountNumber: 'ACC-003', accountNumberTag: 'ACCOUNT #03', bankName: 'Bank Three', accountCode: 'B3', balance: 100000, credit: 50000, accentColor: '#07577A', isActive: true },
    { accountNumber: 'ACC-004', accountNumberTag: 'ACCOUNT #04', bankName: 'Bank Four',  accountCode: 'B4', balance: 100000, credit: 50000, accentColor: '#FF9900', isActive: true },
  ])

  // 2. Sites
  const sites = await Site.insertMany([
    {
      name: 'Aarav Heights',       location: 'Baner, Pune',     siteOwner: 'Rajesh Mehta',
      totalBudget: 18500000, totalSpent: 12400000, status: 'Active',
      startDate: '2026-01-15', expectedCompletionDate: '2027-06-30',
      description: 'Luxury residential 18-storey twin tower project in Baner.', budgetAlertCount: 1,
    },
    {
      name: 'Greenfield Villa',    location: 'Wakad, Pune',     siteOwner: 'Rajesh Mehta',
      totalBudget: 18500000, totalSpent: 12400000, status: 'Active',
      startDate: '2026-02-01', expectedCompletionDate: '2027-03-31',
      description: 'Exclusive gated community villas with premium amenities.', budgetAlertCount: 1,
    },
    {
      name: 'Orchid Business Park', location: 'Hinjawadi, Pune', siteOwner: 'Rajesh Mehta',
      totalBudget: 18500000, totalSpent: 12400000, status: 'Active',
      startDate: '2025-11-10', expectedCompletionDate: '2026-12-31',
      description: 'Commercial IT tech park building phase 1.', budgetAlertCount: 1,
    },
  ])

  // 3. Suppliers
  const suppliers = await Supplier.insertMany([
    { name: 'Shree Cement Co.',          companyName: 'Shree Cement Ltd.',          phone: '+91 98765 43210', email: 'sales@shreecement.com',     address: 'Industrial Area, Pune' },
    { name: 'Tata Steel Depot',          companyName: 'Tata Steel Trading Co.',     phone: '+91 98220 11223', email: 'pune.supply@tatasteel.com',  address: 'MIDC Bhosari, Pune' },
    { name: 'Apex Heavy Earthmovers',    companyName: 'Apex Machinery & Equipment', phone: '+91 94220 55667', email: 'rentals@apexmachinery.com', address: 'Katraj Bypass, Pune' },
    { name: 'Mahalaxmi Bricks & Aggregates', companyName: 'Mahalaxmi Building Supplies', phone: '+91 91234 56789', email: 'info@mahalaxmisupplies.in', address: 'Wagholi, Pune' },
  ])

  // 4. Expenses (use numeric IDs from inserted rows)
  await Expense.insertMany([
    {
      date: '2026-08-11', site: sites[0]._id, supplier: suppliers[1]._id,
      material: 'Structural steel – Fe500', category: 'Material',
      description: 'Structural steel – Fe500',
      quantity: 10, unit: 'Tons', ratePerUnit: 48000, amount: 480000,
      paidAmount: 350000, pendingAmount: 130000, paymentMethod: 'Bank Transfer',
      remark: 'First batch of Fe500 TMT bars for columns', status: 'Partial',
    },
    {
      date: '2026-08-11', site: sites[0]._id, supplier: null,
      material: 'Masonry labour', category: 'Labour',
      description: 'Masonry labour – Week 20',
      quantity: 20, unit: 'Days', ratePerUnit: 24000, amount: 480000,
      paidAmount: 350000, pendingAmount: 0, paymentMethod: 'UPI',
      remark: 'Labour contractor milestone payout for 2nd floor walls', status: 'Paid',
    },
    {
      date: '2026-08-11', site: sites[2]._id, supplier: suppliers[2]._id,
      material: 'Excavator rental', category: 'Equipment',
      description: 'Excavator rental',
      quantity: 12, unit: 'Hours', ratePerUnit: 40000, amount: 480000,
      paidAmount: 350000, pendingAmount: 0, paymentMethod: 'Cheque',
      remark: 'Basement excavation equipment for 3 days', status: 'Paid',
    },
    {
      date: '2026-08-11', site: sites[1]._id, supplier: suppliers[0]._id,
      material: 'Cement', category: 'Transport',
      description: 'Cement – 600 bags',
      quantity: 600, unit: 'Bags', ratePerUnit: 800, amount: 480000,
      paidAmount: 350000, pendingAmount: 130000, paymentMethod: 'Bank Transfer',
      remark: 'Grade 53 OPC Cement bags delivered to site', status: 'Partial',
    },
  ])

  console.log('Database successfully seeded with reference data!')
  return {
    success: true,
    accounts:  bankAccounts.length,
    sites:     sites.length,
    suppliers: suppliers.length,
    expenses:  4,
  }
}
