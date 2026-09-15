"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const calendar_js_1 = require("../controllers/calendar.js");
const smart_calendar_js_1 = require("../controllers/smart-calendar.js");
exports.calendarRouter = (0, express_1.Router)();
exports.calendarRouter.use(auth_js_1.requireAuth);
// Smart routes (must be before /:id to avoid param capture)
exports.calendarRouter.post('/smart/parse', smart_calendar_js_1.parseSmartEvent);
exports.calendarRouter.post('/smart/schedule', smart_calendar_js_1.scheduleSmartEvent);
exports.calendarRouter.get('/smart/briefing', smart_calendar_js_1.calendarBriefing);
exports.calendarRouter.get('/smart/analytics', smart_calendar_js_1.calendarAnalytics);
// CRUD
exports.calendarRouter.get('/', calendar_js_1.listCalendarItems);
exports.calendarRouter.post('/', calendar_js_1.createCalendarItem);
exports.calendarRouter.get('/:id', calendar_js_1.getCalendarItem);
exports.calendarRouter.patch('/:id', calendar_js_1.updateCalendarItem);
exports.calendarRouter.delete('/:id', calendar_js_1.deleteCalendarItem);
// Sub-resource actions
exports.calendarRouter.patch('/:id/status', calendar_js_1.updateCalendarItemStatus);
exports.calendarRouter.post('/:id/duplicate', calendar_js_1.duplicateCalendarItem);
exports.calendarRouter.patch('/:id/recurrence', calendar_js_1.updateRecurrenceRule);
exports.calendarRouter.post('/:id/reminders', calendar_js_1.addReminder);
exports.calendarRouter.delete('/:id/reminders/:reminderId', calendar_js_1.removeReminder);
// Reschedule (smart)
exports.calendarRouter.post('/:id/reschedule', smart_calendar_js_1.rescheduleMissedTask);
