"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const prisma_js_1 = require("./config/prisma.js");
const port = Number(process.env.PORT ?? 4000);
const server = app_js_1.app.listen(port, () => console.log(`LifeOS API listening on ${port}`));
async function shutdown(signal) {
    console.log(`Received ${signal}; shutting down gracefully`);
    server.close(async () => {
        await (0, prisma_js_1.disconnectPrisma)();
        process.exit(0);
    });
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
