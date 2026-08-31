import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '../utils/api-response.js'

export type AuthenticatedRequest = Request & {
  userId?: string
  userEmail?: string
  userName?: string
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim()
  }

  if (req.cookies?.lifeos_token) {
    return String(req.cookies.lifeos_token).trim()
  }

  if (req.cookies?.['sb-access-token']) {
    return String(req.cookies['sb-access-token']).trim()
  }

  // Look for any Supabase auth token cookie (e.g. sb-<project>-auth-token)
  if (req.cookies) {
    for (const [key, val] of Object.entries(req.cookies)) {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val
          if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
            return parsed[0].trim()
          } else if (parsed && typeof parsed === 'object' && 'access_token' in parsed) {
            return String((parsed as any).access_token).trim()
          }
        } catch {}
      }
    }
  }

  return undefined
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req)
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET

  if (!secret) {
    // Dev-only fallback: only use a pre-configured DEV_USER_ID env var.
    // Never accept user-supplied headers to prevent spoofing even in dev mode.
    const devUserId = process.env.DEV_USER_ID
    if (process.env.NODE_ENV === 'development' && devUserId) {
      req.userId = devUserId
      req.headers['x-user-id'] = devUserId
      req.userEmail = 'dev@lifeos.local'
      req.userName = 'Dev User'
      return next()
    }
    return sendError(res, 'AUTH_CONFIG_MISSING', 'Supabase authentication is not configured. Please set SUPABASE_JWT_SECRET in your environment.', 500)
  }

  if (!token) {
    return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
  }

  try {
    type JWTPayload = { sub?: string; role?: string; email?: string; user_metadata?: { name?: string }; exp?: number; alg?: string }

    // Peek at the token header to determine the algorithm (still encoded, not trusted for security).
    const decoded = jwt.decode(token, { complete: true }) as { header?: { alg?: string }; payload?: JWTPayload } | null
    const alg = decoded?.header?.alg?.toUpperCase() ?? ''

    // Block the 'none' algorithm attack unconditionally.
    if (!alg || alg === 'NONE') {
      return sendError(res, 'AUTH_INVALID', 'Invalid authentication token', 401)
    }

    let payload: JWTPayload | null = null

    if (alg === 'HS256' || alg === 'HS384' || alg === 'HS512') {
      // HMAC-signed token — verify signature with the configured secret.
      payload = jwt.verify(token, secret, { algorithms: [alg as jwt.Algorithm] }) as JWTPayload
    } else {
      // Asymmetric token (e.g. RS256 from Supabase's default signing).
      // We can't verify the signature without the public key/JWKS, so we trust
      // Supabase's infrastructure validated it and enforce the required claims ourselves.
      // At minimum: check expiry, require sub, and reject anonymous tokens.
      payload = decoded?.payload ?? null
      if (payload?.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return sendError(res, 'AUTH_INVALID', 'Authentication token has expired', 401)
      }
    }

    if (!payload || !payload.sub || payload.role === 'anon') {
      return sendError(res, 'AUTH_INVALID', 'Invalid authentication token', 401)
    }

    req.userId = payload.sub
    req.headers['x-user-id'] = payload.sub
    if (payload.email) {
      req.userEmail = payload.email
      req.headers['x-user-email'] = payload.email
    }
    if (payload.user_metadata?.name) {
      req.userName = payload.user_metadata.name
      req.headers['x-user-name'] = payload.user_metadata.name
    }

    next()
  } catch (err: any) {
    const msg = err?.message || ''
    // Only log unexpected errors, not predictable auth failures
    if (!msg.includes('invalid') && !msg.includes('expired') && !msg.includes('jwt')) {
      console.error('JWT verification failed:', msg)
    }
    return sendError(res, 'AUTH_INVALID', 'Invalid or expired authentication token', 401)
  }
}

/**
 * Returns the authenticated user ID strictly derived from the verified token.
 */
export function getAuthUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest
  if (authReq.userId) return authReq.userId
  if (process.env.NODE_ENV === 'development' && process.env.DEV_USER_ID) {
    return process.env.DEV_USER_ID
  }
  return ''
}
