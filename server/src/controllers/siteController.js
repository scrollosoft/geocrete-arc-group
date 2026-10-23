import { Site } from '../models/Site.js'
import { Expense } from '../models/Expense.js'

export const getSites = async (req, res, next) => {
  try {
    const { search, status, sort } = req.query
    const sites = await Site.find({ search, status, sort })
    res.json(sites)
  } catch (error) {
    next(error)
  }
}

export const getSiteById = async (req, res, next) => {
  try {
    const site = await Site.findById(req.params.id)
    if (!site) {
      return res.status(404).json({ error: 'Site not found' })
    }
    res.json(site)
  } catch (error) {
    next(error)
  }
}

export const createSite = async (req, res, next) => {
  try {
    const { name, location, siteOwner, totalBudget, startDate, expectedCompletionDate, status, description } = req.body

    if (!name || !location || !siteOwner || totalBudget === undefined) {
      return res.status(400).json({ error: 'Name, location, site owner, and total budget are required' })
    }

    const site = await Site.create({
      name,
      location,
      siteOwner,
      totalBudget:            Number(totalBudget),
      totalSpent:             0,
      status:                 status || 'Active',
      startDate:              startDate || new Date().toISOString().slice(0, 10),
      expectedCompletionDate: expectedCompletionDate || null,
      description:            description || '',
      budgetAlertCount:       1,
    })

    res.status(201).json(site)
  } catch (error) {
    next(error)
  }
}

export const updateSite = async (req, res, next) => {
  try {
    const site = await Site.update(req.params.id, req.body)
    if (!site) {
      return res.status(404).json({ error: 'Site not found' })
    }
    res.json(site)
  } catch (error) {
    next(error)
  }
}

export const deleteSite = async (req, res, next) => {
  try {
    const expenseCount = await Expense.countBySite(req.params.id)
    if (expenseCount > 0) {
      return res.status(400).json({
        error: `Cannot delete site because it has ${expenseCount} associated expense record(s).`,
      })
    }

    const site = await Site.delete(req.params.id)
    if (!site) {
      return res.status(404).json({ error: 'Site not found' })
    }
    res.json({ message: 'Site deleted successfully' })
  } catch (error) {
    next(error)
  }
}
