import { db } from '../../db/db.js'
import { subscriptions } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors.js'

export type SubscriptionData = {
  id: number
  tenant_id: number
  uuid: string
  plano: string
  status: string
  trial_fim: Date
  periodo_fim: Date
  gateway_customer_id: string | null
  gateway_subscription_id: string | null
  cancelado_em: Date | null
  created_at: Date
  updated_at: Date
}

export const subscriptionService = {
  async buscar(tenantId: number) {
    const rows = await db.select().from(subscriptions)
      .where(eq(subscriptions.tenant_id, tenantId)).limit(1)
    if (!rows[0]) throw new NotFoundError('Subscription', String(tenantId))
    const s = rows[0]
    const now = new Date()
    const diffMs = s.periodo_fim.getTime() - now.getTime()
    const diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    return { ...s, diasRestantes }
  },

  async cancelar(tenantId: number) {
    const rows = await db.update(subscriptions)
      .set({ status: 'canceled', cancelado_em: new Date(), updated_at: new Date() })
      .where(eq(subscriptions.tenant_id, tenantId))
      .returning()
    if (!rows[0]) throw new NotFoundError('Subscription', String(tenantId))
    return { ...rows[0], diasRestantes: 0 }
  },

  async upgrade(tenantId: number, data: { plano: string; periodo_fim: Date }) {
    const rows = await db.update(subscriptions)
      .set({ plano: data.plano, status: 'active', periodo_fim: data.periodo_fim, updated_at: new Date() })
      .where(eq(subscriptions.tenant_id, tenantId))
      .returning()
    if (!rows[0]) throw new NotFoundError('Subscription', String(tenantId))
    const s = rows[0]
    const now = new Date()
    const diffMs = s.periodo_fim.getTime() - now.getTime()
    const diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    return { ...s, diasRestantes }
  },
}
