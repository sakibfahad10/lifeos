import { Router } from 'express'
import { calendarRouter } from './calendar.js'
import { tasksRouter } from './tasks.js'
import { sendData } from '../utils/api-response.js'

export const apiRouter = Router()
apiRouter.use('/calendar', calendarRouter)
apiRouter.use('/tasks', tasksRouter)

for (const moduleName of ['auth', 'users', 'notifications', 'ai']) {
  apiRouter.use(`/${moduleName}`, Router().get('/', (_req, res) =>
    sendData(res, { module: moduleName, status: 'not_implemented' }),
  ))
}
