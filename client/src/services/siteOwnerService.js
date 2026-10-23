import { request } from './api.js'

export const siteOwnerService = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    const qs = query ? ('?' + query) : ''
    return request('/site-owners' + qs)
  },
  getById: (id) => request('/site-owners/' + id),
  getPayments: (id) => request('/site-owners/' + id + '/payments'),
  recordPayment: (id, data) => request('/site-owners/' + id + '/payments', { method: 'POST', body: JSON.stringify(data) }),
  create:  (data) => request('/site-owners', { method: 'POST', body: JSON.stringify(data) }),
  update:  (id, data) => request('/site-owners/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  delete:  (id) => request('/site-owners/' + id, { method: 'DELETE' }),
}

