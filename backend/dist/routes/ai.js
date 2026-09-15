"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../config/prisma.js");
const schedule_import_js_1 = require("../integrations/gemini/schedule-import.js");
const auth_js_1 = require("../middleware/auth.js");
const rate_limit_js_1 = require("../middleware/rate-limit.js");
const api_response_js_1 = require("../utils/api-response.js");
exports.aiRouter = (0, express_1.Router)();
exports.aiRouter.use(auth_js_1.requireAuth);
// Large body parser only for the import route (base64 file uploads can be up to ~12 MB)
const largeBodyParser = express_2.default.json({ limit: '15mb' });
const userId = (req) => req.userId || '';
const include = { items: { orderBy: { id: 'asc' } } };
async function ensureUser(req) {
    const id = userId(req);
    if (!id)
        return '';
    const headerEmail = String(req.userEmail || req.headers['x-user-email'] || '');
    const headerName = String(req.userName || req.headers['x-user-name'] || (headerEmail ? headerEmail.split('@')[0] : 'LifeOS user'));
    await prisma_js_1.prisma.user.upsert({
        where: { id },
        update: {},
        create: {
            id,
            email: headerEmail || `${id}@lifeos.local`,
            name: headerName,
        },
    });
    return id;
}
const sourceSchema = zod_1.z.object({
    sourceType: zod_1.z.enum(['text', 'pdf', 'image', 'document']).default('text'),
    text: zod_1.z.string().max(100_000).optional(),
    instruction: zod_1.z.string().trim().max(2_000).optional(),
    file: zod_1.z.object({
        name: zod_1.z.string().max(255),
        mimeType: zod_1.z.string().max(100).default('application/octet-stream'),
        base64: zod_1.z.string().min(1).max(15_000_000)
    }).optional()
}).refine(x => x.text?.trim() || x.file, 'Paste schedule text or choose a file to continue.');
const itemSchema = schedule_import_js_1.extractedItemSchema.extend({
    selected: zod_1.z.preprocess(val => val !== false, zod_1.z.boolean()).default(true)
});
const reviewSchema = zod_1.z.object({ items: zod_1.z.array(itemSchema).min(1).max(100) });
const commandSchema = zod_1.z.object({ command: zod_1.z.string().trim().min(2).max(2_000) });
const toData = (item, edited = true) => ({
    title: item.title,
    description: item.description ?? null,
    startAt: item.startAt ? new Date(item.startAt) : null,
    endAt: item.endAt ? new Date(item.endAt) : null,
    type: item.type,
    category: item.category ?? null,
    priority: item.priority,
    recurrence: item.recurrence,
    reminderMinutes: item.reminderMinutes ?? null,
    confidenceScore: item.confidenceScore != null ? new client_1.Prisma.Decimal(item.confidenceScore) : null,
    selected: item.selected,
    edited
});
function invalid(items) {
    const selected = items.filter(x => x.selected);
    if (!selected.length)
        return 'Select at least one draft item before confirming.';
    const keys = new Set();
    for (const item of selected) {
        if (!item.title.trim() || !item.startAt)
            return 'Every selected item needs a title and start date/time.';
        if (item.endAt && item.endAt <= item.startAt)
            return 'An item’s end time must be after its start time.';
        const key = `${item.title.trim().toLowerCase()}|${item.startAt.toISOString()}`;
        if (keys.has(key))
            return 'Remove or change duplicate selected schedule items.';
        keys.add(key);
    }
}
exports.aiRouter.post('/import', rate_limit_js_1.aiImportLimiter, largeBodyParser, async (req, res, next) => {
    try {
        const uid = await ensureUser(req);
        if (!uid)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Authenticated user ID is missing.', 401);
        const input = sourceSchema.parse(req.body);
        const draft = await prisma_js_1.prisma.aiImportDraft.create({
            data: {
                userId: uid,
                sourceType: input.sourceType,
                originalFileName: input.file?.name,
                status: 'PROCESSING',
                rawResponse: { instruction: input.instruction || null }
            }
        });
        try {
            const result = await (0, schedule_import_js_1.extractSchedule)({
                text: input.text,
                instruction: input.instruction,
                file: input.file ? { mimeType: input.file.mimeType, base64: input.file.base64 } : undefined
            });
            const complete = await prisma_js_1.prisma.aiImportDraft.update({
                where: { id: draft.id },
                data: {
                    status: 'REVIEW',
                    rawResponse: result.raw,
                    items: { create: result.parsed.items.map(x => toData({ ...x, selected: true }, false)) }
                },
                include
            });
            return (0, api_response_js_1.sendData)(res, complete, 201);
        }
        catch (error) {
            await prisma_js_1.prisma.aiImportDraft.update({
                where: { id: draft.id },
                data: { status: 'FAILED', rawResponse: { error: error instanceof Error ? error.message : 'Extraction failed' } }
            }).catch(() => undefined);
            return (0, api_response_js_1.sendError)(res, 'AI_EXTRACTION_FAILED', error instanceof Error ? error.message : 'Failed to extract schedule data.', 422);
        }
    }
    catch (error) {
        next(error);
    }
});
exports.aiRouter.get('/import/:id', async (req, res, next) => {
    try {
        const draft = await prisma_js_1.prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: userId(req) }, include });
        return draft ? (0, api_response_js_1.sendData)(res, draft) : (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_FOUND', 'This import draft was not found.', 404);
    }
    catch (error) {
        next(error);
    }
});
exports.aiRouter.patch('/import/:id/review', async (req, res, next) => {
    try {
        const input = reviewSchema.parse(req.body);
        const draft = await prisma_js_1.prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: userId(req), status: 'REVIEW' } });
        if (!draft)
            return (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_EDITABLE', 'Only review-ready drafts can be edited.', 409);
        const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
            await tx.aiImportItem.deleteMany({ where: { draftId: draft.id } });
            return tx.aiImportDraft.update({
                where: { id: draft.id },
                data: { items: { create: input.items.map(item => toData(item)) } },
                include
            });
        });
        return (0, api_response_js_1.sendData)(res, updated);
    }
    catch (error) {
        next(error);
    }
});
exports.aiRouter.post('/import/:id/edit', rate_limit_js_1.aiImportLimiter, async (req, res, next) => {
    try {
        const { command } = commandSchema.parse(req.body);
        const draft = await prisma_js_1.prisma.aiImportDraft.findFirst({ where: { id: String(req.params.id), userId: userId(req), status: 'REVIEW' }, include });
        if (!draft)
            return (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_EDITABLE', 'Only review-ready drafts can be refined.', 409);
        const source = draft.items.map(x => ({
            title: x.title,
            description: x.description,
            startAt: x.startAt?.toISOString() ?? null,
            endAt: x.endAt?.toISOString() ?? null,
            type: x.type,
            category: x.category,
            priority: x.priority,
            recurrence: x.recurrence,
            reminderMinutes: x.reminderMinutes,
            confidenceScore: x.confidenceScore ? Number(x.confidenceScore) : null,
        }));
        try {
            const result = await (0, schedule_import_js_1.refineSchedule)(source, command);
            const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
                await tx.aiImportItem.deleteMany({ where: { draftId: draft.id } });
                return tx.aiImportDraft.update({
                    where: { id: draft.id },
                    data: {
                        rawResponse: result.raw,
                        items: { create: result.parsed.items.map(x => toData({ ...x, selected: true })) }
                    },
                    include
                });
            });
            return (0, api_response_js_1.sendData)(res, updated);
        }
        catch (err) {
            return (0, api_response_js_1.sendError)(res, 'AI_REFINEMENT_FAILED', err instanceof Error ? err.message : 'Could not refine schedule draft with AI.', 422);
        }
    }
    catch (error) {
        next(error);
    }
});
exports.aiRouter.post('/import/:id/confirm', async (req, res, next) => {
    try {
        const uid = await ensureUser(req);
        if (!uid)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'Authenticated user ID is missing.', 401);
        const draft = await prisma_js_1.prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: uid, status: 'REVIEW' }, include });
        if (!draft)
            return (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_EDITABLE', 'Only review-ready drafts can be confirmed.', 409);
        const problem = invalid(draft.items);
        if (problem)
            return (0, api_response_js_1.sendError)(res, 'INVALID_DRAFT', problem, 422);
        const items = await prisma_js_1.prisma.$transaction(async (tx) => {
            const created = await Promise.all(draft.items.filter(x => x.selected).map(async (x) => {
                const item = await tx.calendarItem.create({
                    data: {
                        userId: uid,
                        title: x.title,
                        description: x.description,
                        notes: x.description,
                        type: x.type,
                        priority: x.priority,
                        category: x.category,
                        startAt: x.startAt,
                        endAt: x.endAt,
                    }
                });
                if (x.reminderMinutes) {
                    await tx.reminder.create({
                        data: {
                            userId: uid,
                            calendarItemId: item.id,
                            offsetMinutes: x.reminderMinutes,
                        }
                    }).catch(() => undefined);
                }
                if (x.recurrence && typeof x.recurrence === 'object' && 'frequency' in x.recurrence) {
                    const freq = String(x.recurrence.frequency).toUpperCase();
                    const validFreqs = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'];
                    if (validFreqs.includes(freq)) {
                        await tx.recurrenceRule.create({
                            data: {
                                calendarItemId: item.id,
                                frequency: freq,
                                interval: typeof x.recurrence.interval === 'number' ? x.recurrence.interval : 1,
                                daysOfWeek: Array.isArray(x.recurrence.daysOfWeek)
                                    ? x.recurrence.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
                                    : [],
                                startDate: x.startAt,
                                timezone: 'UTC',
                            }
                        }).catch(() => undefined);
                    }
                }
                return item;
            }));
            await tx.aiImportDraft.update({
                where: { id: draft.id },
                data: { status: 'CONFIRMED' }
            });
            await tx.notification.create({
                data: {
                    userId: uid,
                    type: 'AI_IMPORT',
                    title: 'Schedule imported',
                    message: `Successfully imported ${created.length} event(s) and task(s) into your calendar.`,
                }
            }).catch(() => undefined);
            await tx.auditLog.create({
                data: {
                    userId: uid,
                    action: 'AI_IMPORT_CONFIRMED',
                    entityType: 'AiImportDraft',
                    entityId: draft.id,
                    metadata: { itemsCount: created.length },
                }
            }).catch(() => undefined);
            return created;
        });
        return (0, api_response_js_1.sendData)(res, { draftId: draft.id, items });
    }
    catch (error) {
        next(error);
    }
});
exports.aiRouter.post('/import/:id/reject', async (req, res, next) => {
    try {
        const result = await prisma_js_1.prisma.aiImportDraft.updateMany({
            where: { id: req.params.id, userId: userId(req), status: { in: ['PROCESSING', 'REVIEW', 'FAILED'] } },
            data: { status: 'REJECTED' }
        });
        return result.count ? (0, api_response_js_1.sendData)(res, { rejected: true }) : (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_FOUND', 'This import draft cannot be rejected.', 404);
    }
    catch (error) {
        next(error);
    }
});
// List AI import draft history
exports.aiRouter.get('/imports', async (req, res, next) => {
    try {
        const uid = userId(req);
        if (!uid)
            return (0, api_response_js_1.sendData)(res, []);
        const drafts = await prisma_js_1.prisma.aiImportDraft.findMany({
            where: { userId: uid },
            include: {
                _count: { select: { items: true } },
                items: { take: 5, select: { id: true, title: true, type: true, category: true, startAt: true, priority: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        return (0, api_response_js_1.sendData)(res, drafts);
    }
    catch (error) {
        next(error);
    }
});
// Delete AI import draft
exports.aiRouter.delete('/import/:id', async (req, res, next) => {
    try {
        const draft = await prisma_js_1.prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: userId(req) } });
        if (!draft)
            return (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_FOUND', 'Draft was not found.', 404);
        await prisma_js_1.prisma.$transaction([
            prisma_js_1.prisma.aiImportItem.deleteMany({ where: { draftId: draft.id } }),
            prisma_js_1.prisma.aiImportDraft.delete({ where: { id: draft.id } }),
        ]);
        return (0, api_response_js_1.sendData)(res, { deleted: true });
    }
    catch (error) {
        next(error);
    }
});
