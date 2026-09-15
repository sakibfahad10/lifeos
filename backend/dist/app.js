"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const health_js_1 = require("./controllers/health.js");
const error_handler_js_1 = require("./middleware/error-handler.js");
const rate_limit_js_1 = require("./middleware/rate-limit.js");
const security_js_1 = require("./middleware/security.js");
const index_js_1 = require("./routes/index.js");
const api_response_js_1 = require("./utils/api-response.js");
exports.app = (0, express_1.default)();
exports.app.disable('x-powered-by');
// Apply OWASP security headers
exports.app.use(security_js_1.securityHeaders);
// Safe CORS: never default to "allow all origins" — require an explicit env var.
// Falls back to localhost:3000 only (not true/wildcard).
const rawOrigins = process.env.CORS_ORIGIN || process.env.FRONTEND_URL;
const allowedOrigins = rawOrigins
    ? rawOrigins.split(',').map(v => v.trim()).filter(Boolean)
    : 'http://localhost:3000';
exports.app.use((0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
exports.app.use((0, cookie_parser_1.default)());
// General routes: 1 MB JSON limit. AI import uses up to 15 MB for file uploads (handled in its own route).
exports.app.use(express_1.default.json({ limit: '1mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
// Health check endpoint (exempt from rate limits)
exports.app.get('/api/v1/health', health_js_1.healthController);
// API routes with general rate limiter
exports.app.use('/api/v1', rate_limit_js_1.generalLimiter, index_js_1.apiRouter);
exports.app.use((_req, res) => (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'Route not found', 404));
exports.app.use(error_handler_js_1.errorHandler);
exports.default = exports.app;
