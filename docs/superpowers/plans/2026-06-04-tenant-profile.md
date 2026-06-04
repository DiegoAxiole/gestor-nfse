# Tenant Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand tenant registration and profile with PJ/PF support, address, phones, and UUID.

**Architecture:** New columns on `tenants` table (tipo, documento, uuid, endereco, telefones, audit). New `tenant.service.ts` with profile CRUD. Frontend `PerfilView` for profile editing. ViaCEP auto-fill on CEP blur.

**Tech Stack:** PostgreSQL, Drizzle ORM, Express, Zod, `cpf-cnpj-validator`, React 19, ViaCEP API

---

### Task 1: Install cpf-cnpj-validator dependency

**Files:**
- Modify: `backend/package.json`
- Run: `npm install`

- [ ] **Step 1: Install the package**

```bash
cd backend
npm install cpf-cnpj-validator
```

- [ ] **Step 2: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: add cpf-cnpj-validator for CPF/CNPJ math validation"
```

---

### Task 2: Update Drizzle schema — tenants table

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Modify the tenants table definition**

Replace the current `tenants` table with the new columns. Remove `slug`, add `uuid`, `tipo`, `documento`, `nome_fantasia`, `inscricao_estadual`, `email_contato`, `telefone_celular`, `whatsapp`, `telefone_fixo`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `updated_at`, `updated_by`.

```typescript
export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 36 }).notNull().unique().defaultRandom(),
  tipo: varchar('tipo', { length: 2 }).notNull().default('pj'),
  documento: varchar('documento', { length: 20 }).notNull().default('').unique(),
  nome: varchar('nome', { length: 255 }).notNull(),
  nome_fantasia: varchar('nome_fantasia', { length: 255 }),
  inscricao_estadual: varchar('inscricao_estadual', { length: 20 }),
  email_contato: varchar('email_contato', { length: 255 }).notNull().default(''),
  telefone_celular: varchar('telefone_celular', { length: 20 }),
  whatsapp: boolean('whatsapp').notNull().default(false),
  telefone_fixo: varchar('telefone_fixo', { length: 20 }),
  cep: varchar('cep', { length: 8 }),
  logradouro: varchar('logradouro', { length: 255 }),
  numero: varchar('numero', { length: 20 }),
  complemento: varchar('complemento', { length: 100 }),
  bairro: varchar('bairro', { length: 100 }),
  cidade: varchar('cidade', { length: 100 }),
  uf: varchar('uf', { length: 2 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  updated_by: integer('updated_by').references(() => tenantUsuarios.id),
})
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat: expand tenants table with PJ/PF, uuid, address, phone, audit fields"
```

---

### Task 3: Generate and apply migration

**Files:**
- Create: `backend/src/db/migrations/0002_<name>.sql`
- Run: `drizzle-kit generate` + `drizzle-kit migrate`

- [ ] **Step 1: Generate migration**

```bash
cd backend
npx drizzle-kit generate
```

This creates a new SQL file in `backend/src/db/migrations/`. Open the generated file and **add `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`** at the top before any `ALTER TABLE`.

- [ ] **Step 2: Edit the generated migration**

Insert this line at the very top of the new `.sql` file:
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

Also add instructions to migrate existing data:
```sql
-- Update existing tenants with email_contato from their admin user
UPDATE tenants SET
  documento = '00000000000000',
  email_contato = (SELECT email FROM tenant_usuarios WHERE tenant_usuarios.tenant_id = tenants.id LIMIT 1);
```

- [ ] **Step 3: Apply migration**

```bash
npx drizzle-kit migrate
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/migrations/
git commit -m "feat: migration for tenants table expansion"
```

---

### Task 4: Create tenant profile service

**Files:**
- Create: `backend/src/modules/auth/tenant.service.ts`

- [ ] **Step 1: Create tenant.service.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/tenant.service.ts
git commit -m "feat: create tenant profile service (get/update)"
```

---

### Task 5: Create tenant profile routes

**Files:**
- Create: `backend/src/modules/auth/tenant.routes.ts`

- [ ] **Step 1: Create tenant.routes.ts**

```typescript
import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { tenantService } from './tenant.service.js'
import { authMiddleware } from '../../shared/auth.middleware.js'

export function criarRouterTenant(): Router {
  const router = Router()

  router.use(authMiddleware)

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await tenantService.buscar(req.tenantId!)
      res.json(profile)
    } catch (err) { next(err) }
  })

  router.put('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tipo, documento, nome, uuid, ...updatable } = req.body
      const profile = await tenantService.atualizar(req.tenantId!, req.usuarioId!, updatable)
      res.json(profile)
    } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/tenant.routes.ts
git commit -m "feat: create tenant profile routes (GET/PUT /api/v1/tenant)"
```

---

### Task 6: Refactor auth service — remove slug, add PJ/PF fields

**Files:**
- Modify: `backend/src/modules/auth/auth.service.ts`

- [ ] **Step 1: Rewrite auth.service.ts**

Replace `cadastrarTenant` to accept `tipo`, `documento`, `nome` instead of `nome`, `slug`. Also keep `nome` as the tenant name. Auto-copy `email` to `email_contato`.

```typescript
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../db/db.js'
import { tenants, tenantUsuarios } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { ValidationError, ConflictError } from '../../shared/errors.js'
import { cpf, cnpj } from 'cpf-cnpj-validator'

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

  async cadastrarTenant(tipo: string, documento: string, nome: string, email: string, senha: string) {
    const docClean = documento.replace(/\D/g, '')
    if (tipo === 'pj' && !cnpj.isValid(docClean)) throw new ValidationError('CNPJ invalido')
    if (tipo === 'pf' && !cpf.isValid(docClean)) throw new ValidationError('CPF invalido')

    const docExiste = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.documento, docClean)).limit(1)
    if (docExiste.length > 0) throw new ConflictError('Documento ja esta cadastrado')

    const emailExiste = await db.select({ id: tenantUsuarios.id }).from(tenantUsuarios).where(eq(tenantUsuarios.email, email)).limit(1)
    if (emailExiste.length > 0) throw new ConflictError('Email ja esta cadastrado')

    const senha_hash = await bcrypt.hash(senha, 10)
    const tenantRows = await db.insert(tenants).values({
      tipo,
      documento: docClean,
      nome,
      email_contato: email,
    }).returning()
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/auth.service.ts
git commit -m "feat: refactor auth.service — remove slug, add PJ/PF cadastro with CPF/CNPJ validation"
```

---

### Task 7: Update auth routes — new cadastrar body

**Files:**
- Modify: `backend/src/modules/auth/auth.routes.ts`

- [ ] **Step 1: Rewrite auth.routes.ts**

```typescript
import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service.js'

export function criarRouterAuth(): Router {
  const router = Router()

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, senha } = req.body
      if (!email || !senha) {
        res.status(422).json({ detail: 'Email e senha sao obrigatorios' })
        return
      }
      const result = await authService.login(email, senha)
      res.json(result)
    } catch (err: any) {
      if (err.message === 'Email ou senha invalidos') {
        res.status(401).json({ detail: err.message })
        return
      }
      next(err)
    }
  })

  router.post('/cadastrar', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tipo, documento, nome, email, senha } = req.body
      if (!tipo || !documento || !nome || !email || !senha) {
        res.status(422).json({ detail: 'Tipo, documento, nome, email e senha sao obrigatorios' })
        return
      }
      const result = await authService.cadastrarTenant(tipo, documento, nome, email, senha)
      res.status(201).json(result)
    } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/auth/auth.routes.ts
git commit -m "feat: update auth routes — new cadastrar body (tipo, documento, nome)"
```

---

### Task 8: Mount tenant routes in app.ts

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Add tenant router import and mount**

Add import after line 17:
```typescript
import { criarRouterTenant } from './modules/auth/tenant.routes.js'
```

Add route mount after line 94 (after `prestadores`):
```typescript
router.use('/api/v1/tenant', criarRouterTenant())
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: mount tenant profile routes at /api/v1/tenant"
```

---

### Task 9: Update seed for new tenant schema

**Files:**
- Modify: `backend/src/seed.ts`

- [ ] **Step 1: Rewrite seed.ts**

```typescript
import { db } from './db/db.js'
import { tenants, tenantUsuarios } from './db/schema.js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function seed() {
  const existingUser = await db.select({ id: tenantUsuarios.id })
    .from(tenantUsuarios)
    .where(eq(tenantUsuarios.email, 'admin@gestornfse.com'))
    .limit(1)
  if (existingUser[0]) {
    console.log('Seed ja executado. Usuario admin existe.')
    return
  }

  const tenantRows = await db.insert(tenants).values({
    tipo: 'pj',
    documento: '00000000000000',
    nome: 'Administrador',
    email_contato: 'admin@gestornfse.com',
  }).returning()
  const tenant = tenantRows[0]

  const senha_hash = await bcrypt.hash('admin123', 10)
  await db.insert(tenantUsuarios).values({
    tenant_id: tenant.id,
    email: 'admin@gestornfse.com',
    senha_hash,
  })

  console.log('Seed concluido!')
  console.log(`  Tenant: ${tenant.nome}`)
  console.log('  Email: admin@gestornfse.com')
  console.log('  Senha: admin123')
}

seed().catch(console.error)
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/seed.ts
git commit -m "feat: update seed for new tenant schema (remove slug)"
```

---

### Task 10: Backend typecheck

- [ ] **Step 1: Run typecheck**

```bash
cd backend && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Fix any type errors found**

- [ ] **Step 3: Run build**

```bash
cd backend && npm run build
```

Expected: 0 errors.

- [ ] **Step 4: Commit fixes**

```bash
git add -A && git commit -m "fix: typecheck and build after schema changes"
```

---

### Task 11: Add TenantProfile type to frontend

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add TenantProfile interface**

```typescript
export interface TenantProfile {
  uuid: string
  tipo: 'pj' | 'pf'
  documento: string
  nome: string
  nome_fantasia?: string
  inscricao_estadual?: string
  email_contato: string
  telefone_celular?: string
  whatsapp: boolean
  telefone_fixo?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add TenantProfile interface"
```

---

### Task 12: Update AuthContext — new cadastrar signature

**Files:**
- Modify: `frontend/src/auth/AuthContext.tsx`

- [ ] **Step 1: Update AuthContextType interface and cadastrar function**

Change `cadastrar` signature from `(nome, slug, email, senha)` to `(tipo, documento, nome, email, senha)`.

```typescript
interface AuthContextType {
  auth: AuthState | null
  login: (email: string, senha: string) => Promise<void>
  cadastrar: (tipo: string, documento: string, nome: string, email: string, senha: string) => Promise<void>
  logout: () => void
}
```

Update the `cadastrar` function body:
```typescript
const cadastrar = async (tipo: string, documento: string, nome: string, email: string, senha: string) => {
  const res = await fetch(`${BASE}/auth/cadastrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, documento, nome, email, senha }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Erro no cadastro' }))
    throw new Error(body.detail)
  }
  const data = await res.json()
  const payload = decodePayload(data.token)
  if (!payload) throw new Error('Token invalido')
  const authData = { token: data.token, ...payload }
  localStorage.setItem('token', data.token)
  setAuth(authData)
  navigate('/')
}
```

Also add a `primeiro_acesso` flag to the response flow — the JWT now includes `primeiroAcesso: true` for newly registered tenants. But for simplicity, we can just redirect to `/perfil` on first load. Add this after `setAuth`:
```typescript
  // Redirect to profile on first access
  navigate('/perfil')
```

Actually, use the simpler approach: always redirect to `/perfil` after cadastro in the API return. Let's add `primeiro_acesso` claim to the JWT:

Update `auth.service.ts` JWT sign to include `primeiroAcesso: true`:
```typescript
const token = jwt.sign(
  { tenantId: tenant.id, usuarioId: usuario.id, email: usuario.email, primeiroAcesso: true },
  JWT_SECRET,
  { expiresIn: '24h' },
)
```

And on login, don't include `primeiroAcesso`. The cadastrar route returns it, and the AuthContext can use it to redirect:
```typescript
const cadastrar = async (tipo: string, documento: string, nome: string, email: string, senha: string) => {
  // ... fetch + parse
  localStorage.setItem('token', data.token)
  setAuth(authData)
  navigate(data.primeiroAcesso ? '/perfil' : '/')
}
```

But since `data` from the API is `{ token, tenant_id, email }`, we need to also return `primeiroAcesso`. Let's add it:

In `auth.service.ts`:
```typescript
return { token, tenant_id: tenant.id, email: usuario.email, primeiroAcesso: true }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/auth/AuthContext.tsx backend/src/modules/auth/auth.service.ts
git commit -m "feat: update AuthContext — new cadastrar signature (tipo, documento)"
```

---

### Task 13: Add tenant profile API functions

**Files:**
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Add fetchTenantProfile and updateTenantProfile**

After the `fetchEmpresas` function:
```typescript
import type { TenantProfile } from './types'
```

Add:
```typescript
export async function fetchTenantProfile(): Promise<TenantProfile> {
  return requestJson('/tenant')
}

export async function updateTenantProfile(data: Partial<TenantProfile>): Promise<TenantProfile> {
  return requestJson('/tenant', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat: add tenant profile API functions (fetch + update)"
```

---

### Task 14: Create PerfilView page

**Files:**
- Create: `frontend/src/pages/PerfilView.tsx`

- [ ] **Step 1: Create PerfilView.tsx**

```tsx
import { useState, useEffect, type FormEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import { User, Save, AlertCircle, CheckCircle } from 'lucide-react'
import { fetchTenantProfile, updateTenantProfile } from '../api'
import type { TenantProfile, OutletContext } from '../types'

export default function PerfilView() {
  const { onNavigate } = useOutletContext<OutletContext>()
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [emailContato, setEmailContato] = useState('')
  const [telefoneCelular, setTelefoneCelular] = useState('')
  const [whatsapp, setWhatsapp] = useState(false)
  const [telefoneFixo, setTelefoneFixo] = useState('')
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')

  useEffect(() => {
    fetchTenantProfile().then(p => {
      setProfile(p)
      setEmailContato(p.email_contato)
      setTelefoneCelular(p.telefone_celular || '')
      setWhatsapp(p.whatsapp)
      setTelefoneFixo(p.telefone_fixo || '')
      setCep(p.cep || '')
      setLogradouro(p.logradouro || '')
      setNumero(p.numero || '')
      setComplemento(p.complemento || '')
      setBairro(p.bairro || '')
      setCidade(p.cidade || '')
      setUf(p.uf || '')
    }).catch(err => setError(err.message))
    .finally(() => setLoading(false))
  }, [])

  const handleCepBlur = async () => {
    const cepClean = cep.replace(/\D/g, '')
    if (cepClean.length !== 8) return
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return
      const data = await res.json()
      if (data.erro) return
      setLogradouro(data.logradouro || '')
      setBairro(data.bairro || '')
      setCidade(data.localidade || '')
      setUf(data.uf || '')
    } catch {
      // ViaCEP unavailable — fields remain free for manual input
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await updateTenantProfile({
        email_contato: emailContato,
        telefone_celular: telefoneCelular.replace(/\D/g, '') || undefined,
        whatsapp,
        telefone_fixo: telefoneFixo.replace(/\D/g, '') || undefined,
        cep: cep.replace(/\D/g, '') || undefined,
        logradouro: logradouro || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        bairro: bairro || undefined,
        cidade: cidade || undefined,
        uf: uf || undefined,
      })
      setSuccess('Perfil atualizado com sucesso!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!profile) {
    return <div className="text-red-400 text-sm">Erro ao carregar perfil</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <User className="w-6 h-6 text-indigo-400" />
        <h1 className="text-xl font-bold text-white">Perfil da Conta</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tipo</span>
            <p className="text-white text-sm mt-1">{profile.tipo === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Documento</span>
            <p className="text-white text-sm mt-1">{profile.documento}</p>
          </div>
          <div className="col-span-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nome</span>
            <p className="text-white text-sm mt-1">{profile.nome}</p>
          </div>
          {profile.tipo === 'pj' && profile.nome_fantasia && (
            <div className="col-span-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nome Fantasia</span>
              <p className="text-white text-sm mt-1">{profile.nome_fantasia}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-900/50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-900/50 rounded-lg p-3">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email de Contato *</label>
            <input type="email" value={emailContato} onChange={e => setEmailContato(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Celular</label>
              <input type="text" value={telefoneCelular} onChange={e => setTelefoneCelular(e.target.value.replace(/\D/g, '').slice(0, 11))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="11999999999" maxLength={11} />
            </div>
            <div className="space-y-1.5 flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/50" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">WhatsApp</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Telefone Fixo</label>
            <input type="text" value={telefoneFixo} onChange={e => setTelefoneFixo(e.target.value.replace(/\D/g, '').slice(0, 10))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="1122223333" maxLength={10} />
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Endereço</h2>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">CEP</label>
              <input type="text" value={cep} onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} onBlur={handleCepBlur} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="01310100" maxLength={8} />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Logradouro</label>
                <input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Número</label>
                <input type="text" value={numero} onChange={e => setNumero(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
            </div>

            <div className="space-y-1.5 mt-4">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Complemento</label>
              <input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Bairro</label>
                <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cidade</label>
                <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">UF</label>
                <input type="text" value={uf} onChange={e => setUf(e.target.value.toUpperCase().slice(0, 2))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="SP" maxLength={2} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-6">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Perfil'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/PerfilView.tsx
git commit -m "feat: create PerfilView with address/phone forms and ViaCEP integration"
```

---

### Task 15: Add /perfil route to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add PerfilView import and route**

```typescript
import PerfilView from './pages/PerfilView'
```

Add inside the ProtectedRoute group:
```typescript
<Route path="perfil" element={<PerfilView />} />
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add /perfil route to App"
```

---

### Task 16: Update CadastroPage — remove slug, add tipo/documento

**Files:**
- Modify: `frontend/src/auth/CadastroPage.tsx`

- [ ] **Step 1: Rewrite CadastroPage**

```tsx
import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

export default function CadastroPage() {
  const { cadastrar } = useAuth()
  const [tipo, setTipo] = useState<'pj' | 'pf'>('pj')
  const [documento, setDocumento] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await cadastrar(tipo, documento.replace(/\D/g, ''), nome, email, senha)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-md bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/10">
            <span className="text-white text-sm font-bold">NFSe</span>
          </div>
          <span className="text-lg font-bold text-white">Gestor NFSe</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-xl">
          <h1 className="text-sm font-bold text-white text-center">Criar Conta</h1>

          {error && (
            <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-950/50 border border-rose-900/50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-4">
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-xs font-bold uppercase tracking-wider ${tipo === 'pj' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
              <input type="radio" name="tipo" value="pj" checked={tipo === 'pj'} onChange={() => { setTipo('pj'); setDocumento('') }} className="sr-only" />
              PJ
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all text-xs font-bold uppercase tracking-wider ${tipo === 'pf' ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
              <input type="radio" name="tipo" value="pf" checked={tipo === 'pf'} onChange={() => { setTipo('pf'); setDocumento('') }} className="sr-only" />
              PF
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{tipo === 'pj' ? 'CNPJ' : 'CPF'}</label>
            <input type="text" value={documento} onChange={e => setDocumento(e.target.value.replace(/\D/g, '').slice(0, tipo === 'pj' ? 14 : 11))} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder={tipo === 'pj' ? '00.000.000/0001-00' : '000.000.000-00'} required maxLength={tipo === 'pj' ? 14 : 11} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{tipo === 'pj' ? 'Razão Social' : 'Nome Completo'}</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder={tipo === 'pj' ? 'Empresa Exemplo Ltda' : 'João da Silva'} required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="seu@email.com" required />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer">
            {loading ? 'Criando...' : 'Criar Conta'}
          </button>

          <p className="text-center text-[11px] text-slate-500">
            Ja tem conta?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/auth/CadastroPage.tsx
git commit -m "feat: update CadastroPage — remove slug, add PJ/PF toggle and document input"
```

---

### Task 17: Frontend typecheck and build

- [ ] **Step 1: Run typecheck**

```bash
cd frontend && npm run lint
```

Expected: 0 errors.

- [ ] **Step 2: Fix any type errors found**

- [ ] **Step 3: Run build**

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: typecheck and build after tenant profile frontend"
```

---

### Task 18: Integration test

- [ ] **Step 1: Restart backend**

```bash
# Kill existing processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force 2>$null

# Start backend
$env:DATABASE_URL = "postgresql://postgres.ezechzescmczbgejctwr:w6z1r8986225@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"
cd backend
Start-Process powershell -WindowStyle Normal -ArgumentList "-NoExit", "-Command", "`$env:DATABASE_URL='postgresql://postgres.ezechzescmczbgejctwr:w6z1r8986225@aws-1-sa-east-1.pooler.supabase.com:6543/postgres'; cd 'C:\Laboratorio\gestor_nfse\backend'; npm run dev"
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx drizzle-kit migrate
```

- [ ] **Step 3: Run seed**

```bash
cd backend
npm run seed
```

- [ ] **Step 4: Test health + cadastro + perfil**

```bash
# Test health
curl -s http://localhost:8001/health

# Test cadastro
curl -s -X POST http://localhost:8001/api/v1/auth/cadastrar \
  -H "Content-Type: application/json" \
  -d '{"tipo":"pj","documento":"12345678000199","nome":"Empresa Teste","email":"teste@teste.com","senha":"123456"}'

# Test GET tenant (replace token)
curl -s http://localhost:8001/api/v1/tenant \
  -H "Authorization: Bearer <TOKEN>"

# Test PUT tenant
curl -s -X PUT http://localhost:8001/api/v1/tenant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"email_contato":"contato@teste.com","telefone_celular":"11999999999","whatsapp":true}'
```

- [ ] **Step 5: Start frontend**

```bash
cd frontend
Start-Process powershell -WindowStyle Normal -ArgumentList "-NoExit", "-Command", "cd 'C:\Laboratorio\gestor_nfse\frontend'; npm run dev"
```

- [ ] **Step 6: Confirm frontend opens at http://localhost:3000 and cadastro + perfil pages work**

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A && git commit -m "fix: integration adjustments after tenant profile implementation"
```
