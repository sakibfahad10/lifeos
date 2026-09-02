import { CalendarItemStatus, CalendarItemType, Priority, type CalendarItem } from '@prisma/client'

export type Availability = { startHour?: number; endHour?: number; horizonDays?: number }
export type ProposedSlot = { startAt: Date; endAt: Date }

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

function nextWeekday(from: Date, weekday: number) {
  const result = new Date(from)
  result.setHours(0, 0, 0, 0)
  const days = (weekday - result.getDay() + 7) % 7 || 7
  result.setDate(result.getDate() + days)
  return result
}

function atTime(date: Date, hour: number, minute = 0) {
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

export function parseNaturalLanguage(input: string, now = new Date()) {
  const text = input.trim()
  const lower = text.toLowerCase()
  const priority: Priority = /\b(high|urgent|important)\b/.test(lower) ? 'HIGH' : /\b(low)\b/.test(lower) ? 'LOW' : 'MEDIUM'
  const durationMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/)
  const estimatedMinutes = durationMatch ? Math.max(15, Math.round(Number(durationMatch[1]) * (/hour|hr/.test(durationMatch[2]) ? 60 : 1))) : 60
  const timeMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/)
  let startAt: Date | undefined
  if (/\btomorrow\b/.test(lower)) { startAt = new Date(now); startAt.setDate(startAt.getDate() + 1) }
  const weekdayNames: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const weekday = Object.entries(weekdayNames).find(([name]) => new RegExp(`\\b(?:next\\s+)?${name}\\b`).test(lower))
  if (weekday) startAt = nextWeekday(now, weekday[1])
  if (!startAt && /\btoday\b/.test(lower)) startAt = new Date(now)
  if (timeMatch) {
    let hour = Number(timeMatch[1])
    if (/p/.test(timeMatch[3]) && hour !== 12) hour += 12
    if (/a/.test(timeMatch[3]) && hour === 12) hour = 0
    startAt = atTime(startAt || now, hour, Number(timeMatch[2] || 0))
  }
  if (startAt && startAt <= now && !/\btoday\b/.test(lower)) startAt.setDate(startAt.getDate() + 1)
  const untilMatch = lower.match(/\buntil\s+(\d{4}-\d{1,2}-\d{1,2})\b/)
  const recurrence = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+and\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))?\b/.exec(lower)
  const recurrenceRule = recurrence ? { frequency: 'WEEKLY' as const, interval: 1, daysOfWeek: [weekdayNames[recurrence[1]], ...(recurrence[2] ? [weekdayNames[recurrence[2]]] : [])], endDate: untilMatch?.[1] } : /\bevery\s+2\s+weeks?\b/.test(lower) ? { frequency: 'WEEKLY' as const, interval: 2, daysOfWeek: [], endDate: untilMatch?.[1] } : /\bmonthly\b/.test(lower) ? { frequency: 'MONTHLY' as const, interval: 1, daysOfWeek: [], endDate: untilMatch?.[1] } : undefined
  let title = text
    .replace(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/ig, '')
    .replace(/\b(today|tomorrow|at\s+\d{1,2}(?::\d{2})?\s*[ap]\.?(?:m\.?)?)\b/ig, '')
    .replace(/\b(?:for|of)\s+\d+(?:\.\d+)?\s*(hours?|hrs?|minutes?|mins?)\b/ig, '')
    .replace(/\b\d+(?:\.\d+)?\s*(hours?|hrs?|minutes?|mins?)\s+(?:of|for)\b/ig, '')
    .replace(/\b(i need|this week)\b/ig, '')
    .replace(/\b(high|medium|low|priority|every|and|until|monthly)\b/ig, '').replace(/\s+/g, ' ').replace(/^\W+|\W+$/g, '')
  if (!title) title = 'Untitled calendar item'
  return { title, startAt: startAt?.toISOString(), estimatedMinutes, priority, recurrence: recurrenceRule }
}

function intervalFor(item: CalendarItem) {
  const start = item.startAt.getTime()
  const end = (item.endAt?.getTime() || start + (item.estimatedMinutes || 60) * MINUTE)
  return { start, end: Math.max(end, start + MINUTE) }
}

export function hasConflict(items: CalendarItem[], startAt: Date, endAt: Date, excludedId?: string) {
  const start = startAt.getTime(); const end = endAt.getTime()
  return items.filter(item => item.id !== excludedId && item.status !== CalendarItemStatus.CANCELLED).some(item => {
    const interval = intervalFor(item)
    return start < interval.end && end > interval.start
  })
}

export function findFreeSlots(items: CalendarItem[], minutes: number, count: number, availability: Availability = {}, now = new Date()): ProposedSlot[] {
  const startHour = availability.startHour ?? 9; const endHour = availability.endHour ?? 17
  const horizonDays = Math.min(Math.max(availability.horizonDays ?? 7, 1), 31)
  if (startHour < 0 || endHour > 24 || startHour >= endHour) throw new Error('Availability hours must form a valid daily window.')
  const slots: ProposedSlot[] = []
  for (let day = 0; day < horizonDays && slots.length < count; day++) {
    const date = new Date(now); date.setDate(date.getDate() + day)
    let cursor = atTime(date, startHour)
    const dayEnd = atTime(date, endHour)
    if (cursor < now) cursor = new Date(Math.ceil(now.getTime() / (30 * MINUTE)) * 30 * MINUTE)
    while (cursor.getTime() + minutes * MINUTE <= dayEnd.getTime() && slots.length < count) {
      const end = new Date(cursor.getTime() + minutes * MINUTE)
      if (!hasConflict(items, cursor, end)) { slots.push({ startAt: new Date(cursor), endAt: end }); break }
      cursor = new Date(cursor.getTime() + 30 * MINUTE)
    }
  }
  return slots
}

export const schedulableTypes = [CalendarItemType.TASK, CalendarItemType.EVENT]
