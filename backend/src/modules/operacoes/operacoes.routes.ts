import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { operacaoRepository } from './operacoes.repository.js'

export function criarRouterOperacoes(): Router {
  const router = Router()

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cnpj, limite, offset } = req.query
      const ops = await operacaoRepository.listar(
        req.tenantId!,
        cnpj as string | undefined,
        Number(limite) || 50,
        Number(offset) || 0,
      )
      res.json(ops)
    } catch (err) { next(err) }
  })

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const op = await operacaoRepository.buscar(Number(req.params.id), req.tenantId!)
      if (!op) { res.status(404).json({ detail: 'Operacao nao encontrada' }); return }
      res.json({
        id: op.id,
        prestador_cnpj: op.prestador_cnpj,
        tipo: op.tipo,
        nsu_consultado: op.nsu_consultado,
        ultimo_nsu: op.ultimo_nsu,
        status: op.status,
        qtd_documentos: op.qtd_documentos,
        xml_request: op.xml_request ?? null,
        xml_response: op.xml_response ?? null,
        xml_erro: op.xml_erro ?? null,
        created_at: op.created_at,
      })
    } catch (err) { next(err) }
  })

  return router
}
