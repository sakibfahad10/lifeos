import { apiFetch } from './api'
import { createClient } from './supabase/client'

export type LifeOSUser = { id: string; name: string; email: string; settings?: Record<string, unknown> }

export async function getCurrentUser() { return apiFetch<LifeOSUser>('/auth/me') }
export async function updateProfile(data: { name?: string; email?: string }) { return apiFetch<LifeOSUser>('/users/profile', { method: 'PATCH', body: JSON.stringify(data) }) }
export async function getSettings() { return apiFetch<Record<string, unknown>>('/users/settings') }
export async function updateSettings(data: Record<string, unknown>) { return apiFetch<Record<string, unknown>>('/users/settings', { method: 'PATCH', body: JSON.stringify(data) }) }
export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined)
  const { error } = await createClient().auth.signOut()
  if (error) throw error
  return { data: { loggedOut: true } }
}
