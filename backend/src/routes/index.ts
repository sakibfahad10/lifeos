import { Router } from 'express'
import { calendarRouter } from './calendar.js'
import { tasksRouter } from './tasks.js'
import { aiRouter } from './ai.js'
import { notificationsRouter } from './notifications.js'
import { sendData } from '../utils/api-response.js'

export const apiRouter = Router()
apiRouter.use('/calendar', calendarRouter)
apiRouter.use('/tasks', tasksRouter)
apiRouter.use('/ai', aiRouter)
apiRouter.use('/notifications', notificationsRouter)
for (const moduleName of ['auth', 'users']) apiRouter.use(`/${moduleName}`, Router().get('/', (_req, res) => sendData(res, { module: moduleName, status: 'not_implemented' })))
