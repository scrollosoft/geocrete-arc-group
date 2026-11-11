import express from 'express'
import {
  getSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
  getSitePayments,
  recordSitePayment,
} from '../controllers/siteController.js'

const router = express.Router()

router.route('/').get(getSites).post(createSite)
router.route('/:id/payments').get(getSitePayments).post(recordSitePayment)
router.route('/:id').get(getSiteById).put(updateSite).delete(deleteSite)

export default router
