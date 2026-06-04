import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../db/db.js'
import { tenants, tenantUsuarios } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { ConflictError } from '../../shared/errors.js'
import { carregarConfig } from '../../config.js'

const { jwtSecret } = carregarConfig()

export const authService = {
  async login(email: string, senha: string) {
    const rows = await db.select().from(tenantUsuarios).where(eq(tenantUsuarios.email, email.toLowerCase())).limit(1)
    const usuario = rows[0]
    if (!usuario) throw new Error('Credenciais inválidas')
    const valida = await bcrypt.compare(senha, usuario.senha_hash)
    if (!valida) throw new Error('Credenciais inválidas')
    const token = jwt.sign(
      { tenantId: usuario.tenant_id, usuarioId: usuario.id, email: usuario.email },
      jwtSecret,
      { expiresIn: '24h' },
    )
    return { token, usuario: { id: usuario.id, email: usuario.email } }
  },

  async cadastrarTenant(data: {
    tipo: string
    documento: string
    nome: string
    nome_fantasia?: string
    email: string
    senha: string
  }) {
    const documentoLimpo = data.documento.replace(/\D/g, '')
    const docExistente = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.documento, documentoLimpo)).limit(1)
    if (docExistente.length > 0) throw new ConflictError('CNPJ/CPF já cadastrado')

    const emailExistente = await db.select({ id: tenantUsuarios.id }).from(tenantUsuarios).where(eq(tenantUsuarios.email, data.email)).limit(1)
    if (emailExistente.length > 0) throw new ConflictError('Email já cadastrado')

    const hash = await bcrypt.hash(data.senha, 10)
    const [novoTenant] = await db.insert(tenants).values({
      tipo: data.tipo,
      documento: documentoLimpo,
      nome: data.nome,
      nome_fantasia: data.nome_fantasia || null,
      email_contato: data.email,
    }).returning({ id: tenants.id, uuid: tenants.uuid, tipo: tenants.tipo, documento: tenants.documento, nome: tenants.nome })

    await db.insert(tenantUsuarios).values({
      tenant_id: novoTenant.id,
      email: data.email,
      senha_hash: hash,
    })

    const token = jwt.sign(
      { tenantId: novoTenant.id, email: data.email },
      jwtSecret,
      { expiresIn: '24h' },
    )

    return {
      token,
      tenant: {
        id: novoTenant.id,
        uuid: novoTenant.uuid,
        tipo: novoTenant.tipo,
        documento: novoTenant.documento,
        nome: novoTenant.nome,
      },
    }
  },
}
