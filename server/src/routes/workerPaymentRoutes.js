import express from 'express'
import {
  createWorkerPayment,
  getWorkerPayments,
  updateWorkerPayment,
  deleteWorkerPayment,
} from '../controllers/workerPaymentController.js'

const router = express.Router()

router.post('/', createWorkerPayment)
router.get('/worker/:workerId', getWorkerPayments)
router.put('/:id', updateWorkerPayment)
router.delete('/:id', deleteWorkerPayment)

export default router

