"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCalendarItems = listCalendarItems;
exports.getCalendarItem = getCalendarItem;
exports.createCalendarItem = createCalendarItem;
exports.updateCalendarItem = updateCalendarItem;
exports.updateCalendarItemStatus = updateCalendarItemStatus;
exports.duplicateCalendarItem = duplicateCalendarItem;
exports.deleteCalendarItem = deleteCalendarItem;
exports.updateRecurrenceRule = updateRecurrenceRule;
exports.addReminder = addReminder;
exports.removeReminder = removeReminder;
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const auth_js_1 = require("../middleware/auth.js");
function userId(req) {
    return (0, auth_js_1.getAuthUserId)(req);
}
function routeId(req) {
    return typeof req.params.id === 'string' ? req.params.id : '';
}
function parseDate(value) {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        return undefined;
    return new Date(value);
}
const itemInclude = {
    recurrenceRule: true,
    reminders: { orderBy: { offsetMinutes: 'asc' } },
};
async function listCalendarItems(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const from = parseDate(req.query.from || req.query.startDate);
        const to = parseDate(req.query.to || req.query.endDate);
        const { status, type, category, priority } = req.query;
        const searchTerm = String(req.query.q || req.query.search || '').trim();
        const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'startAt';
        const sortOrder = String(req.query.sortOrder || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
        const validSort = ['startAt', 'priority', 'status', 'createdAt', 'title'];
        const finalSort = validSort.includes(sortBy) ? sortBy : 'startAt';
        const items = await prisma_js_1.prisma.calendarItem.findMany({
            where: {
                userId: id,
                ...(from || to
                    ? {
                        OR: [
                            { startAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
                            { recurrenceRule: { isNot: null } },
                        ],
                    }
                    : {}),
                ...(Object.values(client_1.CalendarItemStatus).includes(status) ? { status: status } : {}),
                ...(Object.values(client_1.CalendarItemType).includes(type) ? { type: type } : {}),
                ...(Object.values(client_1.Priority).includes(priority) ? { priority: priority } : {}),
                ...(typeof category === 'string' && category ? { category: { contains: category, mode: 'insensitive' } } : {}),
                ...(searchTerm
                    ? {
                        OR: [
                            { title: { contains: searchTerm, mode: 'insensitive' } },
                            { description: { contains: searchTerm, mode: 'insensitive' } },
                            { location: { contains: searchTerm, mode: 'insensitive' } },
                            { notes: { contains: searchTerm, mode: 'insensitive' } },
                            { category: { contains: searchTerm, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            orderBy: [{ [finalSort]: sortOrder }, { id: 'asc' }],
            take: Math.min(Math.max(Number(req.query.limit) || 100, 1), 250),
            include: itemInclude,
        });
        return (0, api_response_js_1.sendData)(res, items);
    }
    catch (error) {
        return next(error);
    }
}
async function getCalendarItem(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const item = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id }, include: itemInclude });
        return item ? (0, api_response_js_1.sendData)(res, item) : (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Calendar item not found.', 404);
    }
    catch (error) {
        return next(error);
    }
}
async function createCalendarItem(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const { title, startAt, endAt, description, type, priority, category, location, allDay, estimatedMinutes, notes } = req.body ?? {};
        const parsedStart = parseDate(startAt);
        const parsedEnd = parseDate(endAt);
        if (typeof title !== 'string' || !title.trim() || !parsedStart)
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'title and a valid startAt are required.', 400);
        if (parsedEnd && parsedEnd <= parsedStart)
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'endAt must be after startAt.', 400);
        const item = await prisma_js_1.prisma.calendarItem.create({
            data: {
                userId: id, title: title.trim(), startAt: parsedStart, endAt: parsedEnd,
                description: typeof description === 'string' ? description.trim() : undefined,
                notes: typeof notes === 'string' ? notes.trim() : undefined,
                type: Object.values(client_1.CalendarItemType).includes(type) ? type : client_1.CalendarItemType.EVENT,
                priority: Object.values(client_1.Priority).includes(priority) ? priority : client_1.Priority.MEDIUM,
                category: typeof category === 'string' ? category.trim() : undefined,
                location: typeof location === 'string' ? location.trim() : undefined,
                allDay: Boolean(allDay),
                estimatedMinutes: Number.isInteger(estimatedMinutes) && estimatedMinutes > 0 && estimatedMinutes <= 1440 ? estimatedMinutes : undefined,
            },
            include: itemInclude,
        });
        return (0, api_response_js_1.sendData)(res, item, 201);
    }
    catch (error) {
        return next(error);
    }
}
async function updateCalendarItem(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Calendar item not found.', 404);
        const body = req.body ?? {};
        const parsedStart = body.startAt ? parseDate(body.startAt) : undefined;
        const parsedEnd = body.endAt !== undefined ? (body.endAt ? parseDate(body.endAt) : null) : undefined;
        const effectiveStart = parsedStart ?? existing.startAt;
        const effectiveEnd = parsedEnd !== undefined ? parsedEnd : existing.endAt;
        if (effectiveEnd && effectiveEnd <= effectiveStart)
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'endAt must be after startAt.', 400);
        const item = await prisma_js_1.prisma.calendarItem.update({
            where: { id: existing.id },
            data: {
                ...(typeof body.title === 'string' && body.title.trim() ? { title: body.title.trim() } : {}),
                ...(parsedStart ? { startAt: parsedStart } : {}),
                ...(parsedEnd !== undefined ? { endAt: parsedEnd } : {}),
                ...(Object.values(client_1.CalendarItemStatus).includes(body.status) ? { status: body.status } : {}),
                ...(Object.values(client_1.Priority).includes(body.priority) ? { priority: body.priority } : {}),
                ...(Object.values(client_1.CalendarItemType).includes(body.type) ? { type: body.type } : {}),
                ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
                ...(typeof body.notes === 'string' ? { notes: body.notes.trim() } : {}),
                ...(typeof body.category === 'string' ? { category: body.category.trim() || null } : {}),
                ...(typeof body.location === 'string' ? { location: body.location.trim() || null } : {}),
                ...(typeof body.allDay === 'boolean' ? { allDay: body.allDay } : {}),
                ...(body.estimatedMinutes !== undefined
                    ? { estimatedMinutes: Number.isInteger(body.estimatedMinutes) && body.estimatedMinutes > 0 ? body.estimatedMinutes : null }
                    : {}),
            },
            include: itemInclude,
        });
        return (0, api_response_js_1.sendData)(res, item);
    }
    catch (error) {
        return next(error);
    }
}
async function updateCalendarItemStatus(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const { status } = req.body ?? {};
        if (!Object.values(client_1.CalendarItemStatus).includes(status))
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', `status must be one of: ${Object.values(client_1.CalendarItemStatus).join(', ')}.`, 400);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Calendar item not found.', 404);
        const item = await prisma_js_1.prisma.calendarItem.update({ where: { id: existing.id }, data: { status }, include: itemInclude });
        return (0, api_response_js_1.sendData)(res, item);
    }
    catch (error) {
        return next(error);
    }
}
async function duplicateCalendarItem(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const source = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id }, include: { recurrenceRule: true, reminders: true } });
        if (!source)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Calendar item not found.', 404);
        const { id: _id, createdAt: _ca, updatedAt: _ua, recurrenceRule, reminders, ...rest } = source;
        const copy = await prisma_js_1.prisma.calendarItem.create({
            data: {
                ...rest,
                title: `${source.title} (copy)`,
                status: client_1.CalendarItemStatus.PENDING,
                ...(recurrenceRule ? {
                    recurrenceRule: {
                        create: {
                            frequency: recurrenceRule.frequency,
                            interval: recurrenceRule.interval,
                            daysOfWeek: recurrenceRule.daysOfWeek,
                            dayOfMonth: recurrenceRule.dayOfMonth ?? undefined,
                            startDate: recurrenceRule.startDate,
                            endDate: recurrenceRule.endDate ?? undefined,
                            timezone: recurrenceRule.timezone,
                        },
                    },
                } : {}),
                ...(reminders.length ? {
                    reminders: {
                        create: reminders.map(r => ({ userId: id, offsetMinutes: r.offsetMinutes, enabled: r.enabled })),
                    },
                } : {}),
            },
            include: itemInclude,
        });
        return (0, api_response_js_1.sendData)(res, copy, 201);
    }
    catch (error) {
        return next(error);
    }
}
async function deleteCalendarItem(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Calendar item not found.', 404);
        await prisma_js_1.prisma.calendarItem.delete({ where: { id: existing.id } });
        return (0, api_response_js_1.sendData)(res, { deleted: true });
    }
    catch (error) {
        return next(error);
    }
}
async function updateRecurrenceRule(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Calendar item not found.', 404);
        const { frequency, interval, daysOfWeek, dayOfMonth, startDate, endDate, timezone, remove } = req.body ?? {};
        if (remove) {
            await prisma_js_1.prisma.recurrenceRule.deleteMany({ where: { calendarItemId: existing.id } });
            return (0, api_response_js_1.sendData)(res, { removed: true });
        }
        const validFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'];
        if (!validFrequencies.includes(frequency))
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', `frequency must be one of: ${validFrequencies.join(', ')}.`, 400);
        // Validate daysOfWeek to be integers 0–6 (Sun–Sat)
        const sanitizedDaysOfWeek = Array.isArray(daysOfWeek)
            ? daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
            : [];
        const parsedStart = parseDate(startDate) ?? existing.startAt;
        const rule = await prisma_js_1.prisma.recurrenceRule.upsert({
            where: { calendarItemId: existing.id },
            create: {
                calendarItemId: existing.id, frequency, interval: interval ?? 1,
                daysOfWeek: sanitizedDaysOfWeek,
                dayOfMonth: typeof dayOfMonth === 'number' ? dayOfMonth : undefined,
                startDate: parsedStart, endDate: parseDate(endDate),
                timezone: typeof timezone === 'string' ? timezone : 'UTC',
            },
            update: {
                frequency, interval: interval ?? 1,
                daysOfWeek: sanitizedDaysOfWeek,
                dayOfMonth: typeof dayOfMonth === 'number' ? dayOfMonth : undefined,
                startDate: parsedStart, endDate: parseDate(endDate),
                timezone: typeof timezone === 'string' ? timezone : 'UTC',
            },
        });
        return (0, api_response_js_1.sendData)(res, rule);
    }
    catch (error) {
        return next(error);
    }
}
async function addReminder(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Calendar item not found.', 404);
        const { offsetMinutes } = req.body ?? {};
        if (!Number.isInteger(offsetMinutes) || offsetMinutes < 0 || offsetMinutes > 10080)
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'offsetMinutes must be 0–10080.', 400);
        const reminder = await prisma_js_1.prisma.reminder.create({
            data: { userId: id, calendarItemId: existing.id, offsetMinutes },
        });
        return (0, api_response_js_1.sendData)(res, reminder, 201);
    }
    catch (error) {
        return next(error);
    }
}
async function removeReminder(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const reminderId = typeof req.params.reminderId === 'string' ? req.params.reminderId : '';
        const deleted = await prisma_js_1.prisma.reminder.deleteMany({ where: { id: reminderId, userId: id } });
        return deleted.count ? (0, api_response_js_1.sendData)(res, { deleted: true }) : (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Reminder not found.', 404);
    }
    catch (error) {
        return next(error);
    }
}
