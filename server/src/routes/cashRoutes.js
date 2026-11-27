import { Router } from 'express'
import {
  getCashRecords,
  addCash,
  updateCash,
  deleteCash,
  updateCashAccount,
  deleteCashAccount,
} from '../controllers/cashController.js'

const router = Router()

router.get('/account', getCashRecords)
router.put('/account', updateCashAccount)
router.delete('/account', deleteCashAccount)
router.get('/', getCashRecords)
router.post('/', addCash)
router.put('/:id', updateCash)
router.delete('/:id', deleteCash)

export default router

