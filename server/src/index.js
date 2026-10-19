import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 5000
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const isProduction = process.env.NODE_ENV === 'production'
const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist',
)

app.use(cors({ origin: clientOrigin }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'geocrete-arc-group-api',
  })
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

if (isProduction) {
  app.use(express.static(clientDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      next()
      return
    }

    res.sendFile(path.join(clientDist, 'index.html'), (error) => {
      if (error) next(error)
    })
  })
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
