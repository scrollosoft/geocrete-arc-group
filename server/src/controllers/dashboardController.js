import { BankAccount } from '../models/BankAccount.js'
import { Site } from '../models/Site.js'
import { Expense } from '../models/Expense.js'
import { seedDatabase } from '../seed.js'

export const getDashboardSummary = async (_req, res, next) => {
  try {
    const bankAccounts = await BankAccount.findActive()
    const sites        = await Site.findActive()
    const expenseSums  = await Expense.sumAll()

    const totalBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0)
    const totalCredit  = bankAccounts.reduce((sum, a) => sum + (a.credit  || 0), 0)

    const totalBudget    = sites.reduce((sum, s) => sum + (s.totalBudget || 0), 0)
    const totalSpent     = sites.reduce((sum, s) => sum + (s.totalSpent  || 0), 0)
    const totalRemaining = Math.max(0, totalBudget - totalSpent)

    res.json({
      bankAccountsCount:   bankAccounts.length,
      totalBalance,
      totalCredit,
      activeSitesCount:    sites.length,
      totalBudget,
      totalSpent,
      totalRemaining,
      totalExpenseAmount:  expenseSums.totalExpenseAmount,
      totalPaidAmount:     expenseSums.totalPaidAmount,
      totalPendingAmount:  expenseSums.totalPendingAmount,
    })
  } catch (error) {
    next(error)
  }
}

export const getRecentExpenses = async (req, res, next) => {
  try {
    const { siteId, limit = 10 } = req.query
    const { expenses } = await Expense.find({
      siteId: siteId && siteId !== 'all' ? siteId : undefined,
      limit: Number(limit),
    })
    res.json(expenses)
  } catch (error) {
    next(error)
  }
}

export const getSiteOverview = async (_req, res, next) => {
  try {
    const sites = await Site.findAll({ limit: 6 })
    const overview = sites.map((s) => ({
      _id:              s._id,
      name:             s.name,
      location:         s.location,
      siteOwner:        s.siteOwner,
      totalBudget:      s.totalBudget,
      totalSpent:       s.totalSpent,
      remainingBudget:  Math.max(0, s.totalBudget - s.totalSpent),
      budgetUtilization: s.totalBudget > 0 ? Number(((s.totalSpent / s.totalBudget) * 100).toFixed(1)) : 0,
      budgetAlertCount: s.budgetAlertCount || 1,
      status:           s.status,
    }))
    res.json(overview)
  } catch (error) {
    next(error)
  }
}

export const runSeed = async (_req, res, next) => {
  try {
    const result = await seedDatabase(true)
    res.json({ message: 'Seed executed successfully', result })
  } catch (error) {
    next(error)
  }
}
