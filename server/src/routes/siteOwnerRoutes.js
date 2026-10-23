import express from 'express'
import {
  getSiteOwners,
  getSiteOwnerById,
  createSiteOwner,
  updateSiteOwner,
  deleteSiteOwner,
  getSiteOwnerPayments,
  recordSiteOwnerPayment,
} from '../controllers/siteOwnerController.js'

const router = express.Router()

router.route('/').get(getSiteOwners).post(createSiteOwner)
router.route('/:id').get(getSiteOwnerById).put(updateSiteOwner).delete(deleteSiteOwner)
router.route('/:id/payments').get(getSiteOwnerPayments).post(recordSiteOwnerPayment)

export default router
