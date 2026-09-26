import type { NextFunction, Request, Response } from 'express'
import { AlertSeverity, AlertTriggerType } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'
import { getAuthUserId } from '../middleware/auth.js'
import { applySmartPreset, processAlerts, snoozeNotification } from '../services/alert-engine.js'
import { sendAlertEmail } from '../services/email.js'

function userId(req: Request): string {
  return getAuthUserId(req)
}

export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const calendarItemId = typeof req.query.calendarItemId === 'string' ? req.query.calendarItemId : undefined

    const alerts = await prisma.alert.findMany({
      where: {
        userId: id,
        ...(calendarItemId ? { calendarItemId } : {}),
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: {
        calendarItem: {
          select: {
            id: true,
            title: true,
            startAt: true,
            type: true,
            status: true,
          },
        },
        deliveries: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return sendData(res, alerts)
  } catch (error) { return next(error) }
}

export async function getAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const alert = await prisma.alert.findFirst({
      where: { id: String(req.params.id), userId: id },
      include: {
        calendarItem: true,
        deliveries: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })

    if (!alert) return sendError(res, 'NOT_FOUND', 'Alert was not found.', 404)
    return sendData(res, alert)
  } catch (error) { return next(error) }
}

export async function createAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const {
      calendarItemId,
      title,
      triggerType = 'OFFSET_BEFORE',
      offsetMinutes = 15,
      exactTime,
      channels = ['IN_APP', 'BROWSER'],
      severity = 'NORMAL',
      soundName = 'REMINDER',
      soundVolume = 80,
      soundRepeat = 1,
      enabled = true,
      order = 0,
      escalationStep,
    } = req.body ?? {}

    if (calendarItemId) {
      const item = await prisma.calendarItem.findFirst({
        where: { id: String(calendarItemId), userId: id },
      })
      if (!item) return sendError(res, 'NOT_FOUND', 'Calendar item not found.', 404)
    }

    const validTrigger = triggerType === 'EXACT_TIME' ? AlertTriggerType.EXACT_TIME : AlertTriggerType.OFFSET_BEFORE
    const validSeverity = Object.values(AlertSeverity).includes(severity) ? severity : AlertSeverity.NORMAL
    const sanitizedChannels = Array.isArray(channels) && channels.length > 0 ? channels : ['IN_APP']

    const alert = await prisma.alert.create({
      data: {
        userId: id,
        calendarItemId: calendarItemId ? String(calendarItemId) : null,
        title: typeof title === 'string' ? title.trim() : null,
        triggerType: validTrigger,
        offsetMinutes: Number.isInteger(offsetMinutes) ? offsetMinutes : 15,
        exactTime: exactTime ? new Date(exactTime) : null,
        channels: sanitizedChannels,
        severity: validSeverity,
        soundName: typeof soundName === 'string' ? soundName : 'REMINDER',
        soundVolume: Math.min(Math.max(Number(soundVolume) || 80, 0), 100),
        soundRepeat: Math.min(Math.max(Number(soundRepeat) || 1, 1), 5),
        enabled: Boolean(enabled),
        order: Number(order) || 0,
        escalationStep: Number.isInteger(escalationStep) ? escalationStep : null,
      },
      include: {
        calendarItem: { select: { id: true, title: true, startAt: true, type: true } },
      },
    })

    return sendData(res, alert, 201)
  } catch (error) { return next(error) }
}

export async function updateAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const existing = await prisma.alert.findFirst({
      where: { id: String(req.params.id), userId: id },
    })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Alert was not found.', 404)

    const {
      title,
      triggerType,
      offsetMinutes,
      exactTime,
      channels,
      severity,
      soundName,
      soundVolume,
      soundRepeat,
      enabled,
      order,
      escalationStep,
    } = req.body ?? {}

    const updated = await prisma.alert.update({
      where: { id: existing.id },
      data: {
        ...(title !== undefined ? { title: typeof title === 'string' ? title.trim() : null } : {}),
        ...(triggerType ? { triggerType: triggerType === 'EXACT_TIME' ? AlertTriggerType.EXACT_TIME : AlertTriggerType.OFFSET_BEFORE } : {}),
        ...(offsetMinutes !== undefined ? { offsetMinutes: Number.isInteger(offsetMinutes) ? offsetMinutes : 15 } : {}),
        ...(exactTime !== undefined ? { exactTime: exactTime ? new Date(exactTime) : null } : {}),
        ...(Array.isArray(channels) ? { channels } : {}),
        ...(severity && Object.values(AlertSeverity).includes(severity) ? { severity } : {}),
        ...(soundName !== undefined ? { soundName } : {}),
        ...(soundVolume !== undefined ? { soundVolume: Math.min(Math.max(Number(soundVolume) || 80, 0), 100) } : {}),
        ...(soundRepeat !== undefined ? { soundRepeat: Math.min(Math.max(Number(soundRepeat) || 1, 1), 5) } : {}),
        ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
        ...(order !== undefined ? { order: Number(order) || 0 } : {}),
        ...(escalationStep !== undefined ? { escalationStep: Number.isInteger(escalationStep) ? escalationStep : null } : {}),
      },
    })

    return sendData(res, updated)
  } catch (error) { return next(error) }
}

export async function deleteAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const existing = await prisma.alert.findFirst({
      where: { id: String(req.params.id), userId: id },
    })
    if (!existing) return sendError(res, 'NOT_FOUND', 'Alert was not found.', 404)

    await prisma.alert.delete({ where: { id: existing.id } })
    return sendData(res, { deleted: true })
  } catch (error) { return next(error) }
}

export async function applyPreset(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const { calendarItemId, preset } = req.body ?? {}
    if (!calendarItemId || !['BIRTHDAY', 'DEADLINE', 'MEETING', 'ESCALATION'].includes(preset)) {
      return sendError(res, 'VALIDATION_ERROR', 'Valid calendarItemId and preset (BIRTHDAY, DEADLINE, MEETING, ESCALATION) are required.', 400)
    }

    const createdAlerts = await applySmartPreset(id, String(calendarItemId), preset)
    return sendData(res, createdAlerts, 201)
  } catch (error) { return next(error) }
}

export async function triggerAlertProcess(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await processAlerts()
    return sendData(res, result)
  } catch (error) { return next(error) }
}

export async function testDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const id = userId(req)
    if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return sendError(res, 'USER_NOT_FOUND', 'User was not found.', 404)

    const { channel = 'IN_APP', soundName = 'REMINDER', severity = 'NORMAL' } = req.body ?? {}

    if (channel === 'EMAIL') {
      const emailResult = await sendAlertEmail({
        to: user.email,
        userName: user.name,
        itemTitle: 'LifeOS Test Notification',
        itemType: 'TEST',
        itemTime: new Date().toLocaleString(),
        alertSeverity: severity,
        message: 'This is a test notification from your LifeOS unified alert engine to verify email delivery.',
      })
      return sendData(res, { success: emailResult.success, channel: 'EMAIL', messageId: emailResult.messageId, error: emailResult.error })
    }

    // Create an in-app test notification record
    const notif = await prisma.notification.create({
      data: {
        userId: id,
        type: 'SYSTEM',
        severity: severity as any,
        title: 'LifeOS Channel Test',
        message: `Testing ${channel} notification delivery with sound ${soundName}.`,
        channels: [channel],
        soundName,
        soundVolume: 85,
        soundRepeat: 1,
      },
    })

    return sendData(res, { success: true, notification: notif })
  } catch (error) { return next(error) }
}
