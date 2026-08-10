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
    const token = req.cookies?.lifeos_token;
    const secret = process.env.JWT_SECRET;
    if (!secret)
        return (0, api_response_js_1.sendError)(res, 'AUTH_CONFIG_MISSING', 'Authentication is not configured', 500);
    if (!token)
        return (0, api_response_js_1.sendError)(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401);
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret);
        if (!payload.sub)
            return (0, api_response_js_1.sendError)(res, 'AUTH_INVALID', 'Invalid authentication token', 401);
        req.userId = payload.sub;
        req.headers['x-user-id'] = payload.sub;
        next();
    }
    catch {
        return (0, api_response_js_1.sendError)(res, 'AUTH_INVALID', 'Invalid or expired authentication token', 401);
    }
}
function signToken(userId) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET is not configured');
    return jsonwebtoken_1.default.sign({}, secret, { subject: userId, expiresIn: '7d' });
}
