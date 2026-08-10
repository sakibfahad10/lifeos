"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.logout = logout;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_js_1 = require("../config/prisma.js");
const auth_js_1 = require("../middleware/auth.js");
const api_response_js_1 = require("../utils/api-response.js");
function validEmail(value) { return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function setCookie(res, token) { res.cookie('lifeos_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' }); }
async function register(req, res) {
    const { name, email, password } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2 || !validEmail(email) || typeof password !== 'string' || password.length < 8)
        return (0, api_response_js_1.sendError)(res, 'INVALID_INPUT', 'Name, valid email, and an 8-character password are required', 422);
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await prisma_js_1.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists)
        return (0, api_response_js_1.sendError)(res, 'EMAIL_TAKEN', 'An account already exists for this email', 409);
    const user = await prisma_js_1.prisma.user.create({ data: { name: name.trim(), email: normalizedEmail, passwordHash: await bcryptjs_1.default.hash(password, 12) }, select: { id: true, name: true, email: true } });
    setCookie(res, (0, auth_js_1.signToken)(user.id));
    return (0, api_response_js_1.sendData)(res, user, 201);
}
async function login(req, res) {
    const { email, password } = req.body ?? {};
    if (!validEmail(email) || typeof password !== 'string')
        return (0, api_response_js_1.sendError)(res, 'INVALID_INPUT', 'Valid email and password are required', 422);
    const user = await prisma_js_1.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash)))
        return (0, api_response_js_1.sendError)(res, 'INVALID_CREDENTIALS', 'Email or password is incorrect', 401);
    setCookie(res, (0, auth_js_1.signToken)(user.id));
    return (0, api_response_js_1.sendData)(res, { id: user.id, name: user.name, email: user.email });
}
function logout(_req, res) { res.clearCookie('lifeos_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); return (0, api_response_js_1.sendData)(res, { loggedOut: true }); }
