import { db } from '../../db/db.js'
import { operacoes, backgroundTasks, prestadores, documentos } from '../../db/schema.js'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'

export const distribuicaoRepository = {
  async buscarUltimoNsu(cnpj: string, tenantId: number): Promise<string> {
    const rows = await db.select({ ultimo_nsu: operacoes.ultimo_nsu })
      .from(operacoes)
      .where(and(
        eq(operacoes.prestador_cnpj, cnpj),
        eq(operacoes.tenant_id, tenantId),
        sql`${operacoes.status} IN ('DOCUMENTOS_LOCALIZADOS', 'SUCESSO', '')`,
      ))
      .orderBy(desc(operacoes.id))
      .limit(1)
    return rows[0]?.ultimo_nsu ?? '000000000000000'
  },

  async consultaAtiva(cnpj: string, tenantId: number) {
    const rows = await db.select({ id: backgroundTasks.id })
      .from(backgroundTasks)
      .where(and(
        eq(backgroundTasks.tipo, 'consulta_distribuicao'),
        eq(backgroundTasks.tenant_id, tenantId),
        inArray(backgroundTasks.status, ['pending', 'processing']),
        eq(backgroundTasks.cnpj, cnpj),
      ))
      .orderBy(desc(backgroundTasks.criado_em))
      .limit(1)
    return rows[0]
  },

  async criarTask(taskId: string, cnpj: string, chaveAcesso: string, tenantId: number) {
    await db.insert(backgroundTasks).values({
      id: taskId,
      tenant_id: tenantId,
      tipo: 'consulta_distribuicao',
      chave_acesso: chaveAcesso,
      cnpj,
      status: 'pending',
      progresso: 0,
      mensagem: 'Iniciando...',
    })
  },

  async atualizarTask(taskId: string, data: { status?: string; progresso?: number; mensagem?: string; erro_texto?: string; resultado_json?: string }) {
    const setData: Record<string, any> = {}
    if (data.status !== undefined) setData.status = data.status
    if (data.progresso !== undefined) setData.progresso = data.progresso
    if (data.mensagem !== undefined) setData.mensagem = data.mensagem
    if (data.resultado_json !== undefined) setData.resultado_json = data.resultado_json
    if (data.erro_texto !== undefined) setData.erro_texto = data.erro_texto
    setData.atualizado_em = new Date()
    await db.update(backgroundTasks).set(setData).where(eq(backgroundTasks.id, taskId))
  },

  async buscarPrestadorCompleto(cnpj: string, tenantId: number) {
    const rows = await db.select().from(prestadores)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },

  async criarOperacao(cnpj: string, tipoNsu: string, nsuConsultado: string, ultimoNsu: string, status: string, qtdDocumentos: number, tenantId: number) {
    const rows = await db.insert(operacoes).values({
      prestador_cnpj: cnpj,
      tenant_id: tenantId,
      tipo: tipoNsu,
      nsu_consultado: nsuConsultado,
      ultimo_nsu: ultimoNsu,
      status,
      qtd_documentos: qtdDocumentos,
    }).returning({ id: operacoes.id })
    return rows[0].id
  },

  async inserirDocumentos(docs: Array<{ chaveAcesso: string; nsu: string | number; xml: string }>, cnpj: string, operacaoId: number, tenantId: number) {
    for (const doc of docs) {
      try {
        await db.insert(documentos).values({
          chave_acesso: doc.chaveAcesso,
          prestador_cnpj: cnpj,
          tenant_id: tenantId,
          operacao_id: operacaoId,
          nsu: String(doc.nsu),
          xml_nfse: doc.xml,
        })
      } catch (err) {
        console.error(`Erro ao inserir documento ${doc.chaveAcesso}:`, err)
      }
    }
  },
}
