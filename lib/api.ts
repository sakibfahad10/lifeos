export type ApiEnvelope<T> = { data: T; error: null } | { data: null; error: { code: string; message: string } }

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
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
