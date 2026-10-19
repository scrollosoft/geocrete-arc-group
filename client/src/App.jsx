import { useEffect, useState } from 'react'
import './App.css'

export default function App() {
  const [apiState, setApiState] = useState('checking')

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        return response.json()
      })
      .then((body) => {
        setApiState(body.ok ? 'connected' : 'offline')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setApiState('offline')
      })

    return () => controller.abort()
  }, [])

  return (
    <main>
      <p className="eyebrow">GeoCrete ARC Group</p>
      <h1>React and Node starter</h1>
      <p className="lead">
        The Vite app is running. The Express API status is shown below.
      </p>
      <p className={`status status-${apiState}`}>
        API {apiState === 'checking' ? 'checking…' : apiState}
      </p>
    </main>
  )
}
