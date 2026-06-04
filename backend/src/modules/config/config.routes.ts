import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { configRepository } from './config.repository.js'

const ALLOWED_KEYS = ['ambiente', 'codigo_municipio', 'lgpd_ativo', 'cnpj', 'razao_social']

function toResponse(row: Record<string, any>) {
  return {
    cnpj: row.cnpj ?? '',
    razao_social: row.razao_social ?? '',
    ambiente: row.ambiente ?? 'Homologacao',
    codigo_municipio: String(row.codigo_municipio),
    lgpd_ativo: Boolean(row.lgpd_ativo),
  }
}

export function criarRouterConfig(): Router {
  const router = Router()

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await configRepository.buscar(req.tenantId!)
      if (!row) {
        res.json({
          cnpj: '',
          razao_social: '',
          ambiente: 'Homologacao',
          codigo_municipio: '1001058',
          lgpd_ativo: false,
        })
        return
      }
      res.json(toResponse(row))
    } catch (err) { next(err) }
  })

  router.put('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body
      const dados: Record<string, any> = {}
      for (const key of ALLOWED_KEYS) {
        if (body[key] !== undefined) dados[key] = body[key]
      }
      if (dados.codigo_municipio !== undefined) dados.codigo_municipio = Number(dados.codigo_municipio)
      if (dados.lgpd_ativo !== undefined) dados.lgpd_ativo = dados.lgpd_ativo ? 1 : 0
      if (dados.ambiente !== undefined && !['Homologacao', 'Producao'].includes(dados.ambiente)) {
        res.status(422).json({ detail: "Ambiente invalido. Use 'Homologacao' ou 'Producao'." })
        return
      }

      await configRepository.atualizar(req.tenantId!, dados)
      const row = await configRepository.buscar(req.tenantId!)
      res.json(toResponse(row!))
    } catch (err) { next(err) }
  })

  return router
}
