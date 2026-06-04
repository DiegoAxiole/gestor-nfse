import { db } from '../../db/db.js'
import { prestadores } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export type PrestadorRow = {
  cnpj: string
  razao_social: string
  ambiente: string
  certificado_validade: string | null
  certificado_nome: string | null
  certificado_pfx: Buffer | null
  certificado_senha: string
}

export const prestadorRepository = {
  async listar(tenantId: number) {
    return db.select({
      cnpj: prestadores.cnpj,
      razao_social: prestadores.razao_social,
      ambiente: prestadores.ambiente,
      certificado_validade: prestadores.certificado_validade,
      certificado_nome: prestadores.certificado_nome,
    })
      .from(prestadores)
      .where(eq(prestadores.tenant_id, tenantId))
      .orderBy(prestadores.razao_social)
  },

  async buscar(cnpj: string, tenantId: number) {
    const rows = await db.select().from(prestadores)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },

  async criar(data: {
    cnpj: string
    tenant_id: number
    razao_social: string
    ambiente: string
    certificado_pfx: Buffer
    certificado_senha: string
    certificado_nome: string
  }) {
    const rows = await db.insert(prestadores).values(data).returning({
      cnpj: prestadores.cnpj,
      razao_social: prestadores.razao_social,
      ambiente: prestadores.ambiente,
      certificado_validade: prestadores.certificado_validade,
      certificado_nome: prestadores.certificado_nome,
    })
    return rows[0]
  },

  async atualizar(
    cnpj: string,
    tenantId: number,
    data: Partial<Pick<PrestadorRow, 'razao_social' | 'ambiente' | 'certificado_pfx' | 'certificado_senha' | 'certificado_nome'>>
  ) {
    const rows = await db.update(prestadores)
      .set(data)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
      .returning()
    return rows[0]
  },

  async remover(cnpj: string, tenantId: number) {
    await db.delete(prestadores)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
  },
}
