import type { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { sendData, sendError } from '../utils/api-response.js'

export async function healthController(_req: Request, res: Response) {
  try {
    await prisma.$queryRaw`SELECT 1`
    return sendData(res, { status: 'ok', service: 'lifeos-api', database: 'ok' })
  } catch {
    return sendError(res, 'DATABASE_UNAVAILABLE', 'Database connectivity check failed', 503)
  }
}
