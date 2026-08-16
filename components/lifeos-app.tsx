'use client'

import { useEffect, useState } from 'react'
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, FileUp, LayoutDashboard, ListChecks, Menu, MoreHorizontal, Plus, Search, Settings, Sparkles, Sun, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTasks, createTask, updateTaskStatus, getCalendarItems, createCalendarItem, getNotifications, markNotificationRead, type TaskItem, type CalendarItem as ApiCalendarItem, type NotificationItem } from '@/lib/api'
import { getCurrentUser, getSettings, updateProfile, updateSettings, logout, type LifeOSUser } from '@/lib/user-api'
import { cn } from '@/lib/utils'
import { AIImportPage } from '@/components/ai-import-page'
import { NotificationsPage as NotificationsFeaturePage } from '@/components/notifications-page'
import { AuthForm } from '@/components/auth-form'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/ai-import', label: 'AI Import', icon: Sparkles },
  { href: '/notifications', label: 'Notifications', icon: Bell },
]

function Brand() { return <div className="flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground"><CalendarDays className="size-4" /></div><span className="text-lg font-semibold tracking-tight">LifeOS</span></div> }

function Sidebar({ path, onClose }: { path: string; onClose?: () => void }) {
  return <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 p-4 shadow-[8px_0_32px_-24px_color-mix(in_oklab,var(--primary)_35%,transparent)] backdrop-blur">
    <div className="flex items-center justify-between px-2 py-2"><Brand />{onClose && <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close navigation"><X /></Button>}</div>
    <div className="mt-8 flex flex-1 flex-col gap-1">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</p>
      {nav.map(({ href, label, icon: Icon }) => <a key={href} href={href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground', path === href && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground')}><Icon className="size-4" /><span className="flex-1">{label}</span></a>)}
      <div className="mt-8"><p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Manage</p><a href="/settings" className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground', path === '/settings' && 'bg-sidebar-primary text-sidebar-primary-foreground')}><Settings className="size-4" />Settings</a></div>
    </div>
    <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3"><div className="flex items-center gap-2"><div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-4" /></div><div><p className="text-xs font-medium">Make time for what matters</p><p className="mt-0.5 text-[11px] text-muted-foreground">Your day, organized.</p></div></div></div>
  </aside>
}

function Topbar({ user, onMenu, onLogout }: { user: LifeOSUser | null; onMenu: () => void; onLogout: () => void }) {
  const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'
  return <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/80 bg-background/85 px-4 shadow-[0_8px_24px_-24px_color-mix(in_oklab,var(--foreground)_40%,transparent)] backdrop-blur-xl md:px-8">
    <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onMenu} aria-label="Open navigation"><Menu /></Button>
    <div className="relative hidden max-w-sm flex-1 md:block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className="h-9 w-full rounded-lg border border-input bg-muted/30 pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Search anything..." /></div>
    <div className="ml-auto flex items-center gap-2">
      <Button variant="ghost" size="icon-sm" aria-label="Help"><CircleHelp /></Button>
      <a href="/notifications" className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Bell className="size-4" /></a>
      <div className="ml-1 flex items-center gap-2 border-l border-border pl-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials}</div>
        <div className="hidden text-left sm:block">
          <p className="text-xs font-medium">{user?.name || 'User'}</p>
          <p className="text-[11px] text-muted-foreground">{user?.email || 'Personal workspace'}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onLogout} aria-label="Log out"><UserRound /></Button>
      </div>
    </div>
  </header>
}

function Stat({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Check }) {
  return <div className="lifeos-enter rounded-2xl border border-border/80 bg-card/90 p-4 shadow-[0_12px_30px_-24px_color-mix(in_oklab,var(--foreground)_35%,transparent)] transition-transform duration-200 hover:-translate-y-0.5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span></div><p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>
}

function Dashboard({ user }: { user: LifeOSUser | null }) {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [events, setEvents] = useState<ApiCalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([getTasks(), getCalendarItems()])
      .then(([tasksData, eventsData]) => {
        setTasks(tasksData)
        setEvents(eventsData)
      })
      .catch(() => setMessage('Loaded workspace.'))
      .finally(() => setLoading(false))
  }, [])

  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const firstName = user?.name ? user.name.split(' ')[0] : 'there'
  const todayFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm text-muted-foreground">{todayFormatted}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Good morning, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s your day at a glance.</p>
      </div>
      <a href="/tasks"><Button><Plus data-icon="inline-start" />Add task</Button></a>
    </div>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Today's progress" value={`${progressPercent}%`} note={`${completedCount} of ${totalCount} tasks complete`} icon={Check} />
      <Stat label="Upcoming" value={String(events.length)} note="Events scheduled" icon={CalendarDays} />
      <Stat label="Total tasks" value={String(totalCount)} note="In your workspace" icon={ClipboardCheck} />
      <Stat label="Completed" value={String(completedCount)} note="Tasks finished" icon={Sun} />
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section className="lifeos-enter lifeos-enter-delay-1 rounded-2xl border border-border/80 bg-card/90 shadow-[0_16px_40px_-30px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
        <div className="flex items-center justify-between border-b border-border/80 p-5">
          <div><h2 className="font-semibold">Today&apos;s schedule</h2><p className="mt-1 text-xs text-muted-foreground">{todayFormatted}</p></div>
          <a href="/calendar" className="text-sm font-medium text-primary hover:underline">View calendar</a>
        </div>
        <div className="flex flex-col">
          {events.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No events scheduled. <a href="/calendar" className="text-primary hover:underline">Create an event</a></div>
          ) : (
            events.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center gap-4 border-b border-border/70 px-5 py-4 last:border-0">
                <span className="w-12 text-xs font-medium text-muted-foreground">{new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="size-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{event.category || 'Event'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="lifeos-enter lifeos-enter-delay-1 rounded-2xl border border-border/80 bg-card/90 shadow-[0_16px_40px_-30px_color-mix(in_oklab,var(--foreground)_45%,transparent)]">
        <div className="flex items-center justify-between border-b border-border/80 p-5">
          <div><h2 className="font-semibold">Tasks for today</h2><p className="mt-1 text-xs text-muted-foreground">Keep the momentum going</p></div>
          <a href="/tasks" className="text-sm font-medium text-primary hover:underline">View all</a>
        </div>
        <div className="flex flex-col p-2">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No tasks yet. <a href="/tasks" className="text-primary hover:underline">Add your first task</a></div>
          ) : (
            tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50">
                <div className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', task.status === 'COMPLETED' ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                  {task.status === 'COMPLETED' && <Check className="size-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', task.status === 'COMPLETED' && 'text-muted-foreground line-through')}>{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{task.category || 'Task'}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', task.priority === 'HIGH' ? 'bg-destructive/10 text-destructive' : task.priority === 'MEDIUM' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>{task.priority}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  </div>
}

function CalendarPage() {
  const [items, setItems] = useState<ApiCalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newDate, setNewDate] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [message, setMessage] = useState('')

  const loadCalendar = () => {
    setLoading(true)
    getCalendarItems()
      .then(setItems)
      .catch(() => setMessage('Unable to load calendar.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCalendar()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      await createCalendarItem({
        title: newTitle.trim(),
        startAt: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
      })
      setNewTitle('')
      setNewDate('')
      setShowComposer(false)
      setMessage('Event created!')
      loadCalendar()
    } catch {
      setMessage('Could not create event.')
    }
  }

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm text-muted-foreground">Your Schedule</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Calendar</h1>
      </div>
      <Button onClick={() => setShowComposer(!showComposer)}><Plus data-icon="inline-start" />{showComposer ? 'Close' : 'New event'}</Button>
    </div>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {showComposer && (
      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-border p-4 bg-card">
        <label className="flex flex-col gap-1 text-sm font-medium">Event Title
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required placeholder="e.g. Team meeting" className="h-9 rounded-lg border border-input px-3 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Start Date & Time
          <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-9 rounded-lg border border-input px-3 text-sm outline-none" />
        </label>
        <Button type="submit" className="w-fit">Save event</Button>
      </form>
    )}
    <div className="rounded-2xl border border-border/80 bg-card/90 shadow-sm p-5">
      <h2 className="font-semibold mb-4">Scheduled Events ({items.length})</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading calendar...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet. Click &quot;New event&quot; to add one.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(item.startAt).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{item.category || 'Event'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
}

function TasksPage() {
  const [taskList, setTaskList] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncMessage, setSyncMessage] = useState('')
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('All')
  const [showComposer, setShowComposer] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')

  const loadTasks = () => {
    setLoading(true)
    getTasks()
      .then(setTaskList)
      .catch(() => setSyncMessage('Could not fetch tasks'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const toggleTask = async (task: TaskItem) => {
    const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    setTaskList(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    try {
      await updateTaskStatus(task.id, nextStatus)
      setSyncMessage('Task updated')
    } catch {
      setSyncMessage('Failed to update task')
      loadTasks()
    }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    try {
      await createTask({ title: newTaskTitle.trim(), priority: newTaskPriority })
      setNewTaskTitle('')
      setShowComposer(false)
      setSyncMessage('Task added!')
      loadTasks()
    } catch {
      setSyncMessage('Failed to create task')
    }
  }

  const visibleTasks = taskList.filter(task =>
    task.title.toLowerCase().includes(query.toLowerCase()) &&
    (priority === 'All' || task.priority === priority)
  )

  return <div className="flex flex-col gap-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-sm text-muted-foreground">Stay on top of what matters</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Tasks</h1></div>
      <Button onClick={() => setShowComposer(!showComposer)}><Plus data-icon="inline-start" />{showComposer ? 'Close' : 'Add task'}</Button>
    </div>
    {showComposer && (
      <form onSubmit={handleAddTask} className="flex flex-col gap-3 rounded-2xl border border-border p-4 bg-card">
        <label className="flex flex-col gap-1 text-sm font-medium">Task Title
          <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required placeholder="e.g. Complete quarterly report" className="h-9 rounded-lg border border-input px-3 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Priority
          <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)} className="h-9 rounded-lg border border-input px-3 text-sm outline-none">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <Button type="submit" className="w-fit">Save task</Button>
      </form>
    )}
    <div className="lifeos-enter flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search tasks" className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none" placeholder="Search tasks..." />
      </div>
      <select value={priority} onChange={event => setPriority(event.target.value)} aria-label="Filter by priority" className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
        <option value="All">All priorities</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>
    </div>
    <div className="rounded-2xl border border-border/80 bg-card/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-semibold">All tasks</h2>
          <p className="mt-1 text-xs text-muted-foreground">{taskList.length} tasks in your workspace{syncMessage ? ` · ${syncMessage}` : ''}</p>
        </div>
      </div>
      <div className="flex flex-col">
        {loading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading tasks...</p>
        ) : visibleTasks.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No tasks found. Click &quot;Add task&quot; to create one.</p>
        ) : (
          visibleTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 border-b border-border/70 px-5 py-4 last:border-0">
              <button onClick={() => void toggleTask(task)} className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border', task.status === 'COMPLETED' && 'border-primary bg-primary text-primary-foreground')} aria-label={`Mark ${task.title}`}>
                {task.status === 'COMPLETED' && <Check className="size-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium', task.status === 'COMPLETED' && 'text-muted-foreground line-through')}>{task.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{task.category || 'General'}</p>
              </div>
              <span className={cn('rounded-full px-2 py-1 text-[11px] font-medium', task.priority === 'HIGH' ? 'bg-destructive/10 text-destructive' : task.priority === 'MEDIUM' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>{task.priority}</span>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
}

function SimplePage({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-6"><div><p className="text-sm text-muted-foreground">{eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1></div>{children}</div>
}

function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = () => {
    setLoading(true)
    getNotifications()
      .then(setItems)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const handleRead = async (id: string) => {
    try {
      await markNotificationRead(id)
      loadNotifications()
    } catch {}
  }

  return <SimplePage title="Notifications" eyebrow="Stay informed, not overwhelmed">
    <div className="rounded-2xl border border-border/80 bg-card/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div><h2 className="font-semibold">Inbox</h2><p className="mt-1 text-xs text-muted-foreground">{items.filter(i => !i.readAt).length} unread notifications</p></div>
      </div>
      {loading ? (
        <p className="p-5 text-sm text-muted-foreground">Loading notifications...</p>
      ) : items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        items.map((n) => (
          <div key={n.id} onClick={() => void handleRead(n.id)} className={cn('flex items-start gap-4 border-b border-border/70 p-5 last:border-0 cursor-pointer', !n.readAt && 'bg-primary/[0.025]')}>
            <div className="mt-1 flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary"><Bell className="size-4" /></div>
            <div className="flex-1">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
            </div>
            {!n.readAt && <span className="mt-2 size-2 rounded-full bg-primary" />}
          </div>
        ))
      )}
    </div>
  </SimplePage>
}

function SettingsPage() {
  const [user, setUser] = useState<LifeOSUser | null>(null); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [theme, setTheme] = useState('system'); const [weekStartsOn, setWeekStartsOn] = useState('monday'); const [status, setStatus] = useState(''); const [saving, setSaving] = useState(false); useEffect(() => { void Promise.all([getCurrentUser(), getSettings()]).then(([profile, settings]) => { setUser(profile.data); setName(profile.data.name); setEmail(profile.data.email); setTheme(String(settings.data.theme ?? 'system')); setWeekStartsOn(String(settings.data.weekStartsOn ?? 'monday')); }).catch(() => setStatus('Unable to load your settings.')); }, []); const save = async () => { setSaving(true); setStatus(''); try { await updateProfile({ name, email }); await updateSettings({ theme, weekStartsOn }); setStatus('Changes saved.'); } catch { setStatus('Could not save changes.'); } finally { setSaving(false); } }; return <SimplePage title="Settings" eyebrow="Make LifeOS work for you"><div className="grid gap-6 lg:grid-cols-[220px_1fr]"><nav className="flex gap-1 overflow-x-auto lg:flex-col"><button className="whitespace-nowrap rounded-lg bg-primary px-3 py-2 text-left text-sm font-medium text-primary-foreground">Profile</button>{['Appearance','Notifications','Calendar','AI preferences','Privacy','Account'].map(x => <button key={x} disabled className="whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60">{x}</button>)}</nav><div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-[0_16px_40px_-30px_color-mix(in_oklab,var(--foreground)_45%,transparent)]"><h2 className="font-semibold">Profile settings</h2><p className="mt-1 text-sm text-muted-foreground">Update your personal details and workspace identity.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-medium">Name<input value={name} onChange={event => setName(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" /></label><label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" /></label><label className="flex flex-col gap-2 text-sm font-medium">Theme<select value={theme} onChange={event => setTheme(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="flex flex-col gap-2 text-sm font-medium">Week starts on<select value={weekStartsOn} onChange={event => setWeekStartsOn(event.target.value)} className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none"><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label></div><div className="mt-6 flex flex-wrap items-center gap-3"><Button onClick={() => void save()} disabled={saving || !user}>{saving ? 'Saving…' : 'Save changes'}</Button>{status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}</div></div></div></SimplePage>
}

export function LifeOSApp({ path = '/dashboard' }: { path?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [user, setUser] = useState<LifeOSUser | null>(null)

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
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading your workspace…</div>
  }

  const page = path === '/calendar' ? <CalendarPage /> : path === '/tasks' ? <TasksPage /> : path === '/ai-import' ? <AIImportPage /> : path === '/notifications' ? <NotificationsPage /> : path === '/settings' ? <SettingsPage /> : <Dashboard user={user} />

  return <div className="flex min-h-screen bg-background">
    <div className="hidden md:block"><Sidebar path={path} /></div>
    {mobileOpen && <div className="fixed inset-0 z-50 flex md:hidden"><div className="absolute inset-0 bg-foreground/20" onClick={() => setMobileOpen(false)} /><div className="relative"><Sidebar path={path} onClose={() => setMobileOpen(false)} /></div></div>}
    <div className="flex min-w-0 flex-1 flex-col">
      <Topbar user={user} onMenu={() => setMobileOpen(true)} onLogout={() => void signOut()} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8"><div className="lifeos-enter">{page}</div></main>
    </div>
  </div>
}

export function AuthPage({ register = false }: { register?: boolean }) {
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm"><Brand /><div className="mt-10"><h1 className="text-2xl font-semibold tracking-tight">{register ? 'Create your account' : 'Welcome back'}</h1><p className="mt-2 text-sm text-muted-foreground">{register ? 'Start organizing the life you want.' : 'Sign in to continue to your workspace.'}</p></div><AuthForm register={register} /></div></main>
}
