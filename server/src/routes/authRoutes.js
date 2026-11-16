import express from 'express'
import { login, verify } from '../controllers/authController.js'

const router = express.Router()

// POST /api/auth/login
router.post('/login', login)

// GET /api/auth/verify  — lightweight token check (used on page load)
router.get('/verify', verify)

export default router

