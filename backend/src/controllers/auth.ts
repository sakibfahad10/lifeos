import type { Request, Response } from 'express'
import { sendError } from '../utils/api-response.js'

const disabled = (_req: Request, res: Response) => sendError(res, 'AUTH_PROVIDER_SUPABASE', 'Use Supabase Auth for authentication', 410)
export const register = disabled
export const login = disabled
export const logout = disabled
