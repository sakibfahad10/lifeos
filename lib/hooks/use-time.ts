/**
 * use-time.ts
 *
 * Shared singleton timer hook for LifeOS.
 *
 * Instead of creating an independent setInterval per component (which causes
 * memory leaks and unnecessary re-renders when many tasks are visible), this
 * hook maintains ONE global interval. All components that call useNow() share
 * the same tick source.
 *
 * The interval fires every 30 seconds — sufficient for countdown precision
 * without burning CPU cycles.
 */

'use client'

import { useEffect, useState } from 'react'

// ─── Singleton timer state ─────────────────────────────────────────────────────

let subscribers = 0
let intervalId: ReturnType<typeof setInterval> | null = null

// Shared mutable "now" value — updated by the single timer
let sharedNow = new Date()

// Listener callbacks registered by each useNow() call
const listeners = new Set<(now: Date) => void>()

function tick() {
  sharedNow = new Date()
  listeners.forEach(fn => fn(sharedNow))
}

function subscribe(fn: (now: Date) => void, intervalMs: number) {
  listeners.add(fn)
  subscribers++

  // Start the global interval only when first subscriber joins
  if (!intervalId) {
    intervalId = setInterval(tick, intervalMs)
  }

  return () => {
    listeners.delete(fn)
    subscribers--
    // Clean up the interval when last subscriber leaves
    if (subscribers === 0 && intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Returns the current time as a Date, updated on a shared interval.
 *
 * All components using this hook share ONE global setInterval — no matter
 * how many task cards are displayed simultaneously, there is only one timer.
 *
 * @param intervalMs - Update interval in milliseconds. Default: 30,000 (30s).
 *   Pass a smaller value (e.g., 10_000) for testing or when sub-minute
 *   precision is needed (e.g., countdown reaching final seconds).
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState<Date>(sharedNow)

  useEffect(() => {
    // Immediately sync to current shared time
    setNow(new Date())

    // Subscribe to future ticks
    const unsubscribe = subscribe(setNow, intervalMs)
    return unsubscribe
  // intervalMs is intentionally excluded from deps — changing interval mid-mount
  // would require re-creating the shared timer. Keep it stable at call site.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return now
}
