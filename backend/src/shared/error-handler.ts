import { Request, Response, NextFunction } from 'express'
import { AppError } from './errors.js'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      detail: err.message,
      code: err.code,
    })
    return
  }

  console.error(`[ERROR] ${err.stack ?? err.message}`)
  res.status(500).json({
    detail: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
  })
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ detail: 'Rota nao encontrada', code: 'NOT_FOUND' })
}
