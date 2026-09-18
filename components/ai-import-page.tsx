'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileText,
  FileUp,
  Image,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  confirmImportDraft,
  createImportDraft,
  deleteAiImportDraft,
  getAiImports,
  getImportDraft,
  refineImportDraft,
  rejectImportDraft,
  saveImportReview,
  type DraftItem,
  type ImportDraft,
} from '@/lib/ai-api'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type DraftStatus = 'idle' | 'uploading' | 'processing' | 'review' | 'editing' | 'confirmed' | 'failed'

type Row = DraftItem & {
  date: string
  startTime: string
  endTime: string
  recurrenceText: string
  reminderText: string
  _expanded: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatLocalTime(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function inferMimeType(file: File): string {
  if (file.type && file.type.trim()) return file.type.trim()
  const ext = file.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf': return 'application/pdf'
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'txt': return 'text/plain'
    case 'csv': return 'text/csv'
    case 'doc': return 'application/msword'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default: return 'application/octet-stream'
  }
}

function toRow(item: DraftItem): Row {
  const s = item.startAt ? new Date(item.startAt) : null
  const e = item.endAt ? new Date(item.endAt) : null
  const validStart = s && !isNaN(s.getTime()) ? s : null
  const validEnd = e && !isNaN(e.getTime()) ? e : null

  return {
    ...item,
    date: validStart ? formatLocalDate(validStart) : '',
    startTime: validStart ? formatLocalTime(validStart) : '',
    endTime: validEnd ? formatLocalTime(validEnd) : '',
    recurrenceText: item.recurrence?.frequency ? String(item.recurrence.frequency) : 'None',
    reminderText: item.reminderMinutes ? String(item.reminderMinutes) : '',
    _expanded: false,
  }
}

function toItem({ id: _id, edited: _ed, date, startTime, endTime, recurrenceText, reminderText, _expanded, ...row }: Row): Omit<DraftItem, 'id' | 'edited'> {
  let startAt: string | null = null
  let endAt: string | null = null

  if (date && date.trim()) {
    const sTime = startTime && startTime.trim() ? startTime.trim() : '09:00'
    const sDate = new Date(`${date.trim()}T${sTime}`)
    if (!isNaN(sDate.getTime())) {
      startAt = sDate.toISOString()
    }
    if (endTime && endTime.trim()) {
      const eDate = new Date(`${date.trim()}T${endTime.trim()}`)
      if (!isNaN(eDate.getTime())) {
        endAt = eDate.toISOString()
      }
    }
  }

  return {
    ...row,
    startAt,
    endAt,
    recurrence: recurrenceText === 'None' || !recurrenceText ? null : { frequency: recurrenceText },
    reminderMinutes: reminderText && !isNaN(Number(reminderText)) ? Number(reminderText) : null,
  }
}

function scoreColor(score: number | string | null | undefined) {
  if (score == null) return 'bg-muted text-muted-foreground'
  const num = Number(score)
  if (isNaN(num)) return 'bg-muted text-muted-foreground'
  if (num >= 0.85) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (num >= 0.6) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  return 'bg-destructive/15 text-destructive'
}

function formatScore(score: number | string | null | undefined) {
  if (score == null) return '?'
  const num = Number(score)
  if (isNaN(num)) return '?'
  return `${Math.round(num * 100)}%`
}

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="size-4 text-primary" />
  return <FileText className="size-4 text-primary" />
}

const RECURRENCE_OPTIONS = ['None', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'] as const
const TYPE_OPTIONS = ['EVENT', 'TASK', 'REMINDER'] as const
const REMINDER_PRESETS = ['5', '10', '15', '30', '60']

const COMMAND_CHIPS = [
  'Add 15-min reminders to all',
  'Make all Fridays weekly',
  'Remove lunch breaks',
  'Set all to HIGH priority',
  'Change category to Study',
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function DraftStatusBadge({ status }: { status: DraftStatus }) {
  const config: Record<DraftStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    idle:       { label: 'Ready to import',   cls: 'bg-muted text-muted-foreground',                           icon: <Sparkles className="size-3" /> },
    uploading:  { label: 'Uploading…',        cls: 'bg-primary/10 text-primary',                               icon: <Loader2 className="size-3 animate-spin" /> },
    processing: { label: 'AI Processing…',    cls: 'bg-primary/10 text-primary',                               icon: <Loader2 className="size-3 animate-spin" /> },
    review:     { label: 'Review Ready',      cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: <Check className="size-3" /> },
    editing:    { label: 'Applying AI Edit…', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',       icon: <Loader2 className="size-3 animate-spin" /> },
    confirmed:  { label: 'Confirmed',         cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', icon: <Check className="size-3" /> },
    failed:     { label: 'Failed',            cls: 'bg-destructive/15 text-destructive',                       icon: <AlertCircle className="size-3" /> },
  }
  const { label, cls, icon } = config[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', cls)}>
      {icon}{label}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="lifeos-skeleton rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 size-4 rounded bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-3 w-14 rounded bg-muted" />
          </div>
        </div>
        <div className="h-5 w-12 rounded-full bg-muted" />
      </div>
    </div>
  )
}

function ProcessingState() {
  return (
    <div className="lifeos-enter space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="size-5 animate-pulse text-primary" />
        </div>
        <div>
          <p className="font-semibold text-primary">AI is extracting your schedule</p>
          <p className="text-xs text-muted-foreground">Reading content and identifying time-based items…</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {(['Upload', 'Extract', 'Review'] as const).map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-6 bg-border" />}
            <div className={cn('flex items-center gap-1 rounded-full px-2 py-0.5', i === 1 ? 'bg-primary text-primary-foreground' : i === 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
              {i === 0 ? <Check className="size-2.5" /> : i === 1 ? <Loader2 className="size-2.5 animate-spin" /> : <Clock className="size-2.5" />}
              {step}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 pt-1">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function DraftReviewCard({
  row,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  row: Row
  onUpdate: (patch: Partial<Row>) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const inputCls = 'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors'
  const selectCls = 'h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors cursor-pointer'
  const labelCls = 'mb-1 block text-[11px] font-medium text-muted-foreground uppercase tracking-wide'

  return (
    <div
      className={cn(
        'lifeos-enter group/card rounded-2xl border bg-card transition-all duration-200',
        row.selected
          ? 'border-primary/30 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_20%,transparent)]'
          : 'border-border/60 opacity-70',
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 p-4">
        {/* Checkbox */}
        <label className="relative flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            className="sr-only"
            checked={row.selected}
            onChange={e => onUpdate({ selected: e.target.checked })}
          />
          <div
            className={cn(
              'flex size-5 items-center justify-center rounded-md border-2 transition-all duration-150',
              row.selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:border-primary/50',
            )}
          >
            {row.selected && <Check className="size-3 stroke-[3]" />}
          </div>
        </label>

        {/* Title + summary */}
        <div className="min-w-0 flex-1">
          <input
            value={row.title}
            onChange={e => onUpdate({ title: e.target.value })}
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/50 focus:text-foreground"
            placeholder="Schedule item title"
          />
          {(row.date || row.startTime) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.date && <span>{row.date}</span>}
              {row.startTime && <span className="ml-1.5">{row.startTime}{row.endTime && ` – ${row.endTime}`}</span>}
              {row.category && <span className="ml-1.5 text-primary/70">· {row.category}</span>}
            </p>
          )}
        </div>

        {/* Badges + actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {row.edited && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Edited
            </span>
          )}
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums', scoreColor(row.confidenceScore))}>
            {formatScore(row.confidenceScore)}
          </span>

          <div className="ml-1 flex items-center opacity-0 transition-opacity group-hover/card:opacity-100">
            <Button size="icon-sm" variant="ghost" aria-label="Duplicate item" title="Duplicate" onClick={onDuplicate}>
              <Copy />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Delete item" title="Delete" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </div>

          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={row._expanded ? 'Collapse' : 'Expand to edit'}
            title={row._expanded ? 'Collapse' : 'Edit details'}
            onClick={() => onUpdate({ _expanded: !row._expanded })}
          >
            {row._expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>

      {/* Expanded editor */}
      {row._expanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={row.date} onChange={e => onUpdate({ date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Start time</label>
              <input type="time" value={row.startTime} onChange={e => onUpdate({ startTime: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End time</label>
              <input type="time" value={row.endTime} onChange={e => onUpdate({ endTime: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <input value={row.category ?? ''} onChange={e => onUpdate({ category: e.target.value })} className={inputCls} placeholder="e.g. Study, Work" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={row.type} onChange={e => onUpdate({ type: e.target.value as Row['type'] })} className={selectCls}>
                {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={row.priority} onChange={e => onUpdate({ priority: e.target.value as Row['priority'] })} className={selectCls}>
                {PRIORITY_OPTIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Recurrence</label>
              <select value={row.recurrenceText} onChange={e => onUpdate({ recurrenceText: e.target.value })} className={selectCls}>
                {RECURRENCE_OPTIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Reminder (min before)</label>
              <div className="flex gap-1">
                <input
                  value={row.reminderText}
                  onChange={e => onUpdate({ reminderText: e.target.value })}
                  className={cn(inputCls, 'w-16 shrink-0')}
                  placeholder="—"
                  type="number"
                  min="0"
                />
                <div className="flex gap-1 overflow-x-auto">
                  {REMINDER_PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onUpdate({ reminderText: p })}
                      className={cn(
                        'shrink-0 h-8 rounded-md border px-2 text-xs transition-colors',
                        row.reminderText === p
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background hover:bg-muted',
                      )}
                    >
                      {p}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={labelCls}>Notes</label>
              <textarea
                value={row.description ?? ''}
                onChange={e => onUpdate({ description: e.target.value })}
                className={cn(inputCls, 'h-16 resize-none py-2')}
                placeholder="Optional notes or description…"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AICommandBox({
  draftId,
  rows,
  onLoad,
  onStateChange,
}: {
  draftId: string
  rows: Row[]
  onLoad: (draft: ImportDraft) => void
  onStateChange: (s: DraftStatus, err?: string) => void
}) {
  const [command, setCommand] = useState('')
  const [busy, setBusy] = useState(false)

  const apply = useCallback(async (cmd: string) => {
    if (!cmd.trim() || !draftId) return
    setBusy(true)
    onStateChange('editing')
    try {
      await saveImportReview(draftId, rows.map(toItem))
      const refined = await refineImportDraft(draftId, cmd)
      onLoad(refined)
      setCommand('')
    } catch (e) {
      onStateChange('review', e instanceof Error ? e.message : 'The draft could not be updated.')
    } finally {
      setBusy(false)
    }
  }, [draftId, rows, onLoad, onStateChange])

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <WandSparkles className="size-4 text-primary" />
        Refine with AI
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Describe changes and the AI will update the draft. You'll review before anything saves.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {COMMAND_CHIPS.map(chip => (
          <button
            key={chip}
            type="button"
            onClick={() => void apply(chip)}
            disabled={busy}
            className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void apply(command)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          placeholder='e.g. "Move all Mondays to 10 AM" or "Add 15-min reminders"'
          disabled={busy}
        />
        <Button onClick={() => void apply(command)} disabled={busy || !command.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          Apply
        </Button>
      </div>
    </div>
  )
}

function ConfirmActionBar({
  selected,
  total,
  draftId,
  rows,
  onConfirmed,
  onRejected,
}: {
  selected: number
  total: number
  draftId: string
  rows: Row[]
  onConfirmed: (count: number) => void
  onRejected: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const validate = () => {
    if (!selected) return 'Select at least one item before confirming.'
    const invalid = rows.find(r => r.selected && (!r.title.trim() || !r.date || !r.startTime))
    if (invalid) return `"${invalid.title || 'An item'}" needs a title, date, and start time.`
    const conflict = rows.find(r => r.selected && r.endTime && r.endTime <= r.startTime)
    if (conflict) return `"${conflict.title}" end time must be after its start time.`
    return ''
  }

  const handleConfirm = async () => {
    const problem = validate()
    if (problem) return setError(problem)
    setBusy(true)
    setError('')
    try {
      await saveImportReview(draftId, rows.map(toItem))
      await confirmImportDraft(draftId)
      onConfirmed(selected)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the draft.')
      setBusy(false)
    }
  }

  const handleReject = async () => {
    setBusy(true)
    try {
      await rejectImportDraft(draftId)
      onRejected()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="sticky bottom-4 z-10 mt-4">
      <div className="rounded-2xl border border-border/80 bg-card/95 p-3 shadow-[0_8px_32px_-8px_color-mix(in_oklab,var(--foreground)_30%,transparent)] backdrop-blur-xl">
        {error && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selected}</span> of{' '}
            {total} item{total !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" disabled={busy} onClick={() => void handleReject()}>
              <X />
              Reject draft
            </Button>
            <Button size="sm" disabled={busy || !selected} onClick={() => void handleConfirm()}>
              {busy ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
              Confirm {selected} item{selected !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AIImportPage({ onNavigate }: { onNavigate?: (path: string) => void } = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [draftId, setDraftId] = useState('')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<DraftStatus>('idle')
  const [error, setError] = useState('')
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedCount = useMemo(() => rows.filter(r => r.selected).length, [rows])

  const update = (id: string, patch: Partial<Row>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch, edited: true } : r))

  const [history, setHistory] = useState<Array<ImportDraft & { createdAt?: string; _count?: { items: number } }>>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const list = await getAiImports()
      setHistory(list)
    } catch (err) {
      console.error('Failed to load AI import history', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const load = (draft: ImportDraft) => {
    setDraftId(draft.id)
    setRows(draft.items.map(toRow))
    setStatus('review')
    setError('')
  }

  const handleResumeDraft = async (id: string) => {
    try {
      const draft = await getImportDraft(id)
      load(draft)
    } catch {
      setError('Could not resume draft.')
    }
  }

  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm('Delete this import draft?')) return
    setHistory(prev => prev.filter(d => d.id !== id))
    try {
      await deleteAiImportDraft(id)
    } catch {
      loadHistory()
    }
  }

  const runImport = useCallback(async (fileParam?: File) => {
    const file = fileParam ?? selectedFile ?? undefined
    if (!file && !text.trim()) {
      setError('Paste schedule text or choose a file to continue.')
      return
    }

    if (file && file.size > 10 * 1024 * 1024) {
      setError('File is too large (maximum 10MB). Please choose a smaller file.')
      return
    }

    setError('')
    setStatus(file ? 'uploading' : 'processing')
    try {
      let base64: string | undefined
      let fileTextContent: string | undefined

      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (ext === 'txt' || ext === 'csv') {
          fileTextContent = await new Promise<string>((ok, fail) => {
            const r = new FileReader()
            r.onload = () => ok(String(r.result || ''))
            r.onerror = fail
            r.readAsText(file)
          })
        } else {
          base64 = await new Promise<string>((ok, fail) => {
            const r = new FileReader()
            r.onload = () => ok(String(r.result).split(',')[1] ?? '')
            r.onerror = fail
            r.readAsDataURL(file)
          })
        }
        setStatus('processing')
      }

      const mimeType = file ? inferMimeType(file) : undefined
      const sourceType = file
        ? mimeType?.includes('pdf')
          ? 'pdf'
          : mimeType?.startsWith('image/')
          ? 'image'
          : 'document'
        : 'text'

      const combinedText = [text.trim(), fileTextContent?.trim()].filter(Boolean).join('\n\n') || undefined
      const instruction = text.trim() && file
        ? text.trim()
        : 'Extract all schedule items with dates, times, and recurrence if present.'

      const draft = await createImportDraft({
        sourceType,
        text: combinedText,
        instruction,
        file: file && base64 ? { name: file.name, mimeType: mimeType || 'application/octet-stream', base64 } : undefined,
      })

      load(draft)
      loadHistory()
    } catch (e) {
      setStatus('failed')
      setError(
        e instanceof Error
          ? e.message
          : 'The schedule could not be extracted. Please check the content and try again.',
      )
    }
  }, [selectedFile, text, loadHistory])

  const handleFile = (file: File) => {
    setSelectedFile(file)
    void runImport(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const reset = () => {
    setRows([])
    setDraftId('')
    setText('')
    setStatus('idle')
    setError('')
    setSelectedFile(null)
    setConfirmedCount(0)
    if (fileRef.current) fileRef.current.value = ''
    loadHistory()
  }

  // ── Confirmed state ──────────────────────────────────────────────────────

  if (status === 'confirmed') {
    return (
      <div className="lifeos-enter flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="size-10 text-emerald-500" strokeWidth={2.5} />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">Schedule added to your calendar</h2>
        <p className="mt-2 text-muted-foreground">
          {confirmedCount} item{confirmedCount !== 1 ? 's were' : ' was'} confirmed and saved.
        </p>
        <div className="mt-8 flex gap-3">
          <Button variant="outline" onClick={reset}>
            <RefreshCw />
            Import another
          </Button>
          <Button onClick={() => { if (onNavigate) { onNavigate('/calendar') } else { window.location.href = '/calendar' } }}>
            <CalendarPlus />
            View Calendar
          </Button>
        </div>
      </div>
    )
  }

  // ── Main layout ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-primary font-bold">AI Import</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">AI Schedule Import</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Extract structured calendar items and tasks from documents, images, or raw text with human-in-the-loop review.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <DraftStatusBadge status={status} />
          {status !== 'idle' && status !== 'processing' && status !== 'uploading' && (
            <Button size="sm" variant="outline" onClick={reset} title="Start over" className="h-8 gap-1.5 text-xs font-medium">
              <RefreshCw className="size-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </header>

      {/* Safety notice */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.03] px-4 py-2.5 text-xs shadow-xs">
        <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Zap className="size-3.5" />
        </div>
        <p className="text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Safe AI Workflow:</span>{' '}
          Extracted items are staged in a draft. Nothing is committed to your calendar or task list until you review and confirm each entry.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div role="alert" className="lifeos-enter flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 shadow-xs">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Extraction Alert</p>
            <p className="mt-0.5 text-xs text-destructive/90">{error}</p>
          </div>
          <Button size="icon-sm" variant="ghost" className="text-destructive hover:bg-destructive/15" onClick={() => setError('')}>
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">

        {/* ── Left: Upload card ── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileUp className="size-4 text-primary" />
              <span>Document or Text Source</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Upload a file or paste raw schedule text below</p>

            {/* Drop zone */}
            <div
              className={cn(
                'mt-4 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200',
                dragOver
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-border/80 hover:border-primary/50 hover:bg-muted/30',
              )}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              aria-label="Upload a file"
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {fileIcon(selectedFile.type)}
                  </div>
                  <p className="max-w-[220px] truncate text-sm font-semibold text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                  <button
                    type="button"
                    className="mt-1 rounded-md px-2 py-0.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedFile(null)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                    <FileUp className="size-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-foreground">Drop your schedule or click to browse</p>
                  <p className="mt-1 text-xs text-muted-foreground">Supports syllabi, agendas, timetable images, and calendars</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {['PDF', 'PNG', 'JPG', 'DOCX', 'TXT'].map(ext => (
                      <span key={ext} className="rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {ext}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            {/* Divider */}
            <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />or paste text below<div className="h-px flex-1 bg-border" />
            </div>

            {/* Text input */}
            <div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                className="min-h-32 w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder={'Paste schedule text or instructions here…\n\ne.g. "Database class Mon/Wed 9–10:30 AM, Lab Thu 2–4 PM"'}
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{text.length}/100,000</p>
            </div>

            <Button
              className="mt-3 w-full"
              disabled={(!text.trim() && !selectedFile) || status === 'processing' || status === 'uploading' || status === 'editing'}
              onClick={() => void runImport()}
            >
              {(status === 'processing' || status === 'uploading') ? (
                <><Loader2 className="animate-spin" />Extracting…</>
              ) : (
                <><WandSparkles />Extract schedule</>
              )}
            </Button>
          </div>

          {/* Tips card */}
          {status === 'idle' && (
            <div className="lifeos-enter rounded-2xl border border-border/60 bg-card/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tips</p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary">·</span> Upload a class schedule PDF for best results</li>
                <li className="flex gap-2"><span className="text-primary">·</span> Paste copied text from emails or documents</li>
                <li className="flex gap-2"><span className="text-primary">·</span> Include the year if dates are missing context</li>
                <li className="flex gap-2"><span className="text-primary">·</span> Use AI refinement to batch-edit after extraction</li>
              </ul>
            </div>
          )}
        </div>

        {/* ── Right: Review section ── */}
        <div className="flex min-w-0 flex-col gap-4">

          {/* Processing skeleton */}
          {(status === 'uploading' || status === 'processing' || status === 'editing') && (
            <ProcessingState />
          )}

          {/* Idle / History State */}
          {status === 'idle' && (
            <div className="flex flex-col gap-4">
              {history.length > 0 ? (
                <div className="lifeos-enter rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="font-semibold text-sm">Import History</h3>
                      <p className="text-xs text-muted-foreground">Previous AI extraction drafts</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => loadHistory()} className="h-7 text-xs gap-1">
                      <RefreshCw className={cn('size-3', historyLoading && 'animate-spin')} />
                      Refresh
                    </Button>
                  </div>
                  <div className="mt-3 divide-y divide-border/60">
                    {history.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-3 text-xs">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            {item.originalFileName || 'Text Schedule Import'}
                          </p>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{item._count?.items ?? 0} items extracted</span>
                            <span>·</span>
                            <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                            item.status === 'CONFIRMED' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                            item.status === 'REVIEW' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                            item.status === 'PROCESSING' && 'bg-primary/10 text-primary',
                            item.status === 'FAILED' && 'bg-destructive/10 text-destructive'
                          )}>
                            {item.status}
                          </span>
                          {item.status === 'REVIEW' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResumeDraft(item.id)}
                              className="h-7 text-xs"
                            >
                              Resume
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDraft(item.id)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="lifeos-enter flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/60">
                    <Sparkles className="size-8 text-muted-foreground/40" />
                  </div>
                  <h3 className="mt-4 font-semibold text-muted-foreground">No draft yet</h3>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground/70">
                    Upload a file or paste schedule text on the left to get started.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Failed empty state */}
          {status === 'failed' && rows.length === 0 && (
            <div className="lifeos-enter flex flex-col items-center justify-center rounded-2xl border border-dashed border-destructive/30 py-16 text-center">
              <AlertCircle className="size-10 text-destructive/50" />
              <h3 className="mt-3 font-semibold">Extraction failed</h3>
              <p className="mt-1 text-sm text-muted-foreground">Try again with different content.</p>
              <Button className="mt-4" variant="outline" onClick={reset}>
                <RefreshCw />
                Try again
              </Button>
            </div>
          )}

          {/* Review state */}
          {(status === 'review' || status === 'editing' || (status === 'failed' && rows.length > 0)) && rows.length > 0 && (
            <>
              {/* Section header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Review extracted schedule</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedCount} of {rows.length} item{rows.length !== 1 ? 's' : ''} selected
                    {rows.some(r => r.edited) && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                        · {rows.filter(r => r.edited).length} edited
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: true })))}>
                    Select all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: false })))}>
                    Deselect all
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const todayStr = formatLocalDate(new Date())
                      setRows(prev => [
                        ...prev,
                        toRow({
                          id: crypto.randomUUID(),
                          title: 'New schedule item',
                          startAt: `${todayStr}T09:00:00.000Z`,
                          endAt: `${todayStr}T10:00:00.000Z`,
                          type: 'EVENT',
                          priority: 'MEDIUM',
                          selected: true,
                          edited: true,
                        }),
                      ])
                    }}
                  >
                    <Plus />
                    Add item
                  </Button>
                </div>
              </div>

              {/* Item cards */}
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div
                    key={row.id}
                    className={cn(
                      'lifeos-enter',
                      i === 0 && 'lifeos-enter-delay-1',
                      i === 1 && 'lifeos-enter-delay-2',
                      i === 2 && 'lifeos-enter-delay-3',
                    )}
                  >
                    <DraftReviewCard
                      row={row}
                      onUpdate={patch => update(row.id, patch)}
                      onDelete={() => setRows(prev => prev.filter(r => r.id !== row.id))}
                      onDuplicate={() =>
                        setRows(prev => {
                          const idx = prev.findIndex(r => r.id === row.id)
                          const copy: Row = { ...row, id: crypto.randomUUID(), title: `${row.title} (copy)`, edited: true }
                          return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              {/* AI command box */}
              {draftId && (
                <AICommandBox
                  draftId={draftId}
                  rows={rows}
                  onLoad={load}
                  onStateChange={(s, err) => {
                    setStatus(s)
                    if (err) setError(err)
                  }}
                />
              )}

              {/* Confirm / reject bar */}
              {draftId && (
                <ConfirmActionBar
                  selected={selectedCount}
                  total={rows.length}
                  draftId={draftId}
                  rows={rows}
                  onConfirmed={count => {
                    setConfirmedCount(count)
                    setStatus('confirmed')
                  }}
                  onRejected={reset}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
