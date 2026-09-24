import { processAlerts } from './alert-engine.js'

let intervalId: NodeJS.Timeout | null = null
let isProcessing = false

export function startAlertScheduler(intervalMs = 20000): void {
  if (intervalId) return

  console.log(`[AlertScheduler] Starting background alert scheduler (interval: ${intervalMs}ms)`)

  // Initial immediate sweep
  void runTick()

  intervalId = setInterval(() => {
    void runTick()
  }, intervalMs)

  // Allow Node process to exit gracefully if only this timer is pending
  intervalId.unref()
}

export function stopAlertScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[AlertScheduler] Background alert scheduler stopped')
  }
}

async function runTick(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    const res = await processAlerts()
    if (res.deliveries > 0 || res.missed > 0) {
      console.log(`[AlertScheduler] Sweep completed: ${res.deliveries} deliveries dispatched, ${res.missed} missed alerts flagged`)
    }
  } catch (err) {
    console.error('[AlertScheduler] Error in scheduler tick:', err)
  } finally {
    isProcessing = false
  }
}
