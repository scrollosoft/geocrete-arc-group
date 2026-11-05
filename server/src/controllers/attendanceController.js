import { WorkerAttendance } from '../models/WorkerAttendance.js'

export async function getAttendanceByDateAndSite(req, res, next) {
  try {
    const { siteId, date } = req.query
    if (!siteId || !date) {
      return res.status(400).json({ error: 'siteId and date are required.' })
    }
    const data = await WorkerAttendance.getByDateAndSite(siteId, date)
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function saveAttendance(req, res, next) {
  try {
    const { siteId, attendanceDate, records, markedBy } = req.body
    if (!siteId || !attendanceDate || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'siteId, attendanceDate, and records[] are required.' })
    }
    const result = await WorkerAttendance.recordAttendance({ siteId, attendanceDate, records, markedBy })
    res.json({ ok: true, data: result })
  } catch (err) {
    next(err)
  }
}

export async function getMonthlySummary(req, res, next) {
  try {
    const { siteId, month, year, workerId } = req.query
    const data = await WorkerAttendance.getMonthlySummary({ siteId, month, year, workerId })
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function getWorkerHistory(req, res, next) {
  try {
    const { workerId } = req.params
    if (!workerId) return res.status(400).json({ error: 'workerId is required.' })
    const data = await WorkerAttendance.getWorkerAttendanceHistory(workerId)
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function updateAttendanceRecord(req, res, next) {
  try {
    const { id } = req.params
    const { status, remarks, markedBy } = req.body
    if (!status) return res.status(400).json({ error: 'status is required.' })
    const data = await WorkerAttendance.updateAttendance(id, { status, remarks, markedBy })
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function deleteAttendanceRecord(req, res, next) {
  try {
    const { id } = req.params
    const data = await WorkerAttendance.deleteAttendance(id)
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

