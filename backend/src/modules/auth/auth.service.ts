import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../db/db.js'
import { tenants, tenantUsuarios } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export const authService = {
  async login(email: string, senha: string) {
    const rows = await db.select().from(tenantUsuarios).where(eq(tenantUsuarios.email, email)).limit(1)
    const usuario = rows[0]
    if (!usuario) throw new Error('Email ou senha invalidos')
    const valida = await bcrypt.compare(senha, usuario.senha_hash)
    if (!valida) throw new Error('Email ou senha invalidos')
    const token = jwt.sign(
      { tenantId: usuario.tenant_id, usuarioId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '24h' },
    )
    return { token, tenant_id: usuario.tenant_id, email: usuario.email }
  },

  async cadastrarTenant(nome: string, slug: string, email: string, senha: string) {
    const senha_hash = await bcrypt.hash(senha, 10)
    const tenantRows = await db.insert(tenants).values({ nome, slug }).returning()
    const tenant = tenantRows[0]
    const usuarioRows = await db.insert(tenantUsuarios).values({
      tenant_id: tenant.id,
      email,
      senha_hash,
    }).returning()
    const usuario = usuarioRows[0]
    const token = jwt.sign(
      { tenantId: tenant.id, usuarioId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '24h' },
    )
    return { token, tenant_id: tenant.id, email: usuario.email }
  },
}
