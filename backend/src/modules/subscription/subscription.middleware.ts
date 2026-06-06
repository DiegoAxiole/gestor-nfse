import type { Request, Response, NextFunction } from 'express'
import { db } from '../../db/db.js'
import { subscriptions } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

const rotasLivres = ['/auth', '/subscription']

export async function subscriptionMiddleware(req: Request, res: Response, next: NextFunction) {
  const rota = req.path
  if (rotasLivres.some(r => rota.startsWith(r))) {
    next()
    return
  }
  if (!req.tenantId) {
    next()
    return
  }
  try {
    const rows = await db.select({ status: subscriptions.status, periodo_fim: subscriptions.periodo_fim })
      .from(subscriptions).where(eq(subscriptions.tenant_id, req.tenantId)).limit(1)
    const sub = rows[0]
    if (!sub) {
      next()
      return
    }
    const ativo = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'pending'
    const valido = sub.periodo_fim > new Date()
    if (ativo && valido) {
      next()
      return
    }
    res.status(402).json({ detail: 'Assinatura expirada', code: 'SUBSCRIPTION_EXPIRED' })
  } catch {
    next()
  }
}
