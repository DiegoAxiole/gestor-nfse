import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../shared/auth.middleware.js'
import { tenantService } from './tenant.service.js'
import { NotFoundError } from '../../shared/errors.js'

declare global {
  namespace Express {
    interface Request {
      tenantId?: number
      usuarioId?: number
    }
  }
}

const schemaAtualizarTenant = z.object({
  nome_fantasia: z.string().max(255).optional(),
  inscricao_estadual: z.string().max(20).optional(),
  email_contato: z.string().email().min(1),
  whatsapp: z.boolean().optional(),
  telefone_celular: z.string().max(20).optional(),
  telefone_fixo: z.string().max(20).optional(),
  cep: z.string().max(8).optional(),
  logradouro: z.string().max(255).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  uf: z.string().length(2).optional(),
})

export function criarRouterTenant(): Router {
  const router = Router()

  router.use(authMiddleware)

  router.get('/', async (req: Request, res: Response) => {
    try {
      const data = await tenantService.buscar(req.tenantId!)
      res.json({ data })
    } catch (err) {
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: 'Tenant não encontrado' })
        return
      }
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  })

  router.put('/', async (req: Request, res: Response) => {
    try {
      const body = schemaAtualizarTenant.parse(req.body)
      const updated = await tenantService.atualizar(req.tenantId!, req.usuarioId!, body)
      res.json({ data: updated })
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: err.issues })
        return
      }
      if (err instanceof NotFoundError) {
        res.status(404).json({ error: 'Tenant não encontrado' })
        return
      }
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  })

  return router
}
