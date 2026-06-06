import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../shared/auth.middleware.js'
import { subscriptionService } from './subscription.service.js'
import { NotFoundError } from '../../shared/errors.js'

const schemaUpgrade = z.object({
  plano: z.enum(['basico', 'profissional']),
  periodo: z.enum(['mensal', 'trimestral', 'anual']),
  payment_method: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']),
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
        periodo: body.periodo,
        payment_method: body.payment_method,
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
