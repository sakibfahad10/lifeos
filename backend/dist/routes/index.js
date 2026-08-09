"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const calendar_js_1 = require("./calendar.js");
const tasks_js_1 = require("./tasks.js");
const api_response_js_1 = require("../utils/api-response.js");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.use('/calendar', calendar_js_1.calendarRouter);
exports.apiRouter.use('/tasks', tasks_js_1.tasksRouter);
for (const moduleName of ['auth', 'users', 'notifications', 'ai']) {
    exports.apiRouter.use(`/${moduleName}`, (0, express_1.Router)().get('/', (_req, res) => (0, api_response_js_1.sendData)(res, { module: moduleName, status: 'not_implemented' })));
}
