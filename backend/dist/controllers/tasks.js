"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTasks = listTasks;
exports.getTask = getTask;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.updateTaskStatus = updateTaskStatus;
exports.deleteTask = deleteTask;
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const auth_js_1 = require("../middleware/auth.js");
function getUserId(req) { return (0, auth_js_1.getAuthUserId)(req); }
async function listTasks(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401);
        const { q, search, status, priority, category, sortBy = 'startAt', sortOrder = 'asc', limit = '100', page = '1', } = req.query;
        const searchTerm = (q || search || '').trim();
        const where = {
            userId: id,
            type: client_1.CalendarItemType.TASK,
            ...(status && Object.values(client_1.CalendarItemStatus).includes(status) ? { status: status } : {}),
            ...(priority && Object.values(client_1.Priority).includes(priority) ? { priority: priority } : {}),
            ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
            ...(searchTerm
                ? {
                    OR: [
                        { title: { contains: searchTerm, mode: 'insensitive' } },
                        { description: { contains: searchTerm, mode: 'insensitive' } },
                        { category: { contains: searchTerm, mode: 'insensitive' } },
                        { notes: { contains: searchTerm, mode: 'insensitive' } },
                        { location: { contains: searchTerm, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const validSortFields = ['startAt', 'priority', 'status', 'createdAt', 'title'];
        const orderField = validSortFields.includes(sortBy) ? sortBy : 'startAt';
        const orderDirection = sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc';
        const take = Math.min(Math.max(parseInt(limit) || 50, 1), 250);
        const skip = Math.max((parseInt(page) || 1) - 1, 0) * take;
        const [tasks, total] = await Promise.all([
            prisma_js_1.prisma.calendarItem.findMany({
                where,
                orderBy: [{ [orderField]: orderDirection }, { id: 'asc' }],
                take,
                skip,
            }),
            prisma_js_1.prisma.calendarItem.count({ where }),
        ]);
        return (0, api_response_js_1.sendData)(res, {
            items: tasks,
            total,
            page: parseInt(page) || 1,
            limit: take,
        });
    }
    catch (error) {
        return next(error);
    }
}
async function getTask(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401);
        const taskId = String(req.params.id);
        const task = await prisma_js_1.prisma.calendarItem.findFirst({
            where: { id: taskId, userId: id, type: client_1.CalendarItemType.TASK },
        });
        if (!task)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Task not found.', 404);
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
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401);
        const { title, startAt, priority, category, description, estimatedMinutes } = req.body ?? {};
        if (typeof title !== 'string' || !title.trim())
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'title is required.', 400);
        const date = typeof startAt === 'string' && !Number.isNaN(Date.parse(startAt)) ? new Date(startAt) : new Date();
        const task = await prisma_js_1.prisma.calendarItem.create({
            data: {
                userId: id,
                title: title.trim(),
                type: client_1.CalendarItemType.TASK,
                startAt: date,
                priority: Object.values(client_1.Priority).includes(priority) ? priority : client_1.Priority.MEDIUM,
                category: typeof category === 'string' && category.trim() ? category.trim().toLowerCase() : undefined,
                description: typeof description === 'string' ? description.trim() : undefined,
                estimatedMinutes: Number.isInteger(estimatedMinutes) && estimatedMinutes > 0 && estimatedMinutes <= 1440 ? estimatedMinutes : undefined,
            },
        });
        return (0, api_response_js_1.sendData)(res, task, 201);
    }
    catch (error) {
        return next(error);
    }
}
async function updateTask(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401);
        const taskId = String(req.params.id);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({
            where: { id: taskId, userId: id, type: client_1.CalendarItemType.TASK },
        });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Task not found.', 404);
        const { title, startAt, priority, category, description, estimatedMinutes, status } = req.body ?? {};
        const updateData = {};
        if (typeof title === 'string' && title.trim())
            updateData.title = title.trim();
        if (typeof startAt === 'string' && !Number.isNaN(Date.parse(startAt)))
            updateData.startAt = new Date(startAt);
        if (priority && Object.values(client_1.Priority).includes(priority))
            updateData.priority = priority;
        if (status && Object.values(client_1.CalendarItemStatus).includes(status))
            updateData.status = status;
        if (typeof category === 'string')
            updateData.category = category.trim().toLowerCase() || null;
        if (typeof description === 'string')
            updateData.description = description.trim() || null;
        if (Number.isInteger(estimatedMinutes) && estimatedMinutes > 0)
            updateData.estimatedMinutes = estimatedMinutes;
        const updated = await prisma_js_1.prisma.calendarItem.update({
            where: { id: existing.id },
            data: updateData,
        });
        return (0, api_response_js_1.sendData)(res, updated);
    }
    catch (error) {
        return next(error);
    }
}
async function updateTaskStatus(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401);
        if (!Object.values(client_1.CalendarItemStatus).includes(req.body?.status))
            return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', 'A valid task status is required.', 400);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: String(req.params.id), userId: id, type: client_1.CalendarItemType.TASK } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Task not found.', 404);
        const task = await prisma_js_1.prisma.calendarItem.update({ where: { id: existing.id }, data: { status: req.body.status } });
        return (0, api_response_js_1.sendData)(res, task);
    }
    catch (error) {
        return next(error);
    }
}
async function deleteTask(req, res, next) {
    try {
        const id = getUserId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401);
        const taskId = String(req.params.id);
        const existing = await prisma_js_1.prisma.calendarItem.findFirst({ where: { id: taskId, userId: id, type: client_1.CalendarItemType.TASK } });
        if (!existing)
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Task not found.', 404);
        await prisma_js_1.prisma.calendarItem.delete({ where: { id: existing.id } });
        return (0, api_response_js_1.sendData)(res, { deleted: true });
    }
    catch (error) {
        return next(error);
    }
}
