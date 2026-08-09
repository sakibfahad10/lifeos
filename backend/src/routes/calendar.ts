import { Router } from 'express'
import { createCalendarItem, deleteCalendarItem, listCalendarItems, updateCalendarItem } from '../controllers/calendar.js'

export const calendarRouter = Router()
calendarRouter.get('/', listCalendarItems)
calendarRouter.post('/', createCalendarItem)
calendarRouter.patch('/:id', updateCalendarItem)
calendarRouter.delete('/:id', deleteCalendarItem)
