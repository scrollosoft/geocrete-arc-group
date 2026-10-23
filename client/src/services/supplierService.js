import { request } from './api.js'

export const supplierService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/suppliers${query ? `?${query}` : ''}`)
  },
  getStats: (params = {}) => {
    const cleanParams = { ...params, stats: 'true' }
    const query = new URLSearchParams(cleanParams).toString()
    return request(`/suppliers${query ? `?${query}` : ''}`)
  },
  getById: (id) => request(`/suppliers/${id}`),
  getPurchases: (id) => request(`/suppliers/${id}/purchases`),
  recordPayment: (data) => request('/suppliers/record-payment', { method: 'POST', body: JSON.stringify(data) }),
  create: (data) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/suppliers/${id}`, { method: 'DELETE' }),
}
