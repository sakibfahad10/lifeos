import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '../utils/api-response.js'

export type AuthenticatedRequest = Request & { userId?: string }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.lifeos_token
  const secret = process.env.JWT_SECRET
  if (!secret) return sendError(res, 'AUTH_CONFIG_MISSING', 'Authentication is not configured', 500)
  if (!token) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required', 401)
  try {
    const payload = jwt.verify(token, secret) as { sub?: string }
    if (!payload.sub) return sendError(res, 'AUTH_INVALID', 'Invalid authentication token', 401)
    req.userId = payload.sub
    req.headers['x-user-id'] = payload.sub
    next()
  } catch {
    return sendError(res, 'AUTH_INVALID', 'Invalid or expired authentication token', 401)
  }
}

export function signToken(userId: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return jwt.sign({}, secret, { subject: userId, expiresIn: '7d' })
}
