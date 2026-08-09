"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthController = healthController;
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
async function healthController(_req, res) {
    try {
        await prisma_js_1.prisma.$queryRaw `SELECT 1`;
        return (0, api_response_js_1.sendData)(res, { status: 'ok', service: 'lifeos-api', database: 'ok' });
    }
    catch {
        return (0, api_response_js_1.sendError)(res, 'DATABASE_UNAVAILABLE', 'Database connectivity check failed', 503);
    }
}
