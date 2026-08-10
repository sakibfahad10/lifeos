import { Router } from 'express'
import { login, logout, register } from '../controllers/auth.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../config/prisma.js'
import { sendData } from '../utils/api-response.js'

export const authRouter = Router()
authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, name: true, email: true } })
  return sendData(res, user)
})
