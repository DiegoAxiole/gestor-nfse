import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { db } from '../../db/db.js'
import { tenantOverrides } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { adminMiddleware } from '../../shared/auth.middleware.js'

const ALLOWED_OVERRIDES = ['prestadores_max', 'documentos_mes_max', 'usuarios_max', 'danfse', 'lote_zip']

export function criarRouterPlanLimits(): Router {
  const router = Router()
  router.use(adminMiddleware)

  router.patch('/tenants/:id/limits', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = Number(req.params.id)
      const dados: Record<string, any> = {}
      for (const key of ALLOWED_OVERRIDES) {
        if (req.body[key] !== undefined) dados[key] = req.body[key]
      }
      if (Object.keys(dados).length === 0) {
        res.status(422).json({ detail: 'Nenhum campo válido para atualizar' })
        return
      }
      dados.updated_by = req.usuarioId
      dados.updated_at = new Date()

      await db.insert(tenantOverrides).values({ tenant_id: tenantId, ...dados })
        .onConflictDoUpdate({ target: tenantOverrides.tenant_id, set: dados })

      res.json({ data: { tenant_id: tenantId, ...dados }, ok: true })
    } catch (err) { next(err) }
  })

  return router
}
