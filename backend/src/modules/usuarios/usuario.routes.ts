import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware, adminMiddleware } from '../../shared/auth.middleware.js'
import { usuarioService } from './usuario.service.js'
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors.js'
import { planLimitsService } from '../plan-limits/plan-limits.service.js'

const schemaCriar = z.object({
  email: z.string().email(),
  nome: z.string().max(255).optional(),
  papel: z.enum(['admin', 'operador']),
  senha: z.string().min(6),
})

const schemaAlterarPapel = z.object({
  papel: z.enum(['admin', 'operador']),
})

export function criarRouterUsuarios(): Router {
  const router = Router()
  router.use(authMiddleware)
  router.use(adminMiddleware)

  router.get('/', async (req: Request, res: Response) => {
    try {
      const usuarios = await usuarioService.listar(req.tenantId!)
      res.json({ data: usuarios })
    } catch {
      res.status(500).json({ error: 'Erro interno' })
    }
  })

  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = schemaCriar.parse(req.body)
      const limits = await planLimitsService.resolveLimits(req.tenantId!)
      const current = await planLimitsService.countUsuarios(req.tenantId!)
      if (current >= limits.usuarios_max) {
        res.status(403).json({
          detail: `Limite do plano excedido (${current}/${limits.usuarios_max}). Faça upgrade para aumentar.`,
          code: 'PLAN_LIMIT_REACHED',
          current,
          max: limits.usuarios_max,
        })
        return
      }
      const usuario = await usuarioService.criar(req.tenantId!, body)
      res.status(201).json({ data: usuario })
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Dados inválidos', details: err.issues }); return }
      if (err instanceof ConflictError) { res.status(409).json({ error: err.message }); return }
      res.status(500).json({ error: 'Erro interno' })
    }
  })

  router.patch('/:id/papel', async (req: Request, res: Response) => {
    try {
      const body = schemaAlterarPapel.parse(req.body)
      const usuario = await usuarioService.alterarPapel(req.tenantId!, Number(req.params.id), body.papel)
      res.json({ data: usuario })
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(400).json({ error: 'Dados inválidos', details: err.issues }); return }
      if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return }
      res.status(500).json({ error: 'Erro interno' })
    }
  })

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await usuarioService.remover(req.tenantId!, Number(req.params.id))
      res.status(200).json({ ok: true })
    } catch (err) {
      if (err instanceof NotFoundError) { res.status(404).json({ error: err.message }); return }
      res.status(500).json({ error: 'Erro interno' })
    }
  })

  return router
}
