import type { ApiEnvelope } from './api'

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'
export type ImportDraft = { id: string; status: string; items: Array<{ id: string; title: string; selected: boolean }> }
export async function createImportDraft(text: string, sourceType = 'text') { const response = await fetch(`${baseUrl}/ai/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sourceType }) }); const body = await response.json() as ApiEnvelope<ImportDraft>; if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Unable to create draft'); return body.data }
export async function confirmImportDraft(id: string) { const response = await fetch(`${baseUrl}/ai/import/${id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }); const body = await response.json() as ApiEnvelope<{ items: unknown[] }>; if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Unable to confirm draft'); return body.data }
