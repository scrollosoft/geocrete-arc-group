import { request } from './api.js'

export const labourService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/labour${query ? `?${query}` : ''}`)
  },
  create: (data) => request('/labour', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/labour/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/labour/${id}`, { method: 'DELETE' }),
}
