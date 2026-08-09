import { Router } from 'express'
import { sendData } from '../utils/api-response.js'

const modules = ['auth', 'users', 'calendar', 'tasks', 'notifications', 'ai'] as const

export const apiRouter = Router()

for (const moduleName of modules) {
  apiRouter.use(`/${moduleName}`, Router().get('/', (_req, res) =>
    sendData(res, { module: moduleName, status: 'not_implemented' }),
  ))
}
