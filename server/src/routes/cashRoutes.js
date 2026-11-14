import { Router } from 'express'
import {
  getCashRecords,
  addCash,
  updateCash,
  deleteCash,
} from '../controllers/cashController.js'

const router = Router()

router.get('/', getCashRecords)
router.post('/', addCash)
router.put('/:id', updateCash)
router.delete('/:id', deleteCash)

export default router

