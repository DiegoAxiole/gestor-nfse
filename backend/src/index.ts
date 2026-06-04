import { createApp } from './app.js'
import { closeDb } from './db/db.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 8001

const { app } = await createApp()
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Gestor NFSe rodando em http://127.0.0.1:${PORT}`)
})

async function shutdown() {
  closeDb()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
