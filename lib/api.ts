export type ApiEnvelope<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } }

const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<{ data: T }> { return { data: await request<T>(path, init) } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { createClient } = await import('@/lib/supabase/client')
  const { data: { session } } = await createClient().auth.getSession()
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  const response = await fetch(`${baseUrl}${path}`, { credentials: 'include', ...init, headers })
  const body = await response.json() as ApiEnvelope<T>
  if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Request failed')
  return body.data
}

export function updateTaskStatus(id: string, status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE') {
  return request(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function createTask(payload: { title: string; startAt?: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  return request('/tasks', { method: 'POST', body: JSON.stringify(payload) })
}
