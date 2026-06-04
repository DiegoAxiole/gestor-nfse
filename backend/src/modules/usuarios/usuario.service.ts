import bcrypt from 'bcryptjs'
import { db } from '../../db/db.js'
import { tenantUsuarios } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { NotFoundError, ConflictError } from '../../shared/errors.js'

export type UsuarioPerfil = {
  id: number
  email: string
  nome: string | null
  papel: string
  created_at: Date
}

export const usuarioService = {
  async listar(tenantId: number): Promise<UsuarioPerfil[]> {
    return db.select({
      id: tenantUsuarios.id,
      email: tenantUsuarios.email,
      nome: tenantUsuarios.nome,
      papel: tenantUsuarios.papel,
      created_at: tenantUsuarios.created_at,
    }).from(tenantUsuarios).where(eq(tenantUsuarios.tenant_id, tenantId))
  },

  async buscar(tenantId: number, usuarioId: number): Promise<UsuarioPerfil> {
    const rows = await db.select({
      id: tenantUsuarios.id,
      email: tenantUsuarios.email,
      nome: tenantUsuarios.nome,
      papel: tenantUsuarios.papel,
      created_at: tenantUsuarios.created_at,
    }).from(tenantUsuarios).where(and(
      eq(tenantUsuarios.id, usuarioId),
      eq(tenantUsuarios.tenant_id, tenantId),
    )).limit(1)
    if (!rows[0]) throw new NotFoundError('Usuário', String(usuarioId))
    return rows[0]
  },

  async criar(tenantId: number, data: { email: string; nome?: string; papel: string; senha: string }): Promise<UsuarioPerfil> {
    const existente = await db.select({ id: tenantUsuarios.id }).from(tenantUsuarios)
      .where(and(eq(tenantUsuarios.email, data.email), eq(tenantUsuarios.tenant_id, tenantId)))
      .limit(1)
    if (existente.length > 0) throw new ConflictError('Email já cadastrado neste tenant')

    const hash = await bcrypt.hash(data.senha, 10)
    const [user] = await db.insert(tenantUsuarios).values({
      tenant_id: tenantId,
      email: data.email,
      nome: data.nome || null,
      papel: data.papel,
      senha_hash: hash,
    }).returning({ id: tenantUsuarios.id, email: tenantUsuarios.email, nome: tenantUsuarios.nome, papel: tenantUsuarios.papel, created_at: tenantUsuarios.created_at })
    return user
  },

  async alterarPapel(tenantId: number, usuarioId: number, papel: string): Promise<UsuarioPerfil> {
    const rows = await db.update(tenantUsuarios)
      .set({ papel })
      .where(and(eq(tenantUsuarios.id, usuarioId), eq(tenantUsuarios.tenant_id, tenantId)))
      .returning({ id: tenantUsuarios.id, email: tenantUsuarios.email, nome: tenantUsuarios.nome, papel: tenantUsuarios.papel, created_at: tenantUsuarios.created_at })
    if (!rows[0]) throw new NotFoundError('Usuário', String(usuarioId))
    return rows[0]
  },

  async remover(tenantId: number, usuarioId: number): Promise<void> {
    const deleted = await db.delete(tenantUsuarios)
      .where(and(eq(tenantUsuarios.id, usuarioId), eq(tenantUsuarios.tenant_id, tenantId)))
      .returning({ id: tenantUsuarios.id })
    if (deleted.length === 0) throw new NotFoundError('Usuário', String(usuarioId))
  },
}
