"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
const uid = (req) => (0, auth_js_1.getAuthUserId)(req);
// Valid notification types from Prisma schema
const VALID_NOTIFICATION_TYPES = ['REMINDER', 'OVERDUE', 'MISSED', 'SYSTEM', 'AI_IMPORT'];
// List notifications (optionally filter unread only)
router.get('/', async (req, res, next) => {
    try {
        const id = uid(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        const unreadOnly = req.query.unread === 'true';
        const typeFilter = typeof req.query.type === 'string' && VALID_NOTIFICATION_TYPES.includes(req.query.type)
            ? req.query.type
            : undefined;
        const searchTerm = String(req.query.q || req.query.search || '').trim();
        const limit = Math.min(Number(req.query.limit) || 50, 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const notifications = await prisma_js_1.prisma.notification.findMany({
            where: {
                userId: id,
                ...(unreadOnly ? { readAt: null } : {}),
                ...(typeFilter ? { type: typeFilter } : {}),
                ...(searchTerm
                    ? {
                        OR: [
                            { title: { contains: searchTerm, mode: 'insensitive' } },
                            { message: { contains: searchTerm, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
            take: limit,
            skip: (page - 1) * limit,
        });
        return (0, api_response_js_1.sendData)(res, notifications);
    }
    catch (error) {
        next(error);
    }
});
// Unread count for badge
router.get('/count', async (req, res, next) => {
    try {
        const id = uid(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        const count = await prisma_js_1.prisma.notification.count({ where: { userId: id, readAt: null } });
        return (0, api_response_js_1.sendData)(res, { count });
    }
    catch (error) {
        next(error);
    }
});
// Mark read
router.patch('/:id/read', async (req, res, next) => {
    try {
        const id = uid(req);
        const updated = await prisma_js_1.prisma.notification.updateMany({ where: { id: String(req.params.id), userId: id }, data: { readAt: new Date() } });
        if (!updated.count)
            return (0, api_response_js_1.sendError)(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404);
        return (0, api_response_js_1.sendData)(res, { read: true });
    }
    catch (error) {
        next(error);
    }
});
// Mark unread
router.patch('/:id/unread', async (req, res, next) => {
    try {
        const id = uid(req);
        const updated = await prisma_js_1.prisma.notification.updateMany({ where: { id: String(req.params.id), userId: id }, data: { readAt: null } });
        if (!updated.count)
            return (0, api_response_js_1.sendError)(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404);
        return (0, api_response_js_1.sendData)(res, { unread: true });
    }
    catch (error) {
        next(error);
    }
});
// Mark all read
router.post('/read-all', async (req, res, next) => {
    try {
        const id = uid(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        await prisma_js_1.prisma.notification.updateMany({ where: { userId: id, readAt: null }, data: { readAt: new Date() } });
        return (0, api_response_js_1.sendData)(res, { done: true });
    }
    catch (error) {
        next(error);
    }
});
// Delete notification
router.delete('/:id', async (req, res, next) => {
    try {
        const id = uid(req);
        const deleted = await prisma_js_1.prisma.notification.deleteMany({ where: { id: String(req.params.id), userId: id } });
        if (!deleted.count)
            return (0, api_response_js_1.sendError)(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404);
        return (0, api_response_js_1.sendData)(res, { deleted: true });
    }
    catch (error) {
        next(error);
    }
});
exports.notificationsRouter = router;
