'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Loader2,
  Plus,
  RefreshCw,
  Repeat,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatApiErrorMessage,
  getDashboardSummary,
  updateCalendarItemStatus,
  type CalendarItem,
  type DashboardSummary,
} from '@/lib/api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })
  } catch {
    return ''
  }
}

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  } catch {
    return ''
  }
}

export function DashboardView({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void
}) {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const summary = await getDashboardSummary()
      setData(summary)
    } catch (err: any) {
      console.error('[Dashboard] Error fetching summary:', err)
      setError('Unable to load dashboard data. Please check your network or try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const handleToggleStatus = async (item: CalendarItem) => {
    const nextStatus: 'PENDING' | 'COMPLETED' = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    setUpdatingId(item.id)

    // Optimistic UI update
    setData(prev => {
      if (!prev) return prev
      const updateItem = (i: CalendarItem) => i.id === item.id ? { ...i, status: nextStatus } : i
      const updatedToday = prev.todayItems.map(updateItem)
      const updatedUpcoming = prev.upcomingItems.map(updateItem)
      const updatedOverdue = prev.overdueItems.filter(i => nextStatus === 'COMPLETED' ? i.id !== item.id : true)

      const completedCount = updatedToday.filter(i => i.status === 'COMPLETED').length
      return {
        ...prev,
        todayItems: updatedToday,
        upcomingItems: updatedUpcoming,
        overdueItems: updatedOverdue,
        metrics: {
          ...prev.metrics,
          completedToday: completedCount,
        },
      }
    })

    toast.success(nextStatus === 'COMPLETED' ? `Completed "${item.title}"` : `Moved "${item.title}" to pending`)

    try {
      await updateCalendarItemStatus(item.id, nextStatus)
    } catch (err) {
      toast.error(formatApiErrorMessage(err))
      loadSummary()
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded bg-muted" />
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border/60 bg-card p-5" />
          ))}
        </div>

        {/* Schedule & Feed Skeletons */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl border border-border/60 bg-card lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-2xl border border-border/60 bg-card" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 p-12 text-center">
        <AlertCircle className="size-10 text-destructive mb-3" />
        <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => loadSummary()} className="mt-4 gap-2">
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    )
  }

  const metrics = data?.metrics || {
    totalToday: 0,
    completedToday: 0,
    upcomingCount: 0,
    overdueCount: 0,
    totalTasks: 0,
    completedTasks: 0,
    unreadNotifications: 0,
    activeReminders: 0,
    recurringCount: 0,
    recentAiDraftsCount: 0,
  }

  const todayItems = data?.todayItems || []
  const upcomingItems = data?.upcomingItems || []
  const overdueItems = data?.overdueItems || []
  const recentActivity = data?.recentActivity || []
  const recentAiDrafts = data?.recentAiDrafts || []

  const progressPercent = metrics.totalToday > 0
    ? Math.round((metrics.completedToday / metrics.totalToday) * 100)
    : 0

  return (
    <div className="lifeos-enter flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace Overview · {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Today’s Command Center</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSummary(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => onNavigate?.('/calendar')} className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            Add Schedule
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Today's Progress */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Today’s Progress</span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {metrics.completedToday}/{metrics.totalToday} done
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{progressPercent}%</span>
            <span className="text-xs text-muted-foreground">completed</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card 2: Upcoming Entries */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Upcoming (Next 7 Days)</span>
            <CalendarDays className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{metrics.upcomingCount}</span>
            <span className="text-xs text-muted-foreground">scheduled entries</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {metrics.recurringCount} recurring schedule{metrics.recurringCount === 1 ? '' : 's'} active
          </p>
        </div>

        {/* Card 3: Overdue Alert Card */}
        <div className={cn(
          'rounded-2xl border p-4 shadow-sm transition-colors',
          metrics.overdueCount > 0
            ? 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10'
            : 'border-border/80 bg-card'
        )}>
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-medium', metrics.overdueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
              Overdue Items
            </span>
            <AlertTriangle className={cn('size-4', metrics.overdueCount > 0 ? 'text-amber-500' : 'text-muted-foreground')} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={cn('text-2xl font-bold tracking-tight', metrics.overdueCount > 0 && 'text-amber-600 dark:text-amber-400')}>
              {metrics.overdueCount}
            </span>
            <span className="text-xs text-muted-foreground">require attention</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {metrics.overdueCount > 0 ? 'Review and reschedule missed items' : 'All schedule items on track!'}
          </p>
        </div>

        {/* Card 4: Quick Links & Alerts */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Workspace Status</span>
            <Bell className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">{metrics.unreadNotifications}</span>
            <span className="text-xs text-muted-foreground">unread notifications</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {metrics.activeReminders} active alert reminder{metrics.activeReminders === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Overdue Items Banner if present */}
      {overdueItems.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 dark:bg-amber-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="size-5 text-amber-500 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  You have {overdueItems.length} overdue schedule item{overdueItems.length === 1 ? '' : 's'}
                </h3>
                <p className="text-xs text-amber-700/90 dark:text-amber-300/80">
                  Mark them as complete or open the calendar to reschedule them.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.('/calendar')}
              className="border-amber-500/30 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            >
              Open Calendar
            </Button>
          </div>
          <div className="mt-3 divide-y divide-amber-500/10 rounded-xl bg-background/50 p-2">
            {overdueItems.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="text-muted-foreground">({formatDate(item.startAt)})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleStatus(item)}
                  disabled={updatingId === item.id}
                  className="h-6 gap-1 px-2 text-[11px]"
                >
                  <CheckCircle2 className="size-3" />
                  Mark done
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Grid: Today's Schedule + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Today's Activities */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="font-semibold text-base">Today’s Schedule</h2>
              <p className="text-xs text-muted-foreground">
                {todayItems.length} item{todayItems.length === 1 ? '' : 's'} scheduled for today
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate?.('/calendar')}
              className="gap-1 text-xs text-primary"
            >
              View full calendar
              <ArrowRight className="size-3.5" />
            </Button>
          </div>

          <div className="mt-4 divide-y divide-border/60">
            {todayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="size-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-semibold">Clear calendar for today!</h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  No events or tasks are scheduled for today. Take time to relax or add a new schedule item.
                </p>
                <Button
                  size="sm"
                  onClick={() => onNavigate?.('/calendar')}
                  className="mt-4 gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  Add item for today
                </Button>
              </div>
            ) : (
              todayItems.map(item => {
                const isCompleted = item.status === 'COMPLETED'
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between py-3 transition-opacity',
                      isCompleted && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        disabled={updatingId === item.id}
                        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                        className={cn(
                          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                          isCompleted
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-muted-foreground/30 hover:border-primary'
                        )}
                      >
                        {updatingId === item.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : null}
                      </button>

                      <div className="space-y-0.5">
                        <p className={cn('text-sm font-medium', isCompleted && 'line-through text-muted-foreground')}>
                          {item.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {item.allDay ? 'All Day' : formatTime(item.startAt)}
                            {item.endAt && !item.allDay ? ` – ${formatTime(item.endAt)}` : ''}
                          </span>
                          {item.category && (
                            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                              {item.category}
                            </span>
                          )}
                          {item.recurrenceRule && (
                            <span className="flex items-center gap-0.5 text-[11px] text-primary">
                              <Repeat className="size-3" />
                              {item.recurrenceRule.frequency}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        item.priority === 'HIGH' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                        item.priority === 'MEDIUM' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        item.priority === 'LOW' && 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      {item.priority}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Col: Recent Activity & AI Summary */}
        <div className="flex flex-col gap-6">
          {/* AI Import Draft Status Box */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">AI Schedule Importer</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.('/ai-import')}
                className="h-7 text-xs text-primary gap-1 px-2"
              >
                Import
                <ExternalLink className="size-3" />
              </Button>
            </div>
            {recentAiDrafts.length > 0 ? (
              <div className="mt-3 space-y-2">
                {recentAiDrafts.slice(0, 2).map(draft => (
                  <div key={draft.id} className="rounded-xl border border-border/60 bg-background/80 p-2.5 text-xs">
                    <div className="flex items-center justify-between font-medium">
                      <span className="truncate max-w-[160px]">{draft.originalFileName || 'Schedule Draft'}</span>
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                        draft.status === 'CONFIRMED' && 'bg-emerald-500/10 text-emerald-600',
                        draft.status === 'REVIEW' && 'bg-amber-500/10 text-amber-600',
                        draft.status === 'FAILED' && 'bg-destructive/10 text-destructive',
                        draft.status === 'PROCESSING' && 'bg-primary/10 text-primary'
                      )}>
                        {draft.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {draft.itemCount} items · {formatRelativeTime(draft.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Drop your syllabus, shift plan, or calendar text to instantly generate schedule items.
              </p>
            )}
          </div>

          {/* Recent Activity Timeline */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <h3 className="font-semibold text-sm">Recent Activity</h3>
            <p className="text-xs text-muted-foreground">Live activity across your workspace</p>

            <div className="mt-4 space-y-3.5">
              {recentActivity.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No recent activity yet.</p>
              ) : (
                recentActivity.map(act => (
                  <div key={act.id} className="flex items-start gap-2.5 text-xs">
                    <div className={cn(
                      'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                      act.type === 'ITEM_COMPLETED' && 'bg-emerald-500/10 text-emerald-600',
                      act.type === 'DRAFT_CONFIRMED' && 'bg-primary/10 text-primary',
                      act.type === 'NOTIFICATION' && 'bg-amber-500/10 text-amber-600',
                      act.type === 'ITEM_UPDATED' && 'bg-muted text-muted-foreground'
                    )}>
                      {act.type === 'ITEM_COMPLETED' ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : act.type === 'DRAFT_CONFIRMED' ? (
                        <Sparkles className="size-3.5" />
                      ) : act.type === 'NOTIFICATION' ? (
                        <Bell className="size-3.5" />
                      ) : (
                        <Clock className="size-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{act.title}</p>
                      {act.description && (
                        <p className="truncate text-[11px] text-muted-foreground">{act.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatRelativeTime(act.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
