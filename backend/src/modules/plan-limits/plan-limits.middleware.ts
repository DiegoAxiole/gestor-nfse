import type { Request, Response, NextFunction } from 'express'
import { planLimitsService } from './plan-limits.service.js'

type LimitKey = 'prestadores_max' | 'documentos_mes_max' | 'usuarios_max' | 'danfse' | 'lote_zip'

export function planLimitMiddleware(limitKey: LimitKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limits = await planLimitsService.resolveLimits(req.tenantId!)

      if (limitKey === 'danfse' || limitKey === 'lote_zip') {
        if (!limits[limitKey]) {
          res.status(403).json({
            detail: `Recurso não disponível no seu plano atual. Faça upgrade para liberar.`,
            code: 'PLAN_LIMIT_REACHED',
          })
          return
        }
        next()
        return
      }

      const countMap: Record<string, () => Promise<number>> = {
        prestadores_max: () => planLimitsService.countPrestadores(req.tenantId!),
        documentos_mes_max: () => planLimitsService.countDocumentosMes(req.tenantId!),
        usuarios_max: () => planLimitsService.countUsuarios(req.tenantId!),
      }

      const current = await countMap[limitKey]()
      const max = limits[limitKey] as number

      if (current >= max) {
        res.status(403).json({
          detail: `Limite do plano excedido (${current}/${max}). Faça upgrade para aumentar.`,
          code: 'PLAN_LIMIT_REACHED',
          current,
          max,
        })
        return
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}
