"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendData = sendData;
exports.sendError = sendError;
function sendData(res, data, status = 200) {
    return res.status(status).json({ data, error: null });
}
function sendError(res, code, message, status = 500) {
    return res.status(status).json({ data: null, error: { code, message } });
}
