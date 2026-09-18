/**
 * time-remaining.ts
 *
 * Pure, framework-agnostic utility for calculating how much time remains
 * until a task or event deadline. Used by the <TimeRemaining /> component
 * and the useNow() hook throughout LifeOS.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UrgencyLevel =
  | 'normal'      // > 24h remaining  — neutral appearance
  | 'approaching' // 2h – 24h         — amber/warning tone
  | 'imminent'    // 0 – 2h           — orange/strong warning
  | 'due'         // within ±30s      — "Due now"
  | 'overdue'     // past deadline    — red/overdue state
  | 'hidden'      // no countdown shown (completed, cancelled, all-day, no date)

export interface TimeRemainingResult {
  /** Short display label e.g. "2h 35m left" or "Overdue by 12m" */
  label: string
  /** Urgency level controlling visual treatment */
  urgency: UrgencyLevel
  /** Full tooltip text e.g. "Due today at 4:30 PM" */
  tooltip: string
  /** Whether the deadline has passed */
  isOverdue: boolean
  /** Whether the item is due right now (within ±30 seconds) */
  isDue: boolean
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR   = 60 * MINUTE
const DAY    = 24 * HOUR

// Urgency thresholds
const THRESHOLD_DUE        = 30 * SECOND  // ±30s  → "Due now"
const THRESHOLD_IMMINENT   =  2 * HOUR    // 0–2h  → imminent
const THRESHOLD_APPROACHING = 24 * HOUR   // 2h–24h → approaching

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format a positive duration in milliseconds to a human-readable label.
 * Avoids unnecessary precision — shows at most 2 units.
 */
function formatDuration(ms: number): string {
  if (ms < MINUTE) {
    const s = Math.floor(ms / SECOND)
    return `${s}s`
  }
  if (ms < HOUR) {
    const m = Math.floor(ms / MINUTE)
    return `${m}m`
  }
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR)
    const m = Math.floor((ms % HOUR) / MINUTE)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(ms / DAY)
  if (d >= 7) {
    // More than 7 days — show days only
    return `${d}d`
  }
  // 1–7 days: show days + hours
  const h = Math.floor((ms % DAY) / HOUR)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

/**
 * Format the deadline date as a human-readable tooltip.
 * e.g. "Due today at 4:30 PM" or "Due Mon, Sep 21 at 9:00 AM"
 */
function formatTooltip(deadline: Date, now: Date): string {
  const todayStr     = now.toDateString()
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toDateString()

  const timeStr = deadline.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (deadline.toDateString() === todayStr) {
    return `Due today at ${timeStr}`
  }
  if (deadline.toDateString() === tomorrowStr) {
    return `Due tomorrow at ${timeStr}`
  }
  const dateStr = deadline.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return `Due ${dateStr} at ${timeStr}`
}

// ─── Main Export ───────────────────────────────────────────────────────────────

/**
 * Calculate how much time remains until a deadline and return display metadata.
 *
 * @param dueAt  - ISO string or Date representing the deadline
 * @param status - Current task/event status (PENDING, COMPLETED, CANCELLED, OVERDUE, IN_PROGRESS, etc.)
 * @param allDay - Whether the item is an all-day event (suppresses countdown)
 * @param now    - Current time for comparison (defaults to Date.now())
 *
 * @returns TimeRemainingResult with label, urgency, tooltip, isOverdue, isDue
 */
export function formatTimeRemaining(
  dueAt: Date | string | null | undefined,
  status: string,
  allDay = false,
  now: Date = new Date(),
): TimeRemainingResult {
  const hidden: TimeRemainingResult = {
    label: '',
    urgency: 'hidden',
    tooltip: '',
    isOverdue: false,
    isDue: false,
  }

  // Don't show countdown for completed or cancelled tasks
  if (status === 'COMPLETED' || status === 'CANCELLED') return hidden

  // Don't show for all-day events
  if (allDay) return hidden

  // No due date
  if (!dueAt) return hidden

  const deadline = dueAt instanceof Date ? dueAt : new Date(dueAt)
  if (isNaN(deadline.getTime())) return hidden

  const diffMs = deadline.getTime() - now.getTime()
  const absDiff = Math.abs(diffMs)

  // ── Due right now ───────────────────────────────────────────────────────────
  if (absDiff <= THRESHOLD_DUE) {
    return {
      label: 'Due now',
      urgency: 'due',
      tooltip: formatTooltip(deadline, now),
      isOverdue: false,
      isDue: true,
    }
  }

  // ── Past deadline ───────────────────────────────────────────────────────────
  if (diffMs < 0) {
    return {
      label: `Overdue by ${formatDuration(absDiff)}`,
      urgency: 'overdue',
      tooltip: formatTooltip(deadline, now),
      isOverdue: true,
      isDue: false,
    }
  }

  // ── Future ──────────────────────────────────────────────────────────────────
  const label = `${formatDuration(diffMs)} left`
  const tooltip = formatTooltip(deadline, now)

  let urgency: UrgencyLevel
  if (diffMs <= THRESHOLD_IMMINENT) {
    urgency = 'imminent'
  } else if (diffMs <= THRESHOLD_APPROACHING) {
    urgency = 'approaching'
  } else {
    urgency = 'normal'
  }

  return { label, urgency, tooltip, isOverdue: false, isDue: false }
}
