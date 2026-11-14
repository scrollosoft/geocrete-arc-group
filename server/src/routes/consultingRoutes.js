import express from 'express'
import {
  getConsultingList,
  getConsultingById,
  createConsulting,
  updateConsulting,
  deleteConsulting,
} from '../controllers/consultingController.js'

const router = express.Router()

router.route('/').get(getConsultingList).post(createConsulting)
router.route('/:id').get(getConsultingById).put(updateConsulting).delete(deleteConsulting)

export default router

