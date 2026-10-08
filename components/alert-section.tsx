'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Bell, BellOff, Plus, Trash2, ChevronDown, ChevronUp, Volume2, VolumeX,
  Zap, AlertTriangle, Shield, Clock, Mail, Monitor, Headphones, ToggleLeft,
  ToggleRight, Play, Square, Loader2, Copy, Settings2, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createAlert, updateAlert, deleteAlert, listAlerts, applyAlertPreset,
  type AlertItem, type AlertInput, type AlertChannel, type AlertSeverity
} from '@/lib/api'
import { playSound, stopCurrentSound, SOUND_OPTIONS, type SoundName } from '@/lib/sounds'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS: { value: AlertChannel; label: string; icon: typeof Bell; description: string }[] = [
  { value: 'IN_APP', label: 'In-App', icon: Bell, description: 'Show in notification center' },
  { value: 'BROWSER', label: 'Browser', icon: Monitor, description: 'Browser/system notification' },
  { value: 'SOUND', label: 'Sound', icon: Headphones, description: 'Play alert sound' },
  { value: 'EMAIL', label: 'Email', icon: Mail, description: 'Send email notification' },
]

const SEVERITY_OPTIONS: { value: AlertSeverity; label: string; icon: typeof Shield; color: string; description: string }[] = [
  { value: 'NORMAL', label: 'Normal', icon: Shield, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', description: 'In-App / Browser' },
  { value: 'IMPORTANT', label: 'Important', icon: AlertTriangle, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', description: 'Browser + optional Sound' },
  { value: 'CRITICAL', label: 'Critical', icon: Zap, color: 'text-red-500 bg-red-500/10 border-red-500/20', description: 'Sound + Email escalation' },
]

const SNOOZE_PRESETS = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
]

const TIME_UNIT_OPTIONS = [
  { label: 'minutes', divisor: 1 },
  { label: 'hours', divisor: 60 },
  { label: 'days', divisor: 1440 },
  { label: 'weeks', divisor: 10080 },
]

const OFFSET_PRESETS = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: '1 day', minutes: 1440 },
  { label: '3 days', minutes: 4320 },
  { label: '1 week', minutes: 10080 },
]

const PRESET_OPTIONS = [
  { value: 'BIRTHDAY', label: '🎂 Birthday', description: '7d Email, 1d Browser, 2h Sound' },
  { value: 'DEADLINE', label: '📅 Deadline', description: '1d Email+App, 1h Browser+Sound, 10m Critical' },
  { value: 'MEETING', label: '👥 Meeting', description: '30m Browser, 5m Sound' },
  { value: 'ESCALATION', label: '⬆️ Escalation', description: '3h App → 1h Browser → 20m Sound → 5m Critical' },
] as const

function formatOffset(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} day${Math.floor(minutes / 1440) > 1 ? 's' : ''}`
  return `${Math.floor(minutes / 10080)} week${Math.floor(minutes / 10080) > 1 ? 's' : ''}`
}

function channelIcons(channels: string[]): string {
  const icons: string[] = []
  if (channels.includes('IN_APP')) icons.push('🔔')
  if (channels.includes('BROWSER')) icons.push('🖥️')
  if (channels.includes('SOUND')) icons.push('🔊')
  if (channels.includes('EMAIL')) icons.push('📧')
  return icons.join(' ')
}

function AlertSummary({ alert }: { alert: AlertItem }) {
  const severity = SEVERITY_OPTIONS.find(s => s.value === alert.severity)
  const SeverityIcon = severity?.icon || Shield

  const timing = alert.triggerType === 'EXACT_TIME'
    ? alert.exactTime ? new Date(alert.exactTime).toLocaleString() : 'at exact time'
    : `${formatOffset(alert.offsetMinutes || 0)} before`

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]', severity?.color)}>
        <SeverityIcon className="size-3" />
      </span>
      <span className="text-xs font-medium text-foreground truncate">{timing}</span>
      <span className="text-xs text-muted-foreground">{channelIcons(alert.channels)}</span>
    </div>
  )
}

// ─── Single Alert Editor ──────────────────────────────────────────────────────

interface AlertEditorRowProps {
  alert: AlertItem
  index: number
  onUpdate: (id: string, payload: Partial<AlertInput>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  isDeleting: boolean
  isSaving: boolean
}

function AlertEditorRow({ alert, index, onUpdate, onDelete, isDeleting, isSaving }: AlertEditorRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [playingSound, setPlayingSound] = useState(false)
  const [localAlert, setLocalAlert] = useState(alert)

  useEffect(() => { setLocalAlert(alert) }, [alert])

  const handleChannelToggle = (ch: AlertChannel) => {
    const channels = localAlert.channels.includes(ch)
      ? localAlert.channels.filter(c => c !== ch)
      : [...localAlert.channels, ch]
    const updated = { ...localAlert, channels }
    setLocalAlert(updated)
    void onUpdate(alert.id, { channels })
  }

  const handlePresetOffset = (minutes: number) => {
    const updated = { ...localAlert, offsetMinutes: minutes, triggerType: 'OFFSET_BEFORE' as const }
    setLocalAlert(updated)
    void onUpdate(alert.id, { offsetMinutes: minutes, triggerType: 'OFFSET_BEFORE' })
  }

  const handleSeverity = (severity: AlertSeverity) => {
    const updated = { ...localAlert, severity }
    setLocalAlert(updated)
    void onUpdate(alert.id, { severity })
  }

  const handleSoundChange = (soundName: string) => {
    const updated = { ...localAlert, soundName }
    setLocalAlert(updated)
    void onUpdate(alert.id, { soundName })
  }

  const handleVolumeChange = (soundVolume: number) => {
    const updated = { ...localAlert, soundVolume }
    setLocalAlert(updated)
    void onUpdate(alert.id, { soundVolume })
  }

  const handleRepeatChange = (soundRepeat: number) => {
    const updated = { ...localAlert, soundRepeat }
    setLocalAlert(updated)
    void onUpdate(alert.id, { soundRepeat })
  }

  const handleToggleEnabled = () => {
    const updated = { ...localAlert, enabled: !localAlert.enabled }
    setLocalAlert(updated)
    void onUpdate(alert.id, { enabled: !localAlert.enabled })
  }

  const handleTestSound = async () => {
    setPlayingSound(true)
    stopCurrentSound()
    try {
      await playSound(
        (localAlert.soundName || 'REMINDER') as SoundName,
        { volume: localAlert.soundVolume, repeat: localAlert.soundRepeat }
      )
    } finally {
      setTimeout(() => setPlayingSound(false), 1000)
    }
  }

  const showSoundOptions = localAlert.channels.includes('SOUND')

  return (
    <div className={cn(
      'group rounded-xl border transition-all',
      localAlert.enabled
        ? 'border-border/70 bg-card hover:border-border'
        : 'border-border/30 bg-muted/20 opacity-60'
    )}>
      {/* Row Header */}
      <div className="flex items-center gap-2 p-3">
        <span className="text-xs font-bold text-muted-foreground/60 w-4 shrink-0">#{index + 1}</span>
        <div className="flex-1 min-w-0">
          <AlertSummary alert={localAlert} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Enable/Disable Toggle */}
          <button
            type="button"
            onClick={handleToggleEnabled}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            title={localAlert.enabled ? 'Disable alert' : 'Enable alert'}
          >
            {localAlert.enabled
              ? <ToggleRight className="size-3.5 text-primary" />
              : <ToggleLeft className="size-3.5" />
            }
          </button>
          {/* Expand Button */}
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex items-center justify-center size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {/* Delete Button */}
          <button
            type="button"
            onClick={() => void onDelete(alert.id)}
            disabled={isDeleting}
            className="flex items-center justify-center size-6 rounded-md hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Editor */}
      {expanded && (
        <div className="border-t border-border/40 p-3 space-y-4">
          {/* Timing */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Timing</p>
            <div className="flex flex-wrap gap-1.5">
              {OFFSET_PRESETS.map(preset => (
                <button
                  key={preset.minutes}
                  type="button"
                  onClick={() => handlePresetOffset(preset.minutes)}
                  className={cn(
                    'rounded-lg border px-2 py-1 text-xs font-medium transition-colors',
                    localAlert.offsetMinutes === preset.minutes && localAlert.triggerType === 'OFFSET_BEFORE'
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Channels</p>
            <div className="flex flex-wrap gap-1.5">
              {CHANNELS.map(ch => {
                const Icon = ch.icon
                const active = localAlert.channels.includes(ch.value)
                return (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => handleChannelToggle(ch.value)}
                    title={ch.description}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                      active
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border/60 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="size-3" />
                    {ch.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sound Options */}
          {showSoundOptions && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sound</p>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {SOUND_OPTIONS.filter(s => s.value !== 'SILENT').map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSoundChange(s.value)}
                      className={cn(
                        'rounded-lg border px-2 py-1 text-xs font-medium transition-colors',
                        localAlert.soundName === s.value
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border/60 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {/* Volume */}
                <div className="flex items-center gap-2">
                  <VolumeX className="size-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={localAlert.soundVolume}
                    onChange={e => handleVolumeChange(Number(e.target.value))}
                    className="flex-1 h-1.5 accent-primary"
                  />
                  <Volume2 className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground w-8 text-right">{localAlert.soundVolume}%</span>
                </div>
                {/* Repeat + Test */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Repeat
                    <select
                      value={localAlert.soundRepeat}
                      onChange={e => handleRepeatChange(Number(e.target.value))}
                      className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
                    >
                      {[1, 2, 3, 4, 5].map(n => (
                        <option key={n} value={n}>{n}×</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleTestSound()}
                    disabled={playingSound}
                    className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {playingSound ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => { stopCurrentSound(); setPlayingSound(false) }}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Square className="size-3" />
                    Stop
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Severity */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Severity</p>
            <div className="flex gap-1.5">
              {SEVERITY_OPTIONS.map(s => {
                const Icon = s.icon
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => handleSeverity(s.value)}
                    title={s.description}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                      localAlert.severity === s.value
                        ? cn('border font-semibold', s.color)
                        : 'border-border/60 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="size-3" />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main AlertSection Component ──────────────────────────────────────────────

interface AlertSectionProps {
  calendarItemId: string
  initialAlerts?: AlertItem[]
  onAlertsChange?: (alerts: AlertItem[]) => void
}

export function AlertSection({ calendarItemId, initialAlerts = [], onAlertsChange }: AlertSectionProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [applyingPreset, setApplyingPreset] = useState(false)
  const [msg, setMsg] = useState('')

  const refreshAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAlerts(calendarItemId)
      setAlerts(data)
      onAlertsChange?.(data)
    } finally {
      setLoading(false)
    }
  }, [calendarItemId, onAlertsChange])

  useEffect(() => {
    if (open && alerts.length === 0) {
      void refreshAlerts()
    }
  }, [open])

  const handleAddAlert = async () => {
    setAdding(true)
    setMsg('')
    try {
      const newAlert = await createAlert({
        calendarItemId,
        offsetMinutes: 15,
        channels: ['IN_APP', 'BROWSER'],
        severity: 'NORMAL',
        soundName: 'REMINDER',
        soundVolume: 80,
        soundRepeat: 1,
        enabled: true,
        order: alerts.length,
      })
      const updated = [...alerts, newAlert]
      setAlerts(updated)
      onAlertsChange?.(updated)
    } catch {
      setMsg('Could not add alert.')
    } finally {
      setAdding(false)
    }
  }

  const handleUpdateAlert = async (id: string, payload: Partial<AlertInput>) => {
    setSaving(id)
    try {
      const updated = await updateAlert(id, payload)
      const newAlerts = alerts.map(a => a.id === id ? { ...a, ...updated } : a)
      setAlerts(newAlerts)
      onAlertsChange?.(newAlerts)
    } catch {
      setMsg('Failed to update alert.')
    } finally {
      setSaving(null)
    }
  }

  const handleDeleteAlert = async (id: string) => {
    setDeleting(id)
    try {
      await deleteAlert(id)
      const newAlerts = alerts.filter(a => a.id !== id)
      setAlerts(newAlerts)
      onAlertsChange?.(newAlerts)
    } catch {
      setMsg('Failed to delete alert.')
    } finally {
      setDeleting(null)
    }
  }

  const handleApplyPreset = async (preset: 'BIRTHDAY' | 'DEADLINE' | 'MEETING' | 'ESCALATION') => {
    setApplyingPreset(true)
    setMsg('')
    try {
      const newAlerts = await applyAlertPreset(calendarItemId, preset)
      setAlerts(newAlerts)
      onAlertsChange?.(newAlerts)
      setShowPresets(false)
    } catch {
      setMsg('Failed to apply preset.')
    } finally {
      setApplyingPreset(false)
    }
  }

  const alertCount = alerts.length
  const enabledCount = alerts.filter(a => a.enabled).length

  return (
    <div>
      {/* Section Toggle */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {alertCount > 0
          ? <Bell className="size-3.5 text-primary" />
          : <BellOff className="size-3.5" />
        }
        <span>
          {alertCount === 0
            ? 'Add alerts'
            : `${alertCount} alert${alertCount > 1 ? 's' : ''}${enabledCount < alertCount ? ` (${enabledCount} active)` : ''}`
          }
        </span>
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {/* Alert Panel */}
      {open && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Alert List */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  {alerts.map((alert, idx) => (
                    <AlertEditorRow
                      key={alert.id}
                      alert={alert}
                      index={idx}
                      onUpdate={handleUpdateAlert}
                      onDelete={handleDeleteAlert}
                      isDeleting={deleting === alert.id}
                      isSaving={saving === alert.id}
                    />
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleAddAlert()}
                  disabled={adding}
                  className="h-7 gap-1.5 text-xs"
                >
                  {adding ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  Add alert
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPresets(s => !s)}
                  className="h-7 gap-1.5 text-xs text-muted-foreground"
                >
                  <Settings2 className="size-3" />
                  Presets
                  {showPresets ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </Button>
              </div>

              {/* Presets Drawer */}
              {showPresets && (
                <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Smart Presets — replaces existing alerts
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_OPTIONS.map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => void handleApplyPreset(preset.value)}
                        disabled={applyingPreset}
                        className="flex flex-col items-start rounded-lg border border-border/60 bg-card p-2.5 text-left hover:border-primary/30 hover:bg-primary/5 transition-all"
                      >
                        <span className="text-xs font-semibold text-foreground">{preset.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{preset.description}</span>
                      </button>
                    ))}
                  </div>
                  {applyingPreset && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Applying preset...
                    </div>
                  )}
                </div>
              )}

              {msg && <p className="text-xs text-destructive">{msg}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
