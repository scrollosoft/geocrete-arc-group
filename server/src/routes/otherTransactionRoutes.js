import express from 'express'
import {
  getOtherTransactions,
  createOtherTransaction,
  updateOtherTransaction,
  deleteOtherTransaction,
} from '../controllers/otherTransactionController.js'

const router = express.Router()

router.route('/').get(getOtherTransactions).post(createOtherTransaction)
router.route('/:id').put(updateOtherTransaction).delete(deleteOtherTransaction)

export default router

