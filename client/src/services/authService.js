import { request, authStorage } from './api.js'

export const authService = {
  login: async (username, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    // Store token on successful login
    if (data?.token) {
      authStorage.setToken(data.token)
    }
    return data
  },

  verify: () => request('/auth/verify'),

  changePassword: (data) => request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateManagerPassword: (data) => request('/auth/update-manager-password', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  logout: () => {
    authStorage.removeToken()
  },
}

