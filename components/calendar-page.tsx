'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, Calendar, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Copy, Edit3, Loader2, MapPin, Plus, RefreshCw, RotateCcw, Search,
  SlidersHorizontal, Sparkles, Tag, Trash2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  addReminder, createCalendarItem, deleteCalendarItem, duplicateCalendarItem,
  getCalendarBriefing, getCalendarItems, removeReminder, smartSchedule, updateCalendarItem,
  updateCalendarItemStatus, updateRecurrenceRule,
  type CalendarBriefing, type CalendarFilters, type CalendarItem, type ReminderItem,
  type SmartProposal, type SmartSchedule,
} from '@/lib/api'
import { cn } from '@/lib/utils'

// ─── Constants & Styles ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  work: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/40',
  study: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-300/40',
  health: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40',
  personal: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40',
  meeting: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300/40',
  finance: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-300/40',
}

const CAT_DOT: Record<string, string> = {
  work: 'bg-blue-500',
  study: 'bg-violet-500',
  health: 'bg-emerald-500',
  personal: 'bg-amber-500',
  meeting: 'bg-sky-500',
  finance: 'bg-green-500',
}

function categoryColor(cat?: string | null) {
  const key = (cat || '').toLowerCase()
  return CATEGORY_COLORS[key] || 'bg-primary/10 text-primary border-primary/20'
}

function categoryDot(cat?: string | null) {
  const key = (cat || '').toLowerCase()
  return CAT_DOT[key] || 'bg-primary'
}

const STATUS_META: Record<string, { label: string; color: string; next?: string }> = {
  PENDING: { label: 'Pending', color: 'bg-muted text-muted-foreground', next: 'COMPLETED' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', next: 'PENDING' },
  OVERDUE: { label: 'Overdue', color: 'bg-red-500/15 text-red-700 dark:text-red-300', next: 'COMPLETED' },
  CANCELLED: { label: 'Cancelled', color: 'bg-muted text-muted-foreground/60 line-through', next: 'PENDING' },
}

const TYPE_META: Record<string, { label: string; icon: typeof Calendar }> = {
  EVENT: { label: 'Event', icon: CalendarDays },
  TASK: { label: 'Task', icon: Check },
  REMINDER: { label: 'Reminder', icon: Clock },
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly', CUSTOM: 'Custom',
}

const REMINDER_PRESETS = [5, 10, 15, 30, 60, 1440]
function reminderLabel(min: number) {
  if (min < 60) return `${min} min`
  if (min === 60) return '1 hour'
  if (min === 1440) return '1 day'
  return `${min} min`
}

// ─── Status & Overdue Logic ───────────────────────────────────────────────────

function isOverdue(item: CalendarItem): boolean {
  if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return false
  if (item.status === 'OVERDUE') return true
  // Only tasks past their end/due time are overdue
  if (item.type === 'TASK') {
    const deadline = item.endAt ? new Date(item.endAt) : new Date(item.startAt)
    return deadline.getTime() < Date.now()
  }
  return false
}

function isInProgress(item: CalendarItem): boolean {
  if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return false
  const now = Date.now()
  const start = new Date(item.startAt).getTime()
  const end = item.endAt ? new Date(item.endAt).getTime() : start + (item.estimatedMinutes || 60) * 60000
  return now >= start && now <= end
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function toLocal(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toLocalDateOnly(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

// ─── Recurrence occurrence calculation ────────────────────────────────────────

function doesItemOccurOnDate(item: CalendarItem, targetDate: Date): boolean {
  const itemStart = new Date(item.startAt)
  if (Number.isNaN(itemStart.getTime())) return false

  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  const startDay = new Date(itemStart.getFullYear(), itemStart.getMonth(), itemStart.getDate())

  if (targetDay.getTime() < startDay.getTime()) return false
  if (targetDay.getTime() === startDay.getTime()) return true

  const rule = item.recurrenceRule
  if (!rule) {
    if (item.endAt) {
      const endItem = new Date(item.endAt)
      if (!Number.isNaN(endItem.getTime())) {
        const endDay = new Date(endItem.getFullYear(), endItem.getMonth(), endItem.getDate())
        return targetDay.getTime() >= startDay.getTime() && targetDay.getTime() <= endDay.getTime()
      }
    }
    return false
  }

  if (rule.endDate) {
    const endRule = new Date(rule.endDate)
    if (!Number.isNaN(endRule.getTime())) {
      const endRuleDay = new Date(endRule.getFullYear(), endRule.getMonth(), endRule.getDate(), 23, 59, 59, 999)
      if (targetDay.getTime() > endRuleDay.getTime()) return false
    }
  }

  const interval = Math.max(1, rule.interval || 1)

  switch (rule.frequency) {
    case 'DAILY': {
      const diffDays = Math.round((targetDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24))
      return diffDays >= 0 && diffDays % interval === 0
    }
    case 'WEEKLY': {
      const targetDow = targetDate.getDay()
      const daysOfWeek = Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0
        ? rule.daysOfWeek
        : [startDay.getDay()]

      if (!daysOfWeek.includes(targetDow)) return false

      const startWeekSunday = new Date(startDay)
      startWeekSunday.setDate(startWeekSunday.getDate() - startWeekSunday.getDay())
      startWeekSunday.setHours(0, 0, 0, 0)

      const targetWeekSunday = new Date(targetDay)
      targetWeekSunday.setDate(targetWeekSunday.getDate() - targetWeekSunday.getDay())
      targetWeekSunday.setHours(0, 0, 0, 0)

      const diffWeeks = Math.round((targetWeekSunday.getTime() - startWeekSunday.getTime()) / (1000 * 60 * 60 * 24 * 7))
      return diffWeeks >= 0 && diffWeeks % interval === 0
    }
    case 'MONTHLY': {
      const dayOfMonth = rule.dayOfMonth || startDay.getDate()
      if (targetDate.getDate() !== dayOfMonth) return false
      const monthsDiff = (targetDate.getFullYear() - startDay.getFullYear()) * 12 + (targetDate.getMonth() - startDay.getMonth())
      return monthsDiff >= 0 && monthsDiff % interval === 0
    }
    case 'YEARLY': {
      if (targetDate.getMonth() !== startDay.getMonth() || targetDate.getDate() !== startDay.getDate()) return false
      const yearsDiff = targetDate.getFullYear() - startDay.getFullYear()
      return yearsDiff >= 0 && yearsDiff % interval === 0
    }
    default:
      return false
  }
}

function sortItemsByTime(list: CalendarItem[]): CalendarItem[] {
  return [...list].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1
    if (!a.allDay && b.allDay) return 1
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  })
}

// ─── Mini calendar grid ───────────────────────────────────────────────────────

function CalendarGrid({ year, month, items, selectedDate, onDateClick }: {
  year: number; month: number; items: CalendarItem[]; selectedDate: Date
  onDateClick: (d: Date) => void
}) {
  const today = new Date()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = first.getDay()
  const days: (Date | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)

  const hasItem = (d: Date) => items.some(i => doesItemOccurOnDate(i, d))

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d, i) => {
          if (!d) return <span key={`empty-${i}`} />
          const isToday = isSameDay(d, today)
          const isSelected = isSameDay(d, selectedDate)
          const hasDot = hasItem(d)
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onDateClick(d)}
              className={cn(
                'relative flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-all hover:bg-primary/15',
                isSelected && !isToday && 'bg-muted font-bold text-foreground ring-1 ring-border',
                isToday && 'bg-primary text-primary-foreground font-bold hover:bg-primary/90'
              )}
            >
              {d.getDate()}
              {hasDot && !isToday && (
                <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Item form types ──────────────────────────────────────────────────────────

type ItemFormData = {
  title: string; description: string; notes: string; type: 'TASK' | 'EVENT' | 'REMINDER'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'; status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'
  category: string; location: string; startAt: string; endAt: string; allDay: boolean
  estimatedMinutes: string
}

const defaultForm = (d = new Date()): ItemFormData => {
  const start = new Date(d)
  if (start.getHours() === 0 && start.getMinutes() === 0) {
    start.setHours(9, 0, 0, 0)
  }
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return {
    title: '', description: '', notes: '', type: 'EVENT', priority: 'MEDIUM', status: 'PENDING',
    category: '', location: '', startAt: toLocal(start.toISOString()), endAt: toLocal(end.toISOString()),
    allDay: false, estimatedMinutes: '60',
  }
}

function fromItem(item: CalendarItem): ItemFormData {
  return {
    title: item.title,
    description: item.description || '',
    notes: item.notes || '',
    type: item.type,
    priority: item.priority,
    status: item.status,
    category: item.category || '',
    location: item.location || '',
    startAt: toLocal(item.startAt),
    endAt: item.endAt ? toLocal(item.endAt) : '',
    allDay: item.allDay,
    estimatedMinutes: item.estimatedMinutes ? String(item.estimatedMinutes) : '',
  }
}

// ─── Recurrence form ─────────────────────────────────────────────────────────

type RecurrenceFormData = {
  enabled: boolean; frequency: string; interval: string
  daysOfWeek: number[]; dayOfMonth: string; endDate: string
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function RecurrenceSection({ itemId, existing, onUpdate }: {
  itemId: string
  existing: CalendarItem['recurrenceRule']
  onUpdate: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<RecurrenceFormData>(() => ({
    enabled: !!existing,
    frequency: existing?.frequency || 'WEEKLY',
    interval: existing ? String(existing.interval) : '1',
    daysOfWeek: existing?.daysOfWeek || [],
    dayOfMonth: existing?.dayOfMonth ? String(existing.dayOfMonth) : '',
    endDate: existing?.endDate ? existing.endDate.slice(0, 10) : '',
  }))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setForm({
      enabled: !!existing,
      frequency: existing?.frequency || 'WEEKLY',
      interval: existing ? String(existing.interval) : '1',
      daysOfWeek: existing?.daysOfWeek || [],
      dayOfMonth: existing?.dayOfMonth ? String(existing.dayOfMonth) : '',
      endDate: existing?.endDate ? existing.endDate.slice(0, 10) : '',
    })
    setMsg('')
  }, [itemId, existing])

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      if (!form.enabled) {
        await updateRecurrenceRule(itemId, { remove: true })
      } else {
        await updateRecurrenceRule(itemId, {
          frequency: form.frequency,
          interval: parseInt(form.interval) || 1,
          daysOfWeek: form.daysOfWeek,
          dayOfMonth: form.dayOfMonth ? parseInt(form.dayOfMonth) : undefined,
          endDate: form.endDate || undefined,
        })
      }
      setMsg('Saved!')
      onUpdate()
    } catch { setMsg('Could not save recurrence.') }
    finally { setSaving(false) }
  }

  const toggleDow = (d: number) =>
    setForm(f => ({ ...f, daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter(x => x !== d) : [...f.daysOfWeek, d] }))

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="size-3.5" />
        {existing ? `Repeats ${FREQ_LABELS[existing.frequency]}` : 'Add recurrence'}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <label className="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
            Enable recurrence
          </label>
          {form.enabled && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Frequency
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
                    {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Every
                  <input type="number" min="1" max="99" value={form.interval} onChange={e => setForm(f => ({ ...f, interval: e.target.value }))} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
                </label>
              </div>
              {form.frequency === 'WEEKLY' && (
                <div className="flex gap-1 flex-wrap">
                  {DOW.map((d, i) => (
                    <button
                      key={d} type="button"
                      onClick={() => toggleDow(i)}
                      className={cn('rounded-lg px-2 py-1 text-xs font-medium border transition-colors',
                        form.daysOfWeek.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >{d}</button>
                  ))}
                </div>
              )}
              {form.frequency === 'MONTHLY' && (
                <label className="flex flex-col gap-1 text-xs font-medium">
                  Day of month
                  <input type="number" min="1" max="31" value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
                </label>
              )}
              <label className="flex flex-col gap-1 text-xs font-medium">
                End date (optional)
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
              </label>
            </>
          )}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
            </Button>
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reminder section ─────────────────────────────────────────────────────────

function ReminderSection({ itemId, reminders, onUpdate }: {
  itemId: string; reminders: ReminderItem[]; onUpdate: () => void
}) {
  const [custom, setCustom] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')

  const add = async (min: number) => {
    setAdding(true); setMsg('')
    try { await addReminder(itemId, min); onUpdate() }
    catch { setMsg('Could not add reminder.') }
    finally { setAdding(false) }
  }

  const remove = async (id: string) => {
    setRemoving(id)
    try { await removeReminder(itemId, id); onUpdate() }
    catch { setMsg('Could not remove.') }
    finally { setRemoving(null) }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Clock className="size-3.5" />
        {reminders.length ? `${reminders.length} reminder${reminders.length > 1 ? 's' : ''}` : 'Add reminder'}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          {reminders.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {reminders.map(r => (
                <span key={r.id} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {reminderLabel(r.offsetMinutes)}
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    disabled={removing === r.id}
                    className="ml-0.5 rounded-full hover:text-destructive"
                  >
                    {removing === r.id ? <Loader2 className="size-2.5 animate-spin" /> : <X className="size-2.5" />}
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {REMINDER_PRESETS.map(min => (
              <button
                key={min} type="button"
                onClick={() => void add(min)}
                disabled={adding || reminders.some(r => r.offsetMinutes === min)}
                className={cn(
                  'rounded-lg border px-2 py-1 text-xs font-medium transition-colors',
                  reminders.some(r => r.offsetMinutes === min)
                    ? 'border-primary/30 bg-primary/10 text-primary cursor-default'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {reminderLabel(min)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number" min="1" max="10080" placeholder="Custom (min)"
              value={custom} onChange={e => setCustom(e.target.value)}
              className="h-8 w-32 rounded-lg border border-input bg-background px-2 text-xs"
            />
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => { const m = parseInt(custom); if (m > 0) void add(m) }}
              disabled={adding || !custom}
            >Add</Button>
          </div>
          {msg && <p className="text-xs text-destructive">{msg}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Item panel (view/edit side panel) ───────────────────────────────────────

function ItemPanel({ item, onClose, onUpdated, onDeleted }: {
  item: CalendarItem; onClose: () => void
  onUpdated: (item: CalendarItem) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ItemFormData>(() => fromItem(item))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [error, setError] = useState('')
  const [localItem, setLocalItem] = useState(item)

  useEffect(() => {
    setLocalItem(item)
    setForm(fromItem(item))
    setEditing(false)
    setError('')
  }, [item])

  const patchForm = (patch: Partial<ItemFormData>) => {
    setForm(f => {
      const next = { ...f, ...patch }
      // Auto adjust end time if start time advanced beyond end time
      if (!next.allDay && next.startAt && next.endAt && next.endAt <= next.startAt) {
        const startD = new Date(next.startAt)
        if (!Number.isNaN(startD.getTime())) {
          startD.setHours(startD.getHours() + 1)
          next.endAt = toLocal(startD.toISOString())
        }
      }
      return next
    })
  }

  const overdue = isOverdue(localItem)
  const inProgress = isInProgress(localItem)

  const save = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.allDay && form.endAt && form.startAt && form.endAt <= form.startAt) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true); setError('')
    try {
      const updated = await updateCalendarItem(localItem.id, {
        title: form.title.trim(),
        description: form.description,
        notes: form.notes,
        type: form.type,
        priority: form.priority,
        status: form.status,
        category: form.category,
        location: form.location,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        allDay: form.allDay,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : null,
      })
      setLocalItem(updated)
      onUpdated(updated)
      setEditing(false)
    } catch (e: any) { setError(e.message || 'Could not save.') }
    finally { setSaving(false) }
  }

  const cycleStatus = async () => {
    const next = STATUS_META[localItem.status]?.next
    if (!next) return
    try {
      const updated = await updateCalendarItemStatus(localItem.id, next as any)
      setLocalItem(updated); onUpdated(updated)
    } catch {}
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${localItem.title}"?`)) return
    setDeleting(true)
    try { await deleteCalendarItem(localItem.id); onDeleted(localItem.id); onClose() }
    catch { setError('Could not delete.') }
    finally { setDeleting(false) }
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    try { const copy = await duplicateCalendarItem(localItem.id); onUpdated(copy); onClose() }
    catch { setError('Could not duplicate.') }
    finally { setDuplicating(false) }
  }

  const refreshLocal = async () => {
    try {
      const { getCalendarItem } = await import('@/lib/api')
      const refreshed = await getCalendarItem(localItem.id)
      setLocalItem(refreshed)
      setForm(fromItem(refreshed))
      onUpdated(refreshed)
    } catch {}
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium border', categoryColor(localItem.category))}>
            {localItem.category || localItem.type}
          </span>
          {inProgress && (
            <span className="flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
              In Progress
            </span>
          )}
          {overdue && (
            <span className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="size-3" /> Overdue
            </span>
          )}
          {localItem.recurrenceRule && (
            <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <RotateCcw className="size-3" /> {FREQ_LABELS[localItem.recurrenceRule.frequency]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <>
              <Button variant="ghost" size="icon-sm" onClick={() => void handleDuplicate()} disabled={duplicating} title="Duplicate">
                {duplicating ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => void handleDelete()} disabled={deleting} title="Delete">
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(true); setForm(fromItem(localItem)) }} title="Edit">
                <Edit3 className="size-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose}><X className="size-4" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {editing ? (
          /* ── Edit form ── */
          <form onSubmit={e => { e.preventDefault(); void save() }} className="flex flex-col gap-3">
            <input
              value={form.title} onChange={e => patchForm({ title: e.target.value })} required
              placeholder="Title" className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold outline-none focus:border-ring"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Type
                <select value={form.type} onChange={e => patchForm({ type: e.target.value as any })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
                  <option value="EVENT">Event</option><option value="TASK">Task</option><option value="REMINDER">Reminder</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Status
                <select value={form.status} onChange={e => patchForm({ status: e.target.value as any })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
                  <option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="OVERDUE">Overdue</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Priority
                <select value={form.priority} onChange={e => patchForm({ priority: e.target.value as any })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
                  <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Category
                <input value={form.category} onChange={e => patchForm({ category: e.target.value })} placeholder="e.g. work" className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={e => {
                  const checked = e.target.checked
                  const baseDate = form.startAt ? new Date(form.startAt) : new Date()
                  const ymd = toLocalDateOnly(baseDate.toISOString())
                  patchForm({
                    allDay: checked,
                    startAt: checked ? `${ymd}T00:00` : `${ymd}T09:00`,
                    endAt: checked ? `${ymd}T23:59` : `${ymd}T10:00`,
                  })
                }}
              />
              All day event
            </label>

            {form.allDay ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium">Date</label>
                <input
                  type="date"
                  value={toLocalDateOnly(form.startAt)}
                  onChange={e => {
                    const d = e.target.value
                    patchForm({ startAt: `${d}T00:00`, endAt: `${d}T23:59` })
                  }}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium">Start
                  <input type="datetime-local" value={form.startAt} onChange={e => patchForm({ startAt: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">End (optional)
                  <input type="datetime-local" value={form.endAt} onChange={e => patchForm({ endAt: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Location
                <input value={form.location} onChange={e => patchForm({ location: e.target.value })} placeholder="Optional" className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Duration (min)
                <input type="number" min="1" max="1440" value={form.estimatedMinutes} onChange={e => patchForm({ estimatedMinutes: e.target.value })} placeholder="e.g. 60" className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs font-medium">
              Description
              <textarea value={form.description} onChange={e => patchForm({ description: e.target.value })} rows={2} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Notes
              <textarea value={form.notes} onChange={e => patchForm({ notes: e.target.value })} rows={2} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs" />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : 'Save changes'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          /* ── View mode ── */
          <div className="flex flex-col gap-4">
            <div>
              <h2 className={cn('text-lg font-semibold leading-tight', localItem.status === 'COMPLETED' && 'line-through text-muted-foreground')}>{localItem.title}</h2>
              {localItem.description && <p className="mt-1 text-sm text-muted-foreground">{localItem.description}</p>}
            </div>

            {/* Status chip - clickable to cycle */}
            <button
              type="button"
              onClick={() => void cycleStatus()}
              title="Click to toggle status"
              className={cn('w-fit rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 flex items-center gap-1.5', STATUS_META[localItem.status]?.color)}
            >
              {localItem.status === 'COMPLETED' ? <Check className="size-3" /> : null}
              {STATUS_META[localItem.status]?.label || localItem.status}
            </button>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-3.5 shrink-0" />
                <span>
                  {localItem.allDay
                    ? `${fmtDate(new Date(localItem.startAt))} (All day)`
                    : `${fmtDate(new Date(localItem.startAt))} at ${fmtTime(new Date(localItem.startAt))}`
                  }
                </span>
              </div>
              {localItem.endAt && !localItem.allDay && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  <span>Ends {fmtDate(new Date(localItem.endAt))} at {fmtTime(new Date(localItem.endAt))}</span>
                </div>
              )}
              {localItem.estimatedMinutes && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" />
                  <span>Est. duration: {localItem.estimatedMinutes} min</span>
                </div>
              )}
              {localItem.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" />
                  <span>{localItem.location}</span>
                </div>
              )}
              {localItem.category && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="size-3.5 shrink-0" />
                  <span>{localItem.category}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium',
                localItem.priority === 'HIGH' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                  : localItem.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-muted text-muted-foreground'
              )}>{localItem.priority} priority</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {TYPE_META[localItem.type]?.label || localItem.type}
              </span>
            </div>

            {localItem.notes && (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{localItem.notes}</p>
              </div>
            )}

            <div className="h-px bg-border/60" />

            <RecurrenceSection
              itemId={localItem.id}
              existing={localItem.recurrenceRule}
              onUpdate={() => void refreshLocal()}
            />
            <ReminderSection
              itemId={localItem.id}
              reminders={localItem.reminders || []}
              onUpdate={() => void refreshLocal()}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── New item form ────────────────────────────────────────────────────────────

function NewItemForm({ defaultDate, onCreated, onCancel }: {
  defaultDate?: Date; onCreated: (item: CalendarItem) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<ItemFormData>(() => defaultForm(defaultDate || new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(defaultForm(defaultDate || new Date()))
  }, [defaultDate])

  const patchForm = (patch: Partial<ItemFormData>) => {
    setForm(f => {
      const next = { ...f, ...patch }
      if (!next.allDay && next.startAt && next.endAt && next.endAt <= next.startAt) {
        const startD = new Date(next.startAt)
        if (!Number.isNaN(startD.getTime())) {
          startD.setHours(startD.getHours() + 1)
          next.endAt = toLocal(startD.toISOString())
        }
      }
      return next
    })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.startAt) { setError('Start date/time is required.'); return }
    if (!form.allDay && form.endAt && form.endAt <= form.startAt) {
      setError('End must be after start.'); return
    }
    setSaving(true); setError('')
    try {
      const item = await createCalendarItem({
        title: form.title.trim(),
        description: form.description || undefined,
        notes: form.notes || undefined,
        type: form.type,
        priority: form.priority,
        category: form.category || undefined,
        location: form.location || undefined,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        allDay: form.allDay,
        estimatedMinutes: form.estimatedMinutes ? parseInt(form.estimatedMinutes) : undefined,
      })
      onCreated(item)
    } catch (e: any) { setError(e.message || 'Could not create.') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">New calendar item</h3>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel}><X className="size-4" /></Button>
      </div>
      <input
        value={form.title} onChange={e => patchForm({ title: e.target.value })} required autoFocus
        placeholder="Title (e.g. Project presentation)" className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Type
          <select value={form.type} onChange={e => patchForm({ type: e.target.value as any })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
            <option value="EVENT">Event</option><option value="TASK">Task</option><option value="REMINDER">Reminder</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Priority
          <select value={form.priority} onChange={e => patchForm({ priority: e.target.value as any })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
            <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={form.allDay}
          onChange={e => {
            const checked = e.target.checked
            const baseDate = form.startAt ? new Date(form.startAt) : new Date()
            const ymd = toLocalDateOnly(baseDate.toISOString())
            patchForm({
              allDay: checked,
              startAt: checked ? `${ymd}T00:00` : `${ymd}T09:00`,
              endAt: checked ? `${ymd}T23:59` : `${ymd}T10:00`,
            })
          }}
        />
        All day event
      </label>

      {form.allDay ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Date</label>
          <input
            type="date"
            value={toLocalDateOnly(form.startAt)}
            onChange={e => {
              const d = e.target.value
              patchForm({ startAt: `${d}T00:00`, endAt: `${d}T23:59` })
            }}
            required
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Start
            <input type="datetime-local" value={form.startAt} onChange={e => patchForm({ startAt: e.target.value })} required className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            End (optional)
            <input type="datetime-local" value={form.endAt} onChange={e => patchForm({ endAt: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
          </label>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <input value={form.category} onChange={e => patchForm({ category: e.target.value })} placeholder="Category (e.g. work)" className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
        <input value={form.location} onChange={e => patchForm({ location: e.target.value })} placeholder="Location (optional)" className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
        <input type="number" min="1" max="1440" value={form.estimatedMinutes} onChange={e => patchForm({ estimatedMinutes: e.target.value })} placeholder="Duration (min)" className="h-8 rounded-lg border border-input bg-background px-2 text-xs" />
      </div>
      <textarea value={form.description} onChange={e => patchForm({ description: e.target.value })} rows={2} placeholder="Description (optional)" className="rounded-xl border border-input bg-background px-3 py-2 text-xs" />
      <textarea value={form.notes} onChange={e => patchForm({ notes: e.target.value })} rows={2} placeholder="Notes (optional)" className="rounded-xl border border-input bg-background px-3 py-2 text-xs" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? <Loader2 className="size-3.5 animate-spin" /> : 'Create item'}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

// ─── Calendar Page Main Component ─────────────────────────────────────────────

export function CalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Briefing
  const [briefing, setBriefing] = useState<CalendarBriefing | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  // Smart Plan
  const [showSmart, setShowSmart] = useState(false)
  const [smartText, setSmartText] = useState('')
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartResult, setSmartResult] = useState<SmartSchedule | null>(null)
  const [smartMessage, setSmartMessage] = useState('')

  // UI state
  const [view, setView] = useState<'agenda' | 'day' | 'week' | 'month'>('agenda')
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFormDate, setNewFormDate] = useState<Date | undefined>()

  // Navigation anchors
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())

  // Keep mini calendar month in sync with main currentDate
  useEffect(() => {
    setCalYear(currentDate.getFullYear())
    setCalMonth(currentDate.getMonth())
  }, [currentDate])

  // Keyboard navigation & Esc to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedItem) setSelectedItem(null)
        if (showNewForm) setShowNewForm(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedItem, showNewForm])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const filters: CalendarFilters = {}
      if (debouncedSearch) filters.search = debouncedSearch
      if (filterType) filters.type = filterType
      if (filterPriority) filters.priority = filterPriority
      if (filterStatus) filters.status = filterStatus
      if (filterCategory) filters.category = filterCategory
      const [data, brief] = await Promise.all([
        getCalendarItems(filters),
        getCalendarBriefing().catch(() => null),
      ])
      setItems(data)
      if (brief) setBriefing(brief)
    } catch { setError('Could not load calendar items.') }
    finally { setLoading(false) }
  }, [debouncedSearch, filterType, filterPriority, filterStatus, filterCategory])

  useEffect(() => { void load() }, [load])

  const handleItemUpdated = (updated: CalendarItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === updated.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [updated, ...prev]
    })
    if (selectedItem?.id === updated.id) setSelectedItem(updated)
  }

  const handleItemDeleted = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    if (selectedItem?.id === id) setSelectedItem(null)
  }

  const handleCreated = (item: CalendarItem) => {
    setItems(prev => [...prev, item].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()))
    setShowNewForm(false)
  }

  const handleToggleStatus = async (e: React.MouseEvent, item: CalendarItem) => {
    e.stopPropagation()
    const nextStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    try {
      const updated = await updateCalendarItemStatus(item.id, nextStatus)
      handleItemUpdated(updated)
    } catch {}
  }

  // Mini-calendar date click: Navigates without popping open new item modal
  const handleMiniDateClick = (d: Date) => {
    setCurrentDate(d)
    setView('day')
  }

  // Day cell click: Navigates to that day view
  const handleCellClick = (d: Date) => {
    setCurrentDate(d)
    setView('day')
  }

  // Explicit Add button on cell
  const handleAddNewOnDate = (d: Date) => {
    setCurrentDate(d)
    setNewFormDate(d)
    setShowNewForm(true)
  }

  const runSmartPlan = async (create = false) => {
    if (!smartText.trim()) return
    setSmartLoading(true); setSmartMessage('')
    try {
      const res = await smartSchedule(smartText, { create })
      setSmartResult(res)
      if (create && res.created.length) {
        setSmartMessage(`${res.created.length} item(s) scheduled.`)
        setSmartText('')
        void load()
      }
    } catch (e: any) { setSmartMessage(e?.message || 'Smart planning failed.') }
    finally { setSmartLoading(false) }
  }

  const bookAlternativeSlot = async (slot: SmartProposal) => {
    setSmartLoading(true); setSmartMessage('')
    try {
      const created = await createCalendarItem({
        title: slot.title,
        startAt: slot.startAt,
        endAt: slot.endAt,
        type: slot.type,
        priority: slot.priority,
        estimatedMinutes: slot.estimatedMinutes,
      })
      handleCreated(created)
      setSmartResult(null)
      setSmartText('')
      setSmartMessage(`Scheduled "${slot.title}" successfully!`)
    } catch (e: any) {
      setSmartMessage(e?.message || 'Could not schedule slot.')
    } finally {
      setSmartLoading(false)
    }
  }

  const today = new Date()

  // Day view items sorted by time
  const dayItems = useMemo(() => {
    const list = items.filter(i => doesItemOccurOnDate(i, currentDate))
    return sortItemsByTime(list)
  }, [items, currentDate])

  // Week view items
  const weekStart = useMemo(() => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  }, [currentDate])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  }), [weekStart])

  // Month view items
  const monthDays = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const startDow = first.getDay()
    const days: (Date | null)[] = Array(startDow).fill(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d))
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [currentDate])

  // Agenda days: projects next 30 days plus any items outside this window
  const agendaDays = useMemo(() => {
    const datesSet = new Set<string>()
    // Generate dates for next 30 days starting from today - 3 days
    for (let i = -3; i <= 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dayKey = d.toDateString()
      if (items.some(item => doesItemOccurOnDate(item, d))) {
        datesSet.add(dayKey)
      }
    }
    // Also include any explicit start dates from items
    for (const item of items) {
      const d = new Date(item.startAt)
      if (!Number.isNaN(d.getTime())) {
        datesSet.add(d.toDateString())
      }
    }
    return [...datesSet].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [items])

  const prevPeriod = () => {
    setCurrentDate(d => {
      if (view === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
      if (view === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)
      return new Date(d.getFullYear(), d.getMonth() - 1, 1)
    })
  }

  const nextPeriod = () => {
    setCurrentDate(d => {
      if (view === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      if (view === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
      return new Date(d.getFullYear(), d.getMonth() + 1, 1)
    })
  }

  const activeFiltersCount = [search, filterType, filterPriority, filterStatus, filterCategory].filter(Boolean).length
  const prevMonth = () => { setCalMonth(m => { if (m === 0) { setCalYear(y => y - 1); return 11 } return m - 1 }) }
  const nextMonth = () => { setCalMonth(m => { if (m === 11) { setCalYear(y => y + 1); return 0 } return m + 1 }) }

  return (
    <div className="flex h-full flex-col gap-0 md:flex-row md:gap-0">
      {/* ── Left sidebar ── */}
      <aside className="w-full shrink-0 md:w-64 md:border-r md:border-border/70 md:pr-5">
        {/* Daily Briefing Card */}
        {briefing && (
          <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 text-xs shadow-sm">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>Daily Briefing</span>
            </div>
            <p className="mt-1 text-muted-foreground leading-relaxed">{briefing.summary}</p>
            {briefing.conflictItemIds.length > 0 && (
              <p className="mt-1.5 font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" />
                {briefing.conflictItemIds.length} conflict{briefing.conflictItemIds.length > 1 ? 's' : ''} detected
              </p>
            )}
          </div>
        )}

        {/* Mini calendar */}
        <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={prevMonth} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Previous month">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">
              {new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Next month">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <CalendarGrid year={calYear} month={calMonth} items={items} selectedDate={currentDate} onDateClick={handleMiniDateClick} />
        </div>

        {/* Stats */}
        <div className="mt-4 flex flex-col gap-2">
          {[
            { label: 'Upcoming', value: items.filter(i => i.status === 'PENDING' && new Date(i.startAt) >= new Date()).length, color: 'text-primary' },
            { label: 'Overdue Tasks', value: items.filter(isOverdue).length, color: 'text-red-500' },
            { label: 'Completed', value: items.filter(i => i.status === 'COMPLETED').length, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/80 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <span className={cn('font-semibold', s.color)}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Smart plan toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSmart(s => !s)}
          className="mt-4 w-full justify-start gap-2 border-primary/30 text-primary hover:bg-primary/5"
        >
          <Sparkles className="size-4" />
          {showSmart ? 'Hide Smart Planner' : 'Smart Planning'}
        </Button>
      </aside>

      {/* ── Main content ── */}
      <div className="mt-4 min-w-0 flex-1 md:mt-0 md:pl-6">
        {/* Header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Your Schedule</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Calendar</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* View switcher: agenda, day, week, month */}
            <div className="flex rounded-lg border border-border/80 bg-muted/40 p-0.5">
              {(['agenda', 'day', 'week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                    view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >{v}</button>
              ))}
            </div>
            <Button
              onClick={() => { setNewFormDate(currentDate); setShowNewForm(s => !s) }}
              size="sm"
            >
              <Plus className="size-3.5" /> New item
            </Button>
          </div>
        </div>

        {/* Smart planning drawer/box */}
        {showSmart && (
          <section className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Natural language smart scheduling</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Type what you want to do; LifeOS checks availability and suggests the best slot.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={smartText}
                onChange={e => setSmartText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runSmartPlan() } }}
                placeholder="Tomorrow at 3pm, review product specs for 1 hour"
                className="h-9 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
              <Button variant="outline" size="sm" onClick={() => void runSmartPlan()} disabled={smartLoading}>
                {smartLoading ? <Loader2 className="size-3.5 animate-spin" /> : 'Find slot'}
              </Button>
            </div>
            {smartMessage && <p className="mt-2 text-xs font-medium text-primary">{smartMessage}</p>}
            {smartResult && (
              <div className="mt-3 rounded-xl border border-border bg-background/90 p-4 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('size-2 rounded-full', smartResult.conflicts.length ? 'bg-destructive' : 'bg-emerald-500')} />
                  <p className="font-semibold text-sm">
                    {smartResult.conflicts.length ? 'Scheduling conflict detected' : 'Slot available'}
                  </p>
                </div>
                {smartResult.conflicts.length > 0 && (
                  <div className="rounded-lg bg-destructive/10 p-2.5 text-destructive mb-3">
                    <p className="font-medium">Conflicts with:</p>
                    <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                      {smartResult.conflicts.map(c => (
                        <li key={c.id}>
                          <span className="font-medium">{c.title}</span> ({new Date(c.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {smartResult.alternatives.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    <p className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                      {smartResult.conflicts.length ? 'Suggested Alternative Slots' : 'Proposed Schedule'}
                    </p>
                    {smartResult.alternatives.map((slot, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl border border-border/80 bg-card/60 px-3 py-2">
                        <div>
                          <p className="font-medium text-foreground">{slot.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(slot.startAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {' – '}
                            {new Date(slot.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {slot.estimatedMinutes ? ` (${slot.estimatedMinutes} min)` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void bookAlternativeSlot(slot)}
                          disabled={smartLoading}
                          className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                        >
                          Book slot
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {smartResult.alternatives.length > 0 && !smartResult.conflicts.length && (
                  <Button size="sm" className="mt-3" onClick={() => void runSmartPlan(true)} disabled={smartLoading}>
                    Add to calendar
                  </Button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Search & filter bar */}
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search schedule by title, location, notes…"
                className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  title="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters(s => !s)}
              className={cn(showFilters && 'bg-primary/5 border-primary/30 text-primary')}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => void load()} title="Refresh">
              <RefreshCw className="size-4" />
            </Button>
          </div>
          {showFilters && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-card/80 p-3">
              {[
                { label: 'Type', value: filterType, setter: setFilterType, options: ['', 'EVENT', 'TASK', 'REMINDER'] },
                { label: 'Priority', value: filterPriority, setter: setFilterPriority, options: ['', 'HIGH', 'MEDIUM', 'LOW'] },
                { label: 'Status', value: filterStatus, setter: setFilterStatus, options: ['', 'PENDING', 'COMPLETED', 'OVERDUE', 'CANCELLED'] },
              ].map(f => (
                <label key={f.label} className="flex flex-col gap-0.5 text-xs font-medium">
                  {f.label}
                  <select
                    value={f.value}
                    onChange={e => f.setter(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                  >
                    {f.options.map(o => <option key={o} value={o}>{o || `All ${f.label}s`}</option>)}
                  </select>
                </label>
              ))}
              <label className="flex flex-col gap-0.5 text-xs font-medium">
                Category
                <input
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  placeholder="e.g. work"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                />
              </label>
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setFilterType(''); setFilterPriority(''); setFilterStatus(''); setFilterCategory('') }}
                  className="self-end text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <X className="size-3" /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* New item form */}
        {showNewForm && (
          <div className="mb-4">
            <NewItemForm defaultDate={newFormDate} onCreated={handleCreated} onCancel={() => setShowNewForm(false)} />
          </div>
        )}

        {/* Main area */}
        <div className="flex gap-4">
          {/* List/grid views */}
          <div className={cn('min-w-0 flex-1', selectedItem && 'hidden md:block md:max-w-[calc(100%-320px)]')}>
            {loading ? (
              <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading calendar…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{error}</div>
            ) : view === 'agenda' ? (
              /* ── AGENDA VIEW ── */
              agendaDays.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><CalendarDays className="size-5" /></div>
                  <p className="text-sm font-medium text-muted-foreground">No items found</p>
                  <p className="text-xs text-muted-foreground">Click &quot;New item&quot; to add one, or adjust your filters.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {agendaDays.map(dayKey => {
                    const dayDate = new Date(dayKey)
                    const isCurrent = isSameDay(dayDate, today)
                    const isPast = dayDate < today && !isCurrent
                    const dayEvents = sortItemsByTime(items.filter(i => doesItemOccurOnDate(i, dayDate)))
                    if (dayEvents.length === 0) return null
                    return (
                      <section key={dayKey}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className={cn('text-xs font-semibold', isCurrent ? 'text-primary' : isPast ? 'text-muted-foreground/60' : 'text-muted-foreground')}>
                            {isCurrent ? 'Today' : fmtDate(dayDate)}
                          </span>
                          {isCurrent && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">Today</span>}
                          <div className="h-px flex-1 bg-border/60" />
                          <button
                            onClick={() => handleAddNewOnDate(dayDate)}
                            className="text-[11px] text-muted-foreground/60 hover:text-primary flex items-center gap-0.5"
                          >
                            <Plus className="size-3" /> Add
                          </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {dayEvents.map(item => (
                            <button
                              key={item.id}
                              onClick={() => setSelectedItem(item)}
                              className={cn(
                                'group flex items-center gap-3 rounded-xl border border-border/60 bg-card/90 px-4 py-3 text-left transition-all hover:border-primary/30 hover:shadow-sm',
                                selectedItem?.id === item.id && 'border-primary/40 bg-primary/[0.03] shadow-sm',
                                isOverdue(item) && 'border-red-300/40 bg-red-500/[0.02]',
                                isInProgress(item) && 'border-blue-300/40 bg-blue-500/[0.02]'
                              )}
                            >
                              {/* Quick complete / status toggle */}
                              <button
                                type="button"
                                onClick={e => void handleToggleStatus(e, item)}
                                title={item.status === 'COMPLETED' ? 'Mark as pending' : 'Mark as completed'}
                                className={cn(
                                  'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                  item.status === 'COMPLETED'
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/10'
                                )}
                              >
                                {item.status === 'COMPLETED' && <Check className="size-3 stroke-[3]" />}
                              </button>

                              <span className={cn('size-2 shrink-0 rounded-full', categoryDot(item.category))} />

                              <div className="min-w-0 flex-1">
                                <p className={cn('truncate text-sm font-medium', item.status === 'COMPLETED' && 'text-muted-foreground line-through')}>
                                  {item.title}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {item.allDay ? 'All day' : fmtTime(new Date(item.startAt))}
                                  {item.endAt && !item.allDay && ` – ${fmtTime(new Date(item.endAt))}`}
                                  {item.location && ` · ${item.location}`}
                                </p>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                  item.priority === 'HIGH' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : item.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                                )}>{item.priority}</span>
                                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', STATUS_META[item.status]?.color)}>
                                  {STATUS_META[item.status]?.label}
                                </span>
                              </div>

                              {item.recurrenceRule && (
                                <span title={`Repeats ${FREQ_LABELS[item.recurrenceRule.frequency]}`} className="flex items-center">
                                  <RotateCcw className="size-3 shrink-0 text-muted-foreground/60" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </section>
                    )
                  })}
                </div>
              )
            ) : view === 'day' ? (
              /* ── DAY VIEW ── */
              <div>
                <div className="mb-3 flex items-center justify-between rounded-xl border border-border/60 bg-card/90 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <button onClick={prevPeriod} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Previous day">
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-sm font-semibold">
                      {fmtDate(currentDate)}
                    </span>
                    <button onClick={nextPeriod} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Next day">
                      <ChevronRight className="size-4" />
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs text-primary hover:underline">Today</button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAddNewOnDate(currentDate)}>
                    <Plus className="size-3.5" /> Add item
                  </Button>
                </div>
                {dayItems.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
                    <p className="text-sm font-medium text-muted-foreground">Nothing scheduled for this day</p>
                    <Button size="sm" variant="ghost" onClick={() => handleAddNewOnDate(currentDate)}>Add item</Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border border-border/60 bg-card/90 p-4 text-left transition-all hover:border-primary/30',
                          selectedItem?.id === item.id && 'border-primary/40 bg-primary/[0.03]',
                          isOverdue(item) && 'border-red-300/40 bg-red-500/[0.02]',
                          isInProgress(item) && 'border-blue-300/40 bg-blue-500/[0.02]'
                        )}
                      >
                        <button
                          type="button"
                          onClick={e => void handleToggleStatus(e, item)}
                          title={item.status === 'COMPLETED' ? 'Mark as pending' : 'Mark as completed'}
                          className={cn(
                            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                            item.status === 'COMPLETED'
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/10'
                          )}
                        >
                          {item.status === 'COMPLETED' && <Check className="size-3 stroke-[3]" />}
                        </button>

                        <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', categoryDot(item.category))} />

                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-semibold', item.status === 'COMPLETED' && 'line-through text-muted-foreground')}>{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.allDay ? 'All Day' : `${fmtTime(new Date(item.startAt))} ${item.endAt ? `– ${fmtTime(new Date(item.endAt))}` : ''}`}
                            {item.location && ` · ${item.location}`}
                          </p>
                          {item.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_META[item.status]?.color)}>
                            {STATUS_META[item.status]?.label}
                          </span>
                          {isInProgress(item) && (
                            <span className="text-[10px] font-medium text-blue-500 flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-blue-500 animate-ping" />
                              Active now
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : view === 'week' ? (
              /* ── WEEK VIEW ── */
              <div className="overflow-x-auto">
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={prevPeriod} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Previous week">
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-sm font-medium flex-1 text-center">
                    {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <button onClick={nextPeriod} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Next week">
                    <ChevronRight className="size-4" />
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} className="text-xs text-primary hover:underline">Today</button>
                </div>
                <div className="grid grid-cols-7 gap-1 rounded-xl border border-border/60 bg-card/90 p-2 min-w-[560px]">
                  {weekDays.map(day => {
                    const isCurrent = isSameDay(day, today)
                    const wItems = sortItemsByTime(items.filter(i => doesItemOccurOnDate(i, day)))
                    return (
                      <div key={day.toISOString()} className={cn('flex min-h-[140px] flex-col rounded-lg p-1.5 transition-colors', isCurrent && 'bg-primary/5 ring-1 ring-primary/20')}>
                        <div className={cn('mb-1 flex items-center justify-between', isCurrent ? 'text-primary' : 'text-muted-foreground')}>
                          <span className="text-[10px] font-semibold uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <button
                            type="button"
                            onClick={() => handleCellClick(day)}
                            className={cn('flex size-5 items-center justify-center rounded-full text-xs font-semibold hover:bg-muted', isCurrent && 'bg-primary text-primary-foreground')}
                          >
                            {day.getDate()}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddNewOnDate(day)}
                          className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-primary mb-1"
                        >
                          <Plus className="size-2.5" /> Add
                        </button>
                        <div className="flex flex-col gap-1">
                          {wItems.slice(0, 4).map(i => (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => setSelectedItem(i)}
                              className={cn('w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-colors border', categoryColor(i.category))}
                            >
                              {i.allDay ? '◆ ' : `${fmtTime(new Date(i.startAt))} `}{i.title}
                            </button>
                          ))}
                          {wItems.length > 4 && (
                            <button
                              type="button"
                              onClick={() => handleCellClick(day)}
                              className="text-[10px] text-primary hover:underline font-medium text-left"
                            >
                              +{wItems.length - 4} more
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* ── MONTH VIEW ── */
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={prevPeriod} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Previous month">
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-sm font-semibold flex-1 text-center">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={nextPeriod} className="flex size-7 items-center justify-center rounded-lg hover:bg-muted" title="Next month">
                    <ChevronRight className="size-4" />
                  </button>
                  <button onClick={() => setCurrentDate(new Date())} className="text-xs text-primary hover:underline">Today</button>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/90 p-2 overflow-x-auto">
                  <div className="grid grid-cols-7 mb-2 text-center text-[11px] font-semibold text-muted-foreground">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span key={d}>{d}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthDays.map((d, idx) => {
                      if (!d) return <div key={`empty-${idx}`} className="min-h-[88px] rounded-lg bg-muted/10" />
                      const isCurrent = isSameDay(d, today)
                      const isSelected = isSameDay(d, currentDate)
                      const mItems = sortItemsByTime(items.filter(i => doesItemOccurOnDate(i, d)))
                      return (
                        <div
                          key={d.toISOString()}
                          onClick={() => handleCellClick(d)}
                          className={cn(
                            'group flex min-h-[88px] cursor-pointer flex-col rounded-xl border border-border/40 p-1.5 transition-all hover:border-primary/40 hover:bg-primary/[0.02]',
                            isCurrent && 'bg-primary/5 border-primary/40',
                            isSelected && !isCurrent && 'bg-muted/30 border-border/80'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn('text-xs font-semibold', isCurrent ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}>
                              {d.getDate()}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleAddNewOnDate(d) }}
                              title="Add item on this date"
                              className="rounded p-0.5 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                          <div className="mt-1 flex flex-col gap-1">
                            {mItems.slice(0, 3).map(i => (
                              <button
                                key={i.id}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedItem(i) }}
                                className={cn('w-full truncate rounded px-1.5 py-0.5 text-left text-[9px] font-medium border transition-transform hover:scale-[1.02]', categoryColor(i.category))}
                              >
                                {i.allDay ? '◆ ' : `${fmtTime(new Date(i.startAt))} `}{i.title}
                              </button>
                            ))}
                            {mItems.length > 3 && (
                              <span className="text-[9px] font-medium text-primary hover:underline">
                                +{mItems.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          {selectedItem && (
            <div className="w-full shrink-0 rounded-2xl border border-border/80 bg-card/90 shadow-[0_16px_40px_-30px_color-mix(in_oklab,var(--foreground)_45%,transparent)] md:w-80">
              <ItemPanel
                key={selectedItem.id}
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onUpdated={handleItemUpdated}
                onDeleted={handleItemDeleted}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
