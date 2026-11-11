import express from 'express'
import {
  getAllWorkerPayments,
  createWorkerPayment,
  getWorkerPayments,
  updateWorkerPayment,
  deleteWorkerPayment,
} from '../controllers/workerPaymentController.js'

const router = express.Router()

router.get('/', getAllWorkerPayments)
router.post('/', createWorkerPayment)
router.get('/worker/:workerId', getWorkerPayments)
router.put('/:id', updateWorkerPayment)
router.delete('/:id', deleteWorkerPayment)

export default router

