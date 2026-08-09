"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const api_response_js_1 = require("../utils/api-response.js");
const errorHandler = (error, _req, res, _next) => {
    console.error('[lifeos-api]', error);
    return (0, api_response_js_1.sendError)(res, 'INTERNAL_ERROR', 'An unexpected error occurred');
};
exports.errorHandler = errorHandler;
