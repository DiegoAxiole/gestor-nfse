import { Router } from 'express'
import archiver from 'archiver'
import type { Request, Response, NextFunction } from 'express'
import { documentoRepository } from './documentos.repository.js'
import { planLimitMiddleware } from '../plan-limits/plan-limits.middleware.js'

export function criarRouterDocumentos(): Router {
  const router = Router()

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cnpj, inicio, fim, data_inicio, data_fim, tem_pdf, page, page_size } = req.query
      const result = await documentoRepository.listar({
        cnpj: cnpj as string | undefined,
        inicio: inicio as string | undefined,
        fim: fim as string | undefined,
        data_inicio: data_inicio as string | undefined,
        data_fim: data_fim as string | undefined,
        tem_pdf: tem_pdf as string | undefined,
        page: page ? Number(page) : undefined,
        page_size: page_size ? Number(page_size) : undefined,
        tenantId: req.tenantId!,
      })
      res.json(result)
    } catch (err) { next(err) }
  })

  router.get('/:chave/xml', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await documentoRepository.buscarXml(req.params.chave, req.tenantId!)
      if (!doc?.xml_nfse) { res.status(404).json({ detail: 'XML nao encontrado' }); return }
      res.setHeader('Content-Type', 'application/xml')
      res.send(doc.xml_nfse)
    } catch (err) { next(err) }
  })

  router.get('/:chave/pdf', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await documentoRepository.buscarPdf(req.params.chave, req.tenantId!)
      if (!doc?.pdf_blob) { res.status(404).json({ detail: 'PDF nao encontrado' }); return }
      res.setHeader('Content-Type', 'application/pdf')
      res.send(doc.pdf_blob)
    } catch (err) { next(err) }
  })

  router.get('/download-zip', planLimitMiddleware('lote_zip'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cnpj, inicio, fim } = req.query
      if (!cnpj || !inicio || !fim) {
        res.status(422).json({ detail: 'Parametros obrigatorios: cnpj, inicio, fim' })
        return
      }
      if (typeof cnpj !== 'string' || typeof inicio !== 'string' || typeof fim !== 'string') {
        res.status(422).json({ detail: 'Parametros devem ser strings' })
        return
      }

      const docs = await documentoRepository.listarPorPeriodo(cnpj, inicio, fim, req.tenantId!)
      if (docs.length === 0) {
        res.status(404).json({ detail: 'Nenhum documento encontrado no periodo' })
        return
      }

      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="nfse_${cnpj}.zip"`)
      const archive = archiver('zip', { zlib: { level: 9 } })
      archive.pipe(res)
      for (const doc of docs) {
        if (doc.xml_nfse) archive.append(doc.xml_nfse, { name: `${doc.chave_acesso}.xml` })
      }
      archive.finalize()
    } catch (err) { next(err) }
  })

  return router
}
