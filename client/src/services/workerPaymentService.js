import { request } from './api.js'

export const workerPaymentService = {
  getAll: () =>
    request('/worker-payments'),

  create: (data) =>
    request('/worker-payments', { method: 'POST', body: JSON.stringify(data) }),

  getByWorker: (workerId) =>
    request(`/worker-payments/worker/${workerId}`),

  update: (id, data) =>
    request(`/worker-payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/worker-payments/${id}`, { method: 'DELETE' }),
}

