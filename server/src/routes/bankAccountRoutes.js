import express from 'express'
import {
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankTransactions,
} from '../controllers/bankAccountController.js'

const router = express.Router()

router.get('/transactions', getBankTransactions)
router.route('/').get(getBankAccounts).post(createBankAccount)
router.route('/:id').get(getBankAccountById).put(updateBankAccount).delete(deleteBankAccount)

export default router
