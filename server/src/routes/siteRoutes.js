import express from 'express'
import {
  getSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
  getSitePayments,
} from '../controllers/siteController.js'

const router = express.Router()

router.route('/').get(getSites).post(createSite)
router.get('/:id/payments', getSitePayments)
router.route('/:id').get(getSiteById).put(updateSite).delete(deleteSite)

export default router
