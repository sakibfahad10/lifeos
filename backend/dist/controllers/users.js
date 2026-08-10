"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = me;
exports.updateProfile = updateProfile;
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
const zod_1 = require("zod");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
const profileSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(80).optional(),
    email: zod_1.z.string().trim().email().max(254).transform(value => value.toLowerCase()).optional(),
}).refine(value => value.name !== undefined || value.email !== undefined, { message: 'At least one profile field is required' });
const settingsSchema = zod_1.z.object({
    theme: zod_1.z.enum(['light', 'dark', 'system']).optional(),
    weekStartsOn: zod_1.z.enum(['sunday', 'monday']).optional(),
    timezone: zod_1.z.string().trim().min(1).max(80).optional(),
    notifications: zod_1.z.object({ reminders: zod_1.z.boolean().optional(), overdue: zod_1.z.boolean().optional(), aiImports: zod_1.z.boolean().optional() }).partial().optional(),
}).partial();
function userId(req) { return req.userId ?? ''; }
async function me(req, res) {
    const user = await prisma_js_1.prisma.user.findUnique({ where: { id: userId(req) }, select: { id: true, name: true, email: true, settings: true } });
    if (!user)
        return (0, api_response_js_1.sendError)(res, 'USER_NOT_FOUND', 'User was not found', 404);
    return (0, api_response_js_1.sendData)(res, user);
}
async function updateProfile(req, res) {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, api_response_js_1.sendError)(res, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid profile data', 422);
    try {
        const user = await prisma_js_1.prisma.user.update({ where: { id: userId(req) }, data: parsed.data, select: { id: true, name: true, email: true, settings: true } });
        return (0, api_response_js_1.sendData)(res, user);
    }
    catch (error) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002')
            return (0, api_response_js_1.sendError)(res, 'EMAIL_TAKEN', 'An account already exists for this email', 409);
        throw error;
    }
}
async function getSettings(req, res) {
    const user = await prisma_js_1.prisma.user.findUnique({ where: { id: userId(req) }, select: { settings: true } });
    if (!user)
        return (0, api_response_js_1.sendError)(res, 'USER_NOT_FOUND', 'User was not found', 404);
    return (0, api_response_js_1.sendData)(res, user.settings);
}
async function updateSettings(req, res) {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success)
        return (0, api_response_js_1.sendError)(res, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid settings data', 422);
    const current = await prisma_js_1.prisma.user.findUnique({ where: { id: userId(req) }, select: { settings: true } });
    if (!current)
        return (0, api_response_js_1.sendError)(res, 'USER_NOT_FOUND', 'User was not found', 404);
    const previous = typeof current.settings === 'object' && current.settings !== null ? current.settings : {};
    const next = { ...previous, ...parsed.data, notifications: { ...(typeof previous.notifications === 'object' && previous.notifications !== null ? previous.notifications : {}), ...(parsed.data.notifications ?? {}) } };
    const user = await prisma_js_1.prisma.user.update({ where: { id: userId(req) }, data: { settings: next }, select: { settings: true } });
    return (0, api_response_js_1.sendData)(res, user.settings);
}
