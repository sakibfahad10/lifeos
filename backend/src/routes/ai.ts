import { Router } from 'express'
import express from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma.js'
import { extractSchedule, extractedItemSchema, refineSchedule } from '../integrations/gemini/schedule-import.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { aiImportLimiter } from '../middleware/rate-limit.js'
import { sendData, sendError } from '../utils/api-response.js'

export const aiRouter = Router()
aiRouter.use(requireAuth)

// Large body parser only for the import route (base64 file uploads can be up to ~12 MB)
const largeBodyParser = express.json({ limit: '15mb' })

const userId = (req: AuthenticatedRequest) => req.userId || ''
const include = { items: { orderBy: { id: 'asc' as const } } }

async function ensureUser(req: AuthenticatedRequest): Promise<string> {
  const id = userId(req)
  if (!id) return ''
  const headerEmail = String(req.userEmail || req.headers['x-user-email'] || '')
  const headerName = String(req.userName || req.headers['x-user-name'] || (headerEmail ? headerEmail.split('@')[0] : 'LifeOS user'))
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      email: headerEmail || `${id}@lifeos.local`,
      name: headerName,
    },
  })
  return id
}

const sourceSchema = z.object({
  sourceType: z.enum(['text', 'pdf', 'image', 'document']).default('text'),
  text: z.string().max(100_000).optional(),
  instruction: z.string().trim().max(2_000).optional(),
  file: z.object({
    name: z.string().max(255),
    mimeType: z.string().max(100).default('application/octet-stream'),
    base64: z.string().min(1).max(15_000_000)
  }).optional()
}).refine(x => x.text?.trim() || x.file, 'Paste schedule text or choose a file to continue.')

const itemSchema = extractedItemSchema.extend({
  selected: z.preprocess(val => val !== false, z.boolean()).default(true)
})
const reviewSchema = z.object({ items: z.array(itemSchema).min(1).max(100) })
const commandSchema = z.object({ command: z.string().trim().min(2).max(2_000) })

const toData = (item: z.infer<typeof itemSchema>, edited = true) => ({
  title: item.title,
  description: item.description ?? null,
  startAt: item.startAt ? new Date(item.startAt) : null,
  endAt: item.endAt ? new Date(item.endAt) : null,
  type: item.type,
  category: item.category ?? null,
  priority: item.priority,
  recurrence: item.recurrence as Prisma.InputJsonValue | undefined,
  reminderMinutes: item.reminderMinutes ?? null,
  confidenceScore: item.confidenceScore != null ? new Prisma.Decimal(item.confidenceScore) : null,
  selected: item.selected,
  edited
})

function invalid(items: Array<{ title: string; startAt: Date | null; endAt: Date | null; selected: boolean }>) {
  const selected = items.filter(x => x.selected)
  if (!selected.length) return 'Select at least one draft item before confirming.'
  const keys = new Set<string>()
  for (const item of selected) {
    if (!item.title.trim() || !item.startAt) return 'Every selected item needs a title and start date/time.'
    if (item.endAt && item.endAt <= item.startAt) return 'An item’s end time must be after its start time.'
    const key = `${item.title.trim().toLowerCase()}|${item.startAt.toISOString()}`
    if (keys.has(key)) return 'Remove or change duplicate selected schedule items.'
    keys.add(key)
  }
}

aiRouter.post('/import', aiImportLimiter, largeBodyParser, async (req, res, next) => {
  try {
    const uid = await ensureUser(req)
    if (!uid) return sendError(res, 'AUTH_REQUIRED', 'Authenticated user ID is missing.', 401)
    const input = sourceSchema.parse(req.body)
    const draft = await prisma.aiImportDraft.create({
      data: {
        userId: uid,
        sourceType: input.sourceType,
        originalFileName: input.file?.name,
        status: 'PROCESSING',
        rawResponse: { instruction: input.instruction || null }
      }
    })

    try {
      const result = await extractSchedule({
        text: input.text,
        instruction: input.instruction,
        file: input.file ? { mimeType: input.file.mimeType, base64: input.file.base64 } : undefined
      })
      const complete = await prisma.aiImportDraft.update({
        where: { id: draft.id },
        data: {
          status: 'REVIEW',
          rawResponse: result.raw,
          items: { create: result.parsed.items.map(x => toData({ ...x, selected: true }, false)) }
        },
        include
      })
      return sendData(res, complete, 201)
    } catch (error) {
      await prisma.aiImportDraft.update({
        where: { id: draft.id },
        data: { status: 'FAILED', rawResponse: { error: error instanceof Error ? error.message : 'Extraction failed' } }
      }).catch(() => undefined)
      return sendError(res, 'AI_EXTRACTION_FAILED', error instanceof Error ? error.message : 'Failed to extract schedule data.', 422)
    }
  } catch (error) { next(error) }
})

aiRouter.get('/import/:id', async (req, res, next) => {
  try {
    const draft = await prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: userId(req) }, include })
    return draft ? sendData(res, draft) : sendError(res, 'DRAFT_NOT_FOUND', 'This import draft was not found.', 404)
  } catch (error) { next(error) }
})

aiRouter.patch('/import/:id/review', async (req, res, next) => {
  try {
    const input = reviewSchema.parse(req.body)
    const draft = await prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: userId(req), status: 'REVIEW' } })
    if (!draft) return sendError(res, 'DRAFT_NOT_EDITABLE', 'Only review-ready drafts can be edited.', 409)
    const updated = await prisma.$transaction(async tx => {
      await tx.aiImportItem.deleteMany({ where: { draftId: draft.id } })
      return tx.aiImportDraft.update({
        where: { id: draft.id },
        data: { items: { create: input.items.map(item => toData(item)) } },
        include
      })
    })
    return sendData(res, updated)
  } catch (error) { next(error) }
})

aiRouter.post('/import/:id/edit', aiImportLimiter, async (req, res, next) => {
  try {
    const { command } = commandSchema.parse(req.body)
    const draft = await prisma.aiImportDraft.findFirst({ where: { id: String(req.params.id), userId: userId(req), status: 'REVIEW' }, include })
    if (!draft) return sendError(res, 'DRAFT_NOT_EDITABLE', 'Only review-ready drafts can be refined.', 409)

    const source = draft.items.map(x => ({
      title: x.title,
      description: x.description,
      startAt: x.startAt?.toISOString() ?? null,
      endAt: x.endAt?.toISOString() ?? null,
      type: x.type,
      category: x.category,
      priority: x.priority,
      recurrence: x.recurrence as Record<string, unknown> | null,
      reminderMinutes: x.reminderMinutes,
      confidenceScore: x.confidenceScore ? Number(x.confidenceScore) : null,
    }))

    try {
      const result = await refineSchedule(source, command)
      const updated = await prisma.$transaction(async tx => {
        await tx.aiImportItem.deleteMany({ where: { draftId: draft.id } })
        return tx.aiImportDraft.update({
          where: { id: draft.id },
          data: {
            rawResponse: result.raw,
            items: { create: result.parsed.items.map(x => toData({ ...x, selected: true })) }
          },
          include
        })
      })
      return sendData(res, updated)
    } catch (err) {
      return sendError(res, 'AI_REFINEMENT_FAILED', err instanceof Error ? err.message : 'Could not refine schedule draft with AI.', 422)
    }
  } catch (error) { next(error) }
})

aiRouter.post('/import/:id/confirm', async (req, res, next) => {
  try {
    const uid = await ensureUser(req)
    if (!uid) return sendError(res, 'AUTH_REQUIRED', 'Authenticated user ID is missing.', 401)
    const draft = await prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: uid, status: 'REVIEW' }, include })
    if (!draft) return sendError(res, 'DRAFT_NOT_EDITABLE', 'Only review-ready drafts can be confirmed.', 409)
    const problem = invalid(draft.items)
    if (problem) return sendError(res, 'INVALID_DRAFT', problem, 422)

    const items = await prisma.$transaction(async tx => {
      const created = await Promise.all(
        draft.items.filter(x => x.selected).map(async x => {
          const item = await tx.calendarItem.create({
            data: {
              userId: uid,
              title: x.title,
              description: x.description,
              notes: x.description,
              type: x.type,
              priority: x.priority,
              category: x.category,
              startAt: x.startAt!,
              endAt: x.endAt,
            }
          })

          if (x.reminderMinutes) {
            await tx.reminder.create({
              data: {
                userId: uid,
                calendarItemId: item.id,
                offsetMinutes: x.reminderMinutes,
              }
            }).catch(() => undefined)
          }

          if (x.recurrence && typeof x.recurrence === 'object' && 'frequency' in x.recurrence) {
            const freq = String((x.recurrence as any).frequency).toUpperCase()
            const validFreqs = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM']
            if (validFreqs.includes(freq)) {
              await tx.recurrenceRule.create({
                data: {
                  calendarItemId: item.id,
                  frequency: freq as any,
                  interval: typeof (x.recurrence as any).interval === 'number' ? (x.recurrence as any).interval : 1,
                  daysOfWeek: Array.isArray((x.recurrence as any).daysOfWeek)
                    ? (x.recurrence as any).daysOfWeek.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)
                    : [],
                  startDate: x.startAt!,
                  timezone: 'UTC',
                }
              }).catch(() => undefined)
            }
          }

          return item
        })
      )

      await tx.aiImportDraft.update({
        where: { id: draft.id },
        data: { status: 'CONFIRMED' }
      })

      await tx.notification.create({
        data: {
          userId: uid,
          type: 'AI_IMPORT',
          title: 'Schedule imported',
          message: `Successfully imported ${created.length} event(s) and task(s) into your calendar.`,
        }
      }).catch(() => undefined)

      await tx.auditLog.create({
        data: {
          userId: uid,
          action: 'AI_IMPORT_CONFIRMED',
          entityType: 'AiImportDraft',
          entityId: draft.id,
          metadata: { itemsCount: created.length },
        }
      }).catch(() => undefined)

      return created
    })

    return sendData(res, { draftId: draft.id, items })
  } catch (error) { next(error) }
})

aiRouter.post('/import/:id/reject', async (req, res, next) => {
  try {
    const result = await prisma.aiImportDraft.updateMany({
      where: { id: req.params.id, userId: userId(req), status: { in: ['PROCESSING', 'REVIEW', 'FAILED'] } },
      data: { status: 'REJECTED' }
    })
    return result.count ? sendData(res, { rejected: true }) : sendError(res, 'DRAFT_NOT_FOUND', 'This import draft cannot be rejected.', 404)
  } catch (error) { next(error) }
})

// List AI import draft history
aiRouter.get('/imports', async (req, res, next) => {
  try {
    const uid = userId(req)
    if (!uid) return sendData(res, [])
    const drafts = await prisma.aiImportDraft.findMany({
      where: { userId: uid },
      include: {
        _count: { select: { items: true } },
        items: { take: 5, select: { id: true, title: true, type: true, category: true, startAt: true, priority: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return sendData(res, drafts)
  } catch (error) { next(error) }
})

// Delete AI import draft
aiRouter.delete('/import/:id', async (req, res, next) => {
  try {
    const draft = await prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: userId(req) } })
    if (!draft) return sendError(res, 'DRAFT_NOT_FOUND', 'Draft was not found.', 404)
    await prisma.$transaction([
      prisma.aiImportItem.deleteMany({ where: { draftId: draft.id } }),
      prisma.aiImportDraft.delete({ where: { id: draft.id } }),
    ])
    return sendData(res, { deleted: true })
  } catch (error) { next(error) }
})

