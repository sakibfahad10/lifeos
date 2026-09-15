"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authLimiter = exports.aiImportLimiter = exports.generalLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
const api_response_js_1 = require("../utils/api-response.js");
/**
 * Lightweight, zero-dependency in-memory rate limiter with sliding window tracking.
 * Avoids external dependencies while preventing API abuse and cost spikes.
 */
function createRateLimiter(options) {
    const { windowMs, max, message = 'Too many requests. Please try again later.' } = options;
    const hits = new Map();
    // Cleanup expired entries periodically every 5 minutes
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of hits.entries()) {
            if (record.resetTime <= now) {
                hits.delete(key);
            }
        }
    }, 5 * 60 * 1000);
    if (cleanupInterval.unref) {
        cleanupInterval.unref();
    }
    return (req, res, next) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
        const now = Date.now();
        let record = hits.get(ip);
        if (!record || record.resetTime <= now) {
            record = { count: 1, resetTime: now + windowMs };
            hits.set(ip, record);
        }
        else {
            record.count += 1;
        }
        const remaining = Math.max(0, max - record.count);
        const resetSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
        res.setHeader('RateLimit-Limit', max);
        res.setHeader('RateLimit-Remaining', remaining);
        res.setHeader('RateLimit-Reset', resetSeconds);
        if (record.count > max) {
            res.setHeader('Retry-After', resetSeconds);
            return (0, api_response_js_1.sendError)(res, 'RATE_LIMITED', message, 429);
        }
        next();
    };
}
const isDev = process.env.NODE_ENV === 'development';
/** General API limiter: 300 req/min (1000 in dev) */
exports.generalLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: isDev ? 1000 : 300,
    message: 'Too many requests. Please slow down and try again.',
});
/** Strict AI import limiter to protect Gemini API quota and costs: 15 req/min (100 in dev) */
exports.aiImportLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: isDev ? 100 : 15,
    message: 'AI import rate limit reached. Please wait a moment before importing again.',
});
/** Auth limiter to prevent brute-force / credential stuffing: 30 req/min (200 in dev) */
exports.authLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: isDev ? 200 : 30,
    message: 'Too many authentication attempts. Please try again later.',
});
