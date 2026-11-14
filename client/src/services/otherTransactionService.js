import { request } from './api.js'

export const otherTransactionService = {
  getAll: () => request('/other-transactions'),
  create: (data) => request('/other-transactions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/other-transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/other-transactions/${id}`, { method: 'DELETE' }),
}

