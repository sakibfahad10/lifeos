"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const zod_1 = require("zod");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.requireAuth);
const itemSchema = zod_1.z.object({ title: zod_1.z.string().min(1), startAt: zod_1.z.string().datetime().optional(), endAt: zod_1.z.string().datetime().optional(), category: zod_1.z.string().optional(), priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'), selected: zod_1.z.boolean().default(true), confidenceScore: zod_1.z.number().min(0).max(1).optional() });
const userId = (req) => (req.header('x-user-id') || process.env.DEV_USER_ID || '').trim();
const fallbackItems = (text) => [{ title: text.trim().split('\n')[0]?.slice(0, 120) || 'Imported schedule item', startAt: new Date().toISOString(), category: 'Imported', priority: 'MEDIUM', selected: true, confidenceScore: 0.7 }];
router.post('/import', async (req, res, next) => {
    try {
        const id = userId(req);
        if (!id)
            return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
        const sourceText = typeof req.body?.text === 'string' ? req.body.text : '';
        const extracted = fallbackItems(sourceText);
        const draft = await prisma_js_1.prisma.aiImportDraft.create({ data: { userId: id, sourceType: req.body?.sourceType || 'text', originalFileName: req.body?.fileName, status: 'REVIEW', rawResponse: { sourceText, provider: process.env.AI_GATEWAY_API_KEY ? 'ai-gateway' : 'fallback' }, items: { create: extracted.map(item => ({ title: item.title, startAt: new Date(item.startAt), category: item.category, priority: item.priority, selected: true, confidenceScore: item.confidenceScore })) } }, include: { items: true } });
        return (0, api_response_js_1.sendData)(res, draft, 201);
    }
    catch (error) {
        next(error);
    }
});
router.patch('/import/:id/edit', async (req, res, next) => { try {
    const id = userId(req);
    const item = itemSchema.parse(req.body);
    const updated = await prisma_js_1.prisma.aiImportItem.updateMany({ where: { id: req.params.id, draft: { userId: id, status: 'REVIEW' } }, data: { title: item.title, startAt: item.startAt ? new Date(item.startAt) : null, endAt: item.endAt ? new Date(item.endAt) : null, category: item.category, priority: item.priority, selected: item.selected, edited: true, confidenceScore: item.confidenceScore } });
    if (!updated.count)
        return (0, api_response_js_1.sendError)(res, 'DRAFT_ITEM_NOT_FOUND', 'Draft item was not found', 404);
    return (0, api_response_js_1.sendData)(res, { updated: true });
}
catch (error) {
    next(error);
} });
router.post('/import/:id/review', async (req, res, next) => { try {
    const id = userId(req);
    const draft = await prisma_js_1.prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: id }, include: { items: true } });
    if (!draft)
        return (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_FOUND', 'Draft was not found', 404);
    return (0, api_response_js_1.sendData)(res, draft);
}
catch (error) {
    next(error);
} });
router.post('/import/:id/confirm', async (req, res, next) => { try {
    const id = userId(req);
    const draft = await prisma_js_1.prisma.aiImportDraft.findFirst({ where: { id: req.params.id, userId: id, status: 'REVIEW' }, include: { items: true } });
    if (!draft)
        return (0, api_response_js_1.sendError)(res, 'DRAFT_NOT_FOUND', 'Reviewable draft was not found', 404);
    const selected = draft.items.filter(item => item.selected && item.title.trim());
    if (!selected.length)
        return (0, api_response_js_1.sendError)(res, 'EMPTY_DRAFT', 'Select at least one valid draft item', 422);
    const result = await prisma_js_1.prisma.$transaction(async (tx) => { const created = await Promise.all(selected.map(item => tx.calendarItem.create({ data: { userId: id, title: item.title, description: item.description, type: item.type, priority: item.priority, category: item.category, startAt: item.startAt || new Date(), endAt: item.endAt } }))); await tx.aiImportDraft.update({ where: { id: draft.id }, data: { status: 'CONFIRMED' } }); return created; });
    return (0, api_response_js_1.sendData)(res, { draftId: draft.id, items: result });
}
catch (error) {
    next(error);
} });
router.post('/import/:id/reject', async (req, res, next) => { try {
    const id = userId(req);
    const draft = await prisma_js_1.prisma.aiImportDraft.updateMany({ where: { id: req.params.id, userId: id }, data: { status: 'REJECTED' } });
    return (0, api_response_js_1.sendData)(res, { rejected: Boolean(draft.count) });
}
catch (error) {
    next(error);
} });
exports.aiRouter = router;
