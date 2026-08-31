import type { Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { sendData, sendError } from '../utils/api-response.js'

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()).optional(),
}).refine(value => value.name !== undefined || value.email !== undefined, { message: 'At least one profile field is required' })

const settingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  weekStartsOn: z.enum(['sunday', 'monday']).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  notifications: z.object({ reminders: z.boolean().optional(), overdue: z.boolean().optional(), aiImports: z.boolean().optional() }).partial().optional(),
}).partial()

function userId(req: AuthenticatedRequest) { return req.userId ?? '' }

export async function me(req: AuthenticatedRequest, res: Response) {
  const id = userId(req)
  if (!id) return sendError(res, 'AUTH_REQUIRED', 'A signed-in user is required.', 401)
  const userEmail = String(req.userEmail || req.headers['x-user-email'] || '')
  const userName = String(req.userName || req.headers['x-user-name'] || (userEmail ? userEmail.split('@')[0] : 'LifeOS user'))
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, settings: true } })
  if (existing) {
    return sendData(res, existing)
  }
  const user = await prisma.user.create({ data: { id, email: userEmail || `${id}@lifeos.local`, name: userName }, select: { id: true, name: true, email: true, settings: true } })
  return sendData(res, user)
}

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid profile data', 422)
  try {
    const user = await prisma.user.update({ where: { id: userId(req) }, data: parsed.data, select: { id: true, name: true, email: true, settings: true } })
    return sendData(res, user)
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return sendError(res, 'EMAIL_TAKEN', 'An account already exists for this email', 409)
    throw error
  }
}

export async function getSettings(req: AuthenticatedRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: userId(req) }, select: { settings: true } })
  if (!user) return sendError(res, 'USER_NOT_FOUND', 'User was not found', 404)
  return sendData(res, user.settings)
}

export async function updateSettings(req: AuthenticatedRequest, res: Response) {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) return sendError(res, 'INVALID_INPUT', parsed.error.issues[0]?.message || 'Invalid settings data', 422)
  const current = await prisma.user.findUnique({ where: { id: userId(req) }, select: { settings: true } })
  if (!current) return sendError(res, 'USER_NOT_FOUND', 'User was not found', 404)
  const previous = typeof current.settings === 'object' && current.settings !== null ? current.settings as Record<string, unknown> : {}
  const next = { ...previous, ...parsed.data, notifications: { ...(typeof previous.notifications === 'object' && previous.notifications !== null ? previous.notifications : {}), ...(parsed.data.notifications ?? {}) } }
  const user = await prisma.user.update({ where: { id: userId(req) }, data: { settings: next }, select: { settings: true } })
  return sendData(res, user.settings)
}
