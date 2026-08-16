export type ApiEnvelope<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } }

const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

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
  const response = await fetch(`${baseUrl}${path}`, { credentials: 'include', ...init, headers })
  const text = await response.text()
  let body: ApiEnvelope<T>
  try {
    body = JSON.parse(text) as ApiEnvelope<T>
  } catch {
    throw new Error(response.ok ? 'Invalid response from server' : `Server error (${response.status}): ${text.slice(0, 150)}`)
  }
  if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Request failed')
  return body.data
}

export type TaskItem = { id: string; userId: string; title: string; description?: string; type: string; status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE'; priority: 'LOW' | 'MEDIUM' | 'HIGH'; category?: string; startAt: string; endAt?: string; location?: string }
export type CalendarItem = { id: string; userId: string; title: string; description?: string; type: string; status: string; priority: string; category?: string; startAt: string; endAt?: string; location?: string; allDay: boolean }
export type NotificationItem = { id: string; userId: string; type: string; title: string; message: string; readAt?: string; createdAt: string }

export function getTasks() {
  return request<TaskItem[]>('/tasks')
}

export function updateTaskStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE') {
  return request<TaskItem>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function createTask(payload: { title: string; startAt?: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH'; category?: string; description?: string }) {
  return request<TaskItem>('/tasks', { method: 'POST', body: JSON.stringify(payload) })
}

export function getCalendarItems(from?: string, to?: string) {
  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  const queryString = query.toString()
  return request<CalendarItem[]>(`/calendar${queryString ? `?${queryString}` : ''}`)
}

export function createCalendarItem(payload: { title: string; startAt: string; endAt?: string; description?: string; type?: string; priority?: string; category?: string; location?: string; allDay?: boolean }) {
  return request<CalendarItem>('/calendar', { method: 'POST', body: JSON.stringify(payload) })
}

export function getNotifications() {
  return request<NotificationItem[]>('/notifications')
}

export function markNotificationRead(id: string) {
  return request<{ read: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' })
}
