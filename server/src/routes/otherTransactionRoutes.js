import express from 'express'
import {
  getOtherTransactions,
  createOtherTransaction,
  updateOtherTransaction,
  deleteOtherTransaction,
  getOtherLedgers,
} from '../controllers/otherTransactionController.js'

const router = express.Router()

router.get('/ledgers', getOtherLedgers)
router.route('/').get(getOtherTransactions).post(createOtherTransaction)
router.route('/:id').put(updateOtherTransaction).delete(deleteOtherTransaction)

export default router

