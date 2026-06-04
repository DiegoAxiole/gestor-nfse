import { db } from '../../db/db.js'
import { configuracoes } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

export const configRepository = {
  async buscar(tenantId: number) {
    const rows = await db.select().from(configuracoes)
      .where(eq(configuracoes.tenant_id, tenantId))
      .limit(1)
    return rows[0]
  },

  async atualizar(tenantId: number, dados: Partial<typeof configuracoes.$inferInsert>) {
    const existing = await db.select({ id: configuracoes.id }).from(configuracoes)
      .where(eq(configuracoes.tenant_id, tenantId))
      .limit(1)
      .then((r: { id: number }[]) => r[0])

    if (existing) {
      await db.update(configuracoes)
        .set({ ...dados, atualizada_em: new Date() })
        .where(eq(configuracoes.id, existing.id))
    } else {
      await db.insert(configuracoes).values({
        tenant_id: tenantId,
        ...dados,
      } as any)
    }
  },
}
