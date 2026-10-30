import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectDB } from './config/db.js'
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

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'geocrete-arc-group-api',
    database: 'mysql',
  })
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
    await ensureSchema()
    // Safe auto-seed if empty
    await seedDatabase(false)
    // Legacy startup tasks commented out to preserve individual purchase transactions and stock
    // await Material.backfillUnappliedMaterialExpenses()
    // await Material.consolidateAllDuplicates()
    // await Material.syncUsedQuantityFromExpenses()

    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Failed to start server due to database error:', error.message)
    process.exit(1)
  }
}

startServer()
