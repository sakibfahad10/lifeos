import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '../utils/api-response.js'

export type AuthenticatedRequest = Request & { userId?: string }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.lifeos_token
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'development' && (req.headers['x-user-id'] || process.env.DEV_USER_ID)) {
      req.userId = (req.headers['x-user-id'] as string) || process.env.DEV_USER_ID
      req.headers['x-user-id'] = req.userId
      req.headers['x-user-email'] = (req.headers['x-user-email'] as string) || 'dev@lifeos.local'
      req.headers['x-user-name'] = (req.headers['x-user-name'] as string) || 'Dev User'
      return next()
    }
    return sendError(res, 'AUTH_CONFIG_MISSING', 'Supabase authentication is not configured. Please set SUPABASE_JWT_SECRET in your environment.', 500)
  }
  if (!token) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
  try {
    let payload: { sub?: string; role?: string; email?: string; user_metadata?: { name?: string }; exp?: number } | null = null

    const decoded = jwt.decode(token, { complete: true }) as { header?: { alg?: string }; payload?: any } | null
    const alg = decoded?.header?.alg

    if (alg && (alg === 'HS256' || alg === 'HS384' || alg === 'HS512')) {
      payload = jwt.verify(token, secret) as any
    } else if (decoded?.payload) {
      payload = decoded.payload
      if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return sendError(res, 'AUTH_INVALID', 'Authentication token has expired', 401)
      }
    }

    if (!payload || !payload.sub || payload.role === 'anon') {
      return sendError(res, 'AUTH_INVALID', 'Invalid authentication token', 401)
    }

    req.userId = payload.sub
    req.headers['x-user-id'] = payload.sub
    if (payload.email) req.headers['x-user-email'] = payload.email
    if (payload.user_metadata?.name) req.headers['x-user-name'] = payload.user_metadata.name
    next()
  } catch (err: any) {
    console.error('JWT verification failed:', err?.message || err)
    return sendError(res, 'AUTH_INVALID', 'Invalid or expired authentication token', 401)
  }
}

/** @deprecated Supabase Auth owns token issuance. */
export function signToken(_userId: string) { throw new Error('Use Supabase Auth for token issuance') }
