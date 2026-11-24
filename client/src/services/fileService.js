import { authStorage } from './api.js'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const fileService = {
  async getFiles() {
    const token = authStorage.getToken()
    const res = await fetch(`${API_BASE}/files`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to fetch files')
    }
    return res.json()
  },

  async uploadFile(file) {
    const token = authStorage.getToken()
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to upload file')
    }
    return res.json()
  },

  async deleteFile(id) {
    const token = authStorage.getToken()
    const res = await fetch(`${API_BASE}/files/${id}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to delete file')
    }
    return res.json()
  },

  getViewUrl(id) {
    const token = authStorage.getToken()
    return `${API_BASE}/files/${id}/view${token ? `?token=${encodeURIComponent(token)}` : ''}`
  },

  getDownloadUrl(id) {
    const token = authStorage.getToken()
    return `${API_BASE}/files/${id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`
  },
}
