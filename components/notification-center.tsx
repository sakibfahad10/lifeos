'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Bell, BellOff, X, Check, CheckCheck, Clock, Zap, AlertTriangle, Shield,
  Mail, Monitor, Headphones, ChevronDown, ChevronUp, Trash2, RefreshCw,
  Volume2, Filter, Search, Loader2, Send, SlidersHorizontal, MoreHorizontal,
  AlarmClock, CalendarClock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getNotifications, getNotificationSummary, markNotificationRead,
  markAllNotificationsRead, deleteNotification, snoozeNotification,
  dismissNotification, sendDailyDigest,
  type NotificationItem, type AlertSeverity, type AlertChannel
} from '@/lib/api'
import { playSound, showBrowserNotification, type SoundName } from '@/lib/sounds'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<AlertSeverity, { icon: typeof Shield; color: string; badge: string; label: string }> = {
  NORMAL: {
    icon: Shield,
    color: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    label: 'Normal',
  },
  IMPORTANT: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    label: 'Important',
  },
  CRITICAL: {
    icon: Zap,
    color: 'text-red-500',
    badge: 'bg-red-500/10 text-red-500 border-red-500/20',
    label: 'Critical',
  },
}

const SNOOZE_PRESETS = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
]

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function formatSnoozedUntil(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `until ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  return `until ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function channelBadges(channels: AlertChannel[]) {
  return channels.map(ch => {
    if (ch === 'IN_APP') return <span key={ch} title="In-App"><Bell className="size-3 text-muted-foreground/70" /></span>
    if (ch === 'BROWSER') return <span key={ch} title="Browser"><Monitor className="size-3 text-muted-foreground/70" /></span>
    if (ch === 'SOUND') return <span key={ch} title="Sound"><Volume2 className="size-3 text-muted-foreground/70" /></span>
    if (ch === 'EMAIL') return <span key={ch} title="Email"><Mail className="size-3 text-muted-foreground/70" /></span>
    return null
  })
}

// ─── Notification Card ────────────────────────────────────────────────────────

interface NotificationCardProps {
  notification: NotificationItem
  onSnooze: (id: string, minutes: number) => Promise<void>
  onDismiss: (id: string) => Promise<void>
  onMarkRead: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  actionLoading: boolean
}

function NotificationCard({ notification: n, onSnooze, onDismiss, onMarkRead, onDelete, actionLoading }: NotificationCardProps) {
  const [showSnooze, setShowSnooze] = useState(false)
  const [hovered, setHovered] = useState(false)

  const severity = (n.severity || 'NORMAL') as AlertSeverity
  const SeverityIcon = SEVERITY_CONFIG[severity].icon
  const isSnoozed = !!n.snoozedUntil && new Date(n.snoozedUntil) > new Date()
  const isRead = !!n.readAt
  const isDismissed = n.status === 'DISMISSED'

  return (
    <div
      className={cn(
        'group relative rounded-xl border transition-all duration-200',
        isDismissed && 'opacity-50',
        !isRead && !isDismissed ? 'border-primary/20 bg-primary/[0.03]' : 'border-border/50 bg-card/50',
        hovered && 'shadow-sm border-border/80'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowSnooze(false) }}
    >
      {/* Unread dot */}
      {!isRead && !isDismissed && (
        <span className="absolute top-3 left-3 size-2 rounded-full bg-primary ring-2 ring-background" />
      )}

      <div className="flex items-start gap-3 p-3 pl-7">
        {/* Severity Icon */}
        <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border', SEVERITY_CONFIG[severity].badge)}>
          <SeverityIcon className="size-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn('text-sm font-semibold leading-tight', isRead && 'font-medium text-foreground/80')}>
                {n.title}
              </p>
              {n.calendarItem && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  📅 {n.calendarItem.title}
                </p>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
          </div>

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>

          {/* Snoozed Banner */}
          {isSnoozed && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600">
              <AlarmClock className="size-3" />
              Snoozed {formatSnoozedUntil(n.snoozedUntil!)}
            </div>
          )}

          {/* Channel badges */}
          {n.channels && n.channels.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1">
              {channelBadges(n.channels as AlertChannel[])}
            </div>
          )}

          {/* Actions */}
          <div className={cn('mt-2 flex flex-wrap items-center gap-1.5 transition-opacity', hovered ? 'opacity-100' : 'opacity-0')}>
            {!isDismissed && (
              <>
                {/* Snooze */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSnooze(s => !s)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Clock className="size-3" />
                    Snooze
                    <ChevronDown className={cn('size-2.5 transition-transform', showSnooze && 'rotate-180')} />
                  </button>
                  {showSnooze && (
                    <div className="absolute bottom-full left-0 mb-1 flex flex-col gap-0.5 rounded-xl border border-border bg-popover p-1.5 shadow-xl z-50 min-w-[110px]">
                      {SNOOZE_PRESETS.map(preset => (
                        <button
                          key={preset.minutes}
                          type="button"
                          onClick={() => { setShowSnooze(false); void onSnooze(n.id, preset.minutes) }}
                          className="rounded-md px-3 py-1.5 text-left text-xs font-medium text-foreground hover:bg-muted transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dismiss */}
                <button
                  type="button"
                  onClick={() => void onDismiss(n.id)}
                  disabled={actionLoading}
                  className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="size-3" />
                  Dismiss
                </button>

                {/* Mark Read */}
                {!isRead && (
                  <button
                    type="button"
                    onClick={() => void onMarkRead(n.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <Check className="size-3" />
                    Mark read
                  </button>
                )}
              </>
            )}

            {/* Delete */}
            <button
              type="button"
              onClick={() => void onDelete(n.id)}
              disabled={actionLoading}
              className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11px] font-medium text-muted-foreground/60 hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive transition-colors"
            >
              <Trash2 className="size-3" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Notification Center Panel ─────────────────────────────────────────────────

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [summary, setSummary] = useState<{
    unreadCount: number
    today: NotificationItem[]
    missed: NotificationItem[]
    upcoming: NotificationItem[]
    recent: NotificationItem[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | 'UNREAD' | 'SNOOZED'>('ALL')
  const [activeSection, setActiveSection] = useState<'TODAY' | 'MISSED' | 'UPCOMING' | 'RECENT'>('TODAY')
  const [digestSending, setDigestSending] = useState(false)
  const [digestMsg, setDigestMsg] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [notifs, summaryData] = await Promise.all([
        getNotifications({ limit: 50 }),
        getNotificationSummary().catch(() => null),
      ])
      setNotifications(notifs)
      setSummary(summaryData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => void load(), 30000)
    return () => clearInterval(interval)
  }, [isOpen, load])

  const handleSnooze = async (id: string, minutes: number) => {
    setActionLoading(true)
    try {
      await snoozeNotification(id, minutes)
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  const handleDismiss = async (id: string) => {
    setActionLoading(true)
    try {
      await dismissNotification(id)
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkRead = async (id: string) => {
    setActionLoading(true)
    try {
      await markNotificationRead(id)
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(true)
    try {
      await deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkAllRead = async () => {
    setActionLoading(true)
    try {
      await markAllNotificationsRead()
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  const handleDigest = async () => {
    setDigestSending(true)
    setDigestMsg('')
    try {
      const result = await sendDailyDigest()
      setDigestMsg(result.success ? '✓ Daily digest sent!' : '✗ Digest failed.')
      setTimeout(() => setDigestMsg(''), 4000)
    } catch {
      setDigestMsg('✗ Could not send digest.')
    } finally {
      setDigestSending(false)
    }
  }

  // Filtered notification list
  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filterType === 'ALL' ||
      (filterType === 'UNREAD' && !n.readAt && n.status !== 'DISMISSED') ||
      (filterType === 'SNOOZED' && !!n.snoozedUntil && new Date(n.snoozedUntil) > new Date())
    return matchesSearch && matchesFilter
  })

  const getSectionList = () => {
    if (!summary) return filteredNotifications
    switch (activeSection) {
      case 'TODAY': return summary.today
      case 'MISSED': return summary.missed
      case 'UPCOMING': return summary.upcoming
      case 'RECENT': return summary.recent
    }
  }

  const displayList = summary ? getSectionList() : filteredNotifications
  const unreadCount = summary?.unreadCount ?? notifications.filter(n => !n.readAt).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-14 pr-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={panelRef}
        className="w-[400px] max-h-[calc(100vh-80px)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in slide-in-from-right-4 fade-in-0 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Digest button */}
            <button
              type="button"
              onClick={() => void handleDigest()}
              disabled={digestSending}
              title="Send daily email digest"
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {digestSending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
            </button>
            {/* Mark all read */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={actionLoading}
                title="Mark all as read"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <CheckCheck className="size-3.5" />
              </button>
            )}
            {/* Refresh */}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </button>
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {digestMsg && (
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            {digestMsg}
          </div>
        )}

        {/* Summary Sections (if available) */}
        {summary && (
          <div className="flex border-b border-border">
            {[
              { key: 'TODAY', label: 'Today', count: summary.today.length },
              { key: 'MISSED', label: 'Missed', count: summary.missed.length },
              { key: 'UPCOMING', label: 'Upcoming', count: summary.upcoming.length },
              { key: 'RECENT', label: 'All', count: summary.recent.length },
            ].map(section => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key as any)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center py-2.5 text-[11px] font-medium transition-colors border-b-2',
                  activeSection === section.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <span className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold mb-0.5',
                  activeSection === section.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  section.key === 'MISSED' && section.count > 0 && 'bg-red-500/20 text-red-500'
                )}>
                  {section.count}
                </span>
                {section.label}
              </button>
            ))}
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-muted/30 px-2.5 py-1.5">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}>
                <X className="size-3 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}
          </div>
          {/* Filter tabs */}
          {!summary && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(['ALL', 'UNREAD', 'SNOOZED'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterType(f)}
                  className={cn(
                    'px-2 py-1.5 text-[10px] font-medium transition-colors',
                    filterType === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {f === 'ALL' ? 'All' : f === 'UNREAD' ? 'Unread' : 'Snoozed'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mb-3" />
              <p className="text-sm">Loading notifications…</p>
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BellOff className="size-8 mb-3 opacity-40" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs mt-1 text-center opacity-60">
                {search ? 'Try a different search term' : 'You\'re all caught up! 🎉'}
              </p>
            </div>
          ) : (
            displayList.map(notification => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onSnooze={handleSnooze}
                onDismiss={handleDismiss}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
                actionLoading={actionLoading}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {displayList.length > 0 && (
          <div className="border-t border-border px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{displayList.length} notification{displayList.length !== 1 ? 's' : ''}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <CheckCheck className="size-3" />
                Mark all read
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Notification Bell Trigger ─────────────────────────────────────────────────

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [prevCount, setPrevCount] = useState(0)
  const [pulse, setPulse] = useState(false)

  const fetchCount = useCallback(async () => {
    try {
      // Use getNotifications with unread filter instead of summary endpoint for simplicity
      const notifs = await getNotifications({ unread: true, limit: 1 })
      // For count, refetch with a large limit
      const all = await getNotifications({ unread: true, limit: 100 })
      const count = all.length
      if (count > prevCount) {
        setPulse(true)
        setTimeout(() => setPulse(false), 2000)
        // Play a soft sound if new notifications arrive
        if (prevCount > 0) {
          void playSound('SOFT', { volume: 40 })
        }
      }
      setPrevCount(count)
      setUnreadCount(count)
    } catch {}
  }, [prevCount])

  useEffect(() => {
    void fetchCount()
    const interval = setInterval(() => void fetchCount(), 30000)
    return () => clearInterval(interval)
  }, [fetchCount])

  return (
    <>
      <button
        type="button"
        id="notification-bell-btn"
        onClick={() => setIsOpen(o => !o)}
        className={cn(
          'relative flex items-center justify-center size-9 rounded-xl transition-all',
          isOpen
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          className
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className={cn('size-4.5 transition-all', pulse && 'animate-bounce')} />
        {unreadCount > 0 && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background',
            pulse && 'animate-ping-once'
          )}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
