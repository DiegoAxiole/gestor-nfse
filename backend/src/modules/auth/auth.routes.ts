import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service.js'

export function criarRouterAuth(): Router {
  const router = Router()

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, senha } = req.body
      if (!email || !senha) {
        res.status(422).json({ detail: 'Email e senha são obrigatórios' })
        return
      }
      const result = await authService.login(email, senha)
      res.json(result)
    } catch (err: any) {
      if (err.message === 'Credenciais inválidas') {
        res.status(401).json({ detail: err.message })
        return
      }
      next(err)
    }
  })

  router.post('/cadastrar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tipo, documento, nome, nome_fantasia, email, senha } = req.body
      if (!tipo || !documento || !nome || !email || !senha) {
        res.status(422).json({ detail: 'Tipo, documento, nome, email e senha são obrigatórios' })
        return
      }
      const result = await authService.cadastrarTenant({ tipo, documento, nome, nome_fantasia, email, senha })
      res.status(201).json(result)
    } catch (err) { next(err) }
  })

  return router
}
