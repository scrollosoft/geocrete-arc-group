import express from 'express'
import {
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from '../controllers/bankAccountController.js'

const router = express.Router()

router.route('/').get(getBankAccounts).post(createBankAccount)
router.route('/:id').get(getBankAccountById).put(updateBankAccount).delete(deleteBankAccount)

export default router
