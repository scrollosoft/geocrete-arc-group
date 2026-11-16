const API_BASE = import.meta.env.VITE_API_URL || '/api'

const TOKEN_KEY = 'geocrete_auth_token'

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  removeToken: () => localStorage.removeItem(TOKEN_KEY),
}

// Retry fetch up to `retries` times with exponential backoff for network errors
async function fetchWithRetry(url, config, retries = 3, delayMs = 800) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, config)
    } catch (networkErr) {
      // Only retry on network-level errors (ECONNRESET, Failed to fetch, etc.)
      // Do NOT retry on HTTP errors (4xx/5xx) — those are handled below
      if (attempt === retries) throw networkErr
      console.warn(
        `[api] Network error on attempt ${attempt}/${retries} – retrying in ${delayMs}ms…`,
        networkErr.message,
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
    }
  }
}

export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const token = authStorage.getToken()
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  }

  const response = await fetchWithRetry(url, config)
  const contentType = response.headers.get('content-type')
  const data = contentType && contentType.includes('application/json')
    ? await response.json()
    : null

  if (!response.ok) {
    // If 401, token expired — clear it so the app re-shows login
    if (response.status === 401) {
      authStorage.removeToken()
      window.dispatchEvent(new CustomEvent('auth:logout'))
    }
    const errorMsg = data?.error || response.statusText || 'Request failed'
    throw new Error(errorMsg)
  }

  return data
}
