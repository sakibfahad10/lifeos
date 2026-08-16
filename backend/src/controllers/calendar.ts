import type { NextFunction, Request, Response } from 'express'
import { CalendarItemStatus, CalendarItemType, Priority } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'

const defaultUserId = process.env.DEV_USER_ID

function userId(req: Request) {
  return ((req as any).userId || req.header('x-user-id') || defaultUserId || '').trim()
}

function routeId(req: Request) {
  return typeof req.params.id === 'string' ? req.params.id : ''
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined
  return new Date(value)
}

export async function listCalendarItems(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401)
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)
    const items = await prisma.calendarItem.findMany({
      where: { userId: id, ...(from || to ? { startAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      orderBy: { startAt: 'asc' },
      take: Math.min(Math.max(Number(req.query.limit) || 100, 1), 250),
    })
    return sendData(res, items)
  } catch (error) { return next(error) }
}

export async function createCalendarItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401)
    const { title, startAt, endAt, description, type, priority, category, location, allDay } = req.body ?? {}
    const parsedStart = parseDate(startAt)
    if (typeof title !== 'string' || !title.trim() || !parsedStart) return sendError(res, 'VALIDATION_ERROR', 'title and a valid startAt are required.', 400)
    const item = await prisma.calendarItem.create({ data: {
      userId: id, title: title.trim(), startAt: parsedStart, endAt: parseDate(endAt),
      description: typeof description === 'string' ? description.trim() : undefined,
      type: Object.values(CalendarItemType).includes(type) ? type : CalendarItemType.EVENT,
      priority: Object.values(Priority).includes(priority) ? priority : Priority.MEDIUM,
      category: typeof category === 'string' ? category.trim() : undefined,
      location: typeof location === 'string' ? location.trim() : undefined,
      allDay: Boolean(allDay),
    } })
    return sendData(res, item, 201)
  } catch (error) { return next(error) }
}

export async function updateCalendarItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401)
    const existing = await prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id } })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Calendar item not found.', 404)
    const body = req.body ?? {}
    const item = await prisma.calendarItem.update({ where: { id: existing.id }, data: {
      ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
      ...(body.startAt ? { startAt: parseDate(body.startAt) } : {}),
      ...(body.endAt ? { endAt: parseDate(body.endAt) } : {}),
      ...(Object.values(CalendarItemStatus).includes(body.status) ? { status: body.status } : {}),
      ...(Object.values(Priority).includes(body.priority) ? { priority: body.priority } : {}),
      ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
    } })
    return sendData(res, item)
  } catch (error) { return next(error) }
}

export async function deleteCalendarItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'Provide x-user-id for development API access.', 401)
    const existing = await prisma.calendarItem.findFirst({ where: { id: routeId(req), userId: id } })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Calendar item not found.', 404)
    await prisma.calendarItem.delete({ where: { id: existing.id } })
    return sendData(res, { deleted: true })
  } catch (error) { return next(error) }
}
