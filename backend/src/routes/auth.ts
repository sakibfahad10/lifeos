import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rate-limit.js'
import { me } from '../controllers/users.js'
import { logout, refresh } from '../controllers/auth.js'

export const authRouter = Router()
authRouter.use(authLimiter)
authRouter.get('/me', requireAuth, me)
authRouter.post('/logout', logout)
authRouter.post('/refresh', requireAuth, refresh)

