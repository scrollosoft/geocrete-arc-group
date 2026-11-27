import { request } from './api.js'

export const cashService = {
  getAll: () => request('/cash'),
  add: (data) => request('/cash', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/cash/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/cash/${id}`, { method: 'DELETE' }),
  updateAccount: (data) => request('/cash/account', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => request(`/cash/account${id ? `?id=${encodeURIComponent(id)}` : ''}`, { method: 'DELETE' }),
}

