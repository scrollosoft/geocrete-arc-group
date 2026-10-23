import { request } from './api.js'

export const dashboardService = {
  getSummary: () => request('/dashboard/summary'),
  getRecentExpenses: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val)
      }
    })
    const queryString = query.toString()
    return request(`/dashboard/recent-expenses${queryString ? `?${queryString}` : ''}`)
  },
  getSiteOverview: () => request('/dashboard/site-overview'),
  runSeed: () => request('/dashboard/seed', { method: 'POST' }),
}
