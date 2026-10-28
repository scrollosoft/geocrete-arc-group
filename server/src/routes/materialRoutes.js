import express from 'express'
import {
  getMaterials,
  getMaterialSummary,
  getMaterialById,
  getMaterialHistory,
  getNextRef,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '../controllers/materialController.js'

const router = express.Router()

router.route('/')
  .get(getMaterials)
  .post(createMaterial)

router.route('/summary')
  .get(getMaterialSummary)

router.route('/history')
  .get(getMaterialHistory)

router.route('/next-ref')
  .get(getNextRef)

router.route('/:id/history')
  .get(getMaterialHistory)

router.route('/:id')
  .get(getMaterialById)
  .put(updateMaterial)
  .delete(deleteMaterial)

export default router
