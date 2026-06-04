import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CertificadoA1 } from '../../vendor/consulta-nfse-api-node/auth.js'
import { validarCnpj } from '../../validators.js'
import { prestadorRepository } from './prestadores.repository.js'
import { NotFoundError, ValidationError } from '../../shared/errors.js'
import type { PrestadorResponse, CadastrarPrestadorDTO, AtualizarPrestadorDTO } from './prestadores.dto.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function toResponse(p: { cnpj: string; razao_social: string; ambiente: string; certificado_validade: string | null; certificado_nome: string | null }, codigoMunicipio: number): PrestadorResponse {
  return {
    cnpj: p.cnpj,
    razao_social: p.razao_social,
    ambiente: p.ambiente,
    codigo_municipio: String(codigoMunicipio),
    certificado_validade: p.certificado_validade || null,
    certificado_nome: p.certificado_nome || null,
  }
}

export const prestadorService = {
  async listar(codigoMunicipio: number, tenantId: number): Promise<PrestadorResponse[]> {
    const prestadores = await prestadorRepository.listar(tenantId)
    return prestadores.map(p => toResponse(p, codigoMunicipio))
  },

  async cadastrar(
    data: CadastrarPrestadorDTO,
    certificadoPfx: Buffer,
    certificadoNome: string,
    codigoMunicipio: number,
    tenantId: number,
  ): Promise<PrestadorResponse> {
    if (!validarCnpj(data.cnpj)) throw new ValidationError('CNPJ invalido: deve ter 14 digitos')

    const p = await prestadorRepository.criar({
      cnpj: data.cnpj,
      tenant_id: tenantId,
      razao_social: data.razao_social,
      ambiente: data.ambiente,
      certificado_pfx: certificadoPfx,
      certificado_senha: data.certificado_senha,
      certificado_nome: certificadoNome,
    })
    return toResponse(p, codigoMunicipio)
  },

  async buscar(cnpj: string, codigoMunicipio: number, tenantId: number): Promise<PrestadorResponse> {
    const p = await prestadorRepository.buscar(cnpj, tenantId)
    if (!p) throw new NotFoundError('Prestador', cnpj)
    return toResponse(p, codigoMunicipio)
  },

  async atualizar(
    cnpj: string,
    data: AtualizarPrestadorDTO,
    certificadoPfx?: Buffer,
    certificadoNome?: string,
    codigoMunicipio?: number,
    tenantId?: number,
  ): Promise<PrestadorResponse> {
    const existente = await prestadorRepository.buscar(cnpj, tenantId!)
    if (!existente) throw new NotFoundError('Prestador', cnpj)

    const updateData: Partial<{ razao_social: string; ambiente: string; certificado_pfx: Buffer; certificado_senha: string; certificado_nome: string }> = {}
    if (data.razao_social) updateData.razao_social = data.razao_social
    if (data.ambiente) updateData.ambiente = data.ambiente
    if (certificadoPfx) {
      updateData.certificado_pfx = certificadoPfx
      updateData.certificado_nome = certificadoNome || ''
    }
    if (data.certificado_senha) updateData.certificado_senha = data.certificado_senha

    const p = await prestadorRepository.atualizar(cnpj, tenantId!, updateData)
    return toResponse(p!, codigoMunicipio ?? 0)
  },

  async remover(cnpj: string, tenantId: number): Promise<void> {
    const existente = await prestadorRepository.buscar(cnpj, tenantId)
    if (!existente) throw new NotFoundError('Prestador', cnpj)
    await prestadorRepository.remover(cnpj, tenantId)
  },

  async uploadCertificado(certificadoPfx: Buffer, senha: string, cnpj?: string) {
    const tempPath = join(tmpdir(), `_temp_${Date.now()}.pfx`)
    writeFileSync(tempPath, certificadoPfx)
    try {
      const cert = new CertificadoA1(tempPath, senha)
      const info = cert.info
      cert.limpar()

      const result: Record<string, unknown> = {
        data_validade: info.validoAte ? info.validoAte.split('T')[0] : '',
        cnpj_extraido: info.cnpj || '',
        razao_extraida: '',
        emissor: info.emissor || '',
        dias_restantes: 0,
        caminho_arquivo: '',
      }
      if (cnpj && validarCnpj(cnpj)) {
        result.cnpj_extraido = cnpj
      }
      return result
    } finally {
      rmSync(tempPath, { force: true })
    }
  },
}
