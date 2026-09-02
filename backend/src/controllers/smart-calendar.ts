import type { NextFunction, Request, Response } from 'express'
import { CalendarItemStatus, CalendarItemType, Priority, RecurrenceFrequency } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'
import { getAuthUserId } from '../middleware/auth.js'
import { findFreeSlots, hasConflict, parseNaturalLanguage } from '../services/smart-calendar.js'

const userId = (req: Request) => getAuthUserId(req)
const availabilitySchema = z.object({ startHour: z.number().int().min(0).max(23).optional(), endHour: z.number().int().min(1).max(24).optional(), horizonDays: z.number().int().min(1).max(31).optional() }).optional()
const smartSchema = z.object({ text: z.string().trim().min(2).max(1000), type: z.enum(['TASK', 'EVENT']).default('TASK'), create: z.boolean().default(false), availability: availabilitySchema })

async function itemsForWindow(id: string, to: Date) {
  return prisma.calendarItem.findMany({ where: { userId: id, startAt: { lte: to }, OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }, orderBy: { startAt: 'asc' } })
}

export async function parseSmartEvent(req: Request, res: Response, next: NextFunction) {
  try { return sendData(res, parseNaturalLanguage(z.object({ text: z.string().trim().min(2).max(1000) }).parse(req.body).text)) } catch (error) { return next(error) }
}

export async function scheduleSmartEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req); if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    const input = smartSchema.parse(req.body); const parsed = parseNaturalLanguage(input.text)
    const horizon = input.availability?.horizonDays ?? 7; const until = new Date(); until.setDate(until.getDate() + horizon)
    const items = await itemsForWindow(id, until)
    const sessions = /\b(\d+(?:\.\d+)?)\s*hours?\s+(?:of|for)\b/i.exec(input.text)
    const totalMinutes = sessions ? Math.round(Number(sessions[1]) * 60) : parsed.estimatedMinutes
    const sessionMinutes = Math.min(totalMinutes, 120)
    const slots = parsed.startAt ? [{ startAt: new Date(parsed.startAt), endAt: new Date(new Date(parsed.startAt).getTime() + totalMinutes * 60000) }] : findFreeSlots(items, sessionMinutes, Math.ceil(totalMinutes / sessionMinutes), input.availability)
    if (!slots.length) return sendError(res, 'NO_FREE_SLOT', 'No free time was found in the selected availability window.', 409)
    const conflicts = parsed.startAt && hasConflict(items, slots[0].startAt, slots[0].endAt) ? items.filter(item => hasConflict([item], slots[0].startAt, slots[0].endAt)) : []
    if (conflicts.length) {
      const alternatives = findFreeSlots(items, totalMinutes, 3, input.availability)
      return sendData(res, { parsed, conflicts: conflicts.map(item => ({ id: item.id, title: item.title, startAt: item.startAt, endAt: item.endAt })), alternatives, created: [] })
    }
    const proposal = slots.map((slot, index) => ({ title: slots.length > 1 ? `${parsed.title} (${index + 1}/${slots.length})` : parsed.title, startAt: slot.startAt, endAt: slot.endAt, estimatedMinutes: Math.round((slot.endAt.getTime() - slot.startAt.getTime()) / 60000), priority: parsed.priority, type: input.type }))
    if (!input.create) return sendData(res, { parsed, conflicts: [], alternatives: proposal, created: [] })
    const created = await prisma.$transaction(async tx => Promise.all(proposal.map((event, index) => tx.calendarItem.create({ data: { userId: id, ...event, type: event.type as CalendarItemType, priority: event.priority as Priority, recurrenceRule: index === 0 && parsed.recurrence ? { create: { frequency: parsed.recurrence.frequency as RecurrenceFrequency, interval: parsed.recurrence.interval, daysOfWeek: parsed.recurrence.daysOfWeek, startDate: event.startAt, endDate: parsed.recurrence.endDate ? new Date(parsed.recurrence.endDate) : undefined } } : undefined } }))))
    return sendData(res, { parsed, conflicts: [], alternatives: proposal, created }, 201)
  } catch (error) { return next(error) }
}

export async function rescheduleMissedTask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req); if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    const task = await prisma.calendarItem.findFirst({ where: { id: String(req.params.id), userId: id, type: CalendarItemType.TASK } })
    if (!task) return sendError(res, 'TASK_NOT_FOUND', 'Task not found.', 404)
    if (task.status !== CalendarItemStatus.OVERDUE) return sendError(res, 'TASK_NOT_MISSED', 'Only missed tasks can be rescheduled automatically.', 422)
    const input = z.object({ confirm: z.boolean().default(false), availability: availabilitySchema }).parse(req.body)
    const until = new Date(); until.setDate(until.getDate() + (input.availability?.horizonDays ?? 7)); const items = await itemsForWindow(id, until)
    const slot = findFreeSlots(items, task.estimatedMinutes || 60, 1, input.availability)[0]
    if (!slot) return sendError(res, 'NO_FREE_SLOT', 'No free time was found for this task.', 409)
    if (!input.confirm) return sendData(res, { taskId: task.id, suggestion: slot, moved: false })
    const updated = await prisma.calendarItem.update({ where: { id: task.id }, data: { startAt: slot.startAt, endAt: slot.endAt, status: CalendarItemStatus.PENDING } })
    return sendData(res, { task: updated, moved: true })
  } catch (error) { return next(error) }
}

export async function calendarBriefing(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req); if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    const date = req.query.date ? new Date(String(req.query.date)) : new Date(); if (Number.isNaN(date.getTime())) return sendError(res, 'VALIDATION_ERROR', 'date must be valid.', 400)
    const start = new Date(date); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1)
    const items = await prisma.calendarItem.findMany({ where: { userId: id, startAt: { gte: start, lt: end } }, orderBy: { startAt: 'asc' } })
    const conflicts = items.filter((item, index) => items.slice(index + 1).some(other => hasConflict([other], item.startAt, item.endAt || new Date(item.startAt.getTime() + (item.estimatedMinutes || 60) * 60000), item.id))).map(item => item.id)
    const highPriority = items.filter(item => item.priority === Priority.HIGH && item.status !== CalendarItemStatus.COMPLETED)
    return sendData(res, { date: start, events: items, highPriority, conflictItemIds: conflicts, summary: `${items.length} scheduled item${items.length === 1 ? '' : 's'}, ${highPriority.length} high priority, ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}.` })
  } catch (error) { return next(error) }
}

export async function calendarAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req); if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6); const end = new Date(start); end.setDate(end.getDate() + 7)
    const items = await prisma.calendarItem.findMany({ where: { userId: id, startAt: { gte: start, lt: end } } })
    const minutes = (predicate: (item: typeof items[number]) => boolean) => items.filter(predicate).reduce((sum, item) => sum + (item.estimatedMinutes || (item.endAt ? Math.max(1, Math.round((item.endAt.getTime() - item.startAt.getTime()) / 60000)) : 60)), 0)
    const scheduled = minutes(() => true); const weekMinutes = 7 * 24 * 60
    return sendData(res, { range: { start, end }, studyMinutes: minutes(item => item.category?.toLowerCase() === 'study'), workMinutes: minutes(item => item.category?.toLowerCase() === 'work'), meetingMinutes: minutes(item => /meeting/i.test(item.title) || item.category?.toLowerCase() === 'meeting'), completedTasks: items.filter(item => item.type === CalendarItemType.TASK && item.status === CalendarItemStatus.COMPLETED).length, totalTasks: items.filter(item => item.type === CalendarItemType.TASK).length, freeMinutes: Math.max(0, weekMinutes - scheduled) })
  } catch (error) { return next(error) }
}
