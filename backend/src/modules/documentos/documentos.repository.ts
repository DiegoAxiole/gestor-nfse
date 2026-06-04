import { db } from '../../db/db.js'
import { documentos } from '../../db/schema.js'
import { eq, and, desc, count, gte, lte, isNull, isNotNull } from 'drizzle-orm'

interface ListarParams {
  cnpj?: string
  inicio?: string
  fim?: string
  data_inicio?: string
  data_fim?: string
  tem_pdf?: string
  page?: number
  page_size?: number
  tenantId: number
}

export const documentoRepository = {
  async listar(params: ListarParams) {
    const conditions = [eq(documentos.tenant_id, params.tenantId)]
    if (params.cnpj) conditions.push(eq(documentos.prestador_cnpj, params.cnpj))
    if (params.inicio) conditions.push(gte(documentos.data_emissao, params.inicio))
    if (params.fim) conditions.push(lte(documentos.data_emissao, params.fim))
    if (params.data_inicio) conditions.push(gte(documentos.created_at, new Date(params.data_inicio)))
    if (params.data_fim) conditions.push(lte(documentos.created_at, new Date(params.data_fim)))
    if (params.tem_pdf !== undefined) {
      const hasPdf = params.tem_pdf === 'true' || params.tem_pdf === '1'
      conditions.push(hasPdf ? isNotNull(documentos.pdf_blob) : isNull(documentos.pdf_blob))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const take = Math.min(params.page_size || 50, 1000)
    const skip = ((params.page || 1) - 1) * take

    const [docs, totalResult] = await Promise.all([
      db.select({
        chave_acesso: documentos.chave_acesso,
        prestador_cnpj: documentos.prestador_cnpj,
        nsu: documentos.nsu,
        xml_nfse: documentos.xml_nfse,
        pdf_blob: documentos.pdf_blob,
        data_emissao: documentos.data_emissao,
        emissao_dh: documentos.emissao_dh,
        created_at: documentos.created_at,
      })
        .from(documentos)
        .where(where)
        .orderBy(desc(documentos.created_at))
        .limit(take)
        .offset(skip),
      db.select({ count: count() }).from(documentos).where(where).then((r: { count: number }[]) => r[0]),
    ])

    const total = totalResult?.count ?? 0

    return {
      documentos: docs.map((d: { chave_acesso: string; prestador_cnpj: string; nsu: string | null; xml_nfse: string | null; pdf_blob: Buffer | null; data_emissao: string | null; emissao_dh: string | null; created_at: Date }) => ({ ...d, tem_pdf: d.pdf_blob !== null, pdf_blob: undefined })),
      total,
    }
  },

  async buscarXml(chave: string, tenantId: number) {
    const rows = await db.select({ xml_nfse: documentos.xml_nfse })
      .from(documentos)
      .where(and(eq(documentos.chave_acesso, chave), eq(documentos.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },

  async buscarPdf(chave: string, tenantId: number) {
    const rows = await db.select({ pdf_blob: documentos.pdf_blob })
      .from(documentos)
      .where(and(eq(documentos.chave_acesso, chave), eq(documentos.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },

  async listarPorPeriodo(cnpj: string, inicio: string, fim: string, tenantId: number) {
    return db.select({
      chave_acesso: documentos.chave_acesso,
      xml_nfse: documentos.xml_nfse,
    })
      .from(documentos)
      .where(and(
        eq(documentos.tenant_id, tenantId),
        eq(documentos.prestador_cnpj, cnpj),
        gte(documentos.data_emissao, inicio),
        lte(documentos.data_emissao, fim),
      ))
      .orderBy(documentos.data_emissao)
  },
}
