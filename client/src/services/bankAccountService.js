import { request } from './api.js'

export const bankAccountService = {
  getAll: () => request('/bank-accounts'),
  getById: (id) => request(`/bank-accounts/${id}`),
  create: (data) => request('/bank-accounts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/bank-accounts/${id}`, { method: 'DELETE' }),
  getTransactions: (params = {}) => {
    const cleanParams = {}
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') {
        cleanParams[k] = v
      }
    }
    const qs = new URLSearchParams(cleanParams).toString()
    return request(`/bank-accounts/transactions${qs ? `?${qs}` : ''}`)
  },
}
