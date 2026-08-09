"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const api_response_js_1 = require("../utils/api-response.js");
const modules = ['auth', 'users', 'calendar', 'tasks', 'notifications', 'ai'];
exports.apiRouter = (0, express_1.Router)();
for (const moduleName of modules) {
    exports.apiRouter.use(`/${moduleName}`, (0, express_1.Router)().get('/', (_req, res) => (0, api_response_js_1.sendData)(res, { module: moduleName, status: 'not_implemented' })));
}
