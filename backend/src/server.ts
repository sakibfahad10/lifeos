import { app } from './app.js'
import { disconnectPrisma } from './config/prisma.js'
import { startAlertScheduler, stopAlertScheduler } from './services/alert-scheduler.js'

const port = Number(process.env.PORT ?? 4000)
const server = app.listen(port, () => {
  console.log(`LifeOS API listening on ${port}`)
  startAlertScheduler()
})

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down gracefully`)
  stopAlertScheduler()
  server.close(async () => {
    await disconnectPrisma()
    process.exit(0)
  })
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))

