import cors from 'cors'
import express from 'express'
import { healthController } from './controllers/health.js'
import { errorHandler } from './middleware/error-handler.js'
import { apiRouter } from './routes/index.js'
import { sendError } from './utils/api-response.js'

export const app = express()

app.disable('x-powered-by')
app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/v1/health', healthController)
app.use('/api/v1', apiRouter)

app.use((_req, res) => sendError(res, 'NOT_FOUND', 'Route not found', 404))
app.use(errorHandler)
