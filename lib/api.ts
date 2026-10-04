export type ApiEnvelope<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } }

const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

export class ApiError extends Error {
  code?: string
  status: number
  constructor(message: string, status: number = 500, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function formatApiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'AUTH_REQUIRED') return 'Please sign in to access this feature.'
    if (err.code === 'AUTH_INVALID') return 'Your session has expired. Please sign in again.'
    if (err.code === 'VALIDATION_ERROR') return err.message || 'Please check your input values.'
    if (err.code === 'NOT_FOUND') return err.message || 'The requested item was not found.'
    if (err.code === 'DRAFT_NOT_FOUND') return 'This import draft was not found.'
    if (err.code === 'DRAFT_NOT_EDITABLE') return 'This draft cannot be edited in its current state.'
    return err.message
  }
  if (err instanceof Error) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch failed')) {
      return 'Unable to reach the server. Please check your network connection.'
    }
    return err.message
  }
  return 'An unexpected error occurred. Please try again.'
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<{ data: T }> { return { data: await request<T>(path, init) } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let session = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && !supabaseUrl.includes('placeholder')) {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const { data } = await createClient().auth.getSession()
      session = data.session
    } catch (err) {
      console.warn('Failed to retrieve Supabase session:', err)
    }
  }
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, { credentials: 'include', ...init, headers })
  } catch {
    throw new ApiError('Unable to connect to LifeOS API server. Please check your connection.', 0, 'NETWORK_ERROR')
  }

  const text = await response.text()
  let body: ApiEnvelope<T>
  try {
    body = JSON.parse(text) as ApiEnvelope<T>
  } catch {
    throw new ApiError(response.ok ? 'Invalid response from server' : `Server error (${response.status})`, response.status)
  }
  if (!response.ok || body.error) {
    throw new ApiError(body.error?.message ?? 'Request failed', response.status, body.error?.code)
  }
  return body.data
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskItem = { id: string; userId: string; title: string; description?: string; type: string; status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'; priority: 'LOW' | 'MEDIUM' | 'HIGH'; category?: string; startAt: string; endAt?: string; location?: string; estimatedMinutes?: number }

export type ReminderItem = { id: string; userId: string; calendarItemId: string; offsetMinutes: number; enabled: boolean; createdAt: string }

export type RecurrenceRule = {
  id: string; calendarItemId: string
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'
  interval: number; daysOfWeek: number[]; dayOfMonth?: number
  startDate: string; endDate?: string; timezone: string
}

export type AlertSeverity = 'NORMAL' | 'IMPORTANT' | 'CRITICAL'
export type AlertTriggerType = 'OFFSET_BEFORE' | 'EXACT_TIME'
export type AlertChannel = 'IN_APP' | 'BROWSER' | 'SOUND' | 'EMAIL'
export type SoundName = 'SILENT' | 'SOFT' | 'REMINDER' | 'URGENT' | 'CRITICAL'

export type AlertItem = {
  id: string; userId: string; calendarItemId?: string | null
  title?: string | null; triggerType: AlertTriggerType
  offsetMinutes?: number | null; exactTime?: string | null
  channels: AlertChannel[]; severity: AlertSeverity
  soundName?: string | null; soundVolume: number; soundRepeat: number
  enabled: boolean; order: number; escalationStep?: number | null
  lastTriggeredAt?: string | null; snoozedUntil?: string | null
  createdAt: string; updatedAt: string
  calendarItem?: { id: string; title: string; startAt: string; type: string; status: string } | null
}

export type CalendarItem = {
  id: string; userId: string; title: string; description?: string
  type: 'TASK' | 'EVENT' | 'REMINDER'; status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'; category?: string; startAt: string; endAt?: string
  location?: string; notes?: string; allDay: boolean; estimatedMinutes?: number
  createdAt: string; updatedAt: string
  recurrenceRule?: RecurrenceRule | null
  reminders?: ReminderItem[]
  alerts?: AlertItem[]
}

export type SmartProposal = { title: string; startAt: string; endAt: string; estimatedMinutes: number; priority: 'LOW' | 'MEDIUM' | 'HIGH'; type: 'TASK' | 'EVENT' }
export type SmartSchedule = { parsed: { title: string; startAt?: string; estimatedMinutes: number; priority: 'LOW' | 'MEDIUM' | 'HIGH' }; conflicts: Array<{ id: string; title: string; startAt: string; endAt?: string }>; alternatives: SmartProposal[]; created: CalendarItem[] }
export type CalendarBriefing = { summary: string; events: CalendarItem[]; highPriority: CalendarItem[]; conflictItemIds: string[] }
export type CalendarAnalytics = { studyMinutes: number; workMinutes: number; meetingMinutes: number; completedTasks: number; totalTasks: number; freeMinutes: number }
export type NotificationItem = {
  id: string; userId: string; type: 'REMINDER' | 'OVERDUE' | 'MISSED' | 'SYSTEM' | 'AI_IMPORT'
  severity: AlertSeverity; title: string; message: string
  channels: AlertChannel[]; soundName?: string | null; soundVolume?: number | null; soundRepeat?: number | null
  snoozedUntil?: string | null; status: string; alertId?: string | null
  metadata?: Record<string, unknown> | null
  readAt?: string | null; createdAt: string; scheduledAt?: string | null; calendarItemId?: string | null
  calendarItem?: { id: string; title: string; type: string; startAt: string; status: string; priority: string } | null
  alert?: { id: string; severity: AlertSeverity; soundName?: string | null; channels: AlertChannel[] } | null
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export type DashboardMetrics = {
  totalToday: number
  completedToday: number
  upcomingCount: number
  overdueCount: number
  totalTasks: number
  completedTasks: number
  unreadNotifications: number
  activeReminders: number
  recurringCount: number
  recentAiDraftsCount: number
}

export type RecentActivityItem = {
  id: string
  type: 'ITEM_COMPLETED' | 'ITEM_CREATED' | 'ITEM_UPDATED' | 'DRAFT_CONFIRMED' | 'DRAFT_CREATED' | 'NOTIFICATION'
  title: string
  description?: string
  timestamp: string
}

export type RecentAiDraftSummary = {
  id: string
  status: string
  originalFileName?: string
  sourceType: string
  itemCount: number
  createdAt: string
}

export type DashboardSummary = {
  metrics: DashboardMetrics
  todayItems: CalendarItem[]
  upcomingItems: CalendarItem[]
  overdueItems: CalendarItem[]
  recentActivity: RecentActivityItem[]
  recentAiDrafts: RecentAiDraftSummary[]
}

export function getDashboardSummary() {
  return request<DashboardSummary>('/dashboard/summary')
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskFilters = {
  q?: string
  search?: string
  status?: string
  priority?: string
  category?: string
  sortBy?: 'startAt' | 'priority' | 'status' | 'createdAt' | 'title'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  page?: number
}

export type TaskListResponse = {
  items: TaskItem[]
  total: number
  page: number
  limit: number
}

export function getTasks(filters: TaskFilters = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== '') q.set(k, String(v))
  const qs = q.toString()
  return request<TaskListResponse | TaskItem[]>(`/tasks${qs ? `?${qs}` : ''}`).then(res => {
    if (Array.isArray(res)) return res
    if (res && 'items' in res) return res.items
    return []
  })
}

export function getTask(id: string) {
  return request<TaskItem>(`/tasks/${id}`)
}

export function createTask(payload: { title: string; startAt?: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH'; category?: string; description?: string; estimatedMinutes?: number }) {
  return request<TaskItem>('/tasks', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateTask(id: string, payload: Partial<{ title: string; startAt: string; priority: 'LOW' | 'MEDIUM' | 'HIGH'; status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'; category: string; description: string; estimatedMinutes: number }>) {
  return request<TaskItem>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function updateTaskStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE') {
  return request<TaskItem>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function deleteTask(id: string) {
  return request<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE' })
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export type CalendarFilters = {
  q?: string; search?: string; from?: string; to?: string; startDate?: string; endDate?: string
  status?: string; type?: string; category?: string; priority?: string; limit?: number
  sortBy?: 'startAt' | 'priority' | 'status' | 'createdAt' | 'title'; sortOrder?: 'asc' | 'desc'
}

export function getCalendarItems(filters: CalendarFilters = {}) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== '') q.set(k, String(v))
  const qs = q.toString()
  return request<CalendarItem[]>(`/calendar${qs ? `?${qs}` : ''}`)
}

export function getCalendarItem(id: string) { return request<CalendarItem>(`/calendar/${id}`) }

export function createCalendarItem(payload: {
  title: string; startAt: string; endAt?: string; description?: string; notes?: string
  type?: string; priority?: string; category?: string; location?: string; allDay?: boolean; estimatedMinutes?: number
}) { return request<CalendarItem>('/calendar', { method: 'POST', body: JSON.stringify(payload) }) }

export function updateCalendarItem(id: string, payload: Partial<{
  title: string; startAt: string; endAt: string | null; description: string; notes: string
  type: string; priority: string; status: string; category: string; location: string; allDay: boolean; estimatedMinutes: number | null
}>) { return request<CalendarItem>(`/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }

export function deleteCalendarItem(id: string) { return request<{ deleted: boolean }>(`/calendar/${id}`, { method: 'DELETE' }) }

export function updateCalendarItemStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE') {
  return request<CalendarItem>(`/calendar/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function duplicateCalendarItem(id: string) { return request<CalendarItem>(`/calendar/${id}/duplicate`, { method: 'POST' }) }

export function updateRecurrenceRule(id: string, payload: { frequency: string; interval?: number; daysOfWeek?: number[]; dayOfMonth?: number; startDate?: string; endDate?: string; timezone?: string } | { remove: true }) {
  return request<RecurrenceRule | { removed: boolean }>(`/calendar/${id}/recurrence`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function addReminder(calendarItemId: string, offsetMinutes: number) {
  return request<ReminderItem>(`/calendar/${calendarItemId}/reminders`, { method: 'POST', body: JSON.stringify({ offsetMinutes }) })
}

export function removeReminder(calendarItemId: string, reminderId: string) {
  return request<{ deleted: boolean }>(`/calendar/${calendarItemId}/reminders/${reminderId}`, { method: 'DELETE' })
}

export function smartSchedule(text: string, options?: { type?: 'TASK' | 'EVENT'; create?: boolean; availability?: { startHour?: number; endHour?: number; horizonDays?: number } }) {
  return request<SmartSchedule>('/calendar/smart/schedule', { method: 'POST', body: JSON.stringify({ text, type: options?.type ?? 'TASK', create: options?.create ?? false, availability: options?.availability }) })
}
export function getCalendarBriefing() { return request<CalendarBriefing>('/calendar/smart/briefing') }
export function getCalendarAnalytics() { return request<CalendarAnalytics>('/calendar/smart/analytics') }
export function rescheduleMissedTask(id: string, confirm = false) { return request<{ moved: boolean; suggestion?: { startAt: string; endAt: string }; task?: TaskItem }>(`/calendar/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ confirm }) }) }

// ─── Notifications ────────────────────────────────────────────────────────────

export function getNotifications(filters: { unread?: boolean; type?: string; limit?: number; search?: string; page?: number } = {}) {
  const q = new URLSearchParams()
  if (filters.unread) q.set('unread', 'true')
  if (filters.type) q.set('type', filters.type)
  if (filters.limit) q.set('limit', String(filters.limit))
  if (filters.search) q.set('search', filters.search)
  if (filters.page) q.set('page', String(filters.page))
  const qs = q.toString()
  return request<NotificationItem[]>(`/notifications${qs ? `?${qs}` : ''}`)
}

export function getNotificationCount() { return request<{ count: number }>('/notifications/count') }
export function markNotificationRead(id: string) { return request<{ read: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }) }
export function markNotificationUnread(id: string) { return request<{ unread: boolean }>(`/notifications/${id}/unread`, { method: 'PATCH' }) }
export function markAllNotificationsRead() { return request<{ done: boolean }>('/notifications/read-all', { method: 'POST' }) }
export function deleteNotification(id: string) { return request<{ deleted: boolean }>(`/notifications/${id}`, { method: 'DELETE' }) }
export function snoozeNotification(id: string, minutes: number) { return request<{ success: boolean; snoozedUntil: string }>(`/notifications/${id}/snooze`, { method: 'POST', body: JSON.stringify({ minutes }) }) }
export function dismissNotification(id: string) { return request<{ success: boolean }>(`/notifications/${id}/dismiss`, { method: 'POST' }) }
export function getNotificationSummary() { return request<{ unreadCount: number; today: NotificationItem[]; missed: NotificationItem[]; upcoming: NotificationItem[]; recent: NotificationItem[] }>('/notifications/summary') }
export function sendDailyDigest() { return request<{ success: boolean; messageId?: string }>('/notifications/digest', { method: 'POST' }) }

// ─── Alerts ────────────────────────────────────────────────────────────────────

export type AlertInput = {
  calendarItemId?: string | null; title?: string
  triggerType?: 'OFFSET_BEFORE' | 'EXACT_TIME'
  offsetMinutes?: number; exactTime?: string | null
  channels?: string[]; severity?: string
  soundName?: string; soundVolume?: number; soundRepeat?: number
  enabled?: boolean; order?: number; escalationStep?: number | null
}

export function listAlerts(calendarItemId?: string) {
  const q = calendarItemId ? `?calendarItemId=${calendarItemId}` : ''
  return request<AlertItem[]>(`/alerts${q}`)
}

export function getAlert(id: string) { return request<AlertItem>(`/alerts/${id}`) }
export function createAlert(payload: AlertInput) { return request<AlertItem>('/alerts', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateAlert(id: string, payload: Partial<AlertInput>) { return request<AlertItem>(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export function deleteAlert(id: string) { return request<{ deleted: boolean }>(`/alerts/${id}`, { method: 'DELETE' }) }
export function applyAlertPreset(calendarItemId: string, preset: 'BIRTHDAY' | 'DEADLINE' | 'MEETING' | 'ESCALATION') {
  return request<AlertItem[]>('/alerts/preset', { method: 'POST', body: JSON.stringify({ calendarItemId, preset }) })
}
export function testAlertDelivery(channel: string, soundName?: string, severity?: string) {
  return request<{ success: boolean; notification?: NotificationItem }>('/alerts/test-delivery', { method: 'POST', body: JSON.stringify({ channel, soundName, severity }) })
}

