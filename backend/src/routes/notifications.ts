import { Router, type NextFunction, type Request, type Response } from 'express'
import { getAuthUserId, requireAuth } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'
import { dismissNotification, snoozeNotification } from '../services/alert-engine.js'
import { sendDailyDigestEmail } from '../services/email.js'

const router = Router()
router.use(requireAuth)
const uid = (req: any) => getAuthUserId(req)

// Valid notification types from Prisma schema
const VALID_NOTIFICATION_TYPES = ['REMINDER', 'OVERDUE', 'MISSED', 'SYSTEM', 'AI_IMPORT'] as const
type NotificationType = typeof VALID_NOTIFICATION_TYPES[number]

// List notifications (optionally filter unread only, type, or search)
router.get('/', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    const unreadOnly = req.query.unread === 'true'
    const typeFilter = typeof req.query.type === 'string' && VALID_NOTIFICATION_TYPES.includes(req.query.type as NotificationType)
      ? req.query.type as NotificationType
      : undefined
    const section = typeof req.query.section === 'string' ? req.query.section : undefined
    const searchTerm = String(req.query.q || req.query.search || '').trim()
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const page = Math.max(Number(req.query.page) || 1, 1)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    let whereClause: any = {
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
    }

    if (section === 'today') {
      whereClause.createdAt = { gte: todayStart, lte: todayEnd }
    } else if (section === 'missed') {
      whereClause.OR = [
        { type: 'MISSED' },
        { status: 'FAILED' },
      ]
    } else if (section === 'upcoming') {
      whereClause.snoozedUntil = { gt: now }
    } else if (section === 'completed') {
      whereClause.readAt = { not: null }
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: (page - 1) * limit,
      include: {
        calendarItem: {
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            status: true,
            priority: true,
          },
        },
        alert: {
          select: {
            id: true,
            severity: true,
            soundName: true,
            channels: true,
          },
        },
      },
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
    const missed = await prisma.notification.count({
      where: {
        userId: id,
        readAt: null,
        OR: [{ type: 'MISSED' }, { status: 'FAILED' }],
      },
    })
    return sendData(res, { count, missed })
  } catch (error) { next(error) }
})

// Grouped summary for Notification Center tabs
router.get('/summary', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [todayItems, missedItems, upcomingItems, recentItems, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: id, createdAt: { gte: todayStart } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { calendarItem: true },
      }),
      prisma.notification.findMany({
        where: {
          userId: id,
          OR: [{ type: 'MISSED' }, { status: 'FAILED' }],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { calendarItem: true },
      }),
      prisma.notification.findMany({
        where: {
          userId: id,
          snoozedUntil: { gt: now },
        },
        orderBy: { snoozedUntil: 'asc' },
        take: 30,
        include: { calendarItem: true },
      }),
      prisma.notification.findMany({
        where: { userId: id },
        orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
        take: 50,
        include: { calendarItem: true },
      }),
      prisma.notification.count({ where: { userId: id, readAt: null } }),
    ])

    return sendData(res, {
      unreadCount,
      today: todayItems,
      missed: missedItems,
      upcoming: upcomingItems,
      recent: recentItems,
    })
  } catch (error) { next(error) }
})

// Snooze notification
router.post('/:id/snooze', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)

    const { minutes, until } = req.body ?? {}
    const snoozeParam = typeof minutes === 'number' && minutes > 0 ? minutes : (until || 10)

    const result = await snoozeNotification(id, String(req.params.id), snoozeParam)
    return sendData(res, result)
  } catch (error: any) {
    if (error?.message?.includes('not found')) {
      return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404)
    }
    next(error)
  }
})

// Dismiss notification
router.post('/:id/dismiss', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)

    const result = await dismissNotification(id, String(req.params.id))
    return sendData(res, result)
  } catch (error: any) {
    if (error?.message?.includes('not found')) {
      return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404)
    }
    next(error)
  }
})

// Mark read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = uid(req)
    const updated = await prisma.notification.updateMany({
      where: { id: String(req.params.id), userId: id },
      data: { readAt: new Date() },
    })
    if (!updated.count) return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification was not found', 404)
    return sendData(res, { read: true })
  } catch (error) { next(error) }
})

// Mark unread
router.patch('/:id/unread', async (req, res, next) => {
  try {
    const id = uid(req)
    const updated = await prisma.notification.updateMany({
      where: { id: String(req.params.id), userId: id },
      data: { readAt: null },
    })
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

// Trigger Daily Digest dispatch
router.post('/digest', async (req, res, next) => {
  try {
    const id = uid(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user || !user.email) return sendError(res, 'USER_NOT_FOUND', 'User has no registered email.', 404)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    const [todayEvents, pendingTasks] = await Promise.all([
      prisma.calendarItem.findMany({
        where: {
          userId: id,
          type: 'EVENT',
          startAt: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { startAt: 'asc' },
      }),
      prisma.calendarItem.findMany({
        where: {
          userId: id,
          type: 'TASK',
          status: 'PENDING',
        },
        orderBy: [{ priority: 'desc' }, { startAt: 'asc' }],
        take: 10,
      }),
    ])

    const dateStr = todayStart.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    const result = await sendDailyDigestEmail({
      to: user.email,
      userName: user.name,
      dateStr,
      tasks: pendingTasks.map(t => ({ title: t.title, priority: t.priority, status: t.status })),
      events: todayEvents.map(e => ({ title: e.title, startAt: e.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })),
    })

    return sendData(res, { success: result.success, messageId: result.messageId, error: result.error })
  } catch (error) { next(error) }
})

export const notificationsRouter = router
