import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export interface AuthPayload {
  tenantId: number
  usuarioId: number
  email: string
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: number
      usuarioId?: number
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
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload
    req.tenantId = payload.tenantId
    req.usuarioId = payload.usuarioId
    next()
  } catch {
    res.status(401).json({ detail: 'Token invalido' })
  }
}
