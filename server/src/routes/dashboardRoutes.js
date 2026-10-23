import express from 'express'
import {
  getDashboardSummary,
  getRecentExpenses,
  getSiteOverview,
  runSeed,
} from '../controllers/dashboardController.js'

const router = express.Router()

router.get('/summary', getDashboardSummary)
router.get('/recent-expenses', getRecentExpenses)
router.get('/site-overview', getSiteOverview)
router.post('/seed', runSeed)

export default router
