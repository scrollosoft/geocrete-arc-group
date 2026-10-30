import { request } from './api.js'

export const siteService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/sites${query ? `?${query}` : ''}`)
  },
  getById: (id) => request(`/sites/${id}`),
  getPayments: (siteId) => request(`/sites/${siteId}/payments`),
  create: (data) => request('/sites', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/sites/${id}`, { method: 'DELETE' }),
}
