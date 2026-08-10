import { Router } from 'express'
import { calendarRouter } from './calendar.js'
import { tasksRouter } from './tasks.js'
import { aiRouter } from './ai.js'
import { notificationsRouter } from './notifications.js'
import { authRouter } from './auth.js'
import { usersRouter } from './users.js'

export const apiRouter = Router()
apiRouter.use('/auth', authRouter)
apiRouter.use('/calendar', calendarRouter)
apiRouter.use('/tasks', tasksRouter)
apiRouter.use('/ai', aiRouter)
apiRouter.use('/notifications', notificationsRouter)
apiRouter.use('/users', usersRouter)
