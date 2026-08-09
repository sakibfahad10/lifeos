"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksRouter = void 0;
const express_1 = require("express");
const tasks_js_1 = require("../controllers/tasks.js");
exports.tasksRouter = (0, express_1.Router)();
exports.tasksRouter.get('/', tasks_js_1.listTasks);
exports.tasksRouter.post('/', tasks_js_1.createTask);
exports.tasksRouter.patch('/:id/status', tasks_js_1.updateTaskStatus);
