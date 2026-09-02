import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  addReminder,
  createCalendarItem,
  deleteCalendarItem,
  duplicateCalendarItem,
  getCalendarItem,
  listCalendarItems,
  removeReminder,
  updateCalendarItem,
  updateCalendarItemStatus,
  updateRecurrenceRule,
} from '../controllers/calendar.js'
import { calendarAnalytics, calendarBriefing, parseSmartEvent, rescheduleMissedTask, scheduleSmartEvent } from '../controllers/smart-calendar.js'

export const calendarRouter = Router()
calendarRouter.use(requireAuth)

// Smart routes (must be before /:id to avoid param capture)
calendarRouter.post('/smart/parse', parseSmartEvent)
calendarRouter.post('/smart/schedule', scheduleSmartEvent)
calendarRouter.get('/smart/briefing', calendarBriefing)
calendarRouter.get('/smart/analytics', calendarAnalytics)

// CRUD
calendarRouter.get('/', listCalendarItems)
calendarRouter.post('/', createCalendarItem)
calendarRouter.get('/:id', getCalendarItem)
calendarRouter.patch('/:id', updateCalendarItem)
calendarRouter.delete('/:id', deleteCalendarItem)

// Sub-resource actions
calendarRouter.patch('/:id/status', updateCalendarItemStatus)
calendarRouter.post('/:id/duplicate', duplicateCalendarItem)
calendarRouter.patch('/:id/recurrence', updateRecurrenceRule)
calendarRouter.post('/:id/reminders', addReminder)
calendarRouter.delete('/:id/reminders/:reminderId', removeReminder)

// Reschedule (smart)
calendarRouter.post('/:id/reschedule', rescheduleMissedTask)
