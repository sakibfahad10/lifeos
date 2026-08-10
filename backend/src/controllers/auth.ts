import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../config/prisma.js'
import { signToken } from '../middleware/auth.js'
import { sendData, sendError } from '../utils/api-response.js'

function validEmail(value: unknown): value is string { return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) }
function setCookie(res: Response, token: string) { res.cookie('lifeos_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' }) }

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 2 || !validEmail(email) || typeof password !== 'string' || password.length < 8) return sendError(res, 'INVALID_INPUT', 'Name, valid email, and an 8-character password are required', 422)
  const normalizedEmail = email.trim().toLowerCase()
  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (exists) return sendError(res, 'EMAIL_TAKEN', 'An account already exists for this email', 409)
  const user = await prisma.user.create({ data: { name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12) }, select: { id: true, name: true, email: true } })
  setCookie(res, signToken(user.id))
  return sendData(res, user, 201)
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {}
  if (!validEmail(email) || typeof password !== 'string') return sendError(res, 'INVALID_INPUT', 'Valid email and password are required', 422)
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return sendError(res, 'INVALID_CREDENTIALS', 'Email or password is incorrect', 401)
  setCookie(res, signToken(user.id))
  return sendData(res, { id: user.id, name: user.name, email: user.email })
}

export function logout(_req: Request, res: Response) { res.clearCookie('lifeos_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' }); return sendData(res, { loggedOut: true }) }
