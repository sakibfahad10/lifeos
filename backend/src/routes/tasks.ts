import { Router } from 'express'
import { createTask, listTasks, updateTaskStatus } from '../controllers/tasks.js'

export const tasksRouter = Router()
tasksRouter.get('/', listTasks)
tasksRouter.post('/', createTask)
tasksRouter.patch('/:id/status', updateTaskStatus)
