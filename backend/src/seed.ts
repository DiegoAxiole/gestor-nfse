import { db } from './db/db.js'
import { tenants, tenantUsuarios, subscriptions } from './db/schema.js'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function seed() {
  await sql`TRUNCATE subscriptions, tenant_usuarios, tenants RESTART IDENTITY CASCADE`

  const trialFim = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const [tenant] = await db.insert(tenants).values({
    nome: 'Administrador',
    documento: '00000000000000',
    email_contato: 'admin@gestornfse.com',
    tipo: 'pj',
  }).returning()

  await db.insert(subscriptions).values({
    tenant_id: tenant.id,
    plano: 'trial',
    status: 'trialing',
    trial_fim: trialFim,
    periodo_fim: trialFim,
  })

  const senha_hash = await bcrypt.hash('admin123', 10)
  await db.insert(tenantUsuarios).values({
    tenant_id: tenant.id,
    email: 'admin@gestornfse.com',
    nome: 'Administrador',
    senha_hash,
    papel: 'admin',
  })

  console.log('Seed concluido!')
  console.log(`  Tenant: ${tenant.nome} (documento: ${tenant.documento})`)
  console.log('  Email: admin@gestornfse.com')
  console.log('  Senha: admin123')
}

seed().catch(console.error)
