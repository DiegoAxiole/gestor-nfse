import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { carregarConfig } from '../config.js'

const { jwtSecret } = carregarConfig()

export interface AuthPayload {
  tenantId: number
  usuarioId: number
  email: string
  papel: string
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: number
      usuarioId?: number
      papel?: string
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Token nao informado' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret) as AuthPayload
    req.tenantId = payload.tenantId
    req.usuarioId = payload.usuarioId
    req.papel = payload.papel
    next()
  } catch {
    res.status(401).json({ detail: 'Token invalido' })
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.papel !== 'admin') {
    res.status(403).json({ detail: 'Acesso restrito a administradores' })
    return
  }
  next()
}
