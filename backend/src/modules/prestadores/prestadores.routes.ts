import { Router } from 'express'
import multer from 'multer'
import { criarController } from './prestadores.controller.js'
import { errorHandler } from '../../shared/error-handler.js'
import { planLimitMiddleware } from '../plan-limits/plan-limits.middleware.js'

const upload = multer({ storage: multer.memoryStorage() })

export function criarRouterPrestadores(codigoMunicipio: number): Router {
  const router = Router()
  const controller = criarController(codigoMunicipio)

  const multipart = upload.fields([{ name: 'certificado_pfx', maxCount: 1 }])

  router.get('/', controller.listar)
  router.post('/', planLimitMiddleware('prestadores_max'), multipart, controller.cadastrar)
  router.post('/upload-certificado', multipart, controller.uploadCertificado)
  router.get('/:cnpj', controller.buscar)
  router.put('/:cnpj', multipart, controller.atualizar)
  router.delete('/:cnpj', controller.remover)

  return router
}
