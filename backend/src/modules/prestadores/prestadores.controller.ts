import type { Request, Response, NextFunction } from 'express'
import type { ZodIssue } from 'zod'
import { prestadorService } from './prestadores.service.js'
import { CadastrarPrestadorSchema, AtualizarPrestadorSchema, UploadCertificadoSchema } from './prestadores.dto.js'
import { ValidationError } from '../../shared/errors.js'

export function criarController(codigoMunicipio: number) {
  return {
    async listar(_req: Request, res: Response, next: NextFunction) {
      try {
        const result = await prestadorService.listar(codigoMunicipio, _req.tenantId!)
        res.json(result)
      } catch (err) { next(err) }
    },

    async cadastrar(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = CadastrarPrestadorSchema.safeParse(req.body)
        if (!parsed.success) throw new ValidationError(parsed.error.issues.map((e: ZodIssue) => e.message).join('; '))

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
        const file = files?.['certificado_pfx']?.[0]
        if (!file) throw new ValidationError('certificado_pfx é obrigatorio')

        const nomeCert = req.body.certificado_nome || file.originalname || ''
        const result = await prestadorService.cadastrar(parsed.data, file.buffer, nomeCert, codigoMunicipio, req.tenantId!)
        res.status(201).json(result)
      } catch (err) { next(err) }
    },

    async buscar(req: Request, res: Response, next: NextFunction) {
      try {
        const result = await prestadorService.buscar(req.params.cnpj, codigoMunicipio, req.tenantId!)
        res.json(result)
      } catch (err) { next(err) }
    },

    async atualizar(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = AtualizarPrestadorSchema.safeParse(req.body)
        if (!parsed.success) throw new ValidationError(parsed.error.issues.map((e: ZodIssue) => e.message).join('; '))

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
        const file = files?.['certificado_pfx']?.[0]
        const result = await prestadorService.atualizar(
          req.params.cnpj,
          parsed.data,
          file?.buffer,
          req.body.certificado_nome || file?.originalname,
          codigoMunicipio,
          req.tenantId!,
        )
        res.json(result)
      } catch (err) { next(err) }
    },

    async remover(req: Request, res: Response, next: NextFunction) {
      try {
        await prestadorService.remover(req.params.cnpj, req.tenantId!)
        res.json({ ok: true })
      } catch (err) { next(err) }
    },

    async uploadCertificado(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = UploadCertificadoSchema.safeParse(req.body)
        if (!parsed.success) throw new ValidationError(parsed.error.issues.map((e: ZodIssue) => e.message).join('; '))

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
        const file = files?.['certificado_pfx']?.[0]
        if (!file) throw new ValidationError('certificado_pfx é obrigatorio')

        const result = await prestadorService.uploadCertificado(file.buffer, parsed.data.senha, parsed.data.cnpj)
        res.json(result)
      } catch (err) { next(err) }
    },
  }
}
