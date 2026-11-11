import express from 'express'
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  recordExpensePayment,
  getExpensePayments,
} from '../controllers/expenseController.js'

const router = express.Router()

router.route('/').get(getExpenses).post(createExpense)
router.route('/:id/payments').get(getExpensePayments).post(recordExpensePayment)
router.route('/:id').get(getExpenseById).put(updateExpense).delete(deleteExpense)

export default router
