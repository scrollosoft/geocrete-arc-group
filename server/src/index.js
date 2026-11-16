import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyBaseSchema } from './config/applySchema.js'
import { connectDB, getPool } from './config/db.js'
import { ensureSchema } from './ensureSchema.js'
import { errorHandler } from './middleware/errorHandler.js'
import { seedDatabase } from './seed.js'

import bankAccountRoutes from './routes/bankAccountRoutes.js'
import siteRoutes from './routes/siteRoutes.js'
import supplierRoutes from './routes/supplierRoutes.js'
import expenseRoutes from './routes/expenseRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import labourRoutes from './routes/labourRoutes.js'
import materialRoutes from './routes/materialRoutes.js'
import siteOwnerRoutes from './routes/siteOwnerRoutes.js'
import settingRoutes from './routes/settingRoutes.js'
import workerPaymentRoutes from './routes/workerPaymentRoutes.js'
import consultingRoutes from './routes/consultingRoutes.js'
import otherTransactionRoutes from './routes/otherTransactionRoutes.js'
import cashRoutes from './routes/cashRoutes.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 5000
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist',
)
const allowedOrigins = new Set([
  clientOrigin,
  'http://localhost:5173',
  'https://geocretearchgroup.in',
  'https://www.geocretearchgroup.in',
])

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
  }),
)
app.use(express.json())

app.get('/api/health', async (_req, res) => {
  try {
    await getPool().query('SELECT 1')
    res.json({
      ok: true,
      service: 'geocrete-arc-group-api',
      database: 'connected',
    })
  } catch {
    res.status(503).json({
      ok: false,
      service: 'geocrete-arc-group-api',
      database: 'disconnected',
    })
  }
})

// Application API routes
app.use('/api/bank-accounts', bankAccountRoutes)
app.use('/api/sites', siteRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/labour', labourRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api/site-owners', siteOwnerRoutes)
app.use('/api/settings', settingRoutes)
app.use('/api/worker-payments', workerPaymentRoutes)
app.use('/api/consulting', consultingRoutes)
app.use('/api/other-transactions', otherTransactionRoutes)
app.use('/api/cash', cashRoutes)

const clientIndex = path.join(clientDist, 'index.html')
if (fs.existsSync(clientIndex)) {
  app.use(express.static(clientDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next()
      return
    }

    res.sendFile(clientIndex, (error) => {
      if (error) next(error)
    })
  })
}

// 404 handler for API routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Centralized error handler
app.use(errorHandler)

// Connect to MySQL (XAMPP) and start server
const startServer = async () => {
  try {
    await connectDB()
    await applyBaseSchema()
    await ensureSchema()
    // Sample records are for a local empty database only.
    if (process.env.SEED_DATABASE === 'true' || !process.env.DB_HOST) {
      await seedDatabase(false)
    }
    // Legacy startup tasks commented out to preserve individual purchase transactions and stock
    // await Material.backfillUnappliedMaterialExpenses()
    // await Material.consolidateAllDuplicates()
    // await Material.syncUsedQuantityFromExpenses()

    app.listen(port, '0.0.0.0', () => {
      console.log(`API listening on http://0.0.0.0:${port}`)
    })
  } catch (error) {
    console.error('Failed to start server due to database error:', error.message)
    process.exit(1)
  }
}

startServer()
