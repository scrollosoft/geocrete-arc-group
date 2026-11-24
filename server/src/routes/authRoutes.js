import express from 'express'
import { login, verify, changePassword, updateManagerPassword } from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = express.Router()

// POST /api/auth/login
router.post('/login', login)

// GET /api/auth/verify  — lightweight token check (used on page load)
router.get('/verify', verify)

// POST /api/auth/change-password  — protected password update (Admin only)
router.post('/change-password', requireAuth, changePassword)

// POST /api/auth/update-manager-password  — Admin only: update manager password
router.post('/update-manager-password', requireAuth, updateManagerPassword)

export default router

