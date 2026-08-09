"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTasks = listTasks;
exports.updateTaskStatus = updateTaskStatus;
exports.createTask = createTask;
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const defaultUserId = process.env.DEV_USER_ID;
function getUserId(req) { return (req.header('x-user-id') || defaultUserId || '').trim(); }
async function listTasks(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const tasks = await prisma_js_1.prisma.calendarItem.findMany({ where: { userId: id, type: client_1.CalendarItemType.TASK }, orderBy: [{ status: 'asc' }, { startAt: 'asc' }], take: 250 });
        return (0, api_response_js_1.sendData)(res, tasks);
    }
    catch (error) {
        return next(error);
    }
}
async function updateTaskStatus(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        if (!Object.values(client_1.CalendarItemStatus).includes(req.body?.status))
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'A valid task status is required.', 400);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: typeof req.params.id === 'string' ? req.params.id : '', userId: id, type: client_1.CalendarItemType.TASK } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Task not found.', 404);
        const task = await prisma_js_1.prisma.calendarItem.update({ where: { id: existing.id }, data: { status: req.body.status } });
        return (0, api_response_js_1.sendData)(res, task);
    }
    catch (error) {
        return next(error);
    }
}
async function createTask(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401);
        const { title, startAt, priority, category, description } = req.body ?? {};
        if (typeof title !== 'string' || !title.trim())
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'title is required.', 400);
        const date = typeof startAt === 'string' && !Number.isNaN(Date.parse(startAt)) ? new Date(startAt) : new Date();
        const task = await prisma_js_1.prisma.calendarItem.create({ data: { userId: id, title: title.trim(), type: client_1.CalendarItemType.TASK, startAt: date, priority: Object.values(client_1.Priority).includes(priority) ? priority : client_1.Priority.MEDIUM, category: typeof category === 'string' ? category.trim() : undefined, description: typeof description === 'string' ? description.trim() : undefined } });
        return (0, api_response_js_1.sendData)(res, task, 201);
    }
    catch (error) {
        return next(error);
    }
}
