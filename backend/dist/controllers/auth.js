"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = logout;
exports.refresh = refresh;
const api_response_js_1 = require("../utils/api-response.js");
async function logout(_req, res) {
    res.clearCookie('lifeos_token');
    res.clearCookie('sb-access-token');
    return (0, api_response_js_1.sendData)(res, { loggedOut: true });
}
async function refresh(_req, res) {
    return (0, api_response_js_1.sendData)(res, { refreshed: true });
}
