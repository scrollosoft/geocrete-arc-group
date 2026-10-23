import { request } from './api.js'

export const materialService = {
  getAll: (params = {}) => {
    // Clean params to remove undefined / empty / 'all'
    const cleanParams = {}
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'all' && val !== 'All Sites' && val !== 'All Status') {
        cleanParams[key] = val
      }
    })
    const query = new URLSearchParams(cleanParams).toString()
    return request(`/materials${query ? `?${query}` : ''}`)
  },
  getSummary: () => request('/materials/summary'),
  getNextRef: () => request('/materials/next-ref'),
  create: (data) => request('/materials', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/materials/${id}`, { method: 'DELETE' }),
}
