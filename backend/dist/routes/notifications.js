"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const router = (0, express_1.Router)();
const userId = (req) => (req.header('x-user-id') || process.env.DEV_USER_ID || '').trim();
router.get('/', async (req, res, next) => { try {
    const id = userId(req);
    if (!id)
        return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
    const unreadOnly = req.query.unread === 'true';
    const notifications = await prisma_js_1.prisma.notification.findMany({ where: { userId: id, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }], take: Math.min(Number(req.query.limit) || 50, 100) });
    return (0, api_response_js_1.sendData)(res, notifications);
}
catch (error) {
    next(error);
} });
router.patch('/:id/read', async (req, res, next) => { try {
    const id = userId(req);
    const updated = await prisma_js_1.prisma.notification.updateMany({ where: { id: typeof req.params.id === 'string' ? req.params.id : '', userId: id }, data: { readAt: new Date() } });
    if (!updated.count)
        return (0, api_response_js_1.sendError)(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404);
    return (0, api_response_js_1.sendData)(res, { read: true });
}
catch (error) {
    next(error);
} });
router.patch('/:id/unread', async (req, res, next) => { try {
    const id = userId(req);
    const updated = await prisma_js_1.prisma.notification.updateMany({ where: { id: typeof req.params.id === 'string' ? req.params.id : '', userId: id }, data: { readAt: null } });
    if (!updated.count)
        return (0, api_response_js_1.sendError)(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404);
    return (0, api_response_js_1.sendData)(res, { unread: true });
}
catch (error) {
    next(error);
} });
exports.notificationsRouter = router;
