import { request } from './api.js'

export const attendanceService = {
  getByDateAndSite: (siteId, date) =>
    request(`/attendance?siteId=${encodeURIComponent(siteId)}&date=${encodeURIComponent(date)}`),

  save: (data) =>
    request('/attendance', { method: 'POST', body: JSON.stringify(data) }),

  getMonthlySummary: (params) => {
    const q = new URLSearchParams(params).toString()
    return request(`/attendance/monthly?${q}`)
  },

  getWorkerHistory: (workerId) =>
    request(`/attendance/worker/${workerId}`),

  update: (id, data) =>
    request(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id) =>
    request(`/attendance/${id}`, { method: 'DELETE' }),
}

