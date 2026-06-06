import { Router } from 'express'
import { writeFileSync, rmSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Request, Response, NextFunction } from 'express'
import { NfseClient } from '../../vendor/consulta-nfse-api-node/client.js'
import { distribuicaoRepository } from './distribuicao.repository.js'

const ConsultarSchema = z.object({
  cnpj: z.string().length(14, 'CNPJ deve ter 14 digitos'),
  nsu: z.string().optional(),
  tipo_nsu: z.string().optional(),
})

const UltimoNsuSchema = z.object({
  cnpj: z.string().length(14, 'CNPJ deve ter 14 digitos'),
})

export function criarRouterDistribuicao(codigoMunicipio: number): Router {
  const router = Router()

  router.get('/ultimo-nsu', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = UltimoNsuSchema.safeParse(req.query)
      if (!parsed.success) { res.status(422).json({ detail: parsed.error.issues.map(e => e.message).join('; ') }); return }
      const ultimoNsu = await distribuicaoRepository.buscarUltimoNsu(parsed.data.cnpj, req.tenantId!)
      res.json({ ultimo_nsu: ultimoNsu })
    } catch (err) { next(err) }
  })

  router.post('/consultar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = ConsultarSchema.safeParse(req.body)
      if (!parsed.success) { res.status(422).json({ detail: parsed.error.issues.map(e => e.message).join('; ') }); return }
      const { cnpj, nsu, tipo_nsu } = parsed.data

      const ativa = await distribuicaoRepository.consultaAtiva(cnpj, req.tenantId!)
      if (ativa) {
        res.status(409).json({ detail: 'Ja existe uma consulta em andamento para este CNPJ', task_id: ativa.id, status: 'processing' })
        return
      }

      const taskId = randomUUID()
      const chaveAcesso = `${cnpj}_${nsu ?? '0'}`
      await distribuicaoRepository.criarTask(taskId, cnpj, chaveAcesso, req.tenantId!)

      setImmediate(async () => {
        try {
          await distribuicaoRepository.atualizarTask(taskId, { status: 'processing', progresso: 10, mensagem: 'Carregando certificado...' })

          const prestador = await distribuicaoRepository.buscarPrestadorCompleto(cnpj, req.tenantId!)
          if (!prestador) {
            await distribuicaoRepository.atualizarTask(taskId, { status: 'error', erro_texto: 'Prestador nao encontrado', mensagem: 'Erro: prestador nao encontrado' })
            return
          }

          const tempCertPath = join(tmpdir(), `_cert_${taskId}.pfx`)
          if (!prestador.certificado_pfx) {
            await distribuicaoRepository.atualizarTask(taskId, { status: 'error', erro_texto: 'Certificado nao encontrado', mensagem: 'Erro: certificado nao encontrado' })
            return
          }
          writeFileSync(tempCertPath, Buffer.from(prestador.certificado_pfx))

          await distribuicaoRepository.atualizarTask(taskId, { progresso: 30, mensagem: 'Consultando ADN Nacional...' })

          const client = new NfseClient({
            certificadoPfx: tempCertPath,
            senha: prestador.certificado_senha,
            ambiente: prestador.ambiente === 'Homologacao' ? 'homologacao' : 'producao',
          })

          const resultado = await client.sincronizar({ nsu: Number(nsu ?? 0), force: true })
          client.fechar()
          rmSync(tempCertPath, { force: true })

          await distribuicaoRepository.atualizarTask(taskId, { progresso: 70, mensagem: 'Salvando documentos...' })

          const operacaoId = await distribuicaoRepository.criarOperacao(
            cnpj,
            tipo_nsu ?? 'DISTRIBUICAO',
            String(nsu ?? 0),
            resultado.ultimoNsu ?? String(nsu ?? 0),
            resultado.status,
            resultado.documentos.length,
            req.tenantId!,
          )

          await distribuicaoRepository.inserirDocumentos(resultado.documentos, cnpj, operacaoId, req.tenantId!)

          await distribuicaoRepository.atualizarTask(taskId, {
            status: 'completed',
            progresso: 100,
            mensagem: `Consulta concluida. ${resultado.documentos.length} documento(s) encontrados.`,
            resultado_json: JSON.stringify({
              status: resultado.status,
              documentos: resultado.documentos.length,
              ultimo_nsu: resultado.ultimoNsu,
              operacao_id: operacaoId,
            }),
          })
        } catch (err: any) {
          const msg = `[${new Date().toISOString()}] Task ${taskId} erro: ${err?.message ?? err}`
          console.error(msg)
          try {
            appendFileSync(join(process.cwd(), 'data', 'distribuicao.log'), msg + '\n')
          } catch { /* fallback */ }
          await distribuicaoRepository.atualizarTask(taskId, {
            status: 'error',
            erro_texto: err.message,
            mensagem: `Erro: ${err.message}`,
          })
        }
      })

      res.status(202).json({ task_id: taskId, status: 'processing' })
    } catch (err) { next(err) }
  })

  return router
}
