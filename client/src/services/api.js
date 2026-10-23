const API_BASE = import.meta.env.VITE_API_URL || '/api'

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
  const config = {
    headers: {
      'Content-Type': 'application/json',
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
    const errorMsg = data?.error || response.statusText || 'Request failed'
    throw new Error(errorMsg)
  }

  return data
}
