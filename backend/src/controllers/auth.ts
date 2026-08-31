import type { Request, Response } from 'express'
import { sendData } from '../utils/api-response.js'

export async function logout(_req: Request, res: Response) {
  res.clearCookie('lifeos_token')
  res.clearCookie('sb-access-token')
  return sendData(res, { loggedOut: true })
}

export async function refresh(_req: Request, res: Response) {
  return sendData(res, { refreshed: true })
}
