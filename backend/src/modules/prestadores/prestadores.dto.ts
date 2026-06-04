import { z } from 'zod'

export const CadastrarPrestadorSchema = z.object({
  cnpj: z.string().length(14, 'CNPJ deve ter 14 digitos'),
  razao_social: z.string().min(1, 'Razao social é obrigatoria'),
  ambiente: z.enum(['Homologacao', 'Producao']),
  certificado_senha: z.string().min(1, 'Senha do certificado é obrigatoria'),
})

export const AtualizarPrestadorSchema = z.object({
  razao_social: z.string().min(1).optional(),
  ambiente: z.enum(['Homologacao', 'Producao']).optional(),
  certificado_senha: z.string().min(1).optional(),
})

export const UploadCertificadoSchema = z.object({
  senha: z.string().min(1, 'Senha é obrigatoria'),
  cnpj: z.string().length(14).optional(),
})

export type CadastrarPrestadorDTO = z.infer<typeof CadastrarPrestadorSchema>
export type AtualizarPrestadorDTO = z.infer<typeof AtualizarPrestadorSchema>
export type UploadCertificadoDTO = z.infer<typeof UploadCertificadoSchema>

export interface PrestadorResponse {
  cnpj: string
  razao_social: string
  ambiente: string
  codigo_municipio: string
  certificado_validade: string | null
  certificado_nome: string | null
}
