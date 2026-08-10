"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_js_1 = require("../controllers/auth.js");
const auth_js_2 = require("../middleware/auth.js");
const prisma_js_1 = require("../config/prisma.js");
const api_response_js_1 = require("../utils/api-response.js");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/register', auth_js_1.register);
exports.authRouter.post('/login', auth_js_1.login);
exports.authRouter.post('/logout', auth_js_1.logout);
exports.authRouter.get('/me', auth_js_2.requireAuth, async (req, res) => {
    const user = await prisma_js_1.prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, email: true } });
    return (0, api_response_js_1.sendData)(res, user);
});
