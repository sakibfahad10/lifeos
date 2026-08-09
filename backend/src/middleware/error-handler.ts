import type { ErrorRequestHandler } from 'express'
import { sendError } from '../utils/api-response.js'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('[lifeos-api]', error)
  return sendError(res, 'INTERNAL_ERROR', 'An unexpected error occurred')
}
