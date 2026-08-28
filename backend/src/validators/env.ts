import { z } from 'zod'

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
})
