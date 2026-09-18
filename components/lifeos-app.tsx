'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, FileUp, LayoutDashboard, ListChecks, Loader2, LogOut, Menu, Moon, MoreHorizontal, Plus, RotateCcw, Search, Settings, Sparkles, Sun, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTasks, createTask, updateTaskStatus, getCalendarItems, createCalendarItem, getNotifications, markNotificationRead, getNotificationCount, getCalendarAnalytics, getCalendarBriefing, rescheduleMissedTask, smartSchedule, type CalendarAnalytics, type CalendarBriefing, type TaskItem, type CalendarItem as ApiCalendarItem, type NotificationItem, type SmartSchedule } from '@/lib/api'
import { getCurrentUser, getSettings, updateProfile, updateSettings, logout, type LifeOSUser } from '@/lib/user-api'
import { cn } from '@/lib/utils'
import { AIImportPage } from '@/components/ai-import-page'
import { CalendarPage } from '@/components/calendar-page'
import { NotificationsPage } from '@/components/notifications-page'
import { TasksPage } from '@/components/tasks-page'
import { DashboardView } from '@/components/dashboard-view'
import { AuthForm } from '@/components/auth-form'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/ai-import', label: 'AI Import', icon: Sparkles },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

function Brand({ onNavigate }: { onNavigate?: (href: string) => void }) {
  return (
    <a
      href="/dashboard"
      onClick={e => {
        if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.button === 0 && onNavigate) {
          e.preventDefault()
          onNavigate('/dashboard')
        }
      }}
      className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
    >
      <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-2xs">
        <CalendarDays className="size-3.5" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tracking-tight text-foreground">LifeOS</span>
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">Pro</span>
      </div>
    </a>
  )
}

function Sidebar({
  path,
  onClose,
  onNavigate,
}: {
  path: string
  onClose?: () => void
  onNavigate: (href: string) => void
}) {
  const normalizedCurrent = path === '/' ? '/dashboard' : path

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.button === 0) {
      e.preventDefault()
      onNavigate(href)
      onClose?.()
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 p-3 shadow-[1px_0_0_0_var(--sidebar-border)] backdrop-blur">
      <div className="flex items-center justify-between px-2 py-2">
        <Brand onNavigate={onNavigate} />
        {onClose && (
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close navigation">
            <X />
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-0.5">
        <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Workspace
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive = normalizedCurrent === href
          return (
            <a
              key={href}
              href={href}
              onClick={e => handleNavClick(e, href)}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary" />
              )}
              <Icon className={cn('size-4 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
              <span className="flex-1">{label}</span>
            </a>
          )
        })}

        <div className="mt-6">
          <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Manage
          </p>
          <a
            href="/settings"
            onClick={e => handleNavClick(e, '/settings')}
            className={cn(
              'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150',
              normalizedCurrent === '/settings'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
            )}
          >
            {normalizedCurrent === '/settings' && (
              <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary" />
            )}
            <Settings className={cn('size-4 transition-colors', normalizedCurrent === '/settings' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
            <span className="flex-1">Settings</span>
          </a>
        </div>
      </div>

      {/* Keyboard Shortcut Hint Card */}
      <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-foreground">Quick Action</p>
              <p className="text-[10px] text-muted-foreground">Anytime shortcut</p>
            </div>
          </div>
          <kbd className="rounded border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>
    </aside>
  )
}

function QuickCreateModal({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (href: string) => void }) {
  const [activeTab, setActiveTab] = useState<'task' | 'event'>('task')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Task form
  const [taskTitle, setTaskTitle] = useState('')
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [taskCategory, setTaskCategory] = useState('Work')
  const [taskDate, setTaskDate] = useState('')
  const [taskDescription, setTaskDescription] = useState('')

  // Event form
  const [eventTitle, setEventTitle] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [eventEnd, setEventEnd] = useState('')
  const [eventCategory, setEventCategory] = useState('Work')
  const [eventLocation, setEventLocation] = useState('')

  useEffect(() => {
    if (open) {
      setSuccess('')
      setError('')
      const now = new Date()
      setTaskDate(now.toISOString().slice(0, 10))
      const start = new Date(now.getTime() + 3600000)
      const end = new Date(now.getTime() + 7200000)
      setEventStart(start.toISOString().slice(0, 16))
      setEventEnd(end.toISOString().slice(0, 16))
    } else {
      setTaskTitle('')
      setEventTitle('')
      setTaskDescription('')
      setEventLocation('')
    }
  }, [open])

  if (!open) return null

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim() || loading) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await createTask({
        title: taskTitle.trim(),
        priority: taskPriority,
        category: taskCategory,
        description: taskDescription.trim() || undefined,
        startAt: taskDate ? new Date(taskDate).toISOString() : new Date().toISOString(),
      })
      setSuccess('Task created successfully!')
      window.dispatchEvent(new CustomEvent('lifeos:refresh-data'))
      setTimeout(() => {
        onClose()
        onNavigate('/tasks')
      }, 700)
    } catch (err: any) {
      setError(err?.message || 'Failed to create task.')
    } finally {
      setLoading(false)
    }
  }

  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventTitle.trim() || loading) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await createCalendarItem({
        title: eventTitle.trim(),
        type: 'EVENT',
        category: eventCategory,
        location: eventLocation.trim() || undefined,
        startAt: eventStart ? new Date(eventStart).toISOString() : new Date().toISOString(),
        endAt: eventEnd ? new Date(eventEnd).toISOString() : undefined,
      })
      setSuccess('Event added to schedule!')
      window.dispatchEvent(new CustomEvent('lifeos:refresh-data'))
      setTimeout(() => {
        onClose()
        onNavigate('/calendar')
      }, 700)
    } catch (err: any) {
      setError(err?.message || 'Failed to create calendar event.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in-0">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Plus className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Quick Action</h2>
              <p className="text-xs text-muted-foreground">Add to your LifeOS workspace</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-muted/20 px-6 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('task')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 pb-2.5 text-xs font-semibold transition-colors',
              activeTab === 'task' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ListChecks className="size-3.5" />
            New Task
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('event')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 pb-2.5 text-xs font-semibold transition-colors',
              activeTab === 'event' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarDays className="size-3.5" />
            New Event
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              onNavigate('/ai-import')
            }}
            className="ml-auto flex items-center gap-1.5 pb-2.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>AI Import →</span>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="size-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'task' ? (
            <form onSubmit={submitTask} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Task title
                <input
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="e.g., Finalize project roadmap"
                  required
                  autoFocus
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  Priority
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as any)}
                    className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  Category
                  <input
                    value={taskCategory}
                    onChange={e => setTaskCategory(e.target.value)}
                    placeholder="Work, Health, Personal..."
                    className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Due date
                <input
                  type="date"
                  value={taskDate}
                  onChange={e => setTaskDate(e.target.value)}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <Button type="submit" disabled={loading || !taskTitle.trim()} className="mt-2 h-10 w-full font-medium">
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create Task'}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitEvent} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Event title
                <input
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value)}
                  placeholder="e.g., Weekly Sync or Chemistry Lecture"
                  required
                  autoFocus
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  Start time
                  <input
                    type="datetime-local"
                    value={eventStart}
                    onChange={e => setEventStart(e.target.value)}
                    required
                    className="h-10 rounded-xl border border-input bg-background px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  End time
                  <input
                    type="datetime-local"
                    value={eventEnd}
                    onChange={e => setEventEnd(e.target.value)}
                    className="h-10 rounded-xl border border-input bg-background px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  Category
                  <input
                    value={eventCategory}
                    onChange={e => setEventCategory(e.target.value)}
                    placeholder="Work, Class, etc."
                    className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-medium">
                  Location (optional)
                  <input
                    value={eventLocation}
                    onChange={e => setEventLocation(e.target.value)}
                    placeholder="Zoom, Room 101..."
                    className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              </div>

              <Button type="submit" disabled={loading || !eventTitle.trim()} className="mt-2 h-10 w-full font-medium">
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Schedule Event'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Topbar({ user, onMenu, onLogout, onOpenQuickAdd, onNavigate }: {
  user: LifeOSUser | null; onMenu: () => void; onLogout: () => void; onOpenQuickAdd: () => void; onNavigate: (href: string) => void
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [inlineTask, setInlineTask] = useState('')
  const [inlineLoading, setInlineLoading] = useState(false)
  const [inlineSuccess, setInlineSuccess] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getNotificationCount()
      .then(res => setUnreadCount(res.count))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.button === 0) {
      e.preventDefault()
      onNavigate(href)
      setUserDropdownOpen(false)
    }
  }

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inlineTask.trim()
    if (!trimmed || inlineLoading) return
    setInlineLoading(true)
    try {
      await createTask({
        title: trimmed,
        priority: 'MEDIUM',
        category: 'Work',
        startAt: new Date().toISOString(),
      })
      setInlineTask('')
      setInlineSuccess(true)
      window.dispatchEvent(new CustomEvent('lifeos:refresh-data'))
      setTimeout(() => setInlineSuccess(false), 2200)
    } catch (err) {
      console.error('Failed to quick-add task:', err)
    } finally {
      setInlineLoading(false)
    }
  }

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('lifeos-theme', isDark ? 'dark' : 'light')
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const initials = (user?.name || 'User')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md md:px-6">
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onMenu} aria-label="Open navigation">
        <Menu />
      </Button>

      {/* Contextual Date Pill */}
      <button
        type="button"
        onClick={() => onNavigate('/calendar')}
        className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/60 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground shadow-2xs"
        title="View today in Calendar"
      >
        <CalendarDays className="size-3.5 text-primary" />
        <span className="font-medium text-foreground">{todayFormatted}</span>
      </button>

      {/* Quick Task Capture / Search Input */}
      <form onSubmit={handleInlineSubmit} className="relative hidden max-w-xs flex-1 items-center sm:flex md:max-w-sm">
        <Plus className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          value={inlineTask}
          onChange={e => setInlineTask(e.target.value)}
          disabled={inlineLoading}
          placeholder={inlineSuccess ? '✓ Task added to workspace!' : 'Quick add task… (press Enter)'}
          className={cn(
            'h-8 w-full rounded-lg border bg-muted/30 pl-8 pr-12 text-xs font-normal outline-none transition-all placeholder:text-muted-foreground/70 focus:bg-background focus:ring-1 focus:ring-primary/20',
            inlineSuccess
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 placeholder:text-emerald-600'
              : 'border-border/80 focus:border-primary/60'
          )}
        />
        {inlineLoading ? (
          <Loader2 className="absolute right-2 size-3 animate-spin text-muted-foreground" />
        ) : inlineTask.trim() ? (
          <button
            type="submit"
            className="absolute right-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            ↵
          </button>
        ) : (
          <kbd className="absolute right-2 hidden rounded border border-border/70 bg-background/80 px-1 py-0.2 text-[9px] font-mono text-muted-foreground/70 lg:inline-block">
            ↵
          </kbd>
        )}
      </form>

      {/* Action controls */}
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          onClick={onOpenQuickAdd}
          className="h-8 gap-1.5 px-2.5 text-xs shadow-xs"
          title="Quick add task or event (⌘K)"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">New Item</span>
        </Button>

        {/* Theme mode toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title="Toggle light/dark theme"
          className="text-muted-foreground hover:text-foreground"
        >
          <Sun className="size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications Icon */}
        <a
          href="/notifications"
          onClick={e => handleNavClick(e, '/notifications')}
          className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="size-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </a>

        {/* Interactive User Avatar & Dropdown */}
        <div className="relative ml-1 border-l border-border/80 pl-2.5" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(prev => !prev)}
            className="flex items-center gap-2 rounded-lg p-1 transition-all hover:bg-muted/60"
            aria-expanded={userDropdownOpen}
            aria-haspopup="true"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border/80">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-foreground">{user?.name || 'User'}</p>
            </div>
            <ChevronDown className={cn('size-3 text-muted-foreground transition-transform duration-150', userDropdownOpen && 'rotate-180')} />
          </button>

          {userDropdownOpen && (
            <div className="lifeos-enter absolute right-0 mt-2 w-56 rounded-xl border border-border/80 bg-card p-1.5 shadow-xl backdrop-blur-md z-50">
              <div className="border-b border-border/70 px-2.5 py-2">
                <p className="text-xs font-semibold text-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user?.email || 'Personal workspace'}</p>
                <span className="mt-1.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                  Active Member
                </span>
              </div>

              <div className="py-1">
                <a
                  href="/profile"
                  onClick={e => handleNavClick(e, '/profile')}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <UserRound className="size-3.5" />
                  <span>Profile & Account</span>
                </a>
                <a
                  href="/settings"
                  onClick={e => handleNavClick(e, '/settings')}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Settings className="size-3.5" />
                  <span>Settings</span>
                </a>
              </div>

              <div className="border-t border-border/70 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false)
                    onLogout()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function SimplePage({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 pt-1">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  )
}


function ProfilePage({ user, onUpdateUser, onLogout, onNavigate }: { user: LifeOSUser | null; onUpdateUser: (u: LifeOSUser) => void; onLogout: () => void; onNavigate?: (href: string) => void }) {
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
    }
  }, [user])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const res = await updateProfile({ name: name.trim(), email: email.trim() })
      onUpdateUser(res.data)
      setStatus('Profile updated successfully.')
    } catch (err: any) {
      setError(err?.message || 'Could not update profile.')
    } finally {
      setSaving(false)
    }
  }

  const initials = (name || user?.name || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return <SimplePage title="Profile" eyebrow="Account & Identity">
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-[0_16px_40px_-30px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
          <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary shadow-inner">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{user?.name || 'User'}</h2>
              <p className="text-sm text-muted-foreground">{user?.email || 'Personal workspace'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Active Member</span>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Personal Workspace</span>
              </div>
            </div>
          </div>

          <form onSubmit={save} className="mt-6 flex flex-col gap-4">
            <h3 className="font-semibold text-foreground">Edit details</h3>
            <p className="text-xs text-muted-foreground">Update your name and email address in your LifeOS workspace.</p>

            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Full name
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Your name"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  placeholder="you@example.com"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving || !user}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {status && <p role="status" className="text-xs font-medium text-primary">{status}</p>}
              {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <h3 className="font-semibold text-sm text-foreground">Account security</h3>
          <p className="mt-1 text-xs text-muted-foreground">Your account authentication is secured through Supabase Auth session tokens.</p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-3.5">
            <div>
              <p className="text-xs font-medium">Session Status</p>
              <p className="text-[11px] text-muted-foreground">Authenticated and active</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Connected</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
          <h3 className="font-semibold text-sm text-foreground">Quick actions</h3>
          <div className="mt-3 flex flex-col gap-2">
            <a
              href="/settings"
              onClick={e => {
                if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.button === 0 && onNavigate) {
                  e.preventDefault()
                  onNavigate('/settings')
                }
              }}
              className="flex items-center justify-between rounded-xl border border-border/70 p-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span>Workspace settings</span>
              <Settings className="size-3.5" />
            </a>
            <a
              href="/notifications"
              onClick={e => {
                if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.button === 0 && onNavigate) {
                  e.preventDefault()
                  onNavigate('/notifications')
                }
              }}
              className="flex items-center justify-between rounded-xl border border-border/70 p-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span>Notifications</span>
              <Bell className="size-3.5" />
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
          <h3 className="font-semibold text-sm text-destructive">Account session</h3>
          <p className="mt-1 text-xs text-muted-foreground">Sign out of your active LifeOS session on this device.</p>
          <Button variant="outline" size="sm" className="mt-4 w-full border-destructive/30 text-destructive hover:bg-destructive/10" onClick={onLogout}>
            <LogOut className="size-3.5 mr-1.5" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  </SimplePage>
}

function SettingsPage({ onUpdateUser, onNavigate, onLogout }: { onUpdateUser?: (u: LifeOSUser) => void; onNavigate?: (href: string) => void; onLogout?: () => void }) {
  const [user, setUser] = useState<LifeOSUser | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [theme, setTheme] = useState('system')
  const [weekStartsOn, setWeekStartsOn] = useState('monday')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void Promise.all([getCurrentUser(), getSettings()]).then(([profile, settings]) => {
      setUser(profile.data)
      setName(profile.data.name)
      setEmail(profile.data.email)
      setTheme(String(settings.data.theme ?? 'system'))
      setWeekStartsOn(String(settings.data.weekStartsOn ?? 'monday'))
    }).catch(() => setStatus('Unable to load your settings.'))
  }, [])

  const save = async () => {
    setSaving(true)
    setStatus('')
    try {
      const updatedUser = await updateProfile({ name, email })
      await updateSettings({ theme, weekStartsOn })
      setUser(updatedUser.data)
      if (onUpdateUser) onUpdateUser(updatedUser.data)
      setStatus('Changes saved.')
    } catch {
      setStatus('Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SimplePage title="Settings" eyebrow="Workspace Preferences">
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          <a
            href="/profile"
            onClick={e => {
              if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.button === 0 && onNavigate) {
                e.preventDefault()
                onNavigate('/profile')
              }
            }}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Profile
          </a>
          <button className="whitespace-nowrap rounded-lg bg-primary/10 px-3 py-2 text-left text-xs font-semibold text-primary">
            Preferences
          </button>
          {['Appearance', 'Notifications', 'Calendar', 'AI Import'].map(x => (
            <button key={x} disabled className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-xs text-muted-foreground/60">
              {x}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
            <h2 className="font-semibold text-base">Preferences</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Update your personal details and workspace preferences.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Name
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium sm:col-span-2">
                Email address
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Theme
                <select
                  value={theme}
                  onChange={event => setTheme(event.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  <option value="system">System Default</option>
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-medium">
                Week starts on
                <select
                  value={weekStartsOn}
                  onChange={event => setWeekStartsOn(event.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                >
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={() => void save()} disabled={saving || !user}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {status && <p role="status" className="text-xs font-medium text-primary">{status}</p>}
            </div>
          </div>

          {onLogout && (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
              <h3 className="font-semibold text-sm text-destructive">Account Session</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Sign out of your active session on this device.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={onLogout}
              >
                <LogOut className="mr-1.5 size-3.5" />
                Sign out
              </Button>
            </div>
          )}
        </div>
      </div>
    </SimplePage>
  )
}

export function LifeOSApp({ path = '/dashboard' }: { path?: string }) {
  const [currentPath, setCurrentPath] = useState(path)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<LifeOSUser | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  // Sync state if path prop changes
  useEffect(() => {
    if (path) {
      setCurrentPath(path)
    }
  }, [path])

  // Handle browser Back / Forward buttons without full page reloads
  useEffect(() => {
    const onPopState = () => {
      if (typeof window !== 'undefined') {
        setCurrentPath(window.location.pathname || '/dashboard')
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to: string) => {
    if (!to) return
    setCurrentPath(to)
    if (typeof window !== 'undefined' && window.location.pathname !== to) {
      window.history.pushState(null, '', to)
    }
    setMobileOpen(false)
  }, [])

  // Global Cmd+K / Ctrl+K listener opens Quick Action
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickAddOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    void getCurrentUser()
      .then(res => {
        setUser(res.data)
        setAuthChecked(true)
      })
      .catch(() => {
        window.location.href = '/login'
      })
  }, [])

  const signOut = async () => {
    await logout().catch(() => undefined)
    window.location.href = '/login'
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-xs font-medium text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2 text-primary" />
        Loading your workspace…
      </div>
    )
  }

  const normalizedPath = currentPath === '/' ? '/dashboard' : currentPath

  const page = normalizedPath === '/calendar' ? <CalendarPage />
    : normalizedPath === '/tasks' ? <TasksPage />
    : normalizedPath === '/ai-import' ? <AIImportPage onNavigate={navigate} />
    : normalizedPath === '/notifications' ? <NotificationsPage />
    : normalizedPath === '/settings' ? <SettingsPage onUpdateUser={setUser} onNavigate={navigate} onLogout={() => void signOut()} />
    : normalizedPath === '/profile' ? <ProfilePage user={user} onUpdateUser={setUser} onLogout={() => void signOut()} onNavigate={navigate} />
    : <DashboardView onNavigate={navigate} />

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <QuickCreateModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onNavigate={navigate} />
      <div className="hidden md:block">
        <Sidebar path={currentPath} onNavigate={navigate} />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in-0 duration-200">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative shadow-2xl">
            <Sidebar path={currentPath} onClose={() => setMobileOpen(false)} onNavigate={navigate} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenu={() => setMobileOpen(true)} onLogout={() => void signOut()} onOpenQuickAdd={() => setQuickAddOpen(true)} onNavigate={navigate} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 sm:p-6 md:p-8">
          <div className="lifeos-enter" key={normalizedPath}>{page}</div>
        </main>
      </div>
    </div>
  )
}

export function AuthPage({ register = false }: { register?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 shadow-sm">
        <Brand />
        <div className="mt-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{register ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{register ? 'Start organizing the life you want.' : 'Sign in to continue to your workspace.'}</p>
        </div>
        <AuthForm register={register} />
      </div>
    </main>
  )
}
