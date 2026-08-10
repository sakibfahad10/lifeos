import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { createCalendarItem, deleteCalendarItem, listCalendarItems, updateCalendarItem } from '../controllers/calendar.js'

export const calendarRouter = Router()
calendarRouter.use(requireAuth)
calendarRouter.get('/', listCalendarItems)
calendarRouter.post('/', createCalendarItem)
calendarRouter.patch('/:id', updateCalendarItem)
calendarRouter.delete('/:id', deleteCalendarItem)
