import express from 'express'
import {
  getAttendanceByDateAndSite,
  saveAttendance,
  getMonthlySummary,
  getWorkerHistory,
  updateAttendanceRecord,
  deleteAttendanceRecord,
} from '../controllers/attendanceController.js'

const router = express.Router()

router.get('/', getAttendanceByDateAndSite)
router.post('/', saveAttendance)
router.get('/monthly', getMonthlySummary)
router.get('/worker/:workerId', getWorkerHistory)
router.put('/:id', updateAttendanceRecord)
router.delete('/:id', deleteAttendanceRecord)

export default router

