# PostgreSQL + Multi-Tenant + Deploy — Design Doc

## Summary

Migrate Gestor NFSe from SQLite (better-sqlite3) to PostgreSQL (Supabase), add multi-tenant isolation via JWT auth, and deploy on Render + Supabase.

## Architecture

```
Browser ──► Render Web Service (Express)
                │
                ├── Supabase Auth (JWT login)
                └── Supabase PostgreSQL (RLS-ready schema)
```

- **Render** — Express server full-time, serves static frontend build
- **Supabase PostgreSQL** — all data with tenant_id column
- **Auth próprio** — bcrypt + JWT, sem dependência de Supabase Auth

## Multi-Tenant Model

```
Tenant (Escritório)
  ├── Usuários (login + senha)
  ├── Prestadores
  ├── Documentos
  ├── Configurações
  ├── Operações
  ├── Background Tasks
  ├── Agendamentos
  └── Automação Logs
```

### Tenant isolation

- Everything filtered by `tenant_id` column
- JWT middleware extracts `tenant_id` and injects into `req`
- All repository queries include `eq(tabela.tenant_id, tenantId)`
- No data crosses tenant boundaries

## Database Schema Changes

### New tables

**tenants**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| nome | varchar(255) NOT NULL | |
| slug | varchar(100) UNIQUE NOT NULL | subdomain-friendly |
| created_at | timestamp default now() | |

**tenant_usuarios**
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| tenant_id | int FK → tenants.id | |
| email | varchar(255) UNIQUE NOT NULL | login credential |
| senha_hash | varchar(255) NOT NULL | bcrypt hash |
| created_at | timestamp default now() | |

### Existing tables — add `tenant_id` column

| Table | tenant_id type | FK |
|---|---|---|
| prestadores | int NOT NULL | → tenants.id |
| documentos | int NOT NULL | → tenants.id |
| configuracoes | int NOT NULL | → tenants.id |
| operacoes | int NOT NULL | → tenants.id |
| background_tasks | int NOT NULL | → tenants.id |
| agendamentos | int NOT NULL | → tenants.id |
| automacao_logs | int NOT NULL | → tenants.id |

### Drop SQLite-only columns

- `configuracoes.certificado_caminho` — TOML config, não usado em nuvem
- `configuracoes.certificado_senha` — TOML config, não usado em nuvem

### Type mapping SQLite → PostgreSQL

| SQLite | PostgreSQL |
|---|---|
| `sqliteTable('x')` | `pgTable('x')` |
| `text('col')` | `varchar('col', { length: 255 })` or `text('col')` |
| `blob('col', { mode: 'buffer' })` | `bytea('col')` |
| `integer('id').primaryKey({ autoIncrement: true })` | `serial('id').primaryKey()` |
| `text('created_at').default("datetime('now')")` | `timestamp('created_at').defaultNow()` |
| `text('atualizado_em').default("datetime('now')")` | `timestamp('atualizado_em').defaultNow()` |
| `integer('lgpd_ativo').default(0)` | `boolean('lgpd_ativo').default(false)` |
| `integer('qtd_documentos').default(0)` | `integer('qtd_documentos').default(0)` |
| `integer('ativo', { mode: 'boolean' }).default(true)` | `boolean('ativo').default(true)` |
| `blob('pdf_blob')` | `bytea('pdf_blob')` |

## Auth Flow

```
POST /api/v1/auth/login { email, senha }
  → bcrypt.compare(senha, tenant_usuarios.senha_hash)
  → jwt.sign({ tenant_id, email, sub: usuario_id }, JWT_SECRET)
  → retorna { token, tenant_id, email }

Todas as rotas protegidas (exceto /auth/*, /health)
  → middleware verifica JWT
  → extrai tenant_id
  → injeta em req.tenantId
```

## Middleware

```typescript
// auth.middleware.ts
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ detail: 'Token nao informado' })
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { tenant_id: number }
    req.tenantId = payload.tenant_id
    next()
  } catch {
    return res.status(401).json({ detail: 'Token invalido' })
  }
}
```

## Routes

| Route | Auth | Notes |
|---|---|---|
| POST /api/v1/auth/login | No | Login |
| POST /api/v1/auth/cadastrar | No | Cadastro de tenant + admin |
| GET /health | No | Health check |
| GET /api/v1/prestadores | Yes | Filtrado por tenant_id |
| POST /api/v1/prestadores | Yes | |
| ... todas as demais | Yes | Filtrado por tenant_id |

## Deploy Configuration

### render.yaml

```yaml
services:
  - type: web
    name: gestor-nfse
    env: node
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && node dist/index.js
    envVars:
      - key: DATABASE_URL
        value: postgresql://user:pass@host:5432/db
      - key: JWT_SECRET
        generateValue: true
      - key: AMBIENTE
        value: Producao
      - key: CODIGO_MUNICIPIO
        value: "1001058"
```

> A conexão com Supabase PostgreSQL é feita via `DATABASE_URL` (connection string). Supabase fornece isso no painel do projeto. Não usamos Supabase Auth SDK — auth é próprio com bcrypt + JWT.

### Environment Variables

| Variable | Source | Required |
|---|---|---|
| DATABASE_URL | Supabase dashboard → connection string | Yes |
| JWT_SECRET | Render auto-generate | Yes |
| AMBIENTE | Manual | Yes |
| CODIGO_MUNICIPIO | Manual (default 1001058) | No |

## File Changes

### Backend files to create
- `backend/src/modules/auth/auth.routes.ts` — login + cadastro routes
- `backend/src/modules/auth/auth.service.ts` — auth business logic
- `backend/src/shared/auth.middleware.ts` — JWT verification middleware
- `backend/render.yaml` — Render deploy config

### Backend files to modify
- `backend/src/db/schema.ts` — complete rewrite for PostgreSQL + tenant_id
- `backend/src/db/db.ts` — swap better-sqlite3 for pg (PostgreSQL)
- `backend/src/app.ts` — add auth routes, auth middleware, fix SQLite queries
- `backend/src/config.ts` — remove TOML, read env vars
- `backend/src/index.ts` — no changes needed (already async)
- `backend/drizzle.config.ts` — dialect: postgresql
- `backend/package.json` — add deps, remove better-sqlite3
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

### Frontend files to modify
- `frontend/src/api.ts` — add auth header, login endpoint
- `frontend/src/App.tsx` — add login page, auth routing
- `frontend/src/api-types.ts` — add auth types

## Dependencies

### Add
- `pg` + `@types/pg` — PostgreSQL driver (simples, synax async)
- `bcryptjs` + `@types/bcryptjs` — password hashing
- `jsonwebtoken` + `@types/jsonwebtoken` — JWT

### Remove
- `better-sqlite3` + `@types/better-sqlite3`
- (manter) `multer` + `@types/multer` — PFX upload via multipart

## Database Initialization

No primeiro deploy:
1. Rodar `drizzle-kit generate` → cria migration SQL
2. Rodar `drizzle-kit migrate` → aplica no Supabase PostgreSQL
3. Script de seed cria tenant admin + usuário padrão

## Migration from Existing SQLite Data

Um script `scripts/migrate-local-to-supabase.js` será criado para:
1. Ler SQLite local
2. Criar tenant default
3. Migrar prestadores, configs, docs para o novo schema

## Out of Scope (futuro)

- RLS (Row-Level Security) no Supabase — pode ser adicionado depois como camada extra
- Social login (Google, GitHub) — Supabase Auth já suporta, só ativar
- Subdomínios por tenant — requer proxy reverso
- Rate limiting
- Audit log
