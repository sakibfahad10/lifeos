'use client'

/**
 * TimeRemaining component
 *
 * Displays a compact, urgency-aware countdown for a task or event deadline.
 * Updates automatically via the shared useNow() timer — no per-instance timers.
 *
 * Usage:
 *   <TimeRemaining dueAt={item.startAt} status={item.status} />
 *   <TimeRemaining dueAt={item.endAt ?? item.startAt} status={item.status} allDay={item.allDay} />
 *
 * Visual behaviour:
 *   - Hidden for completed, cancelled, all-day, or no-due-date items
 *   - Normal (> 24h):       neutral muted text
 *   - Approaching (2–24h):  amber text
 *   - Imminent (0–2h):      orange-red text with subtle background
 *   - Due now (±30s):       red text, "Due now"
 *   - Overdue:              red text, "Overdue by X"
 */

import { cn } from '@/lib/utils'
import { formatTimeRemaining, type UrgencyLevel } from '@/lib/time-remaining'
import { useNow } from '@/lib/hooks/use-time'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimeRemainingProps {
  /**
   * The deadline ISO string. For tasks, use endAt if available, otherwise startAt.
   * For calendar events with a specific due time, pass endAt.
   */
  dueAt: string | null | undefined
  /** Current status of the task/event */
  status: string
  /** Whether the item is an all-day event — suppresses countdown */
  allDay?: boolean
  /** Optional additional className on the root element */
  className?: string
  /**
   * Display variant:
   * - 'badge' (default): compact pill with background — used in task lists
   * - 'inline': no background, fits inside existing text rows
   */
  variant?: 'badge' | 'inline'
}

// ─── Urgency → CSS class mapping ─────────────────────────────────────────────

const URGENCY_CLASS: Record<UrgencyLevel, string> = {
  normal:     'tr-normal',
  approaching:'tr-approaching',
  imminent:   'tr-imminent',
  due:        'tr-due',
  overdue:    'tr-overdue',
  hidden:     '',
}

const BADGE_URGENCY_CLASS: Record<UrgencyLevel, string> = {
  normal:     'tr-badge-normal',
  approaching:'tr-badge-approaching',
  imminent:   'tr-badge-imminent',
  due:        'tr-badge-due',
  overdue:    'tr-badge-overdue',
  hidden:     '',
}

// ─── Icon ────────────────────────────────────────────────────────────────────

/** Compact clock icon glyph — avoids importing lucide for this tiny component */
function ClockGlyph({ urgency }: { urgency: UrgencyLevel }) {
  if (urgency === 'overdue') return <span aria-hidden>⚠</span>
  if (urgency === 'due') return <span aria-hidden>●</span>
  return <span aria-hidden>◷</span>
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TimeRemaining({
  dueAt,
  status,
  allDay = false,
  className,
  variant = 'badge',
}: TimeRemainingProps) {
  const now = useNow()
  const result = formatTimeRemaining(dueAt, status, allDay, now)

  if (result.urgency === 'hidden') return null

  const urgencyClass = variant === 'badge'
    ? BADGE_URGENCY_CLASS[result.urgency]
    : URGENCY_CLASS[result.urgency]

  return (
    <span
      className={cn(
        'tr-root inline-flex items-center gap-1 font-medium tabular-nums',
        urgencyClass,
        className,
      )}
      title={result.tooltip}
      aria-label={result.label}
    >
      <ClockGlyph urgency={result.urgency} />
      <span>{result.label}</span>
    </span>
  )
}
