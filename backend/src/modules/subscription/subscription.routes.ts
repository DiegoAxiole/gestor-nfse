import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../shared/auth.middleware.js'
import { subscriptionService } from './subscription.service.js'
import { NotFoundError } from '../../shared/errors.js'

const schemaUpgrade = z.object({
  plano: z.string().min(1),
  periodo_fim: z.string().refine(s => !isNaN(Date.parse(s)), { message: 'Data inválida' }),
})

export function criarRouterSubscription(): Router {
  const router = Router()
  router.use(authMiddleware)

  router.get('/', async (req: Request, res: Response) => {
    try {
      const sub = await subscriptionService.buscar(req.tenantId!)
      res.json({ data: sub })
    } catch (err) {
      if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return }
      res.status(500).json({ error: 'Erro interno' })
    }
  })

  router.post('/cancelar', async (req: Request, res: Response) => {
    try {
      const sub = await subscriptionService.cancelar(req.tenantId!)
      res.json({ data: sub })
    } catch (err) {
      if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return }
      res.status(500).json({ error: 'Erro interno' })
    }
  })

  router.post('/upgrade', async (req: Request, res: Response) => {
    try {
      const body = schemaUpgrade.parse(req.body)
      const sub = await subscriptionService.upgrade(req.tenantId!, {
        plano: body.plano,
        periodo_fim: new Date(body.periodo_fim),
      })
      res.json({ data: sub })
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Dados inválidos', details: err.issues }); return }
      if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return }
      res.status(500).json({ error: 'Erro interno' })
    }
  })

  return router
}
