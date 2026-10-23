import { Router } from 'express'
import {
  getLabour,
  createLabour,
  updateLabour,
  deleteLabour,
} from '../controllers/labourController.js'

const router = Router()

router.get('/', getLabour)
router.post('/', createLabour)
router.put('/:id', updateLabour)
router.delete('/:id', deleteLabour)

export default router
