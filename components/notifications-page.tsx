'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Bell, BellOff, CheckCheck, Clock, Info, Loader2, Search, Sparkles, Trash2, X } from 'lucide-react'
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
  REMINDER: { label: 'Reminder', icon: Clock, color: 'text-blue-500 bg-blue-500/10' },
  OVERDUE: { label: 'Overdue', icon: AlertCircle, color: 'text-red-500 bg-red-500/10' },
  MISSED: { label: 'Missed', icon: X, color: 'text-orange-500 bg-orange-500/10' },
  SYSTEM: { label: 'System', icon: Info, color: 'text-muted-foreground bg-muted' },
  AI_IMPORT: { label: 'AI Import', icon: Sparkles, color: 'text-purple-500 bg-purple-500/10' },
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
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">Stay informed, not overwhelmed</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground">Reminders, overdue items, and workflow updates in one place.</p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card/90 shadow-[0_16px_40px_-30px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-semibold">Inbox</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading && page === 1 ? 'Loading…' : `${totalUnread} unread notification${totalUnread !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => void handleMarkAll()}
            disabled={markingAll || !totalUnread}
          >
            {markingAll ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
            Mark all read
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
          <div className="flex gap-1 overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTab === tab.value
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notifications…"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-7 text-xs outline-none focus:border-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading notifications…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BellOff className="size-5" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No notifications here</p>
            <p className="text-xs text-muted-foreground">You are all caught up.</p>
          </div>
        ) : (
          items.map(n => {
            const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM
            const Icon = meta.icon
            const isUnread = !n.readAt
            return (
              <div
                key={n.id}
                onClick={() => isUnread && void handleRead(n.id)}
                className={cn(
                  'group flex items-start gap-4 border-b border-border/70 p-5 transition-colors last:border-0',
                  isUnread ? 'cursor-pointer bg-primary/[0.025] hover:bg-primary/[0.04]' : 'hover:bg-muted/20'
                )}
              >
                <div className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm', meta.color)}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{meta.label}</span>
                    {isUnread && <span className="size-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); void handleDelete(n.id, isUnread) }}
                  disabled={deleting === n.id}
                  className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete notification"
                >
                  {deleting === n.id
                    ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    : <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  }
                </button>
              </div>
            )
          })
        )}

        {hasMore && !loading && (
          <div className="border-t border-border/70 p-4 text-center">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore && <Loader2 className="mr-2 size-3.5 animate-spin" />}
              Load More
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
