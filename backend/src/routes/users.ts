import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getSettings, me, updateProfile, updateSettings } from '../controllers/users.js'

export const usersRouter = Router()
usersRouter.use(requireAuth)
usersRouter.get('/me', me)
usersRouter.patch('/profile', updateProfile)
usersRouter.get('/settings', getSettings)
usersRouter.patch('/settings', updateSettings)
