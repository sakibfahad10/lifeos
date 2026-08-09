import type { Response } from 'express'

export function sendData<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data, error: null })
}

export function sendError(res: Response, code: string, message: string, status = 500) {
  return res.status(status).json({ data: null, error: { code, message } })
}
