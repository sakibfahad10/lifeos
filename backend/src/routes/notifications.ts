import { Router, type NextFunction, type Request, type Response } from 'express'
import { getAuthUserId, requireAuth } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'

const router = Router()
router.use(requireAuth)
const uid = (req: any) => getAuthUserId(req)

// Valid notification types from Prisma schema
const VALID_NOTIFICATION_TYPES = ['REMINDER', 'OVERDUE', 'MISSED', 'SYSTEM', 'AI_IMPORT'] as const
type NotificationType = typeof VALID_NOTIFICATION_TYPES[number]

// List notifications (optionally filter unread only)
router.get('/', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    const unreadOnly = req.query.unread === 'true'
    const typeFilter = typeof req.query.type === 'string' && VALID_NOTIFICATION_TYPES.includes(req.query.type as NotificationType)
      ? req.query.type as NotificationType
      : undefined
    const searchTerm = String(req.query.q || req.query.search || '').trim()
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const page = Math.max(Number(req.query.page) || 1, 1)
    
    const notifications = await prisma.notification.findMany({
      where: {
        userId: id,
        ...(unreadOnly ? { readAt: null } : {}),
        ...(typeFilter ? { type: typeFilter as any } : {}),
        ...(searchTerm
          ? {
              OR: [
                { title: { contains: searchTerm, mode: 'insensitive' as const } },
                { message: { contains: searchTerm, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: (page - 1) * limit,
    })
    return sendData(res, notifications)
  } catch (error) { next(error) }
})

// Unread count for badge
router.get('/count', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    const count = await prisma.notification.count({ where: { userId: id, readAt: null } })
    return sendData(res, { count })
  } catch (error) { next(error) }
})

// Mark read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = uid(req)
    const updated = await prisma.notification.updateMany({ where: { id: String(req.params.id), userId: id }, data: { readAt: new Date() } })
    if (!updated.count) return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404)
    return sendData(res, { read: true })
  } catch (error) { next(error) }
})

// Mark unread
router.patch('/:id/unread', async (req, res, next) => {
  try {
    const id = uid(req)
    const updated = await prisma.notification.updateMany({ where: { id: String(req.params.id), userId: id }, data: { readAt: null } })
    if (!updated.count) return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404)
    return sendData(res, { unread: true })
  } catch (error) { next(error) }
})

// Mark all read
router.post('/read-all', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    await prisma.notification.updateMany({ where: { userId: id, readAt: null }, data: { readAt: new Date() } })
    return sendData(res, { done: true })
  } catch (error) { next(error) }
})

// Delete notification
router.delete('/:id', async (req, res, next) => {
  try {
    const id = uid(req)
    const deleted = await prisma.notification.deleteMany({ where: { id: String(req.params.id), userId: id } })
    if (!deleted.count) return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404)
    return sendData(res, { deleted: true })
  } catch (error) { next(error) }
})

export const notificationsRouter = router
