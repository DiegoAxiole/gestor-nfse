import { db } from '../../db/db.js'
import { planLimits, tenantOverrides, subscriptions, prestadores, tenantUsuarios, documentos } from '../../db/schema.js'
import { eq, and, gte, lte, count } from 'drizzle-orm'

export interface ResolvedLimits {
  prestadores_max: number
  documentos_mes_max: number
  usuarios_max: number
  danfse: boolean
  lote_zip: boolean
}

export const planLimitsService = {
  async getPlanName(tenantId: number): Promise<string> {
    const rows = await db.select({ plano: subscriptions.plano })
      .from(subscriptions)
      .where(eq(subscriptions.tenant_id, tenantId))
      .limit(1)
    return rows[0]?.plano ?? 'trial'
  },

  async resolveLimits(tenantId: number): Promise<ResolvedLimits> {
    const plano = await this.getPlanName(tenantId)
    const [defaults] = await db.select().from(planLimits)
      .where(eq(planLimits.plano, plano))
      .limit(1)

    const base = defaults ?? { prestadores_max: 1, documentos_mes_max: 50, usuarios_max: 2, danfse: true, lote_zip: true, plano: 'trial', id: 0, created_at: new Date() }

    const [override] = await db.select().from(tenantOverrides)
      .where(eq(tenantOverrides.tenant_id, tenantId))
      .limit(1)

    if (!override) return base

    return {
      prestadores_max: override.prestadores_max ?? base.prestadores_max,
      documentos_mes_max: override.documentos_mes_max ?? base.documentos_mes_max,
      usuarios_max: override.usuarios_max ?? base.usuarios_max,
      danfse: override.danfse ?? base.danfse,
      lote_zip: override.lote_zip ?? base.lote_zip,
    }
  },

  async countPrestadores(tenantId: number): Promise<number> {
    const rows = await db.select({ total: count() }).from(prestadores)
      .where(eq(prestadores.tenant_id, tenantId))
    return rows[0]?.total ?? 0
  },

  async countUsuarios(tenantId: number): Promise<number> {
    const rows = await db.select({ total: count() }).from(tenantUsuarios)
      .where(eq(tenantUsuarios.tenant_id, tenantId))
    return rows[0]?.total ?? 0
  },

  async countDocumentosMes(tenantId: number): Promise<number> {
    const rows = await db.select({ total: count() }).from(documentos)
      .where(and(
        eq(documentos.tenant_id, tenantId),
        gte(documentos.created_at, new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      ))
    return rows[0]?.total ?? 0
  },
}
