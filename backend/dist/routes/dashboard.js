"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const dashboard_js_1 = require("../controllers/dashboard.js");
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.use(auth_js_1.requireAuth);
exports.dashboardRouter.get('/summary', dashboard_js_1.getDashboardSummary);
