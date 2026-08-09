"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCalendarItems = listCalendarItems;
exports.createCalendarItem = createCalendarItem;
exports.updateCalendarItem = updateCalendarItem;
exports.deleteCalendarItem = deleteCalendarItem;
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const defaultUserId = process.env.DEV_USER_ID;
function userId(req) {
    return (req.header('x-user-id') || defaultUserId || '').trim();
}
function routeId(req) {
    return typeof req.params.id === 'string' ? req.params.id : '';
}
function parseDate(value) {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        return undefined;
    return new Date(value);
}
async function listCalendarItems(req, res, next) {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const from = parseDate(req.query.from);
        const to = parseDate(req.query.to);
        const items = await prisma_js_1.prisma.calendarItem.findMany({
            where: { userId: id, ...(from || to ? { startAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
            orderBy: { startAt: 'asc' },
            take: Math.min(Math.max(Number(req.query.limit) || 100, 1), 250),
        });
        return (0, api_response_js_1.sendData)(res, items);
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
        const { title, startAt, endAt, description, type, priority, category, location, allDay } = req.body ?? {};
        const parsedStart = parseDate(startAt);
        if (typeof title !== 'string' || !title.trim() || !parsedStart)
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'title and a valid startAt are required.', 400);
        const item = await prisma_js_1.prisma.calendarItem.create({ data: {
                userId: id, title: title.trim(), startAt: parsedStart, endAt: parseDate(endAt),
                description: typeof description === 'string' ? description.trim() : undefined,
                type: Object.values(client_1.CalendarItemType).includes(type) ? type : client_1.CalendarItemType.EVENT,
                priority: Object.values(client_1.Priority).includes(priority) ? priority : client_1.Priority.MEDIUM,
                category: typeof category === 'string' ? category.trim() : undefined,
                location: typeof location === 'string' ? location.trim() : undefined,
                allDay: Boolean(allDay),
            } });
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
        const item = await prisma_js_1.prisma.calendarItem.update({ where: { id: existing.id }, data: {
                ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
                ...(body.startAt ? { startAt: parseDate(body.startAt) } : {}),
                ...(body.endAt ? { endAt: parseDate(body.endAt) } : {}),
                ...(Object.values(client_1.CalendarItemStatus).includes(body.status) ? { status: body.status } : {}),
                ...(Object.values(client_1.Priority).includes(body.priority) ? { priority: body.priority } : {}),
                ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
            } });
        return (0, api_response_js_1.sendData)(res, item);
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
