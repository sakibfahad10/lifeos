import { Router } from 'express'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'

const router = Router()
const userId = (req: any) => (req.header('x-user-id') || process.env.DEV_USER_ID || '').trim()
router.get('/', async (req, res, next) => { try { const id = userId(req); if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401); const unreadOnly = req.query.unread === 'true'; const notifications = await prisma.notification.findMany({ where: { userId: id, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }], take: Math.min(Number(req.query.limit) || 50, 100) }); return sendData(res, notifications) } catch (error) { next(error) } })
router.patch('/:id/read', async (req, res, next) => { try { const id = userId(req); const updated = await prisma.notification.updateMany({ where: { id: typeof req.params.id === 'string' ? req.params.id : '', userId: id }, data: { readAt: new Date() } }); if (!updated.count) return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404); return sendData(res, { read: true }) } catch (error) { next(error) } })
router.patch('/:id/unread', async (req, res, next) => { try { const id = userId(req); const updated = await prisma.notification.updateMany({ where: { id: typeof req.params.id === 'string' ? req.params.id : '', userId: id }, data: { readAt: null } }); if (!updated.count) return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404); return sendData(res, { unread: true }) } catch (error) { next(error) } })
export const notificationsRouter = router
