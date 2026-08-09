import type { NextFunction, Request, Response } from 'express'
import { CalendarItemStatus, CalendarItemType, Priority } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'

const defaultUserId = process.env.DEV_USER_ID
function getUserId(req: Request) { return (req.header('x-user-id') || defaultUserId || '').trim() }

export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401)
    const tasks = await prisma.calendarItem.findMany({ where: { userId: id, type: CalendarItemType.TASK }, orderBy: [{ status: 'asc' }, { startAt: 'asc' }], take: 250 })
    return sendData(res, tasks)
  } catch (error) { return next(error) }
}

export async function updateTaskStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401)
    if (!Object.values(CalendarItemStatus).includes(req.body?.status)) return sendError(res, 'VALIDATION_ERROR', 'A valid task status is required.', 400)
    const existing = await prisma.calendarItem.findFirst({ where: { id: typeof req.params.id === 'string' ? req.params.id : '', userId: id, type: CalendarItemType.TASK } })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Task not found.', 404)
    const task = await prisma.calendarItem.update({ where: { id: existing.id }, data: { status: req.body.status as CalendarItemStatus } })
    return sendData(res, task)
  } catch (error) { return next(error) }
}

export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getUserId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401)
    const { title, startAt, priority, category, description } = req.body ?? {}
    if (typeof title !== 'string' || !title.trim()) return sendError(res, 'VALIDATION_ERROR', 'title is required.', 400)
    const date = typeof startAt === 'string' && !Number.isNaN(Date.parse(startAt)) ? new Date(startAt) : new Date()
    const task = await prisma.calendarItem.create({ data: { userId: id, title: title.trim(), type: CalendarItemType.TASK, startAt: date, priority: Object.values(Priority).includes(priority) ? priority : Priority.MEDIUM, category: typeof category === 'string' ? category.trim() : undefined, description: typeof description === 'string' ? description.trim() : undefined } })
    return sendData(res, task, 201)
  } catch (error) { return next(error) }
}
