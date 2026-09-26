import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  applyPreset,
  createAlert,
  deleteAlert,
  getAlert,
  listAlerts,
  testDelivery,
  triggerAlertProcess,
  updateAlert,
} from '../controllers/alerts.js'

export const alertsRouter = Router()
alertsRouter.use(requireAuth)

alertsRouter.get('/', listAlerts)
alertsRouter.post('/', createAlert)
alertsRouter.get('/:id', getAlert)
alertsRouter.patch('/:id', updateAlert)
alertsRouter.delete('/:id', deleteAlert)

// Operational and preset endpoints
alertsRouter.post('/preset', applyPreset)
alertsRouter.post('/process', triggerAlertProcess)
alertsRouter.post('/test-delivery', testDelivery)
