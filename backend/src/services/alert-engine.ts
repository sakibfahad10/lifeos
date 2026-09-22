import { prisma } from '../config/prisma.js'
import { AlertSeverity, AlertTriggerType, DeliveryStatus, NotificationType } from '@prisma/client'
import { sendAlertEmail } from './email.js'

export interface AlertInput {
  calendarItemId?: string | null
  title?: string
  triggerType?: AlertTriggerType
  offsetMinutes?: number
  exactTime?: string | Date | null
  channels?: string[]
  severity?: AlertSeverity
  soundName?: string
  soundVolume?: number
  soundRepeat?: number
  enabled?: boolean
  order?: number
  escalationStep?: number | null
}

/**
 * Checks if current time is within user's configured quiet hours
 */
export function isWithinQuietHours(userSettings: any, now = new Date()): {
  inQuietHours: boolean
  allowCritical: boolean
  allowedSeverities: string[]
} {
  const notif = userSettings?.notifications || {}
  const quietHours = notif.quietHours || userSettings?.quietHours

  if (!quietHours || !quietHours.enabled) {
    return { inQuietHours: false, allowCritical: true, allowedSeverities: ['NORMAL', 'IMPORTANT', 'CRITICAL'] }
  }

  const { start = '22:00', end = '08:00', allowCritical = true, allowedSeverities = ['CRITICAL'] } = quietHours
  const timezone = userSettings?.timezone || 'UTC'

  try {
    // Get current time formatted as HH:mm in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const timeParts = formatter.formatToParts(now)
    const hour = timeParts.find(p => p.type === 'hour')?.value ?? '00'
    const minute = timeParts.find(p => p.type === 'minute')?.value ?? '00'
    const currentTimeStr = `${hour}:${minute}`

    let inQuiet = false
    if (start < end) {
      inQuiet = currentTimeStr >= start && currentTimeStr < end
    } else {
      // Crosses midnight, e.g. 22:00 to 08:00
      inQuiet = currentTimeStr >= start || currentTimeStr < end
    }

    return { inQuietHours: inQuiet, allowCritical, allowedSeverities }
  } catch (err) {
    console.error('[AlertEngine] Timezone calculation error:', err)
    return { inQuietHours: false, allowCritical: true, allowedSeverities: ['NORMAL', 'IMPORTANT', 'CRITICAL'] }
  }
}

/**
 * Calculates next recurrence date for recurring calendar items
 */
export function getNextOccurrenceDate(recurrenceRule: any, startAt: Date, afterDate = new Date()): Date {
  if (!recurrenceRule) return startAt

  const { frequency, interval = 1, startDate, endDate } = recurrenceRule
  let current = new Date(startDate || startAt)
  const limit = endDate ? new Date(endDate) : new Date(afterDate.getTime() + 365 * 24 * 60 * 60 * 1000)

  while (current <= afterDate && current <= limit) {
    if (frequency === 'DAILY') {
      current = new Date(current.getTime() + interval * 24 * 60 * 60 * 1000)
    } else if (frequency === 'WEEKLY') {
      current = new Date(current.getTime() + interval * 7 * 24 * 60 * 60 * 1000)
    } else if (frequency === 'MONTHLY') {
      const nextMonth = new Date(current)
      nextMonth.setMonth(nextMonth.getMonth() + interval)
      current = nextMonth
    } else if (frequency === 'YEARLY') {
      const nextYear = new Date(current)
      nextYear.setFullYear(nextYear.getFullYear() + interval)
      current = nextYear
    } else {
      // Default step daily
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000)
    }
  }

  return current
}

/**
 * Main alert processor: checks scheduled alerts and triggers deliveries
 */
export async function processAlerts(): Promise<{ processed: number; deliveries: number; missed: number }> {
  const now = new Date()
  let processedCount = 0
  let deliveryCount = 0
  let missedCount = 0

  try {
    // 1. Fetch active alerts that are enabled
    const activeAlerts = await prisma.alert.findMany({
      where: {
        enabled: true,
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lte: now } },
        ],
      },
      include: {
        calendarItem: {
          include: {
            recurrenceRule: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            settings: true,
          },
        },
      },
      take: 200,
    })

    for (const alert of activeAlerts) {
      processedCount++
      const user = alert.user
      const calendarItem = alert.calendarItem

      let targetTime: Date | null = null

      if (alert.triggerType === AlertTriggerType.EXACT_TIME && alert.exactTime) {
        targetTime = new Date(alert.exactTime)
      } else if (calendarItem) {
        const itemStart = calendarItem.recurrenceRule
          ? getNextOccurrenceDate(calendarItem.recurrenceRule, calendarItem.startAt, now)
          : new Date(calendarItem.startAt)

        const offsetMs = (alert.offsetMinutes || 0) * 60 * 1000
        targetTime = new Date(itemStart.getTime() - offsetMs)
      }

      if (!targetTime) continue

      // Has the scheduled trigger time arrived?
      const diffMs = now.getTime() - targetTime.getTime()

      // If scheduled time has arrived:
      // - diffMs >= 0 means targetTime is now or in the past
      // - If diffMs > 30 mins and never fired, mark as missed
      const isDue = diffMs >= 0
      const isMissed = diffMs > 30 * 60 * 1000 && (!alert.lastTriggeredAt || alert.lastTriggeredAt < targetTime)

      if (isDue) {
        // Prevent duplicate trigger for the exact same target time instance
        if (alert.lastTriggeredAt && alert.lastTriggeredAt >= targetTime && !alert.snoozedUntil) {
          continue
        }

        // Check Quiet Hours
        const quietCheck = isWithinQuietHours(user.settings, now)
        const isSeverityAllowedInQuiet = quietCheck.allowedSeverities.includes(alert.severity)

        const channelsToDeliver = alert.channels.filter(ch => {
          if (quietCheck.inQuietHours && !isSeverityAllowedInQuiet) {
            // During quiet hours, only IN_APP is retained silently; audible and external channels suppressed
            return ch === 'IN_APP'
          }
          return true
        })

        // Check if all channels were suppressed due to quiet hours
        if (quietCheck.inQuietHours && !isSeverityAllowedInQuiet && channelsToDeliver.length === 0) {
          await prisma.alertDelivery.create({
            data: {
              alertId: alert.id,
              userId: user.id,
              channel: 'ALL',
              status: DeliveryStatus.SKIPPED_QUIET_HOURS,
              scheduledFor: targetTime,
              error: `Suppressed by Quiet Hours (${alert.severity} not in allowed list)`,
            },
          })
          continue
        }

        // Build Title and Message
        const itemTitle = calendarItem?.title || alert.title || 'Scheduled Reminder'
        const itemType = calendarItem?.type || 'ITEM'
        const timeDisplay = targetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

        let notifType: NotificationType = NotificationType.REMINDER
        if (isMissed) {
          notifType = NotificationType.MISSED
          missedCount++
        } else if (calendarItem?.status === 'OVERDUE' || (calendarItem && new Date(calendarItem.startAt) < now)) {
          notifType = NotificationType.OVERDUE
        }

        const message = isMissed
          ? `Missed alert for ${itemTitle} (originally scheduled for ${timeDisplay})`
          : alert.offsetMinutes && alert.offsetMinutes > 0
          ? `${itemTitle} starts in ${formatOffset(alert.offsetMinutes)}`
          : `${itemTitle} is starting right now`

        // 1. IN_APP / BROWSER / SOUND dispatch: Create Notification record
        const notification = await prisma.notification.create({
          data: {
            userId: user.id,
            calendarItemId: calendarItem?.id || null,
            alertId: alert.id,
            type: notifType,
            severity: alert.severity,
            title: itemTitle,
            message,
            channels: alert.channels,
            soundName: alert.channels.includes('SOUND') ? alert.soundName : 'SILENT',
            soundVolume: alert.soundVolume,
            soundRepeat: alert.soundRepeat,
            status: isMissed ? DeliveryStatus.FAILED : DeliveryStatus.SENT,
            scheduledAt: targetTime,
          },
        })

        deliveryCount++

        // Record AlertDelivery for IN_APP / BROWSER / SOUND
        await prisma.alertDelivery.create({
          data: {
            alertId: alert.id,
            userId: user.id,
            channel: alert.channels.join(','),
            status: DeliveryStatus.SENT,
            scheduledFor: targetTime,
            sentAt: now,
            payload: { notificationId: notification.id, channels: alert.channels },
          },
        })

        // 2. EMAIL Dispatch
        if (channelsToDeliver.includes('EMAIL') && user.email) {
          const emailRes = await sendAlertEmail({
            to: user.email,
            userName: user.name,
            itemTitle,
            itemType,
            itemTime: targetTime.toLocaleString(),
            alertSeverity: alert.severity,
            message,
            actionUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar`,
          })

          await prisma.alertDelivery.create({
            data: {
              alertId: alert.id,
              userId: user.id,
              channel: 'EMAIL',
              status: emailRes.success ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
              scheduledFor: targetTime,
              sentAt: emailRes.success ? now : null,
              error: emailRes.error || null,
            },
          })
        }

        // Update alert state
        await prisma.alert.update({
          where: { id: alert.id },
          data: {
            lastTriggeredAt: now,
            snoozedUntil: null, // clear snooze once delivered
          },
        })
      }
    }

    // 2. Also process legacy reminders if any exist without an Alert
    const legacyReminders = await prisma.reminder.findMany({
      where: { enabled: true },
      include: {
        calendarItem: true,
        user: { select: { id: true, email: true, name: true, settings: true } },
      },
      take: 100,
    })

    for (const rem of legacyReminders) {
      if (!rem.calendarItem) continue
      const targetTime = new Date(rem.calendarItem.startAt.getTime() - rem.offsetMinutes * 60 * 1000)
      const diffMs = now.getTime() - targetTime.getTime()

      if (diffMs >= 0 && diffMs < 60 * 1000) {
        // Trigger within a 1-minute window
        const existingNotif = await prisma.notification.findFirst({
          where: {
            userId: rem.userId,
            calendarItemId: rem.calendarItemId,
            scheduledAt: targetTime,
          },
        })

        if (!existingNotif) {
          await prisma.notification.create({
            data: {
              userId: rem.userId,
              calendarItemId: rem.calendarItemId,
              type: NotificationType.REMINDER,
              title: rem.calendarItem.title,
              message: `${rem.calendarItem.title} starts in ${formatOffset(rem.offsetMinutes)}`,
              channels: ['IN_APP', 'BROWSER', 'SOUND'],
              soundName: 'REMINDER',
              scheduledAt: targetTime,
              status: DeliveryStatus.SENT,
            },
          })
          deliveryCount++
        }
      }
    }

  } catch (err) {
    console.error('[AlertEngine] Error processing alerts:', err)
  }

  return { processed: processedCount, deliveries: deliveryCount, missed: missedCount }
}

/**
 * Snoozes an active notification and updates its backend schedule
 */
export async function snoozeNotification(
  userId: string,
  notificationId: string,
  minutesOrDate: number | string
): Promise<{ success: boolean; snoozedUntil: Date }> {
  const notif = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  })

  if (!notif) throw new Error('Notification not found')

  const now = new Date()
  let snoozedUntil: Date

  if (typeof minutesOrDate === 'number') {
    snoozedUntil = new Date(now.getTime() + minutesOrDate * 60 * 1000)
  } else {
    snoozedUntil = new Date(minutesOrDate)
    if (isNaN(snoozedUntil.getTime()) || snoozedUntil <= now) {
      snoozedUntil = new Date(now.getTime() + 10 * 60 * 1000) // fallback 10m
    }
  }

  // Update notification record
  await prisma.notification.update({
    where: { id: notif.id },
    data: {
      snoozedUntil,
      status: DeliveryStatus.SNOOZED,
      readAt: now,
    },
  })

  // If this notification was generated by an Alert, update the Alert's snooze
  if (notif.alertId) {
    await prisma.alert.update({
      where: { id: notif.alertId },
      data: { snoozedUntil },
    })

    await prisma.alertDelivery.create({
      data: {
        alertId: notif.alertId,
        userId,
        channel: 'SNOOZE',
        status: DeliveryStatus.SNOOZED,
        scheduledFor: snoozedUntil,
        payload: { originalNotificationId: notif.id, minutes: typeof minutesOrDate === 'number' ? minutesOrDate : null },
      },
    })
  }

  return { success: true, snoozedUntil }
}

/**
 * Dismisses an active notification
 */
export async function dismissNotification(
  userId: string,
  notificationId: string
): Promise<{ success: boolean }> {
  const notif = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  })

  if (!notif) throw new Error('Notification not found')

  await prisma.notification.update({
    where: { id: notif.id },
    data: {
      status: DeliveryStatus.DISMISSED,
      readAt: notif.readAt || new Date(),
    },
  })

  return { success: true }
}

/**
 * Creates smart preset alerts for tasks or events
 */
export async function applySmartPreset(
  userId: string,
  calendarItemId: string,
  preset: 'BIRTHDAY' | 'DEADLINE' | 'MEETING' | 'ESCALATION'
): Promise<any[]> {
  const item = await prisma.calendarItem.findFirst({
    where: { id: calendarItemId, userId },
  })

  if (!item) throw new Error('Calendar item not found')

  // Remove existing alerts for clean preset replacement
  await prisma.alert.deleteMany({
    where: { calendarItemId, userId },
  })

  const alertsToCreate: Array<Partial<AlertInput>> = []

  if (preset === 'BIRTHDAY') {
    alertsToCreate.push(
      { offsetMinutes: 7 * 24 * 60, channels: ['EMAIL'], severity: AlertSeverity.NORMAL, soundName: 'SILENT', order: 0 },
      { offsetMinutes: 24 * 60, channels: ['IN_APP', 'BROWSER'], severity: AlertSeverity.IMPORTANT, soundName: 'REMINDER', order: 1 },
      { offsetMinutes: 120, channels: ['IN_APP', 'BROWSER', 'SOUND'], severity: AlertSeverity.IMPORTANT, soundName: 'SOFT', soundVolume: 75, order: 2 },
    )
  } else if (preset === 'DEADLINE') {
    alertsToCreate.push(
      { offsetMinutes: 24 * 60, channels: ['IN_APP', 'EMAIL'], severity: AlertSeverity.IMPORTANT, soundName: 'REMINDER', order: 0 },
      { offsetMinutes: 60, channels: ['IN_APP', 'BROWSER', 'SOUND'], severity: AlertSeverity.IMPORTANT, soundName: 'URGENT', soundVolume: 90, order: 1 },
      { offsetMinutes: 10, channels: ['IN_APP', 'BROWSER', 'SOUND', 'EMAIL'], severity: AlertSeverity.CRITICAL, soundName: 'CRITICAL', soundVolume: 100, soundRepeat: 3, order: 2 },
    )
  } else if (preset === 'MEETING') {
    alertsToCreate.push(
      { offsetMinutes: 30, channels: ['IN_APP', 'BROWSER'], severity: AlertSeverity.NORMAL, soundName: 'REMINDER', order: 0 },
      { offsetMinutes: 5, channels: ['IN_APP', 'BROWSER', 'SOUND'], severity: AlertSeverity.IMPORTANT, soundName: 'SOFT', soundVolume: 80, order: 1 },
    )
  } else if (preset === 'ESCALATION') {
    alertsToCreate.push(
      { offsetMinutes: 180, channels: ['IN_APP'], severity: AlertSeverity.NORMAL, soundName: 'SILENT', escalationStep: 1, order: 0 },
      { offsetMinutes: 60, channels: ['IN_APP', 'BROWSER'], severity: AlertSeverity.IMPORTANT, soundName: 'REMINDER', escalationStep: 2, order: 1 },
      { offsetMinutes: 20, channels: ['IN_APP', 'BROWSER', 'SOUND'], severity: AlertSeverity.IMPORTANT, soundName: 'URGENT', soundVolume: 85, escalationStep: 3, order: 2 },
      { offsetMinutes: 5, channels: ['IN_APP', 'BROWSER', 'SOUND', 'EMAIL'], severity: AlertSeverity.CRITICAL, soundName: 'CRITICAL', soundVolume: 100, soundRepeat: 2, escalationStep: 4, order: 3 },
    )
  }

  const created = []
  for (const a of alertsToCreate) {
    const alert = await prisma.alert.create({
      data: {
        userId,
        calendarItemId,
        title: item.title,
        triggerType: AlertTriggerType.OFFSET_BEFORE,
        offsetMinutes: a.offsetMinutes ?? 15,
        channels: a.channels || ['IN_APP'],
        severity: a.severity || AlertSeverity.NORMAL,
        soundName: a.soundName || 'REMINDER',
        soundVolume: a.soundVolume ?? 80,
        soundRepeat: a.soundRepeat ?? 1,
        order: a.order ?? 0,
        escalationStep: a.escalationStep || null,
        enabled: true,
      },
    })
    created.push(alert)
  }

  return created
}

function formatOffset(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`
  const weeks = Math.floor(days / 7)
  return `${weeks} week${weeks === 1 ? '' : 's'}`
}
