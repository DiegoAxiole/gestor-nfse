import { db } from '../../db/db.js'
import { tenants } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { NotFoundError } from '../../shared/errors.js'

export type TenantProfile = {
  uuid: string
  tipo: string
  documento: string
  nome: string
  nome_fantasia: string | null
  inscricao_estadual: string | null
  email_contato: string
  telefone_celular: string | null
  whatsapp: boolean
  telefone_fixo: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

export const tenantService = {
  async buscar(tenantId: number): Promise<TenantProfile> {
    const rows = await db.select({
      uuid: tenants.uuid,
      tipo: tenants.tipo,
      documento: tenants.documento,
      nome: tenants.nome,
      nome_fantasia: tenants.nome_fantasia,
      inscricao_estadual: tenants.inscricao_estadual,
      email_contato: tenants.email_contato,
      telefone_celular: tenants.telefone_celular,
      whatsapp: tenants.whatsapp,
      telefone_fixo: tenants.telefone_fixo,
      cep: tenants.cep,
      logradouro: tenants.logradouro,
      numero: tenants.numero,
      complemento: tenants.complemento,
      bairro: tenants.bairro,
      cidade: tenants.cidade,
      uf: tenants.uf,
    }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    if (!rows[0]) throw new NotFoundError('Tenant', String(tenantId))
    return rows[0]
  },

  async atualizar(tenantId: number, usuarioId: number, data: Partial<Omit<TenantProfile, 'uuid' | 'tipo' | 'documento' | 'nome'>>) {
    const rows = await db.update(tenants)
      .set({ ...data, updated_at: new Date(), updated_by: usuarioId })
      .where(eq(tenants.id, tenantId))
      .returning()
    return rows[0]
  },
}
