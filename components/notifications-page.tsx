'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  Clock,
  Info,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  getNotificationCount,
  type NotificationItem,
} from '@/lib/api'
import { cn } from '@/lib/utils'

const TYPE_META: Record<NotificationItem['type'], { label: string; icon: typeof Bell; color: string }> = {
  REMINDER: { label: 'Reminder', icon: Clock, color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' },
  OVERDUE: { label: 'Overdue', icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
  MISSED: { label: 'Missed', icon: X, color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' },
  SYSTEM: { label: 'System', icon: Info, color: 'text-muted-foreground bg-muted border-border/70' },
  AI_IMPORT: { label: 'AI Import', icon: Sparkles, color: 'text-primary bg-primary/10 border-primary/20' },
}

const FILTER_TABS = [
  { label: 'All', value: '' },
  { label: 'Unread', value: 'unread' },
  { label: 'Reminders', value: 'REMINDER' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'AI Import', value: 'AI_IMPORT' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeTab, setActiveTab] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback((pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    setError('')
    const filters: { unread?: boolean; type?: string; search?: string; limit?: number; page?: number } = { limit: 50, page: pageNum }
    if (activeTab === 'unread') filters.unread = true
    else if (activeTab) filters.type = activeTab
    if (debouncedSearch.trim()) filters.search = debouncedSearch.trim()

    Promise.all([
      getNotifications(filters),
      getNotificationCount().catch(() => ({ count: 0 }))
    ])
      .then(([data, countRes]) => {
        setItems(prev => append ? [...prev, ...data] : data)
        setHasMore(data.length === 50)
        if (pageNum === 1 || !append) setTotalUnread(countRes.count)
      })
      .catch(() => setError('Could not load notifications.'))
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }, [activeTab, debouncedSearch])

  useEffect(() => { 
    setPage(1)
    load(1, false) 
  }, [load])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    load(next, true)
  }

  const handleRead = async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    setTotalUnread(prev => Math.max(0, prev - 1))
    await markNotificationRead(id).catch(() => load(1, false))
  }

  const handleDelete = async (id: string, wasUnread: boolean) => {
    setDeleting(id)
    try {
      await deleteNotification(id)
      setItems(prev => prev.filter(n => n.id !== id))
      if (wasUnread) setTotalUnread(prev => Math.max(0, prev - 1))
    } catch {
      load(1, false)
    } finally {
      setDeleting(null)
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
      setTotalUnread(0)
    } catch {
      load(1, false)
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="lifeos-enter flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-primary font-bold">Notifications</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Inbox & Updates</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Reminders, schedule alerts, and automated workflow updates in one centralized feed.
          </p>
        </div>

        {totalUnread > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleMarkAll()}
            disabled={markingAll}
            className="h-9 gap-1.5 text-xs font-semibold self-start sm:self-auto"
          >
            {markingAll ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5 text-primary" />
            )}
            <span>Mark all as read</span>
          </Button>
        )}
      </div>

      {/* Main Inbox Container */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        {/* Inbox Subheader & Filters */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {/* Segmented Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all shrink-0',
                  activeTab === tab.value
                    ? 'bg-card text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{tab.label}</span>
                {tab.value === 'unread' && totalUnread > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                    {totalUnread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter notifications…"
              className="h-8.5 w-full rounded-lg border border-input bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="divide-y divide-border/60 p-5 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-start gap-3.5 py-2">
                <div className="size-8 animate-pulse rounded-full bg-muted shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-72 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center text-sm text-destructive">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/60 mb-3">
              <BellOff className="size-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">You&apos;re all caught up!</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {search || activeTab
                ? 'No notifications match your current filter and search query.'
                : 'There are no pending notifications or reminders in your inbox.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {items.map(n => {
              const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM
              const Icon = meta.icon
              const isUnread = !n.readAt

              return (
                <div
                  key={n.id}
                  onClick={() => isUnread && void handleRead(n.id)}
                  className={cn(
                    'group relative flex items-start gap-3.5 p-4 sm:px-5 transition-all',
                    isUnread
                      ? 'cursor-pointer bg-primary/[0.03] hover:bg-primary/[0.06]'
                      : 'hover:bg-muted/25'
                  )}
                >
                  {/* Category icon avatar */}
                  <div className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border shadow-2xs',
                    meta.color
                  )}>
                    <Icon className="size-4" />
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn('text-sm font-medium text-foreground', isUnread && 'font-semibold')}>
                        {n.title}
                      </p>
                      <span className="rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {meta.label}
                      </span>
                      {isUnread && (
                        <span className="flex size-2 rounded-full bg-primary ring-4 ring-primary/10" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/75 pt-0.5">
                      <Clock className="size-3 shrink-0" />
                      <span>{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>

                  {/* Action group */}
                  <div className="shrink-0 ml-2">
                    <button
                      onClick={e => { e.stopPropagation(); void handleDelete(n.id, isUnread) }}
                      disabled={deleting === n.id}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                      aria-label="Delete notification"
                      title="Delete notification"
                    >
                      {deleting === n.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {hasMore && !loading && (
          <div className="border-t border-border/70 p-4 text-center">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="h-8 text-xs">
              {loadingMore && <Loader2 className="mr-2 size-3 animate-spin" />}
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
