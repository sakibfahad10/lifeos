import express from 'express'

export const app = express()
app.use(express.json())
app.get('/api/v1/health', (_req, res) => res.json({ data: { status: 'ok', service: 'lifeos-api' }, error: null }))
app.use((_req, res) => res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Route not found' } }))
