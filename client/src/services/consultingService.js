import { request } from './api.js'

export const consultingService = {
  getAll: () => request('/consulting'),
  getById: (id) => request(`/consulting/${id}`),
  create: (data) => request('/consulting', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/consulting/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/consulting/${id}`, { method: 'DELETE' }),
}

