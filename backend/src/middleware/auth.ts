import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '../utils/api-response.js'

export type AuthenticatedRequest = Request & { userId?: string }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.lifeos_token
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return sendError(res, 'AUTH_CONFIG_MISSING', 'Supabase authentication is not configured', 500)
  if (!token) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as { sub?: string; role?: string; email?: string; user_metadata?: { name?: string } }
    if (!payload.sub || payload.role === 'anon') return sendError(res, 'AUTH_INVALID', 'Invalid authentication token', 401)
    req.userId = payload.sub
    req.headers['x-user-id'] = payload.sub
    if (payload.email) req.headers['x-user-email'] = payload.email
    if (payload.user_metadata?.name) req.headers['x-user-name'] = payload.user_metadata.name
    next()
  } catch {
    return sendError(res, 'AUTH_INVALID', 'Invalid or expired authentication token', 401)
  }
}

/** @deprecated Supabase Auth owns token issuance. */
export function signToken(_userId: string) { throw new Error('Use Supabase Auth for token issuance') }
