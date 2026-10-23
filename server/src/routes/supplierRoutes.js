import express from 'express'
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierPurchases,
  recordPayment,
} from '../controllers/supplierController.js'

const router = express.Router()

router.route('/').get(getSuppliers).post(createSupplier)
router.route('/record-payment').post(recordPayment)
router.route('/:id').get(getSupplierById).put(updateSupplier).delete(deleteSupplier)
router.route('/:id/purchases').get(getSupplierPurchases)

export default router
