"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
const zod_1 = require("zod");
exports.envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().min(1),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    JWT_SECRET: zod_1.z.string().optional(),
    GEMINI_API_KEY: zod_1.z.string().optional(),
});
