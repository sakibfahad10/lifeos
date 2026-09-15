"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSmartEvent = parseSmartEvent;
exports.scheduleSmartEvent = scheduleSmartEvent;
exports.rescheduleMissedTask = rescheduleMissedTask;
exports.calendarBriefing = calendarBriefing;
exports.calendarAnalytics = calendarAnalytics;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const auth_js_1 = require("../middleware/auth.js");
const smart_calendar_js_1 = require("../services/smart-calendar.js");
const userId = (req) => (0, auth_js_1.getAuthUserId)(req);
const availabilitySchema = zod_1.z.object({ startHour: zod_1.z.number().int().min(0).max(23).optional(), endHour: zod_1.z.number().int().min(1).max(24).optional(), horizonDays: zod_1.z.number().int().min(1).max(31).optional() }).optional();
const smartSchema = zod_1.z.object({ text: zod_1.z.string().trim().min(2).max(1000), type: zod_1.z.enum(['TASK', 'EVENT']).default('TASK'), create: zod_1.z.boolean().default(false), availability: availabilitySchema });
async function itemsForWindow(id, to) {
    return prisma_js_1.prisma.calendarItem.findMany({ where: { userId: id, startAt: { lte: to }, OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }, orderBy: { startAt: 'asc' } });
}
async function parseSmartEvent(req, res, next) {
    try {
        return (0, api_response_js_1.sendData)(res, (0, smart_calendar_js_1.parseNaturalLanguage)(zod_1.z.object({ text: zod_1.z.string().trim().min(2).max(1000) }).parse(req.body).text));
    }
    catch (error) {
        return next(error);
    }
}
async function scheduleSmartEvent(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        const input = smartSchema.parse(req.body);
        const parsed = (0, smart_calendar_js_1.parseNaturalLanguage)(input.text);
        const horizon = input.availability?.horizonDays ?? 7;
        const until = new Date();
        until.setDate(until.getDate() + horizon);
        const items = await itemsForWindow(id, until);
        const sessions = /\b(\d+(?:\.\d+)?)\s*hours?\s+(?:of|for)\b/i.exec(input.text);
        const totalMinutes = sessions ? Math.round(Number(sessions[1]) * 60) : parsed.estimatedMinutes;
        const sessionMinutes = Math.min(totalMinutes, 120);
        const slots = parsed.startAt ? [{ startAt: new Date(parsed.startAt), endAt: new Date(new Date(parsed.startAt).getTime() + totalMinutes * 60000) }] : (0, smart_calendar_js_1.findFreeSlots)(items, sessionMinutes, Math.ceil(totalMinutes / sessionMinutes), input.availability);
        if (!slots.length)
            return (0, api_response_js_1.sendError)(res, 'NO_FREE_SLOT', 'No free time was found in the selected availability window.', 409);
        const conflicts = parsed.startAt && (0, smart_calendar_js_1.hasConflict)(items, slots[0].startAt, slots[0].endAt) ? items.filter(item => (0, smart_calendar_js_1.hasConflict)([item], slots[0].startAt, slots[0].endAt)) : [];
        if (conflicts.length) {
            const alternatives = (0, smart_calendar_js_1.findFreeSlots)(items, totalMinutes, 3, input.availability);
            return (0, api_response_js_1.sendData)(res, { parsed, conflicts: conflicts.map(item => ({ id: item.id, title: item.title, startAt: item.startAt, endAt: item.endAt })), alternatives, created: [] });
        }
        const proposal = slots.map((slot, index) => ({ title: slots.length > 1 ? `${parsed.title} (${index + 1}/${slots.length})` : parsed.title, startAt: slot.startAt, endAt: slot.endAt, estimatedMinutes: Math.round((slot.endAt.getTime() - slot.startAt.getTime()) / 60000), priority: parsed.priority, type: input.type }));
        if (!input.create)
            return (0, api_response_js_1.sendData)(res, { parsed, conflicts: [], alternatives: proposal, created: [] });
        const created = await prisma_js_1.prisma.$transaction(async (tx) => Promise.all(proposal.map((event, index) => tx.calendarItem.create({ data: { userId: id, ...event, type: event.type, priority: event.priority, recurrenceRule: index === 0 && parsed.recurrence ? { create: { frequency: parsed.recurrence.frequency, interval: parsed.recurrence.interval, daysOfWeek: parsed.recurrence.daysOfWeek, startDate: event.startAt, endDate: parsed.recurrence.endDate ? new Date(parsed.recurrence.endDate) : undefined } } : undefined } }))));
        return (0, api_response_js_1.sendData)(res, { parsed, conflicts: [], alternatives: proposal, created }, 201);
    }
    catch (error) {
        return next(error);
    }
}
async function rescheduleMissedTask(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        const task = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: String(req.params.id), userId: id, type: client_1.CalendarItemType.TASK } });
        if (!task)
            return (0, api_response_js_1.sendError)(res, 'TASK_NOT_FOUND', 'Task not found.', 404);
        if (task.status !== client_1.CalendarItemStatus.OVERDUE)
            return (0, api_response_js_1.sendError)(res, 'TASK_NOT_MISSED', 'Only missed tasks can be rescheduled automatically.', 422);
        const input = zod_1.z.object({ confirm: zod_1.z.boolean().default(false), availability: availabilitySchema }).parse(req.body);
        const until = new Date();
        until.setDate(until.getDate() + (input.availability?.horizonDays ?? 7));
        const items = await itemsForWindow(id, until);
        const slot = (0, smart_calendar_js_1.findFreeSlots)(items, task.estimatedMinutes || 60, 1, input.availability)[0];
        if (!slot)
            return (0, api_response_js_1.sendError)(res, 'NO_FREE_SLOT', 'No free time was found for this task.', 409);
        if (!input.confirm)
            return (0, api_response_js_1.sendData)(res, { taskId: task.id, suggestion: slot, moved: false });
        const updated = await prisma_js_1.prisma.calendarItem.update({ where: { id: task.id }, data: { startAt: slot.startAt, endAt: slot.endAt, status: client_1.CalendarItemStatus.PENDING } });
        return (0, api_response_js_1.sendData)(res, { task: updated, moved: true });
    }
    catch (error) {
        return next(error);
    }
}
async function calendarBriefing(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        const date = req.query.date ? new Date(String(req.query.date)) : new Date();
        if (Number.isNaN(date.getTime()))
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'date must be valid.', 400);
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const items = await prisma_js_1.prisma.calendarItem.findMany({ where: { userId: id, startAt: { gte: start, lt: end } }, orderBy: { startAt: 'asc' } });
        const conflicts = items.filter((item, index) => items.slice(index + 1).some(other => (0, smart_calendar_js_1.hasConflict)([other], item.startAt, item.endAt || new Date(item.startAt.getTime() + (item.estimatedMinutes || 60) * 60000), item.id))).map(item => item.id);
        const highPriority = items.filter(item => item.priority === client_1.Priority.HIGH && item.status !== client_1.CalendarItemStatus.COMPLETED);
        return (0, api_response_js_1.sendData)(res, { date: start, events: items, highPriority, conflictItemIds: conflicts, summary: `${items.length} scheduled item${items.length === 1 ? '' : 's'}, ${highPriority.length} high priority, ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}.` });
    }
    catch (error) {
        return next(error);
    }
}
async function calendarAnalytics(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        const items = await prisma_js_1.prisma.calendarItem.findMany({ where: { userId: id, startAt: { gte: start, lt: end } } });
        const minutes = (predicate) => items.filter(predicate).reduce((sum, item) => sum + (item.estimatedMinutes || (item.endAt ? Math.max(1, Math.round((item.endAt.getTime() - item.startAt.getTime()) / 60000)) : 60)), 0);
        const scheduled = minutes(() => true);
        const weekMinutes = 7 * 24 * 60;
        return (0, api_response_js_1.sendData)(res, { range: { start, end }, studyMinutes: minutes(item => item.category?.toLowerCase() === 'study'), workMinutes: minutes(item => item.category?.toLowerCase() === 'work'), meetingMinutes: minutes(item => /meeting/i.test(item.title) || item.category?.toLowerCase() === 'meeting'), completedTasks: items.filter(item => item.type === client_1.CalendarItemType.TASK && item.status === client_1.CalendarItemStatus.COMPLETED).length, totalTasks: items.filter(item => item.type === client_1.CalendarItemType.TASK).length, freeMinutes: Math.max(0, weekMinutes - scheduled) });
    }
    catch (error) {
        return next(error);
    }
}
