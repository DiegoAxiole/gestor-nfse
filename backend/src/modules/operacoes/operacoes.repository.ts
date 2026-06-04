import { db } from '../../db/db.js'
import { operacoes } from '../../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'

export const operacaoRepository = {
  async listar(tenantId: number, cnpj?: string, limite = 50, offset = 0) {
    const take = Math.min(limite, 200)
    const conditions = [eq(operacoes.tenant_id, tenantId)]
    if (cnpj) conditions.push(eq(operacoes.prestador_cnpj, cnpj))
    return db.select({
      id: operacoes.id,
      prestador_cnpj: operacoes.prestador_cnpj,
      tipo: operacoes.tipo,
      nsu_consultado: operacoes.nsu_consultado,
      ultimo_nsu: operacoes.ultimo_nsu,
      status: operacoes.status,
      qtd_documentos: operacoes.qtd_documentos,
      created_at: operacoes.created_at,
    }).from(operacoes)
      .where(and(...conditions))
      .orderBy(desc(operacoes.id))
      .limit(take)
      .offset(offset)
  },

  async buscar(id: number, tenantId: number) {
    const rows = await db.select({
      id: operacoes.id,
      prestador_cnpj: operacoes.prestador_cnpj,
      tipo: operacoes.tipo,
      nsu_consultado: operacoes.nsu_consultado,
      ultimo_nsu: operacoes.ultimo_nsu,
      status: operacoes.status,
      qtd_documentos: operacoes.qtd_documentos,
      xml_request: operacoes.xml_request,
      xml_response: operacoes.xml_response,
      xml_erro: operacoes.xml_erro,
      created_at: operacoes.created_at,
    }).from(operacoes).where(and(eq(operacoes.id, id), eq(operacoes.tenant_id, tenantId))).limit(1)
    return rows[0]
  },
}
