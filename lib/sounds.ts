'use client'

export type SoundName = 'SILENT' | 'SOFT' | 'REMINDER' | 'URGENT' | 'CRITICAL'

interface SoundConfig {
  label: string
  description: string
  frequency: number[]
  duration: number[]
  type: OscillatorType
  gainEnvelope?: number[]
}

const SOUND_CONFIGS: Record<SoundName, SoundConfig> = {
  SILENT: {
    label: 'Silent',
    description: 'No sound',
    frequency: [],
    duration: [],
    type: 'sine',
  },
  SOFT: {
    label: 'Soft',
    description: 'Gentle chime',
    frequency: [523, 659, 784],
    duration: [0.15, 0.15, 0.3],
    type: 'sine',
    gainEnvelope: [0.6, 0.4, 0.2],
  },
  REMINDER: {
    label: 'Reminder',
    description: 'Standard notification',
    frequency: [880, 0, 880, 880],
    duration: [0.1, 0.08, 0.1, 0.2],
    type: 'sine',
    gainEnvelope: [0.8, 0, 0.8, 0.5],
  },
  URGENT: {
    label: 'Urgent',
    description: 'Attention-grabbing alert',
    frequency: [1047, 831, 1047, 831, 1047],
    duration: [0.15, 0.1, 0.15, 0.1, 0.25],
    type: 'square',
    gainEnvelope: [0.7, 0.5, 0.7, 0.5, 0.3],
  },
  CRITICAL: {
    label: 'Critical',
    description: 'High-priority emergency alert',
    frequency: [1319, 1047, 1319, 1047, 1319, 1047],
    duration: [0.12, 0.08, 0.12, 0.08, 0.12, 0.4],
    type: 'sawtooth',
    gainEnvelope: [0.9, 0.7, 0.9, 0.7, 0.9, 0.5],
  },
}

export const SOUND_OPTIONS = Object.entries(SOUND_CONFIGS).map(([key, cfg]) => ({
  value: key as SoundName,
  label: cfg.label,
  description: cfg.description,
}))

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext || audioContext.state === 'closed') {
    try {
      audioContext = new AudioContext()
    } catch {
      return null
    }
  }
  return audioContext
}

export async function resumeAudioContext(): Promise<boolean> {
  const ctx = getAudioContext()
  if (!ctx) return false
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
      const state: string = ctx.state
      return state === 'running'
    } catch {
      return false
    }
  }
  const state: string = ctx.state
  return state === 'running'
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  startTime: number,
  gain: number,
  type: OscillatorType = 'sine',
  volume = 1.0
): void {
  if (frequency === 0) return

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startTime)

  const effectiveGain = gain * volume
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(effectiveGain, startTime + 0.01)
  gainNode.gain.linearRampToValueAtTime(effectiveGain * 0.7, startTime + duration * 0.5)
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration - 0.01)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}

export async function playSound(
  soundName: SoundName,
  options: { volume?: number; repeat?: number } = {}
): Promise<{ success: boolean; error?: string }> {
  if (soundName === 'SILENT') return { success: true }

  const cfg = SOUND_CONFIGS[soundName]
  if (!cfg || cfg.frequency.length === 0) return { success: true }

  const ctx = getAudioContext()
  if (!ctx) return { success: false, error: 'Web Audio API not supported' }

  const resumed = await resumeAudioContext()
  if (!resumed) {
    return { success: false, error: 'AudioContext requires user interaction first' }
  }

  const volume = Math.min(Math.max((options.volume ?? 80) / 100, 0), 1)
  const repeat = Math.max(options.repeat ?? 1, 1)

  try {
    let startTime = ctx.currentTime

    for (let r = 0; r < repeat; r++) {
      for (let i = 0; i < cfg.frequency.length; i++) {
        const freq = cfg.frequency[i]
        const dur = cfg.duration[i]
        const gain = cfg.gainEnvelope?.[i] ?? 0.8
        playTone(ctx, freq, dur, startTime, gain, cfg.type, volume)
        startTime += dur
      }
      if (r < repeat - 1) startTime += 0.3
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to play sound' }
  }
}

let activeSoundStopTime: number | null = null

export function stopCurrentSound(): void {
  // AudioContext cannot easily stop individual scheduled sounds,
  // but we can signal stop by creating silence or closing context
  if (audioContext && audioContext.state !== 'closed') {
    try {
      audioContext.close()
      audioContext = null
    } catch {}
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'denied'
  }
}

export function showBrowserNotification(
  title: string,
  options: { body?: string; icon?: string; tag?: string; silent?: boolean } = {}
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false

  try {
    new Notification(title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag || 'lifeos-alert',
      silent: options.silent || false,
    })
    return true
  } catch {
    return false
  }
}
