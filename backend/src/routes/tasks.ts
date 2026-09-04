import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { createTask, deleteTask, getTask, listTasks, updateTask, updateTaskStatus } from '../controllers/tasks.js'

export const tasksRouter = Router()
tasksRouter.use(requireAuth)

tasksRouter.get('/', listTasks)
tasksRouter.post('/', createTask)
tasksRouter.get('/:id', getTask)
tasksRouter.patch('/:id', updateTask)
tasksRouter.delete('/:id', deleteTask)
tasksRouter.patch('/:id/status', updateTaskStatus)
