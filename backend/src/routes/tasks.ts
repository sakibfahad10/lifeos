import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { createTask, listTasks, updateTaskStatus } from '../controllers/tasks.js'

export const tasksRouter = Router()
tasksRouter.use(requireAuth)
tasksRouter.get('/', listTasks)
tasksRouter.post('/', createTask)
tasksRouter.patch('/:id/status', updateTaskStatus)
