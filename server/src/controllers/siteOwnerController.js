import { SiteOwner } from '../models/SiteOwner.js'

export const getSiteOwners = async (req, res, next) => {
  try {
    const { search } = req.query
    const [clients, summary] = await Promise.all([
      SiteOwner.find({ search }),
      SiteOwner.getSummary(),
    ])
    res.json({ clients, summary })
  } catch (error) {
    next(error)
  }
}

export const getSiteOwnerById = async (req, res, next) => {
  try {
    const client = await SiteOwner.findById(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    res.json(client)
  } catch (error) {
    next(error)
  }
}

export const createSiteOwner = async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'Client name is required' })
    const client = await SiteOwner.create(req.body)
    res.status(201).json(client)
  } catch (error) {
    next(error)
  }
}

export const updateSiteOwner = async (req, res, next) => {
  try {
    const client = await SiteOwner.update(req.params.id, req.body)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    res.json(client)
  } catch (error) {
    next(error)
  }
}

export const deleteSiteOwner = async (req, res, next) => {
  try {
    const client = await SiteOwner.delete(req.params.id)
    if (!client) return res.status(404).json({ error: 'Client not found' })
    res.json({ message: 'Client deleted successfully' })
  } catch (error) {
    next(error)
  }
}

export const getSiteOwnerPayments = async (req, res, next) => {
  try {
    const payments = await SiteOwner.getPayments(req.params.id)
    res.json(payments)
  } catch (error) {
    next(error)
  }
}

export const recordSiteOwnerPayment = async (req, res, next) => {
  try {
    const client = await SiteOwner.recordPayment(req.params.id, req.body)
    const payments = await SiteOwner.getPayments(req.params.id)
    res.json({ client, payments })
  } catch (error) {
    next(error)
  }
}

