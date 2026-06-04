import { db } from './db/db.js'
import { tenants, tenantUsuarios } from './db/schema.js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function seed() {
  const rows = await db.select().from(tenants).where(eq(tenants.nome, 'Administrador')).limit(1)
  const existing = rows[0]
  if (existing) {
    console.log('Seed ja executado. Tenant admin existe.')
    return
  }

  const tenantRows = await db.insert(tenants).values({
    nome: 'Administrador',
    documento: '00000000000000',
    email_contato: 'admin@gestornfse.com',
    tipo: 'pj',
  }).returning()
  const tenant = tenantRows[0]

  const senha_hash = await bcrypt.hash('admin123', 10)
  await db.insert(tenantUsuarios).values({
    tenant_id: tenant.id,
    email: 'admin@gestornfse.com',
    senha_hash,
  })

  console.log('Seed concluido!')
  console.log(`  Tenant: ${tenant.nome} (documento: ${tenant.documento})`)
  console.log('  Email: admin@gestornfse.com')
  console.log('  Senha: admin123')
}

seed().catch(console.error)
