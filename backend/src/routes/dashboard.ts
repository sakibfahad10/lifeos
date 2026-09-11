import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getDashboardSummary } from '../controllers/dashboard.js'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

dashboardRouter.get('/summary', getDashboardSummary)
