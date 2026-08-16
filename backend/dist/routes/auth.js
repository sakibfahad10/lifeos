"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../middleware/auth.js");
const users_js_1 = require("../controllers/users.js");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.get('/me', auth_js_1.requireAuth, users_js_1.me);
