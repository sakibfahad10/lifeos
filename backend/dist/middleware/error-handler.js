"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const zod_1 = require("zod");
const api_response_js_1 = require("../utils/api-response.js");
const errorHandler = (error, _req, res, _next) => {
    // 1. Zod schema validation errors
    if (error instanceof zod_1.ZodError) {
        const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return (0, api_response_js_1.sendError)(res, 'VALIDATION_ERROR', issues || 'Validation failed', 400);
    }
    // 2. Prisma database errors
    if (error && typeof error === 'object' && 'code' in error) {
        const code = String(error.code);
        if (code === 'P2002') {
            return (0, api_response_js_1.sendError)(res, 'CONFLICT', 'A record with this unique value already exists.', 409);
        }
        if (code === 'P2025') {
            return (0, api_response_js_1.sendError)(res, 'NOT_FOUND', 'The requested record was not found.', 404);
        }
        if (code.startsWith('P')) {
            console.error('[lifeos-db-error]', error);
            return (0, api_response_js_1.sendError)(res, 'DATABASE_ERROR', 'A database operation could not be completed.', 500);
        }
    }
    // 3. Fallback unexpected internal errors (safe, non-leaking message)
    console.error('[lifeos-api-error]', error);
    const message = process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'An unexpected server error occurred.';
    return (0, api_response_js_1.sendError)(res, 'INTERNAL_ERROR', message, 500);
};
exports.errorHandler = errorHandler;
