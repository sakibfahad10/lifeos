import { apiFetch } from './api'

export type DraftItem = { id: string; title: string; description?: string | null; startAt?: string | null; endAt?: string | null; type: 'TASK' | 'EVENT' | 'REMINDER'; category?: string | null; priority: 'LOW' | 'MEDIUM' | 'HIGH'; recurrence?: Record<string, unknown> | null; reminderMinutes?: number | null; confidenceScore?: number | null; selected: boolean; edited: boolean }
export type ImportDraft = { id: string; sourceType: string; originalFileName?: string | null; status: 'PROCESSING' | 'REVIEW' | 'CONFIRMED' | 'REJECTED' | 'FAILED'; items: DraftItem[] }
export type ImportSource = { sourceType: 'text' | 'pdf' | 'image' | 'document'; text?: string; instruction?: string; file?: { name: string; mimeType: string; base64: string } }

export async function createImportDraft(source: ImportSource) { return (await apiFetch<ImportDraft>('/ai/import', { method: 'POST', body: JSON.stringify(source) })).data }
export async function getImportDraft(id: string) { return (await apiFetch<ImportDraft>(`/ai/import/${id}`)).data }
export async function saveImportReview(id: string, items: Array<Omit<DraftItem, 'id' | 'edited'>>) { return (await apiFetch<ImportDraft>(`/ai/import/${id}/review`, { method: 'PATCH', body: JSON.stringify({ items }) })).data }
export async function refineImportDraft(id: string, command: string) { return (await apiFetch<ImportDraft>(`/ai/import/${id}/edit`, { method: 'POST', body: JSON.stringify({ command }) })).data }
export async function confirmImportDraft(id: string) { return (await apiFetch<{ draftId: string; items: unknown[] }>(`/ai/import/${id}/confirm`, { method: 'POST' })).data }
export async function rejectImportDraft(id: string) { return (await apiFetch<{ rejected: boolean }>(`/ai/import/${id}/reject`, { method: 'POST' })).data }
export async function getAiImports() { return (await apiFetch<Array<ImportDraft & { createdAt?: string; _count?: { items: number } }>>('/ai/imports')).data }
export async function deleteAiImportDraft(id: string) { return (await apiFetch<{ deleted: boolean }>(`/ai/import/${id}`, { method: 'DELETE' })).data }
