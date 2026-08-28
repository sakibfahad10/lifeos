import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { sendError } from '../utils/api-response.js'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // 1. Zod schema validation errors
  if (error instanceof ZodError) {
    const issues = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
    return sendError(res, 'VALIDATION_ERROR', issues || 'Validation failed', 400)
  }

  // 2. Prisma database errors
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as any).code)
    if (code === 'P2002') {
      return sendError(res, 'CONFLICT', 'A record with this unique value already exists.', 409)
    }
    if (code === 'P2025') {
      return sendError(res, 'NOT_FOUND', 'The requested record was not found.', 404)
    }
    if (code.startsWith('P')) {
      console.error('[lifeos-db-error]', error)
      return sendError(res, 'DATABASE_ERROR', 'A database operation could not be completed.', 500)
    }
  }

  // 3. Fallback unexpected internal errors (safe, non-leaking message)
  console.error('[lifeos-api-error]', error)
  const message = process.env.NODE_ENV === 'development' && error instanceof Error
    ? error.message
    : 'An unexpected server error occurred.'

  return sendError(res, 'INTERNAL_ERROR', message, 500)
}
