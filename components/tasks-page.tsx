'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  createTask,
  deleteTask,
  formatApiErrorMessage,
  getTasks,
  updateTaskStatus,
  type TaskItem,
} from '@/lib/api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useNow } from '@/lib/hooks/use-time'
import { TimeRemaining } from '@/components/ui/time-remaining'

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Real-time clock — triggers re-renders so overdue state stays accurate
  const now = useNow()

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED' | 'OVERDUE'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'startAt' | 'priority' | 'createdAt' | 'title'>('startAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Composer state
  const [showComposer, setShowComposer] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [newCategory, setNewCategory] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('23:59')
  const [newMinutes, setNewMinutes] = useState('45')
  const [composerSubmitting, setComposerSubmitting] = useState(false)

  const loadTaskList = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const items = await getTasks({
        q: debouncedQuery.trim() || undefined,
        status: statusFilter !== 'ALL' && statusFilter !== 'OVERDUE' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        sortBy,
        sortOrder,
      })
      setTasks(items)
    } catch (err: any) {
      console.error('[Tasks] Failed to load tasks:', err)
      setError('Unable to load tasks from the server. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [debouncedQuery, statusFilter, priorityFilter, categoryFilter, sortBy, sortOrder])

  useEffect(() => {
    loadTaskList()
  }, [loadTaskList])

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) {
      if (t.category) set.add(t.category.toLowerCase())
    }
    return Array.from(set)
  }, [tasks])

  // Client-side overdue computation — depends on `now` so it re-evaluates as time passes
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (statusFilter === 'OVERDUE') {
        return t.status === 'PENDING' && new Date(t.startAt) < now
      }
      return true
    })
  }, [tasks, statusFilter, now])

  // Metrics — re-evaluated whenever `now` changes (via useNow timer)
  const stats = useMemo(() => {
    let pending = 0
    let completed = 0
    let overdue = 0

    for (const t of tasks) {
      if (t.status === 'COMPLETED') completed++
      else {
        pending++
        if (new Date(t.startAt) < now) overdue++
      }
    }
    return { total: tasks.length, pending, completed, overdue }
  }, [tasks, now])

  const handleToggleTask = async (task: TaskItem) => {
    const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    setUpdatingId(task.id)

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    toast.success(nextStatus === 'COMPLETED' ? 'Task marked as completed' : 'Task restored to pending')

    try {
      await updateTaskStatus(task.id, nextStatus)
    } catch (err) {
      toast.error(formatApiErrorMessage(err))
      loadTaskList()
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.info('Task removed from workspace')
    try {
      await deleteTask(id)
    } catch (err) {
      toast.error(formatApiErrorMessage(err))
      loadTaskList()
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    setComposerSubmitting(true)
    try {
      let scheduledDate: string
      if (newDate) {
        const timeStr = newTime || '23:59'
        scheduledDate = new Date(`${newDate}T${timeStr}`).toISOString()
      } else {
        scheduledDate = new Date().toISOString()
      }

      await createTask({
        title: newTitle.trim(),
        priority: newPriority,
        category: newCategory.trim() || undefined,
        startAt: scheduledDate,
        estimatedMinutes: parseInt(newMinutes) || 45,
      })

      setNewTitle('')
      setNewCategory('')
      setNewDate('')
      setNewTime('23:59')
      setShowComposer(false)
      toast.success('Task created successfully')
      loadTaskList(true)
    } catch (err) {
      const msg = formatApiErrorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setComposerSubmitting(false)
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || categoryFilter !== 'ALL'

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('ALL')
    setPriorityFilter('ALL')
    setCategoryFilter('ALL')
    setSortBy('startAt')
    setSortOrder('asc')
  }

  return (
    <div className="lifeos-enter flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-primary font-bold">Tasks</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Tasks & Priorities</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Organize, prioritize, and complete your actionable work items with real-time tracking.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTaskList(true)}
            disabled={refreshing}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin text-primary')} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowComposer(!showComposer)}
            className="h-9 gap-1.5 text-xs font-medium shadow-xs"
          >
            {showComposer ? (
              <>
                <X className="size-3.5" />
                <span>Close</span>
              </>
            ) : (
              <>
                <Plus className="size-3.5" />
                <span>New Task</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Task Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Tasks */}
        <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-border hover:shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Total Tasks</p>
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ListTodo className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-muted-foreground/50" />
            <span>Workspace total</span>
          </div>
        </div>

        {/* Pending */}
        <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pending</p>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">{stats.pending}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-primary" />
            <span>Awaiting action</span>
          </div>
        </div>

        {/* Completed */}
        <div className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-emerald-500/30 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Completed</p>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            <span>Resolved</span>
          </div>
        </div>

        {/* Overdue */}
        <div className={cn(
          'group relative overflow-hidden rounded-xl border p-4 shadow-xs transition-all hover:shadow-sm',
          stats.overdue > 0
            ? 'border-amber-500/30 bg-amber-500/[0.04] dark:border-amber-500/20'
            : 'border-border/80 bg-card'
        )}>
          <div className="flex items-center justify-between">
            <p className={cn('text-xs font-medium', stats.overdue > 0 ? 'text-amber-600 font-semibold dark:text-amber-400' : 'text-muted-foreground')}>
              Overdue
            </p>
            <span className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              stats.overdue > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'
            )}>
              <AlertTriangle className="size-3.5" />
            </span>
          </div>
          <p className={cn('mt-2 text-2xl font-bold tracking-tight', stats.overdue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
            {stats.overdue}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn('inline-block size-1.5 rounded-full', stats.overdue > 0 ? 'bg-amber-500' : 'bg-muted-foreground/50')} />
            <span>{stats.overdue > 0 ? 'Requires attention' : 'All on schedule'}</span>
          </div>
        </div>
      </div>

      {/* Inline Task Composer */}
      {showComposer && (
        <form
          onSubmit={handleCreateTask}
          className="lifeos-enter relative overflow-hidden rounded-2xl border border-primary/25 bg-card/95 p-5 shadow-md backdrop-blur-xs flex flex-col gap-4 sm:p-6"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Plus className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Create New Task</h3>
                <p className="text-[11px] text-muted-foreground">Fill in the details to schedule and prioritize this task</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Title */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-foreground">
                Task Title <span className="text-primary">*</span>
              </label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                placeholder="e.g., Finalize quarterly financial reports and metrics"
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>

            {/* Priority Selector Pills */}
            <div>
              <label className="text-xs font-semibold text-foreground">Priority Level</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-all',
                      newPriority === p
                        ? p === 'HIGH'
                          ? 'border-rose-500/50 bg-rose-500/10 text-rose-600 font-semibold dark:text-rose-400 shadow-xs'
                          : p === 'MEDIUM'
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 font-semibold dark:text-amber-400 shadow-xs'
                          : 'border-slate-500/50 bg-slate-500/10 text-foreground font-semibold shadow-xs'
                        : 'border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        p === 'HIGH' ? 'bg-rose-500' : p === 'MEDIUM' ? 'bg-amber-500' : 'bg-slate-400'
                      )}
                    />
                    <span>{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-foreground">Category</label>
              <div className="relative mt-1.5">
                <Tag className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder="work, health, personal, finance..."
                  className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs font-semibold text-foreground">Due Date</label>
              <div className="relative mt-1.5">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>

            {/* Due Time & Duration */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Due Time <span className="text-muted-foreground/60 font-normal">(opt)</span>
                </label>
                <input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Duration (min)</label>
                <input
                  type="number"
                  min="10"
                  max="720"
                  step="5"
                  value={newMinutes}
                  onChange={e => setNewMinutes(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowComposer(false)}
              className="h-9 px-4 text-xs font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={composerSubmitting || !newTitle.trim()}
              className="h-9 px-4 gap-1.5 text-xs font-semibold shadow-xs"
            >
              {composerSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>Save Task</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3.5 rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title or keyword..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Chips / Segmented Control */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-1">
            {[
              { id: 'ALL', label: 'All', count: stats.total },
              { id: 'PENDING', label: 'Pending', count: stats.pending },
              { id: 'COMPLETED', label: 'Done', count: stats.completed },
              { id: 'OVERDUE', label: 'Overdue', count: stats.overdue },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all shrink-0',
                  statusFilter === tab.id
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-semibold',
                    statusFilter === tab.id
                      ? tab.id === 'OVERDUE' && tab.count > 0
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters: Priority, Category, Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/60 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none transition-colors focus:border-ring"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none uppercase transition-colors focus:border-ring"
              >
                <option value="ALL">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="size-3.5 text-muted-foreground" />
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={e => {
                  const [sb, so] = e.target.value.split('-') as [any, any]
                  setSortBy(sb)
                  setSortOrder(so)
                }}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none transition-colors focus:border-ring"
              >
                <option value="startAt-asc">Date (Earliest First)</option>
                <option value="startAt-desc">Date (Latest First)</option>
                <option value="priority-desc">Priority (High to Low)</option>
                <option value="priority-asc">Priority (Low to High)</option>
                <option value="createdAt-desc">Recently Added</option>
                <option value="title-asc">Title (A – Z)</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {statusFilter === 'ALL'
                ? 'All Tasks'
                : statusFilter === 'PENDING'
                ? 'Pending Tasks'
                : statusFilter === 'COMPLETED'
                ? 'Completed Tasks'
                : 'Overdue Tasks'}
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {filteredTasks.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {stats.completed} of {stats.total} completed
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-border/60 p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3.5 py-3">
                <div className="size-5 animate-pulse rounded-md bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-52 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/60 mb-3">
              <CheckCircle2 className="size-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No tasks found</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {hasActiveFilters
                ? 'No tasks match your current filter and search criteria. Try clearing some filters.'
                : 'Your task list is empty. Add your first task to start organizing your daily priorities!'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 text-xs">
                Clear Filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => setShowComposer(true)} className="mt-4 gap-1.5 text-xs shadow-xs">
                <Plus className="size-3.5" />
                <span>Create First Task</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTasks.map(task => {
              const isCompleted = task.status === 'COMPLETED'
              const isOverdue = !isCompleted && new Date(task.startAt) < now

              return (
                <div
                  key={task.id}
                  className={cn(
                    'group flex items-center justify-between p-4 sm:px-5 transition-all hover:bg-muted/25',
                    isCompleted && 'bg-muted/[0.08] opacity-65'
                  )}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Custom Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      disabled={updatingId === task.id}
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-all',
                        isCompleted
                          ? 'border-emerald-500 bg-emerald-500 text-white shadow-xs'
                          : 'border-muted-foreground/30 bg-background hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/20'
                      )}
                      aria-label={isCompleted ? 'Mark pending' : 'Mark completed'}
                    >
                      {updatingId === task.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isCompleted ? (
                        <Check className="size-3.5 stroke-[2.5]" />
                      ) : null}
                    </button>

                    <div className="min-w-0 space-y-1.5">
                      <p className={cn(
                        'text-sm font-medium leading-snug transition-colors truncate text-foreground',
                        isCompleted && 'line-through text-muted-foreground/75'
                      )}>
                        {task.title}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {/* Due Date Badge */}
                        <span className={cn(
                          'flex items-center gap-1 text-[11px] font-medium',
                          isOverdue ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'
                        )}>
                          <Calendar className="size-3 shrink-0" />
                          <span>{new Date(task.startAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          {(() => {
                            const d = new Date(task.startAt)
                            const h = d.getHours(), m = d.getMinutes()
                            if (h !== 0 && !(h === 23 && m === 59)) {
                              return <span>at {d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            }
                            return null
                          })()}
                        </span>

                        {/* Estimated Duration */}
                        {task.estimatedMinutes && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                            <Clock className="size-3 shrink-0" />
                            <span>{task.estimatedMinutes}m</span>
                          </span>
                        )}

                        {/* Category Tag */}
                        {task.category && (
                          <span className="rounded-md border border-border/70 bg-secondary/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-foreground">
                            {task.category}
                          </span>
                        )}

                        {/* Real-time Time Remaining countdown */}
                        <TimeRemaining
                          dueAt={task.endAt ?? task.startAt}
                          status={task.status}
                          variant="inline"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 ml-4">
                    {/* Priority Badge */}
                    <span
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        task.priority === 'HIGH' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
                        task.priority === 'MEDIUM' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                        task.priority === 'LOW' && 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 rounded-full',
                          task.priority === 'HIGH' && 'bg-rose-500',
                          task.priority === 'MEDIUM' && 'bg-amber-500',
                          task.priority === 'LOW' && 'bg-slate-400'
                        )}
                      />
                      <span>{task.priority}</span>
                    </span>

                    {/* Delete Task button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                      aria-label="Delete task"
                      title="Delete task"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
