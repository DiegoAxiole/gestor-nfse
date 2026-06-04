import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service.js'

export function criarRouterAuth(): Router {
  const router = Router()

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, senha } = req.body
      if (!email || !senha) {
        res.status(422).json({ detail: 'Email e senha sao obrigatorios' })
        return
      }
      const result = await authService.login(email, senha)
      res.json(result)
    } catch (err: any) {
      if (err.message === 'Email ou senha invalidos') {
        res.status(401).json({ detail: err.message })
        return
      }
      next(err)
    }
  })

  router.post('/cadastrar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { nome, slug, email, senha } = req.body
      if (!nome || !slug || !email || !senha) {
        res.status(422).json({ detail: 'Nome, slug, email e senha sao obrigatorios' })
        return
      }
      const result = await authService.cadastrarTenant(nome, slug, email, senha)
      res.status(201).json(result)
    } catch (err) { next(err) }
  })

  return router
}
