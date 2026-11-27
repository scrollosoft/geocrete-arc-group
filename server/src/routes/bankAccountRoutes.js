import express from 'express'
import {
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankTransactions,
  deleteAllTransactions,
  transferFunds,
} from '../controllers/bankAccountController.js'

const router = express.Router()

router.get('/transactions', getBankTransactions)
router.delete('/transactions/all', deleteAllTransactions)
router.post('/transfer', transferFunds)
router.route('/').get(getBankAccounts).post(createBankAccount)
router.route('/:id').get(getBankAccountById).put(updateBankAccount).delete(deleteBankAccount)

export default router
