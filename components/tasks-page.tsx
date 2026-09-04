'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
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
  updateTask,
  updateTaskStatus,
  type TaskItem,
} from '@/lib/api'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

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

  // Client-side overdue computation
  const filteredTasks = useMemo(() => {
    const now = new Date()
    return tasks.filter(t => {
      if (statusFilter === 'OVERDUE') {
        return t.status === 'PENDING' && new Date(t.startAt) < now
      }
      return true
    })
  }, [tasks, statusFilter])

  // Metrics
  const stats = useMemo(() => {
    const now = new Date()
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
  }, [tasks])

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
      const scheduledDate = newDate ? new Date(newDate).toISOString() : new Date().toISOString()
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Task Management
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Tasks & Priorities</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTaskList(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowComposer(!showComposer)}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            {showComposer ? 'Cancel' : 'New Task'}
          </Button>
        </div>
      </div>

      {/* Task Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Total Tasks</p>
          <p className="mt-1 text-xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="mt-1 text-xl font-bold text-primary">{stats.pending}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
        </div>
        <div className={cn(
          'rounded-xl border p-3.5 shadow-sm',
          stats.overdue > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/80 bg-card'
        )}>
          <p className={cn('text-xs', stats.overdue > 0 ? 'text-amber-600 font-medium dark:text-amber-400' : 'text-muted-foreground')}>
            Overdue
          </p>
          <p className={cn('mt-1 text-xl font-bold', stats.overdue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
            {stats.overdue}
          </p>
        </div>
      </div>

      {/* Inline Task Composer */}
      {showComposer && (
        <form
          onSubmit={handleCreateTask}
          className="lifeos-enter rounded-2xl border border-primary/20 bg-card p-5 shadow-md flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Create New Task</h3>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Task Title *</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                required
                placeholder="e.g. Complete quarterly financial review"
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as any)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <input
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="work, health, study..."
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Scheduled Date / Due Date</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
              <input
                type="number"
                min="10"
                max="720"
                step="5"
                value={newMinutes}
                onChange={e => setNewMinutes(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowComposer(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={composerSubmitting || !newTitle.trim()}
              className="gap-1.5"
            >
              {composerSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save Task
            </Button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title or description..."
              className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'PENDING', 'COMPLETED', 'OVERDUE'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0',
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {status === 'ALL' ? 'All' : status === 'PENDING' ? 'Pending' : status === 'COMPLETED' ? 'Done' : 'Overdue'}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filters: Priority, Category, Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none"
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
                className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none uppercase"
              >
                <option value="ALL">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={e => {
                const [sb, so] = e.target.value.split('-') as [any, any]
                setSortBy(sb)
                setSortOrder(so)
              }}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none"
            >
              <option value="startAt-asc">Date (Earliest First)</option>
              <option value="startAt-desc">Date (Latest First)</option>
              <option value="priority-desc">Priority (High to Low)</option>
              <option value="priority-asc">Priority (Low to High)</option>
              <option value="createdAt-desc">Recently Added</option>
              <option value="title-asc">Title (A – Z)</option>
            </select>
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
      <div className="rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-semibold text-sm">
            {statusFilter === 'ALL' ? 'All Tasks' : statusFilter === 'PENDING' ? 'Pending Tasks' : statusFilter === 'COMPLETED' ? 'Completed Tasks' : 'Overdue Tasks'}
          </h2>
          <span className="text-xs text-muted-foreground">
            {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-border/60 p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="size-5 animate-pulse rounded bg-muted" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="size-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-semibold">No tasks found</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {hasActiveFilters
                ? 'No tasks match your current filter and search criteria. Try resetting your filters.'
                : 'Your task list is empty. Create your first task to start organizing your schedule!'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 text-xs">
                Clear Filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => setShowComposer(true)} className="mt-4 gap-1.5 text-xs">
                <Plus className="size-3.5" />
                Create First Task
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTasks.map(task => {
              const isCompleted = task.status === 'COMPLETED'
              const isOverdue = !isCompleted && new Date(task.startAt) < new Date()

              return (
                <div
                  key={task.id}
                  className={cn(
                    'flex items-center justify-between p-4 transition-colors hover:bg-muted/30',
                    isCompleted && 'opacity-60 bg-muted/10'
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(task)}
                      disabled={updatingId === task.id}
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        isCompleted
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-muted-foreground/30 hover:border-primary'
                      )}
                    >
                      {updatingId === task.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : isCompleted ? (
                        <Check className="size-3.5" />
                      ) : null}
                    </button>

                    <div className="min-w-0 space-y-1">
                      <p className={cn('text-sm font-medium leading-snug truncate', isCompleted && 'line-through text-muted-foreground')}>
                        {task.title}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className={cn('flex items-center gap-1', isOverdue && 'text-amber-600 font-medium dark:text-amber-400')}>
                          <Calendar className="size-3" />
                          {new Date(task.startAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          {isOverdue && ' (Overdue)'}
                        </span>

                        {task.estimatedMinutes && (
                          <span className="flex items-center gap-0.5 text-[11px]">
                            <Clock className="size-3" />
                            {task.estimatedMinutes}m
                          </span>
                        )}

                        {task.category && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase">
                            {task.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        task.priority === 'HIGH' && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                        task.priority === 'MEDIUM' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        task.priority === 'LOW' && 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                      )}
                    >
                      {task.priority}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label="Delete task"
                    >
                      <Trash2 className="size-4" />
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
