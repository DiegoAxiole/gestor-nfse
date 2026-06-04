import express from 'express'
import cors from 'cors'
import { existsSync, appendFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { carregarConfig } from './config.js'
import { db } from './db/db.js'
import { configuracoes, backgroundTasks } from './db/schema.js'
import { eq, sql, and } from 'drizzle-orm'
import { criarRouterPrestadores } from './modules/prestadores/prestadores.routes.js'
import { criarRouterConfig } from './modules/config/config.routes.js'
import { criarRouterDistribuicao } from './modules/distribuicao/distribuicao.routes.js'
import { criarRouterDocumentos } from './modules/documentos/documentos.routes.js'
import { criarRouterOperacoes } from './modules/operacoes/operacoes.routes.js'
import { criarRouterTasks } from './modules/tasks/tasks.routes.js'
import { errorHandler } from './shared/error-handler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function createApp() {
  const config = carregarConfig()

  const existingConfig = db.select().from(configuracoes).where(eq(configuracoes.id, 1)).get()
  if (!existingConfig) {
    db.insert(configuracoes).values({
      id: 1,
      ambiente: config.ambiente,
      codigo_municipio: config.codigo_municipio,
    }).run()
  }

  db.update(backgroundTasks).set({
    status: 'error',
    erro_texto: 'Servidor reiniciado enquanto a task estava em execução',
    atualizado_em: new Date().toISOString(),
  }).where(sql`status IN ('processing', 'pending')`).run()

  db.delete(backgroundTasks).where(and(
    sql`status IN ('completed', 'error')`,
    sql`atualizado_em < datetime('now', '-24 hours')`
  )).run()

  const app = express()

  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '10mb' }))

  function redactSensitive(value: unknown): unknown {
    if (typeof value === 'string') {
      const sensitiveKeys = ['senha', 'password', 'certificado_senha', 'token', 'cookie', 'authorization']
      return value
    }
    if (value && typeof value === 'object') {
      const obj = Array.isArray(value) ? [...value] : { ...value }
      const sensitiveKeys = ['senha', 'password', 'certificado_senha', 'token', 'cookie', 'authorization']
      for (const key of Object.keys(obj as object)) {
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          ;(obj as any)[key] = '***REDACTED***'
        }
      }
      return obj
    }
    return value
  }

  const httpLogPath = join(__dirname, '..', 'data', 'http.log')
  app.use((req, res, next) => {
    const start = Date.now()
    const chunks: Buffer[] = []
    const origWrite = res.write.bind(res)
    const origEnd = res.end.bind(res) as (...args: any[]) => any
    res.write = (chunk: any, ...args: any[]) => { chunks.push(Buffer.from(chunk)); return origWrite(chunk, ...args) }
    res.end = (chunk?: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.from(chunk))
      const duration = Date.now() - start
      const body = Buffer.concat(chunks).toString('utf-8').slice(0, 500)
      const safeHeaders = redactSensitive(req.headers) as Record<string, unknown>
      const safeBody = redactSensitive(req.body ?? '')
      const entry = [
        `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`,
        `> Headers: ${JSON.stringify(safeHeaders)}`,
        `> Body: ${JSON.stringify(safeBody).slice(0, 500)}`,
        `< Status: ${res.statusCode}`,
        `< Body: ${body}`,
        `< Duration: ${duration}ms`,
        '---',
      ].join('\n') + '\n'
      try { appendFileSync(httpLogPath, entry) } catch { }
      return origEnd(chunk, ...args)
    }
    next()
  })

  const router = express.Router()

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.5.0' })
  })

  router.use('/api/v1/prestadores', criarRouterPrestadores(config.codigo_municipio))
  router.use('/api/v1/config', criarRouterConfig())
  router.use('/api/v1/distribuicao', criarRouterDistribuicao(config.codigo_municipio))
  router.use('/api/v1/documentos', criarRouterDocumentos())
  router.use('/api/v1/operacoes', criarRouterOperacoes())
  router.use('/api/v1/tasks', criarRouterTasks())

  app.use(router)

  app.use(errorHandler)

  const publicPath = join(__dirname, '..', 'public')
  const distPath = join(__dirname, '..', 'dist')
  if (existsSync(publicPath)) {
    app.use(express.static(publicPath))
    app.get('*', (_req, res) => {
      res.sendFile(join(publicPath, 'index.html'))
    })
  } else if (existsSync(distPath)) {
    app.use(express.static(distPath))
    app.get('*', (_req, res) => {
      res.sendFile(join(distPath, 'index.html'))
    })
  }

  return { app }
}
