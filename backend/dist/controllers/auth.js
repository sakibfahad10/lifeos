"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.register = void 0;
const api_response_js_1 = require("../utils/api-response.js");
const disabled = (_req, res) => (0, api_response_js_1.sendError)(res, 'AUTH_PROVIDER_SUPABASE', 'Use Supabase Auth for authentication', 410);
exports.register = disabled;
exports.login = disabled;
exports.logout = disabled;
