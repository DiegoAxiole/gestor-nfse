# PostgreSQL + Multi-Tenant + Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from SQLite to PostgreSQL (Supabase), add multi-tenant isolation with JWT auth, and deploy on Render.

**Architecture:** Express server on Render, PostgreSQL on Supabase. Auth with bcrypt + JWT (no Supabase Auth SDK). All tables include `tenant_id` column. JWT middleware extracts `tenant_id` and injects into `req`. Every repository query filters by `tenant_id`.

**Tech Stack:** Drizzle ORM (pg), `pg` driver, `bcryptjs`, `jsonwebtoken`, Supabase PostgreSQL, Render Web Service.

---

## File Map

### Files to create:
- `backend/src/modules/auth/auth.routes.ts` — login + cadastro endpoints
- `backend/src/modules/auth/auth.service.ts` — bcrypt hash/compare, JWT sign/verify
- `backend/src/shared/auth.middleware.ts` — JWT verification middleware
- `backend/src/seed.ts` — seed initial tenant + admin user
- `backend/render.yaml` — Render deploy configuration

### Files to rewrite:
- `backend/src/db/schema.ts` — PostgreSQL schema + tenant_id in all tables
- `backend/src/db/db.ts` — pg driver (async) instead of better-sqlite3
- `backend/src/config.ts` — env vars instead of TOML parser
- `backend/drizzle.config.ts` — dialect: postgresql

### Files to modify:
- `backend/src/app.ts` — add auth routes, middleware, fix SQLite-specific queries
- `backend/package.json` — add/remove dependencies, add db:migrate script
- `backend/src/modules/prestadores/prestadores.repository.ts` — add tenant_id filter
- `backend/src/modules/prestadores/prestadores.service.ts` — add tenant_id param
- `backend/src/modules/prestadores/prestadores.controller.ts` — pass tenant_id
- `backend/src/modules/prestadores/prestadores.routes.ts` — add auth middleware
- `backend/src/modules/config/config.repository.ts` — add tenant_id filter
- `backend/src/modules/config/config.routes.ts` — add auth middleware
- `backend/src/modules/distribuicao/distribuicao.repository.ts` — add tenant_id
- `backend/src/modules/distribuicao/distribuicao.routes.ts` — add auth middleware
- `backend/src/modules/documentos/documentos.repository.ts` — add tenant_id
- `backend/src/modules/documentos/documentos.routes.ts` — add auth middleware
- `backend/src/modules/operacoes/operacoes.repository.ts` — add tenant_id
- `backend/src/modules/operacoes/operacoes.routes.ts` — add auth middleware
- `backend/src/modules/tasks/tasks.repository.ts` — add tenant_id
- `backend/src/modules/tasks/tasks.routes.ts` — add auth middleware
- `AGENTS.md` — update docs

---

### Task 1: Install new dependencies, remove old ones

**Files:** `backend/package.json`

- [ ] **Edit package.json — add pg, bcryptjs, jsonwebtoken; remove better-sqlite3**

Old package.json has:
```json
"dependencies": {
    "better-sqlite3": "^12.10.0",
    ...
}
```

Edit to:
```json
"dependencies": {
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.13.0",
    ...
}
```

Add scripts:
```json
"scripts": {
    ...
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    ...
}
```

Remove `"better-sqlite3"` from `dependencies` and `"@types/better-sqlite3"` from `devDependencies`. Add `"@types/bcryptjs"`, `"@types/jsonwebtoken"`, `"@types/pg"` to `devDependencies`.

- [ ] **Install and remove packages**

```bash
cd backend
npm install pg bcryptjs jsonwebtoken
npm install -D @types/pg @types/bcryptjs @types/jsonwebtoken
npm uninstall better-sqlite3 @types/better-sqlite3
```

- [ ] **Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: swap better-sqlite3 for pg + add auth deps"
```

---

### Task 2: Rewrite db.ts — PostgreSQL driver (async)

**File:** `backend/src/db/db.ts`

- [ ] **Rewrite db.ts entirely**

```typescript
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/pg'
import { Pool } from 'pg'
import * as schema from './schema.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/gestor_nfse',
})

export const db = drizzle(pool, { schema })

export async function closeDb() {
  await pool.end()
}
```

- [ ] **Commit**

```bash
git add backend/src/db/db.ts
git commit -m "refactor: swap better-sqlite3 for pg (async driver)"
```

---

### Task 3: Rewrite schema.ts — PostgreSQL + tenant_id

**File:** `backend/src/db/schema.ts`

- [ ] **Rewrite complete schema**

```typescript
import { pgTable, serial, varchar, text, integer, timestamp, boolean, bytea } from 'drizzle-orm/pg-core'

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  nome: varchar('nome', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const tenantUsuarios = pgTable('tenant_usuarios', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  senha_hash: varchar('senha_hash', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const prestadores = pgTable('prestadores', {
  cnpj: varchar('cnpj', { length: 14 }).primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  razao_social: varchar('razao_social', { length: 255 }).notNull(),
  ambiente: varchar('ambiente', { length: 20 }).notNull().default('Homologacao'),
  certificado_pfx: bytea('certificado_pfx'),
  certificado_senha: varchar('certificado_senha', { length: 255 }).notNull(),
  certificado_validade: varchar('certificado_validade', { length: 20 }).default(''),
  certificado_nome: varchar('certificado_nome', { length: 255 }).default(''),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const documentos = pgTable('documentos', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  chave_acesso: varchar('chave_acesso', { length: 44 }).notNull().unique(),
  prestador_cnpj: varchar('prestador_cnpj', { length: 14 }).notNull(),
  operacao_id: integer('operacao_id'),
  nsu: varchar('nsu', { length: 20 }).default(''),
  xml_nfse: text('xml_nfse').default(''),
  data_emissao: varchar('data_emissao', { length: 20 }),
  emissao_dh: varchar('emissao_dh', { length: 30 }),
  pdf_blob: bytea('pdf_blob'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const configuracoes = pgTable('configuracoes', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id).unique(),
  ambiente: varchar('ambiente', { length: 20 }).default('Homologacao'),
  codigo_municipio: integer('codigo_municipio').default(1001058),
  lgpd_ativo: boolean('lgpd_ativo').default(false),
  cnpj: varchar('cnpj', { length: 14 }).default(''),
  razao_social: varchar('razao_social', { length: 255 }).default(''),
  atualizada_em: timestamp('atualizada_em').defaultNow(),
})

export const operacoes = pgTable('operacoes', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  prestador_cnpj: varchar('prestador_cnpj', { length: 14 }).notNull(),
  tipo: varchar('tipo', { length: 20 }).default(''),
  nsu_consultado: varchar('nsu_consultado', { length: 20 }),
  ultimo_nsu: varchar('ultimo_nsu', { length: 20 }).default(''),
  status: varchar('status', { length: 30 }).default(''),
  qtd_documentos: integer('qtd_documentos').default(0),
  xml_request: text('xml_request'),
  xml_response: text('xml_response'),
  xml_erro: text('xml_erro'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const backgroundTasks = pgTable('background_tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  tipo: varchar('tipo', { length: 50 }).default(''),
  chave_acesso: varchar('chave_acesso', { length: 44 }),
  cnpj: varchar('cnpj', { length: 14 }),
  status: varchar('status', { length: 20 }).default('pending'),
  progresso: integer('progresso').default(0),
  mensagem: text('mensagem').default(''),
  resultado_json: text('resultado_json'),
  erro_texto: text('erro_texto'),
  criado_em: timestamp('criado_em').defaultNow().notNull(),
  atualizado_em: timestamp('atualizado_em').defaultNow().notNull(),
})

export const agendamentos = pgTable('agendamentos', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  prestador_cnpj: varchar('prestador_cnpj', { length: 14 }),
  tipo: varchar('tipo', { length: 30 }).default('consulta_distribuicao'),
  intervalo_minutos: integer('intervalo_minutos').default(60),
  ativo: boolean('ativo').default(true),
  ultima_execucao: timestamp('ultima_execucao'),
  proxima_execucao: timestamp('proxima_execucao'),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const automacaoLogs = pgTable('automacao_logs', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  prestador_cnpj: varchar('prestador_cnpj', { length: 14 }),
  tipo: varchar('tipo', { length: 30 }).default(''),
  mensagem: text('mensagem').default(''),
  created_at: timestamp('created_at').defaultNow().notNull(),
})
```

- [ ] **Commit**

```bash
git add backend/src/db/schema.ts
git commit -m "feat: PostgreSQL schema with multi-tenant (tenant_id on all tables)"
```

---

### Task 4: Update drizzle.config.ts — PostgreSQL dialect

**File:** `backend/drizzle.config.ts`

- [ ] **Rewrite drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/gestor_nfse',
  },
})
```

- [ ] **Commit**

```bash
git add backend/drizzle.config.ts
git commit -m "chore: update drizzle config for PostgreSQL dialect"
```

---

### Task 5: Rewrite config.ts — env vars instead of TOML

**File:** `backend/src/config.ts`

- [ ] **Rewrite config.ts**

```typescript
export interface AppConfig {
  ambiente: string
  codigo_municipio: number
  databaseUrl: string
  jwtSecret: string
}

export function carregarConfig(): AppConfig {
  const ambiente = process.env.AMBIENTE || 'Homologacao'
  if (!['Homologacao', 'Producao'].includes(ambiente)) {
    throw new Error(`Ambiente inválido: ${ambiente}. Use 'Homologacao' ou 'Producao'.`)
  }
  return {
    ambiente,
    codigo_municipio: Number(process.env.CODIGO_MUNICIPIO) || 1001058,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/gestor_nfse',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  }
}
```

- [ ] **Commit**

```bash
git add backend/src/config.ts
git commit -m "refactor: config reads from env vars instead of TOML"
```

---

### Task 6: Create auth module — middleware, service, routes, seed

**Files:**
- Create: `backend/src/shared/auth.middleware.ts`
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.routes.ts`
- Create: `backend/src/seed.ts`

- [ ] **Create auth.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export interface AuthPayload {
  tenantId: number
  usuarioId: number
  email: string
}

declare global {
  namespace Express {
    interface Request {
      tenantId?: number
      usuarioId?: number
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Token nao informado' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload
    req.tenantId = payload.tenantId
    req.usuarioId = payload.usuarioId
    next()
  } catch {
    res.status(401).json({ detail: 'Token invalido' })
  }
}
```

- [ ] **Create auth.service.ts**

```typescript
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../../db/db.js'
import { tenants, tenantUsuarios } from '../../db/schema.js'
import { eq } from 'drizzle-orm'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export const authService = {
  async login(email: string, senha: string) {
    const usuario = db.select().from(tenantUsuarios).where(eq(tenantUsuarios.email, email)).limit(1).then(r => r[0])
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
    const tenant = db.insert(tenants).values({ nome, slug }).returning().then(r => r[0])
    const usuario = db.insert(tenantUsuarios).values({
      tenant_id: tenant.id,
      email,
      senha_hash,
    }).returning().then(r => r[0])
    const token = jwt.sign(
      { tenantId: tenant.id, usuarioId: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: '24h' },
    )
    return { token, tenant_id: tenant.id, email: usuario.email }
  },
}
```

- [ ] **Create auth.routes.ts**

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
      const { nome, slug, email, senha } = req.body
      if (!nome || !slug || !email || !senha) {
        res.status(422).json({ detail: 'Nome, slug, email e senha sao obrigatorios' })
        return
      }
      const result = await authService.cadastrarTenant(nome, slug, email, senha)
      res.status(201).json(result)
    } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Create seed.ts — initial tenant + admin user**

```typescript
import { db } from './db/db.js'
import { tenants, tenantUsuarios } from './db/schema.js'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function seed() {
  const existing = await db.select().from(tenants).where(eq(tenants.slug, 'admin')).limit(1).then(r => r[0])
  if (existing) {
    console.log('Seed ja executado. Tenant admin existe.')
    return
  }

  const tenant = await db.insert(tenants).values({
    nome: 'Administrador',
    slug: 'admin',
  }).returning().then(r => r[0])

  const senha_hash = await bcrypt.hash('admin123', 10)
  await db.insert(tenantUsuarios).values({
    tenant_id: tenant.id,
    email: 'admin@gestornfse.com',
    senha_hash,
  })

  console.log('Seed concluido!')
  console.log(`  Tenant: ${tenant.nome} (slug: ${tenant.slug})`)
  console.log('  Email: admin@gestornfse.com')
  console.log('  Senha: admin123')
}

seed().catch(console.error)
```

- [ ] **Commit**

```bash
git add backend/src/shared/auth.middleware.ts backend/src/modules/auth/ backend/src/seed.ts
git commit -m "feat: add JWT auth module (login, cadastro, middleware, seed)"
```

---

### Task 7: Update app.ts — add auth routes, middleware, fix SQLite queries

**File:** `backend/src/app.ts`

- [ ] **Edit app.ts — add auth imports and routes**

Add imports at top:
```typescript
import { criarRouterAuth } from './modules/auth/auth.routes.js'
import { authMiddleware } from './shared/auth.middleware.js'
```

Update the `createApp` function signature — remove `configPath` param:
```typescript
export async function createApp() {
  const config = carregarConfig()
```

Remove TOML config file reading logic — config now comes from env vars:
```typescript
const config = carregarConfig()
// No TOML file reading needed
```

Add auth route BEFORE protected routes:
```typescript
router.use('/api/v1/auth', criarRouterAuth())
```

Fix the SQLite-specific `datetime()` calls. Change:
```typescript
sql`atualizado_em < datetime('now', '-24 hours')`
```
To:
```typescript
sql`atualizado_em < NOW() - INTERVAL '24 hours'`
```

Also add authMiddleware to all protected route groups:
```typescript
router.use('/api/v1/prestadores', authMiddleware, criarRouterPrestadores(config.codigo_municipio))
router.use('/api/v1/config', authMiddleware, criarRouterConfig())
router.use('/api/v1/distribuicao', authMiddleware, criarRouterDistribuicao(config.codigo_municipio))
router.use('/api/v1/documentos', authMiddleware, criarRouterDocumentos())
router.use('/api/v1/operacoes', authMiddleware, criarRouterOperacoes())
router.use('/api/v1/tasks', authMiddleware, criarRouterTasks())
```

Remove the `configPath` parameter from `createApp`:
```typescript
export async function createApp() {
```

- [ ] **Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: add auth routes + middleware to app; fix SQLite queries for PG"
```

---

### Task 8: Update prestadores module — tenant_id filter + auth

**Files:**
- Modify: `backend/src/modules/prestadores/prestadores.repository.ts`
- Modify: `backend/src/modules/prestadores/prestadores.service.ts`
- Modify: `backend/src/modules/prestadores/prestadores.controller.ts`
- Modify: `backend/src/modules/prestadores/prestadores.routes.ts`

- [ ] **Edit prestadores.repository.ts — add tenant_id filter to all queries**

The repository functions need a `tenantId` parameter. Drizzle ORM with pg uses async queries (no `.get()`, use `await` + array destructuring).

```typescript
import { db } from '../../db/db.js'
import { prestadores } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export type PrestadorRow = {
  cnpj: string
  razao_social: string
  ambiente: string
  certificado_validade: string | null
  certificado_nome: string | null
  certificado_pfx: Buffer | null
  certificado_senha: string
}

export const prestadorRepository = {
  async listar(tenantId: number) {
    return db.select({
      cnpj: prestadores.cnpj,
      razao_social: prestadores.razao_social,
      ambiente: prestadores.ambiente,
      certificado_validade: prestadores.certificado_validade,
      certificado_nome: prestadores.certificado_nome,
    })
      .from(prestadores)
      .where(eq(prestadores.tenant_id, tenantId))
      .orderBy(prestadores.razao_social)
  },

  async buscar(cnpj: string, tenantId: number) {
    const rows = await db.select().from(prestadores)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },

  async criar(data: {
    cnpj: string
    tenant_id: number
    razao_social: string
    ambiente: string
    certificado_pfx: Buffer
    certificado_senha: string
    certificado_nome: string
  }) {
    const rows = await db.insert(prestadores).values(data).returning({
      cnpj: prestadores.cnpj,
      razao_social: prestadores.razao_social,
      ambiente: prestadores.ambiente,
      certificado_validade: prestadores.certificado_validade,
      certificado_nome: prestadores.certificado_nome,
    })
    return rows[0]
  },

  async atualizar(cnpj: string, tenantId: number, data: Partial<Pick<PrestadorRow, 'razao_social' | 'ambiente' | 'certificado_pfx' | 'certificado_senha' | 'certificado_nome'>>) {
    const rows = await db.update(prestadores)
      .set(data)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
      .returning()
    return rows[0]
  },

  async remover(cnpj: string, tenantId: number) {
    await db.delete(prestadores)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
  },
}
```

- [ ] **Edit prestadores.service.ts — accept and pass tenantId**

```typescript
import { prestadorRepository } from './prestadores.repository.js'
import { validarCNPJ } from '../../validators.js'
import { NotFoundError, ValidationError } from '../../shared/errors.js'

export const prestadorService = {
  async listar(codigoMunicipio: number, tenantId: number) {
    return prestadorRepository.listar(tenantId)
  },

  async cadastrar(data: any, certificadoPfx: Buffer, nomeCert: string, codigoMunicipio: number, tenantId: number) {
    if (!validarCNPJ(data.cnpj)) throw new ValidationError('CNPJ invalido')
    const result = await prestadorRepository.criar({
      cnpj: data.cnpj,
      tenant_id: tenantId,
      razao_social: data.razao_social,
      ambiente: data.ambiente,
      certificado_pfx: certificadoPfx,
      certificado_senha: data.certificado_senha,
      certificado_nome: nomeCert,
    })
    return result
  },

  async buscar(cnpj: string, codigoMunicipio: number, tenantId: number) {
    const prestador = await prestadorRepository.buscar(cnpj, tenantId)
    if (!prestador) throw new NotFoundError('Prestador nao encontrado')
    return prestador
  },

  async atualizar(cnpj: string, data: any, certificadoPfx: Buffer | undefined, nomeCert: string | undefined, codigoMunicipio: number, tenantId: number) {
    if (!validarCNPJ(cnpj)) throw new ValidationError('CNPJ invalido')
    const updateData: any = { ...data }
    if (certificadoPfx) updateData.certificado_pfx = certificadoPfx
    if (nomeCert) updateData.certificado_nome = nomeCert
    const result = await prestadorRepository.atualizar(cnpj, tenantId, updateData)
    if (!result) throw new NotFoundError('Prestador nao encontrado')
    return result
  },

  async remover(cnpj: string, tenantId: number) {
    await prestadorRepository.remover(cnpj, tenantId)
  },

  async uploadCertificado(certificadoPfx: Buffer, senha: string, cnpj: string | undefined, tenantId: number) {
    if (!cnpj) {
      return { valido: true, mensagem: 'Certificado validado (sem CNPJ para vincular)' }
    }
    const prestador = await prestadorRepository.buscar(cnpj, tenantId)
    if (!prestador) throw new NotFoundError('Prestador nao encontrado')
    await prestadorRepository.atualizar(cnpj, tenantId, {
      certificado_pfx: certificadoPfx,
      certificado_senha: senha,
    })
    return { valido: true, mensagem: 'Certificado atualizado com sucesso' }
  },
}
```

- [ ] **Edit prestadores.controller.ts — pass tenantId from req**

```typescript
import type { Request, Response, NextFunction } from 'express'
import type { ZodIssue } from 'zod'
import { prestadorService } from './prestadores.service.js'
import { CadastrarPrestadorSchema, AtualizarPrestadorSchema, UploadCertificadoSchema } from './prestadores.dto.js'
import { ValidationError } from '../../shared/errors.js'

export function criarController(codigoMunicipio: number) {
  return {
    async listar(req: Request, res: Response, next: NextFunction) {
      try {
        const result = await prestadorService.listar(codigoMunicipio, req.tenantId!)
        res.json(result)
      } catch (err) { next(err) }
    },

    async cadastrar(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = CadastrarPrestadorSchema.safeParse(req.body)
        if (!parsed.success) throw new ValidationError(parsed.error.issues.map((e: ZodIssue) => e.message).join('; '))

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
        const file = files?.['certificado_pfx']?.[0]
        if (!file) throw new ValidationError('certificado_pfx é obrigatorio')

        const nomeCert = req.body.certificado_nome || file.originalname || ''
        const result = await prestadorService.cadastrar(parsed.data, file.buffer, nomeCert, codigoMunicipio, req.tenantId!)
        res.status(201).json(result)
      } catch (err) { next(err) }
    },

    async buscar(req: Request, res: Response, next: NextFunction) {
      try {
        const result = await prestadorService.buscar(req.params.cnpj, codigoMunicipio, req.tenantId!)
        res.json(result)
      } catch (err) { next(err) }
    },

    async atualizar(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = AtualizarPrestadorSchema.safeParse(req.body)
        if (!parsed.success) throw new ValidationError(parsed.error.issues.map((e: ZodIssue) => e.message).join('; '))

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
        const file = files?.['certificado_pfx']?.[0]
        const result = await prestadorService.atualizar(
          req.params.cnpj,
          parsed.data,
          file?.buffer,
          req.body.certificado_nome || file?.originalname,
          codigoMunicipio,
          req.tenantId!,
        )
        res.json(result)
      } catch (err) { next(err) }
    },

    async remover(req: Request, res: Response, next: NextFunction) {
      try {
        await prestadorService.remover(req.params.cnpj, req.tenantId!)
        res.json({ ok: true })
      } catch (err) { next(err) }
    },

    async uploadCertificado(req: Request, res: Response, next: NextFunction) {
      try {
        const parsed = UploadCertificadoSchema.safeParse(req.body)
        if (!parsed.success) throw new ValidationError(parsed.error.issues.map((e: ZodIssue) => e.message).join('; '))

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
        const file = files?.['certificado_pfx']?.[0]
        if (!file) throw new ValidationError('certificado_pfx é obrigatorio')

        const result = await prestadorService.uploadCertificado(file.buffer, parsed.data.senha, parsed.data.cnpj, req.tenantId!)
        res.json(result)
      } catch (err) { next(err) }
    },
  }
}
```

The `.dto.ts` file needs no changes. The `.routes.ts` file also needs no changes (auth middleware is applied at app.ts level).

- [ ] **Commit**

```bash
git add backend/src/modules/prestadores/
git commit -m "feat: add tenant_id filter to prestadores module"
```

---

### Task 9: Update config module — tenant_id filter

**Files:**
- Modify: `backend/src/modules/config/config.repository.ts`
- Modify: `backend/src/modules/config/config.routes.ts`

- [ ] **Edit config.repository.ts — add tenant_id**

```typescript
import { db } from '../../db/db.js'
import { configuracoes } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export const configRepository = {
  buscar(tenantId: number) {
    return db.select().from(configuracoes)
      .where(eq(configuracoes.tenant_id, tenantId))
      .limit(1)
      .then(r => r[0])
  },

  async atualizar(tenantId: number, dados: Partial<typeof configuracoes.$inferInsert>) {
    const existing = await db.select({ id: configuracoes.id }).from(configuracoes)
      .where(eq(configuracoes.tenant_id, tenantId))
      .limit(1)
      .then(r => r[0])

    if (existing) {
      await db.update(configuracoes)
        .set({ ...dados, atualizada_em: new Date() })
        .where(eq(configuracoes.id, existing.id))
    } else {
      await db.insert(configuracoes).values({
        tenant_id: tenantId,
        ...dados,
      } as any)
    }
  },
}
```

- [ ] **Edit config.routes.ts — add tenantId from req**

Add `tenantId` extraction:
```typescript
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await configRepository.buscar(req.tenantId!)
      // ... rest
```

```typescript
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // ... validation ...
      await configRepository.atualizar(req.tenantId!, dados)
      const row = await configRepository.buscar(req.tenantId!)
      // ... rest
```

- [ ] **Commit**

```bash
git add backend/src/modules/config/
git commit -m "feat: add tenant_id filter to config module"
```

---

### Task 10: Update distribuicao module — tenant_id filter

**Files:**
- Modify: `backend/src/modules/distribuicao/distribuicao.repository.ts`
- Modify: `backend/src/modules/distribuicao/distribuicao.routes.ts`

- [ ] **Edit distribuicao.repository.ts — add tenant_id to all queries**

All queries need `and(eq(table.tenant_id, tenantId), ...existingFilters...)`.

```typescript
import { db } from '../../db/db.js'
import { operacoes, backgroundTasks, prestadores, documentos } from '../../db/schema.js'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'

export const distribuicaoRepository = {
  async buscarUltimoNsu(cnpj: string, tenantId: number): Promise<string> {
    const rows = await db.select({ ultimo_nsu: operacoes.ultimo_nsu })
      .from(operacoes)
      .where(and(
        eq(operacoes.prestador_cnpj, cnpj),
        eq(operacoes.tenant_id, tenantId),
        sql`${operacoes.status} IN ('DOCUMENTOS_LOCALIZADOS', 'SUCESSO', '')`,
      ))
      .orderBy(desc(operacoes.id))
      .limit(1)
    return rows[0]?.ultimo_nsu ?? '000000000000000'
  },

  async consultaAtiva(cnpj: string, tenantId: number) {
    const rows = await db.select({ id: backgroundTasks.id })
      .from(backgroundTasks)
      .where(and(
        eq(backgroundTasks.tipo, 'consulta_distribuicao'),
        eq(backgroundTasks.tenant_id, tenantId),
        inArray(backgroundTasks.status, ['pending', 'processing']),
        eq(backgroundTasks.cnpj, cnpj),
      ))
      .orderBy(desc(backgroundTasks.criado_em))
      .limit(1)
    return rows[0]
  },

  async criarTask(taskId: string, cnpj: string, chaveAcesso: string, tenantId: number) {
    await db.insert(backgroundTasks).values({
      id: taskId,
      tenant_id: tenantId,
      tipo: 'consulta_distribuicao',
      chave_acesso: chaveAcesso,
      cnpj,
      status: 'pending',
      progresso: 0,
      mensagem: 'Iniciando...',
    })
  },

  async atualizarTask(taskId: string, data: { status?: string; progresso?: number; mensagem?: string; erro_texto?: string; resultado_json?: string }) {
    const setData: Record<string, any> = {}
    if (data.status !== undefined) setData.status = data.status
    if (data.progresso !== undefined) setData.progresso = data.progresso
    if (data.mensagem !== undefined) setData.mensagem = data.mensagem
    if (data.resultado_json !== undefined) setData.resultado_json = data.resultado_json
    if (data.erro_texto !== undefined) setData.erro_texto = data.erro_texto
    setData.atualizado_em = new Date()
    await db.update(backgroundTasks).set(setData).where(eq(backgroundTasks.id, taskId))
  },

  async buscarPrestadorCompleto(cnpj: string, tenantId: number) {
    const rows = await db.select().from(prestadores)
      .where(and(eq(prestadores.cnpj, cnpj), eq(prestadores.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },

  async criarOperacao(cnpj: string, tipoNsu: string, nsuConsultado: string, ultimoNsu: string, status: string, qtdDocumentos: number, tenantId: number) {
    const rows = await db.insert(operacoes).values({
      prestador_cnpj: cnpj,
      tenant_id: tenantId,
      tipo: tipoNsu,
      nsu_consultado: nsuConsultado,
      ultimo_nsu: ultimoNsu,
      status,
      qtd_documentos: qtdDocumentos,
    }).returning({ id: operacoes.id })
    return rows[0].id
  },

  async inserirDocumentos(docs: Array<{ chaveAcesso: string; nsu: string | number; xml: string }>, cnpj: string, operacaoId: number, tenantId: number) {
    for (const doc of docs) {
      try {
        await db.insert(documentos).values({
          chave_acesso: doc.chaveAcesso,
          prestador_cnpj: cnpj,
          tenant_id: tenantId,
          operacao_id: operacaoId,
          nsu: String(doc.nsu),
          xml_nfse: doc.xml,
        })
      } catch (err) {
        console.error(`Erro ao inserir documento ${doc.chaveAcesso}:`, err)
      }
    }
  },
}
```

- [ ] **Edit distribuicao.routes.ts — extract tenantId from req, pass to repository**

In the routes file, change all handler calls that go through `distribuicaoService` to pass `req.tenantId!`. For service calls, add tenantId parameter.

Read current `distribuicao.routes.ts` to see what needs changing — each handler needs `req.tenantId!` passed to service methods.

- [ ] **Commit**

```bash
git add backend/src/modules/distribuicao/
git commit -m "feat: add tenant_id filter to distribuicao module"
```

---

### Task 11: Update documentos module — tenant_id filter

**Files:**
- Modify: `backend/src/modules/documentos/documentos.repository.ts`
- Modify: `backend/src/modules/documentos/documentos.routes.ts`

- [ ] **Edit documentos.repository.ts — add tenant_id filter**

All `listar`, `buscarXml`, `buscarPdf`, `listarPorPeriodo` queries need `and(eq(documentos.tenant_id, tenantId), ...)`.

- [ ] **Edit documentos.routes.ts — extract tenantId from req**

Add `const tenantId = req.tenantId!` at the start of each handler and pass to repository methods.

- [ ] **Commit**

```bash
git add backend/src/modules/documentos/
git commit -m "feat: add tenant_id filter to documentos module"
```

---

### Task 12: Update operacoes module — tenant_id filter

**Files:**
- Modify: `backend/src/modules/operacoes/operacoes.repository.ts`
- Modify: `backend/src/modules/operacoes/operacoes.routes.ts`

- [ ] **Edit operacoes.repository.ts — add tenant_id filter to listar and buscar**

```typescript
import { db } from '../../db/db.js'
import { operacoes } from '../../db/schema.js'
import { eq, and, desc } from 'drizzle-orm'

export const operacaoRepository = {
  async listar(tenantId: number, cnpj?: string, limite = 50, offset = 0) {
    const conditions = [eq(operacoes.tenant_id, tenantId)]
    if (cnpj) conditions.push(eq(operacoes.prestador_cnpj, cnpj))
    return db.select().from(operacoes)
      .where(and(...conditions))
      .orderBy(desc(operacoes.id))
      .limit(limite)
      .offset(offset)
  },

  async buscar(id: number, tenantId: number) {
    const rows = await db.select().from(operacoes)
      .where(and(eq(operacoes.id, id), eq(operacoes.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },
}
```

- [ ] **Edit operacoes.routes.ts — pass tenantId**

In `GET /` handler, pass `req.tenantId!` as first arg. In `GET /:id`, pass `req.tenantId!` to `operacaoRepository.buscar`.

- [ ] **Commit**

```bash
git add backend/src/modules/operacoes/
git commit -m "feat: add tenant_id filter to operacoes module"
```

---

### Task 13: Update tasks module — tenant_id filter

**Files:**
- Modify: `backend/src/modules/tasks/tasks.repository.ts`
- Modify: `backend/src/modules/tasks/tasks.routes.ts`

- [ ] **Edit tasks.repository.ts — add tenant_id**

```typescript
import { db } from '../../db/db.js'
import { backgroundTasks } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'

export const tasksRepository = {
  async buscar(taskId: string, tenantId: number) {
    const rows = await db.select().from(backgroundTasks)
      .where(and(eq(backgroundTasks.id, taskId), eq(backgroundTasks.tenant_id, tenantId)))
      .limit(1)
    return rows[0]
  },
}
```

- [ ] **Edit tasks.routes.ts — pass tenantId**

```typescript
router.get('/:taskId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await tasksRepository.buscar(req.params.taskId, req.tenantId!)
      if (!task) { res.status(404).json({ detail: 'Task nao encontrada' }); return }
      res.json(task)
    } catch (err) { next(err) }
  })
```

- [ ] **Commit**

```bash
git add backend/src/modules/tasks/
git commit -m "feat: add tenant_id filter to tasks module"
```

---

### Task 14: Create render.yaml — deploy config

**File:** `backend/render.yaml`

- [ ] **Create render.yaml**

```yaml
services:
  - type: web
    name: gestor-nfse
    runtime: node
    region: oregon
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && node dist/index.js
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: AMBIENTE
        value: Homologacao
      - key: CODIGO_MUNICIPIO
        value: "1001058"
```

- [ ] **Commit**

```bash
git add backend/render.yaml
git commit -m "chore: add Render deploy configuration"
```

---

### Task 15: Update AGENTS.md

**File:** `AGENTS.md`

- [ ] **Update AGENTS.md — reflect PostgreSQL + multi-tenant**

Change the header to mention PostgreSQL, update commands table to include migration commands, update Database section.

- [ ] **Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for PostgreSQL + multi-tenant"
```

---

### Task 16: Generate initial migration + typecheck

- [ ] **Generate initial PostgreSQL migration**

```bash
cd backend
npx drizzle-kit generate
```

Expected: creates migration SQL files in `backend/src/db/migrations/`.

- [ ] **Typecheck**

```bash
cd backend
npm run typecheck
```

Expected: no errors. If errors, fix them.

- [ ] **Build**

```bash
cd backend
npm run build
```

Expected: compiles to `backend/dist/`.

- [ ] **Commit**

```bash
git add backend/src/db/migrations/
git commit -m "chore: generate initial PostgreSQL migration"
```
