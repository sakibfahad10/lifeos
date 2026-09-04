import type { NextFunction, Request, Response } from 'express'
import { CalendarItemStatus, CalendarItemType, Priority, Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'
import { getAuthUserId } from '../middleware/auth.js'

function getUserId(req: Request) { return getAuthUserId(req) }

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const {
      q,
      search,
      status,
      priority,
      category,
      sortBy = 'startAt',
      sortOrder = 'asc',
      limit = '100',
      page = '1',
    } = req.query as Record<string, string | undefined>

    const searchTerm = (q || search || '').trim()

    const where: Prisma.CalendarItemWhereInput = {
      userId: id,
      type: CalendarItemType.TASK,
      ...(status && Object.values(CalendarItemStatus).includes(status as any) ? { status: status as CalendarItemStatus } : {}),
      ...(priority && Object.values(Priority).includes(priority as any) ? { priority: priority as Priority } : {}),
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
    }

    const validSortFields = ['startAt', 'priority', 'status', 'createdAt', 'title']
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'startAt'
    const orderDirection = sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc'

    const take = Math.min(Math.max(parseInt(limit) || 50, 1), 250)
    const skip = Math.max((parseInt(page) || 1) - 1, 0) * take

    const [tasks, total] = await Promise.all([
      prisma.calendarItem.findMany({
        where,
        orderBy: [{ [orderField]: orderDirection }, { id: 'asc' }],
        take,
        skip,
      }),
      prisma.calendarItem.count({ where }),
    ])

    return sendData(res, {
      items: tasks,
      total,
      page: parseInt(page) || 1,
      limit: take,
    })
  } catch (error) { return next(error) }
}

export async function getTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)
    const taskId = String(req.params.id)
    const task = await prisma.calendarItem.findFirst({
      where: { id: taskId, userId: id, type: CalendarItemType.TASK },
    })
    if (!task) return sendError(res, 'NOT_FOUND', 'Task not found.', 404)
    return sendData(res, task)
  } catch (error) { return next(error) }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)
    const { title, startAt, priority, category, description, estimatedMinutes } = req.body ?? {}
    if (typeof title !== 'string' || !title.trim()) return sendError(res, 'VALIDATION_ERROR', 'title is required.', 400)
    const date = typeof startAt === 'string' && !Number.isNaN(Date.parse(startAt)) ? new Date(startAt) : new Date()
    const task = await prisma.calendarItem.create({
      data: {
        userId: id,
        title: title.trim(),
        type: CalendarItemType.TASK,
        startAt: date,
        priority: Object.values(Priority).includes(priority) ? priority : Priority.MEDIUM,
        category: typeof category === 'string' && category.trim() ? category.trim().toLowerCase() : undefined,
        description: typeof description === 'string' ? description.trim() : undefined,
        estimatedMinutes: Number.isInteger(estimatedMinutes) && estimatedMinutes > 0 && estimatedMinutes <= 1440 ? estimatedMinutes : undefined,
      },
    })
    return sendData(res, task, 201)
  } catch (error) { return next(error) }
}

export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)
    const taskId = String(req.params.id)
    const existing = await prisma.calendarItem.findFirst({
      where: { id: taskId, userId: id, type: CalendarItemType.TASK },
    })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Task not found.', 404)

    const { title, startAt, priority, category, description, estimatedMinutes, status } = req.body ?? {}
    const updateData: Prisma.CalendarItemUpdateInput = {}

    if (typeof title === 'string' && title.trim()) updateData.title = title.trim()
    if (typeof startAt === 'string' && !Number.isNaN(Date.parse(startAt))) updateData.startAt = new Date(startAt)
    if (priority && Object.values(Priority).includes(priority)) updateData.priority = priority
    if (status && Object.values(CalendarItemStatus).includes(status)) updateData.status = status
    if (typeof category === 'string') updateData.category = category.trim().toLowerCase() || null
    if (typeof description === 'string') updateData.description = description.trim() || null
    if (Number.isInteger(estimatedMinutes) && estimatedMinutes > 0) updateData.estimatedMinutes = estimatedMinutes

    const updated = await prisma.calendarItem.update({
      where: { id: existing.id },
      data: updateData,
    })
    return sendData(res, updated)
  } catch (error) { return next(error) }
}

export async function updateTaskStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)
    if (!Object.values(CalendarItemStatus).includes(req.body?.status)) return sendError(res, 'VALIDATION_ERROR', 'A valid task status is required.', 400)
    const existing = await prisma.calendarItem.findFirst({ where: { id: String(req.params.id), userId: id, type: CalendarItemType.TASK } })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Task not found.', 404)
    const task = await prisma.calendarItem.update({ where: { id: existing.id }, data: { status: req.body.status as CalendarItemStatus } })
    return sendData(res, task)
  } catch (error) { return next(error) }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)
    const taskId = String(req.params.id)
    const existing = await prisma.calendarItem.findFirst({ where: { id: taskId, userId: id, type: CalendarItemType.TASK } })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Task not found.', 404)
    await prisma.calendarItem.delete({ where: { id: existing.id } })
    return sendData(res, { deleted: true })
  } catch (error) { return next(error) }
}
