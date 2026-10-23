import { Labour } from '../models/Labour.js'
import { Site } from '../models/Site.js'

// Seed default workers matching reference screenshot if none exist
const ensureInitialLabour = async () => {
  const count = await Labour.count()
  if (count > 0) return

  const sites = await Site.findAll({ limit: 4 })
  const aaravSite      = sites.find((s) => s.name?.includes('Aarav'))      || sites[0] || null
  const greenfieldSite = sites.find((s) => s.name?.includes('Greenfield')) || sites[1] || sites[0] || null
  const orchidSite     = sites.find((s) => s.name?.includes('Orchid'))     || sites[2] || sites[0] || null

  await Labour.insertMany([
    { name: 'Ramesh Kumar',  phone: '+91234567892', trade: 'Mason',       site: aaravSite?._id      || null, dailyRate: 1000, wagesEarned: 19950, totalPaid: 15000, status: 'Active' },
    { name: 'Suresh Yadav',  phone: '+91234567892', trade: 'Carpenter',   site: greenfieldSite?._id || null, dailyRate: 1100, wagesEarned: 13325, totalPaid: 10000, status: 'Active' },
    { name: 'Ramesh Kumar',  phone: '+91234567892', trade: 'Electrician', site: orchidSite?._id     || null, dailyRate: 650,  wagesEarned: 23100, totalPaid: 22000, status: 'Active' },
    { name: 'Ramesh Kumar',  phone: '+91234567892', trade: 'Helper',      site: aaravSite?._id      || null, dailyRate: 950,  wagesEarned: 20000, totalPaid: 12000, status: 'Active' },
    { name: 'Mahesh Patil',  phone: '+91234567892', trade: 'Plumber',     site: greenfieldSite?._id || null, dailyRate: 1200, wagesEarned: 18000, totalPaid: 10000, status: 'Active' },
  ])
}

export const getLabour = async (req, res, next) => {
  try {
    await ensureInitialLabour()

    const { search, siteId, trade } = req.query
    const workers = await Labour.find({ search, siteId, trade })
    const summary = await Labour.sumAll()

    res.json({ workers, summary })
  } catch (error) {
    next(error)
  }
}

export const createLabour = async (req, res, next) => {
  try {
    const { name, phone, trade, otherTrade, site, joiningDate, dailyRate, paymentType, status, address, remarks } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Worker Full Name is required.' })
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone Number is required.' })
    }

    const finalTrade = trade === 'Other' ? (otherTrade || '').trim() : (trade || '').trim()
    if (!finalTrade) {
      return res.status(400).json({ error: 'Worker Trade / Role is required.' })
    }

    if (!site) {
      return res.status(400).json({ error: 'Construction Site is required.' })
    }

    // Verify site exists
    const siteDoc = await Site.findById(site)
    if (!siteDoc) {
      return res.status(400).json({ error: 'Selected Construction Site does not exist.' })
    }

    if (!dailyRate || Number(dailyRate) <= 0) {
      return res.status(400).json({ error: 'Daily Wage must be greater than zero.' })
    }

    const worker = await Labour.create({
      name:        name.trim(),
      phone:       phone.trim(),
      trade:       finalTrade,
      site:        siteDoc._id,
      joiningDate: joiningDate ? new Date(joiningDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      dailyRate:   Number(dailyRate),
      paymentType: paymentType || 'Daily',
      status:      status || 'Active',
      address:     address ? address.trim() : '',
      remarks:     remarks ? remarks.trim() : '',
      wagesEarned: 0,
      totalPaid:   0,
    })

    res.status(201).json(worker)
  } catch (error) {
    next(error)
  }
}

export const updateLabour = async (req, res, next) => {
  try {
    const worker = await Labour.update(req.params.id, req.body)
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' })
    }
    res.json(worker)
  } catch (error) {
    next(error)
  }
}

export const deleteLabour = async (req, res, next) => {
  try {
    const worker = await Labour.delete(req.params.id)
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' })
    }
    res.json({ message: 'Worker deleted successfully' })
  } catch (error) {
    next(error)
  }
}
