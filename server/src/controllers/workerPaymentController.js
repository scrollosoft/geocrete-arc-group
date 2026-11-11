import { WorkerPayment } from '../models/WorkerPayment.js'

export async function getAllWorkerPayments(req, res, next) {
  try {
    const data = await WorkerPayment.getAllPayments()
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function createWorkerPayment(req, res, next) {
  try {
    const { workerId, siteId, bankAccountId, amount, paymentDate, paymentType, remarks, createdBy } = req.body
    if (!workerId || !bankAccountId || !amount) {
      return res.status(400).json({ error: 'workerId, bankAccountId, and amount are required.' })
    }
    const data = await WorkerPayment.createPayment({
      workerId,
      siteId,
      bankAccountId,
      amount,
      paymentDate,
      paymentType,
      remarks,
      createdBy,
    })
    res.status(201).json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function getWorkerPayments(req, res, next) {
  try {
    const { workerId } = req.params
    if (!workerId) return res.status(400).json({ error: 'workerId is required.' })
    const data = await WorkerPayment.getPaymentsByWorker(workerId)
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function updateWorkerPayment(req, res, next) {
  try {
    const { id } = req.params
    const data = await WorkerPayment.updatePayment(id, req.body)
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

export async function deleteWorkerPayment(req, res, next) {
  try {
    const { id } = req.params
    const data = await WorkerPayment.deletePayment(id)
    res.json({ ok: true, data })
  } catch (err) {
    next(err)
  }
}

