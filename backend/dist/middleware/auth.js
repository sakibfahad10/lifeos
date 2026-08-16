"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const api_response_js_1 = require("../utils/api-response.js");
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.lifeos_token;
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret)
        return (0, api_response_js_1.sendError)(res, 'AUTH_CONFIG_MISSING', 'Supabase authentication is not configured', 500);
    if (!token)
        return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret, { algorithms: ['HS256'] });
        if (!payload.sub || payload.role === 'anon')
            return (0, api_response_js_1.sendError)(res, 'AUTH_INVALID', 'Invalid authentication token', 401);
        req.userId = payload.sub;
        req.headers['x-user-id'] = payload.sub;
        if (payload.email)
            req.headers['x-user-email'] = payload.email;
        if (payload.user_metadata?.name)
            req.headers['x-user-name'] = payload.user_metadata.name;
        next();
    }
    catch {
        return (0, api_response_js_1.sendError)(res, 'AUTH_INVALID', 'Invalid or expired authentication token', 401);
    }
}
/** @deprecated Supabase Auth owns token issuance. */
function signToken(_userId) { throw new Error('Use Supabase Auth for token issuance'); }
