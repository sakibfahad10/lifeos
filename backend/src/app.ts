import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { healthController } from './controllers/health.js'
import { errorHandler } from './middleware/error-handler.js'
import { generalLimiter } from './middleware/rate-limit.js'
import { securityHeaders } from './middleware/security.js'
import { apiRouter } from './routes/index.js'
import { sendError } from './utils/api-response.js'

export const app = express()

app.disable('x-powered-by')

// Apply OWASP security headers
app.use(securityHeaders)

// Safe CORS: never default to "allow all origins" — require an explicit env var.
// Falls back to localhost:3000 only (not true/wildcard).
const rawOrigins = process.env.CORS_ORIGIN || process.env.FRONTEND_URL
const allowedOrigins: string[] | string = rawOrigins
  ? rawOrigins.split(',').map(v => v.trim()).filter(Boolean)
  : 'http://localhost:3000'

app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(cookieParser())
// General routes: 1 MB JSON limit. AI import uses up to 15 MB for file uploads (handled in its own route).
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Health check endpoint (exempt from rate limits)
app.get('/api/v1/health', healthController)

// API routes with general rate limiter
app.use('/api/v1', generalLimiter, apiRouter)

app.use((_req, res) => sendError(res, 'NOT_FOUND', 'Route not found', 404))
app.use(errorHandler)

export default app
