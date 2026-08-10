import { Router } from 'express'
import { login, logout, register } from '../controllers/auth.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { sendData } from '../utils/api-response.js'
import { me } from '../controllers/users.js'

export const authRouter = Router()
authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireAuth, me)
