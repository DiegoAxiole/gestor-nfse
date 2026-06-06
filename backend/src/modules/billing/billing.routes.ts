import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { db } from '../../db/db.js'
import { asaasWebhooks, subscriptions } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { billingService } from './billing.service.js'

export function criarRouterBilling(): Router {
  const router = Router()

  router.post('/webhooks/asaas', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await billingService.processarWebhook(req.body)

      await db.insert(asaasWebhooks).values({
        event: result.event,
        asaas_id: result.subscriptionId ?? result.paymentId,
        raw_body: JSON.stringify(req.body),
      })

      if (result.event === 'PAYMENT_RECEIVED' && result.subscriptionId) {
        const [sub] = await db.select({ id: subscriptions.id, tenant_id: subscriptions.tenant_id })
          .from(subscriptions)
          .where(eq(subscriptions.asaas_subscription_id, result.subscriptionId))
          .limit(1)

        if (sub) {
          const periodoFim = new Date()
          const [current] = await db.select({ plano: subscriptions.plano })
            .from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1)
          const diasExtra = current?.plano === 'basico' ? 30 : current?.plano === 'profissional' ? 30 : 30
          periodoFim.setDate(periodoFim.getDate() + diasExtra)

          await db.update(subscriptions)
            .set({ status: 'active', periodo_fim: periodoFim, updated_at: new Date() })
            .where(eq(subscriptions.id, sub.id))
        }
      }

      res.json({ received: true })
    } catch (err) { next(err) }
  })

  return router
}
