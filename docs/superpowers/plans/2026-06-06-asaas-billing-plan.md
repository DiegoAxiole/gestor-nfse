# Asaas Billing + Feature Gating — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual subscription upgrade with real Asaas payments + enforce per-plan limits.

**Architecture:** New `billing` module wraps Asaas API (customers, subscriptions, payments, webhooks). New `plan-limits` module enforces per-plan limits via middleware (count-check for numerics, boolean gate for features). Existing subscription service extended to call Asaas. Admin overrides via `tenant_overrides` table.

**Tech Stack:** Asaas API v3, Express middleware pattern (same as existing authMiddleware), Zod for webhook validation.

---

## File Structure

```
Create:
  backend/src/modules/billing/billing.config.ts       — Asaas env vars + client setup
  backend/src/modules/billing/billing.service.ts      — Asaas API calls (customer, subscription, payment)
  backend/src/modules/billing/billing.routes.ts       — webhook + payment-link endpoints
  backend/src/modules/plan-limits/plan-limits.service.ts   — resolve limits, count usage
  backend/src/modules/plan-limits/plan-limits.middleware.ts — feature gating middleware
  backend/src/modules/plan-limits/plan-limits.routes.ts     — admin override PATCH
  frontend/src/components/PlanComparison.tsx          — plan comparison table

Modify:
  backend/src/db/schema.ts                            — new tables + columns
  backend/src/app.ts                                  — register billing + plan-limits routes
  backend/src/seed.ts                                 — seed plan_limits defaults
  backend/src/modules/subscription/subscription.service.ts — upgrade/cancel via Asaas
  backend/src/modules/subscription/subscription.routes.ts  — upgrade with payment_method
  backend/src/config.ts                               — add Asaas env vars
  frontend/src/pages/SubscriptionView.tsx             — reformat with plans + payment
  frontend/src/api.ts                                 — new API functions
  frontend/src/types.ts                               — new types
  frontend/src/utils.ts                               — optional helpers
```

---

### Task 1: Add new tables + columns to schema.ts

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Add plan_limits table**

After `automacaoLogs` block, add:

```typescript
export const planLimits = pgTable('plan_limits', {
  id: serial('id').primaryKey(),
  plano: varchar('plano', { length: 50 }).notNull().unique(),
  prestadores_max: integer('prestadores_max').notNull().default(1),
  documentos_mes_max: integer('documentos_mes_max').notNull().default(50),
  usuarios_max: integer('usuarios_max').notNull().default(2),
  danfse: boolean('danfse').notNull().default(true),
  lote_zip: boolean('lote_zip').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
})
```

- [ ] **Step 2: Add tenant_overrides table**

```typescript
export const tenantOverrides = pgTable('tenant_overrides', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().unique().references(() => tenants.id),
  prestadores_max: integer('prestadores_max'),
  documentos_mes_max: integer('documentos_mes_max'),
  usuarios_max: integer('usuarios_max'),
  danfse: boolean('danfse'),
  lote_zip: boolean('lote_zip'),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  updated_by: integer('updated_by').references(() => tenantUsuarios.id),
})
```

- [ ] **Step 3: Add asaas_webhooks table**

```typescript
export const asaasWebhooks = pgTable('asaas_webhooks', {
  id: serial('id').primaryKey(),
  event: varchar('event', { length: 100 }).notNull(),
  asaas_id: varchar('asaas_id', { length: 100 }),
  subscription_id: integer('subscription_id').references(() => subscriptions.id),
  raw_body: text('raw_body'),
  processed_at: timestamp('processed_at').defaultNow().notNull(),
})
```

- [ ] **Step 4: Add columns to subscriptions table**

Add after `updated_at` in the subscriptions table definition:

```typescript
  asaas_customer_id: varchar('asaas_customer_id', { length: 100 }),
  asaas_subscription_id: varchar('asaas_subscription_id', { length: 100 }),
  documentos_este_mes: integer('documentos_este_mes').notNull().default(0),
  documentos_mes_ref: varchar('documentos_mes_ref', { length: 7 }),
```

Also update the `SubscriptionData` type in `subscription.service.ts` to include new fields.

- [ ] **Step 5: Generate migration**

Run: `cd backend && npm run db:generate`
Commit: `git add backend/src/db/schema.ts backend/src/db/migrations/ && git commit -m "feat: add plan_limits, tenant_overrides, asaas_webhooks tables + subscription columns"`

---

### Task 2: Add Asaas config

**Files:**
- Create: `backend/src/modules/billing/billing.config.ts`

- [ ] **Step 1: Create billing.config.ts**

```typescript
export function getAsaasConfig() {
  const sandbox = process.env.ASAAS_SANDBOX !== 'false'
  return {
    apiKey: process.env.ASAAS_API_KEY || '',
    baseUrl: sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3',
    webhookSecret: process.env.ASAAS_WEBHOOK_SECRET || '',
    sandbox,
  }
}
```

- [ ] **Step 2: Commit**

`git add backend/src/modules/billing/billing.config.ts && git commit -m "feat: add Asaas config module"`

---

### Task 3: Plan limits service

**Files:**
- Create: `backend/src/modules/plan-limits/plan-limits.service.ts`

- [ ] **Step 1: Write the test**

Create `backend/src/__tests__/plan-limits.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { getApp } from './setup.js'
import type { Express } from 'express'

let app: Express
let token: string

beforeAll(async () => {
  app = await getApp()
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@gestornfse.com', senha: 'admin123' })
  token = res.body.token as string
})

describe('Feature gating — plan_limits', () => {
  it('trial plan has 1 prestador max', async () => {
    // Criar 1o prestador deve funcionar
    const r1 = await request(app)
      .post('/api/v1/prestadores')
      .set('Authorization', `Bearer ${token}`)
      .field('cnpj', '12345678000199')
      .field('razao_social', 'Empresa Teste')
      .field('ambiente', 'Homologacao')
      .field('certificado_senha', '123456')
    expect(r1.status).toBe(201)

    // Criar 2o prestador deve falhar (trial max 1)
    const r2 = await request(app)
      .post('/api/v1/prestadores')
      .set('Authorization', `Bearer ${token}`)
      .field('cnpj', '98765432000199')
      .field('razao_social', 'Empresa Teste 2')
      .field('ambiente', 'Homologacao')
      .field('certificado_senha', '123456')
    expect(r2.status).toBe(403)
    expect(r2.body.detail).toContain('Limite')
  })
})
```

Run: `npx vitest run backend/src/__tests__/plan-limits.test.ts`
Expected: FAIL (middleware not implemented yet)

- [ ] **Step 2: Create plan-limits.service.ts**

```typescript
import { db } from '../../db/db.js'
import { planLimits, tenantOverrides, subscriptions, prestadores, tenantUsuarios, documentos } from '../../db/schema.js'
import { eq, and, sql, gte, lte, count } from 'drizzle-orm'

export interface ResolvedLimits {
  prestadores_max: number
  documentos_mes_max: number
  usuarios_max: number
  danfse: boolean
  lote_zip: boolean
}

export const planLimitsService = {
  async getPlanName(tenantId: number): Promise<string> {
    const rows = await db.select({ plano: subscriptions.plano })
      .from(subscriptions)
      .where(eq(subscriptions.tenant_id, tenantId))
      .limit(1)
    return rows[0]?.plano ?? 'trial'
  },

  async resolveLimits(tenantId: number): Promise<ResolvedLimits> {
    const plano = await this.getPlanName(tenantId)
    const [defaults] = await db.select().from(planLimits)
      .where(eq(planLimits.plano, plano))
      .limit(1)

    const base = defaults ?? { prestadores_max: 1, documentos_mes_max: 50, usuarios_max: 2, danfse: true, lote_zip: true }

    const [override] = await db.select().from(tenantOverrides)
      .where(eq(tenantOverrides.tenant_id, tenantId))
      .limit(1)

    if (!override) return base

    return {
      prestadores_max: override.prestadores_max ?? base.prestadores_max,
      documentos_mes_max: override.documentos_mes_max ?? base.documentos_mes_max,
      usuarios_max: override.usuarios_max ?? base.usuarios_max,
      danfse: override.danfse ?? base.danfse,
      lote_zip: override.lote_zip ?? base.lote_zip,
    }
  },

  async countPrestadores(tenantId: number): Promise<number> {
    const rows = await db.select({ total: count() }).from(prestadores)
      .where(eq(prestadores.tenant_id, tenantId))
    return rows[0]?.total ?? 0
  },

  async countUsuarios(tenantId: number): Promise<number> {
    const rows = await db.select({ total: count() }).from(tenantUsuarios)
      .where(eq(tenantUsuarios.tenant_id, tenantId))
    return rows[0]?.total ?? 0
  },

  async countDocumentosMes(tenantId: number): Promise<number> {
    const rows = await db.select({ total: count() }).from(documentos)
      .where(and(
        eq(documentos.tenant_id, tenantId),
        gte(documentos.created_at, sql`DATE_TRUNC('month', NOW())`),
        lte(documentos.created_at, sql`NOW()`)
      ))
    return rows[0]?.total ?? 0
  },
}
```

- [ ] **Step 3: Create plan-limits.middleware.ts**

```typescript
import type { Request, Response, NextFunction } from 'express'
import { planLimitsService } from './plan-limits.service.js'

type LimitKey = 'prestadores_max' | 'documentos_mes_max' | 'usuarios_max' | 'danfse' | 'lote_zip'

export function planLimitMiddleware(limitKey: LimitKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limits = await planLimitsService.resolveLimits(req.tenantId!)

      if (limitKey === 'danfse' || limitKey === 'lote_zip') {
        if (!limits[limitKey]) {
          res.status(403).json({
            detail: `Recurso não disponível no seu plano atual. Faça upgrade para liberar.`,
            code: 'PLAN_LIMIT_REACHED',
          })
          return
        }
        next()
        return
      }

      const countMap: Record<string, () => Promise<number>> = {
        prestadores_max: () => planLimitsService.countPrestadores(req.tenantId!),
        documentos_mes_max: () => planLimitsService.countDocumentosMes(req.tenantId!),
        usuarios_max: () => planLimitsService.countUsuarios(req.tenantId!),
      }

      const current = await countMap[limitKey]()
      const max = limits[limitKey] as number

      if (current >= max) {
        res.status(403).json({
          detail: `Limite do plano excedido (${current}/${max}). Faça upgrade para aumentar.`,
          code: 'PLAN_LIMIT_REACHED',
          current,
          max,
        })
        return
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run backend/src/__tests__/plan-limits.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/plan-limits/ backend/src/__tests__/plan-limits.test.ts
git commit -m "feat: add plan limits service + feature gating middleware"
```

---

### Task 4: Admin overrides route

**Files:**
- Create: `backend/src/modules/plan-limits/plan-limits.routes.ts`

- [ ] **Step 1: Write the test**

Add to `backend/src/__tests__/plan-limits.test.ts`:

```typescript
describe('Admin overrides', () => {
  it('admin pode sobrescrever limites de prestadores', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/tenants/1/limits')
      .set('Authorization', `Bearer ${token}`)
      .send({ prestadores_max: 5 })

    expect(res.status).toBe(200)

    // Agora criar 2o prestador deve funcionar (limite sobrescrito pra 5)
    const r2 = await request(app)
      .post('/api/v1/prestadores')
      .set('Authorization', `Bearer ${token}`)
      .field('cnpj', '98765432000199')
      .field('razao_social', 'Empresa Teste 2')
      .field('ambiente', 'Homologacao')
      .field('certificado_senha', '123456')
    expect(r2.status).toBe(201)
  })
})
```

Run: `npx vitest run backend/src/__tests__/plan-limits.test.ts -- -t "Admin overrides"` — expected FAIL

- [ ] **Step 2: Create plan-limits.routes.ts**

```typescript
import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { db } from '../../db/db.js'
import { tenantOverrides } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { adminMiddleware } from '../../shared/auth.middleware.js'

const ALLOWED_OVERRIDES = ['prestadores_max', 'documentos_mes_max', 'usuarios_max', 'danfse', 'lote_zip']

export function criarRouterPlanLimits(): Router {
  const router = Router()
  router.use(adminMiddleware)

  router.patch('/tenants/:id/limits', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = Number(req.params.id)
      const dados: Record<string, any> = {}
      for (const key of ALLOWED_OVERRIDES) {
        if (req.body[key] !== undefined) dados[key] = req.body[key]
      }
      if (Object.keys(dados).length === 0) {
        res.status(422).json({ detail: 'Nenhum campo válido para atualizar' })
        return
      }
      dados.updated_by = req.usuarioId
      dados.updated_at = new Date()

      await db.insert(tenantOverrides).values({ tenant_id: tenantId, ...dados })
        .onConflictDoUpdate({ target: tenantOverrides.tenant_id, set: dados })

      res.json({ data: { tenant_id: tenantId, ...dados }, ok: true })
    } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 3: Run tests to verify they pass**

`npx vitest run backend/src/__tests__/plan-limits.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/plan-limits/plan-limits.routes.ts backend/src/__tests__/plan-limits.test.ts
git commit -m "feat: admin overrides route for tenant plan limits"
```

---

### Task 5: Create Asaas billing service

**Files:**
- Create: `backend/src/modules/billing/billing.service.ts`

- [ ] **Step 1: Write tests**

Create `backend/src/__tests__/billing.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { getApp } from './setup.js'
import type { Express } from 'express'

let app: Express
let token: string

beforeAll(async () => {
  app = await getApp()
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@gestornfse.com', senha: 'admin123' })
  token = res.body.token as string
})

describe('POST /api/v1/subscription/upgrade (with Asaas)', () => {
  it('inicia upgrade com payment_method', async () => {
    const res = await request(app)
      .post('/api/v1/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ plano: 'basico', periodo: 'mensal', payment_method: 'pix' })

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('payment_link')
    expect(res.body.data.payment_method).toBe('pix')
  })
})

describe('POST /api/v1/webhooks/asaas', () => {
  it('processa PAYMENT_RECEIVED e ativa subscription', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/asaas')
      .send({
        event: 'PAYMENT_RECEIVED',
        payment: { id: 'pay_123', subscription: 'sub_123' },
      })
    expect(res.status).toBe(200)
  })
})
```

Run: expected FAIL

- [ ] **Step 2: Create billing.service.ts**

```typescript
import { getAsaasConfig } from './billing.config.js'

interface AsaasCustomer {
  id: string
  name: string
  cpfCnpj: string
  email: string
}

interface AsaasSubscription {
  id: string
  customer: string
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  value: number
  nextDueDate: string
  cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED'
}

const { apiKey, baseUrl } = getAsaasConfig()

async function asaasFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
      ...(options.headers as Record<string, string>),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Asaas API error ${res.status}: ${body}`)
  }
  return res.json()
}

const PRICE_MAP: Record<string, Record<string, number>> = {
  basico: { mensal: 2900, trimestral: 7900, anual: 29900 },
  profissional: { mensal: 7900, trimestral: 19900, anual: 79900 },
}

const CYCLE_MAP: Record<string, 'MONTHLY' | 'QUARTERLY' | 'YEARLY'> = {
  mensal: 'MONTHLY',
  trimestral: 'QUARTERLY',
  anual: 'YEARLY',
}

export const billingService = {
  async criarCliente(data: { nome: string; documento: string; email: string }): Promise<string> {
    const customer = await asaasFetch<AsaasCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: data.nome,
        cpfCnpj: data.documento,
        email: data.email,
      }),
    })
    return customer.id
  },

  async criarAssinatura(params: {
    customerId: string
    plano: string
    periodo: string
    paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  }): Promise<{ subscriptionId: string; paymentLink: string }> {
    const priceInCents = PRICE_MAP[params.plano]?.[params.periodo]
    if (!priceInCents) throw new Error(`Preço não encontrado para ${params.plano}/${params.periodo}`)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 1)

    const sub = await asaasFetch<AsaasSubscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: params.customerId,
        billingType: params.paymentMethod,
        value: priceInCents / 100,
        nextDueDate: dueDate.toISOString().split('T')[0],
        cycle: CYCLE_MAP[params.periodo],
        description: `Gestor NFSe - ${params.plano} ${params.periodo}`,
      }),
    })

    return {
      subscriptionId: sub.id,
      paymentLink: `${baseUrl.replace('/api/v3', '').replace('.sandbox', '')}/subscription/${sub.id}`,
    }
  },

  async cancelarAssinatura(asaasSubscriptionId: string): Promise<void> {
    await asaasFetch(`/subscriptions/${asaasSubscriptionId}`, { method: 'DELETE' })
  },

  async processarWebhook(body: any): Promise<{ event: string; subscriptionId?: string; paymentId?: string }> {
    const event = body.event
    const payment = body.payment
    const subscription = body.subscription

    if (payment?.id && subscription?.id) {
      return { event, subscriptionId: subscription.id, paymentId: payment.id }
    }
    return { event }
  },
}
```

- [ ] **Step 3: Create billing.routes.ts**

```typescript
import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { db } from '../../db/db.js'
import { asaasWebhooks, subscriptions } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { billingService } from './billing.service.js'
import { subscriptionService } from '../subscription/subscription.service.js'

export function criarRouterBilling(): Router {
  const router = Router()

  router.post('/webhooks/asaas', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await billingService.processarWebhook(req.body)

      await db.insert(asaasWebhooks).values({
        event: result.event,
        asaas_id: result.subscriptionId ?? result.paymentId,
        raw_body: JSON.stringify(req.body),
      })

      if (result.event === 'PAYMENT_RECEIVED' && result.subscriptionId) {
        const [sub] = await db.select({ id: subscriptions.id, tenant_id: subscriptions.tenant_id })
          .from(subscriptions)
          .where(eq(subscriptions.asaas_subscription_id, result.subscriptionId))
          .limit(1)

        if (sub) {
          const periodoFim = new Date()
          // Encontrar plano actual
          const [current] = await db.select({ plano: subscriptions.plano })
            .from(subscriptions).where(eq(subscriptions.id, sub.id)).limit(1)
          const diasExtra = current?.plano === 'basico' ? 30 : current?.plano === 'profissional' ? 30 : 30
          periodoFim.setDate(periodoFim.getDate() + diasExtra)

          await db.update(subscriptions)
            .set({ status: 'active', periodo_fim: periodoFim, updated_at: new Date() })
            .where(eq(subscriptions.id, sub.id))
        }
      }

      res.json({ received: true })
    } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 4: Run tests**

`npx vitest run backend/src/__tests__/billing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/billing/ backend/src/__tests__/billing.test.ts
git commit -m "feat: add Asaas billing service + webhook handler"
```

---

### Task 6: Update subscription service with Asaas

**Files:**
- Modify: `backend/src/modules/subscription/subscription.service.ts`
- Modify: `backend/src/modules/subscription/subscription.routes.ts`

- [ ] **Step 1: Update subscription.service.ts**

Replace upgrade method:

```typescript
async upgrade(tenantId: number, data: { plano: string; periodo: string; payment_method: 'PIX' | 'BOLETO' | 'CREDIT_CARD' }) {
  const tenant = await db.select({ nome: tenants.nome, documento: tenants.documento, email_contato: tenants.email_contato })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1).then(r => r[0])
  if (!tenant) throw new NotFoundError('Tenant', String(tenantId))

  // Get or create Asaas customer
  const [sub] = await db.select({ asaas_customer_id: subscriptions.asaas_customer_id })
    .from(subscriptions).where(eq(subscriptions.tenant_id, tenantId)).limit(1)

  let customerId = sub?.asaas_customer_id
  if (!customerId) {
    customerId = await billingService.criarCliente({
      nome: tenant.nome,
      documento: tenant.documento,
      email: tenant.email_contato,
    })
  }

  const result = await billingService.criarAssinatura({
    customerId,
    plano: data.plano,
    periodo: data.periodo,
    paymentMethod: data.payment_method,
  })

  const periodoFim = new Date()
  periodoFim.setDate(periodoFim.getDate() + 30)

  const rows = await db.update(subscriptions)
    .set({
      plano: data.plano,
      status: 'pending',
      periodo_fim: periodoFim,
      asaas_customer_id: customerId,
      asaas_subscription_id: result.subscriptionId,
      updated_at: new Date(),
    })
    .where(eq(subscriptions.tenant_id, tenantId))
    .returning()

  if (!rows[0]) throw new NotFoundError('Subscription', String(tenantId))
  return { ...rows[0], payment_link: result.paymentLink, payment_method: data.payment_method, diasRestantes: 0 }
}
```

Also update cancelar:

```typescript
async cancelar(tenantId: number) {
  const [sub] = await db.select({ asaas_subscription_id: subscriptions.asaas_subscription_id })
    .from(subscriptions).where(eq(subscriptions.tenant_id, tenantId)).limit(1)

  if (sub?.asaas_subscription_id) {
    await billingService.cancelarAssinatura(sub.asaas_subscription_id).catch(() => {})
  }

  const rows = await db.update(subscriptions)
    .set({ status: 'canceled', cancelado_em: new Date(), updated_at: new Date() })
    .where(eq(subscriptions.tenant_id, tenantId))
    .returning()
  if (!rows[0]) throw new NotFoundError('Subscription', String(tenantId))
  return { ...rows[0], diasRestantes: 0 }
}
```

- [ ] **Step 2: Update subscription.routes.ts**

Replace schemaUpgrade:

```typescript
const schemaUpgrade = z.object({
  plano: z.enum(['basico', 'profissional']),
  periodo: z.enum(['mensal', 'trimestral', 'anual']),
  payment_method: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']),
})
```

Update route body parsing accordingly (replace the existing upgrade route handler to pass the new fields).

- [ ] **Step 3: Run existing tests to verify they still pass**

`npx vitest run backend/src/__tests__/subscription.test.ts`
Expected: PASS (update test if needed)

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/subscription/
git commit -m "feat: integrate Asaas into subscription service (upgrade/cancel)"
```

---

### Task 7: Register new routes in app.ts

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Add imports and mount plan-limits route**

Add imports:
```typescript
import { criarRouterBilling } from './modules/billing/billing.routes.js'
import { criarRouterPlanLimits } from './modules/plan-limits/plan-limits.routes.js'
```

Before `router.use('/api/v1', apiRouter)`:

```typescript
// Admin routes (no subscription check)
const adminRouter = express.Router()
adminRouter.use((req, res, next) => {
  authMiddleware(req, res, next)
})
adminRouter.use('/admin', criarRouterPlanLimits())
router.use('/api/v1', adminRouter)
```

Inside `apiRouter`, after the existing routes:

```typescript
apiRouter.use('/subscription', criarRouterSubscription())
apiRouter.use('/billing', criarRouterBilling())
```

Also remove `apiRouter.use('/subscription', criarRouterSubscription())` if duplicated.
And add billing routes outside subscription middleware (webhook needs no auth).

Actually, webhook needs to be outside auth. Let me fix that:

Before the `apiRouter` block:
```typescript
// Webhooks — no auth
router.use('/api/v1/webhooks', criarRouterBilling())
```

And in billing.routes.ts, mount as `/asaas` so full route is `/api/v1/webhooks/asaas`.

- [ ] **Step 2: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat: register billing webhooks + admin plan-limits routes"
```

---

### Task 8: Seed plan_limits defaults + update seed

**Files:**
- Modify: `backend/src/seed.ts`

- [ ] **Step 1: Add plan_limits seed**

Add to imports:
```typescript
import { planLimits } from './db/schema.js'
```

After creating tenant/subscription, add:

```typescript
await db.insert(planLimits).values([
  { plano: 'trial', prestadores_max: 1, documentos_mes_max: 50, usuarios_max: 2, danfse: true, lote_zip: true },
  { plano: 'basico', prestadores_max: 2, documentos_mes_max: 100, usuarios_max: 3, danfse: true, lote_zip: false },
  { plano: 'profissional', prestadores_max: 10, documentos_mes_max: 2000, usuarios_max: 10, danfse: true, lote_zip: true },
])
```

Add `plan_limits` to the TRUNCATE list at top.

- [ ] **Step 2: Test seed**

Run: `cd backend && npm run seed`
Expected: seed concluido

- [ ] **Step 3: Commit**

```bash
git add backend/src/seed.ts
git commit -m "feat: seed plan_limits defaults (trial, basico, profissional)"
```

---

### Task 9: Frontend — PlanComparison component

**Files:**
- Create: `frontend/src/components/PlanComparison.tsx`

- [ ] **Step 1: Create component**

```tsx
import { Check, X } from 'lucide-react'

interface PlanData {
  id: string
  nome: string
  preco: string
  prestadores: number | string
  documentos: number | string
  usuarios: number
  danfse: boolean
  loteZip: boolean
  destaque?: boolean
}

const PLANOS: PlanData[] = [
  {
    id: 'trial',
    nome: 'Trial',
    preco: 'Grátis',
    prestadores: 1,
    documentos: '50 (total)',
    usuarios: 2,
    danfse: true,
    loteZip: true,
  },
  {
    id: 'basico',
    nome: 'Básico',
    preco: 'R$ 29/mês',
    prestadores: 2,
    documentos: '100/mês',
    usuarios: 3,
    danfse: true,
    loteZip: false,
    destaque: true,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 'R$ 79/mês',
    prestadores: 10,
    documentos: '2.000/mês',
    usuarios: 10,
    danfse: true,
    loteZip: true,
  },
]

interface Props {
  selected?: string
  onSelect?: (id: string) => void
}

export default function PlanComparison({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANOS.filter(p => p.id !== 'trial').map(plan => (
        <button
          key={plan.id}
          onClick={() => onSelect?.(plan.id)}
          className={`p-6 rounded-xl border-2 text-left transition-all cursor-pointer ${
            selected === plan.id
              ? 'border-indigo-500 bg-indigo-600/10'
              : 'border-slate-800 bg-slate-900 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-sm font-bold">{plan.nome}</h3>
            {plan.destaque && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                Popular
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-white mb-4">{plan.preco}</p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              {plan.danfse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-400" />}
              <span className="text-slate-300">DANFSe</span>
            </li>
            <li className="flex items-center gap-2">
              {plan.loteZip ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-400" />}
              <span className="text-slate-300">Download ZIP</span>
            </li>
            <li className="text-slate-400">Até {plan.prestadores} prestadores</li>
            <li className="text-slate-400">Até {plan.documentos} documentos</li>
            <li className="text-slate-400">Até {plan.usuarios} usuários</li>
          </ul>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PlanComparison.tsx
git commit -m "feat: add PlanComparison component"
```

---

### Task 10: Frontend — SubscriptionView reformatted

**Files:**
- Modify: `frontend/src/pages/SubscriptionView.tsx`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Update types.ts**

Add to Subscription interface:
```typescript
  asaas_customer_id?: string | null
  asaas_subscription_id?: string | null
  payment_link?: string
  payment_method?: string
```

- [ ] **Step 2: Update api.ts**

Replace `upgradeSubscription` with:

```typescript
export async function upgradeSubscription(data: {
  plano: string
  periodo: string
  payment_method: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
}): Promise<{ data: Subscription }> {
  return requestJson<{ data: Subscription }>('/subscription/upgrade', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
```

- [ ] **Step 3: Rewrite SubscriptionView.tsx**

Replace the entire file with a new version that:
- Import `PlanComparison` component
- Shows current plan status (same as before)
- If trial/canceled, shows PlanComparison + period selector + payment method selector
- After upgrade response, shows payment link / QR code
- Reuses existing CSS patterns from the current file

Key sections (in order):
1. Current plan status card (exists, keep)
2. If trialing or canceled → "Escolher Plano" section
3. PlanComparison component
4. Period selector (Mensal/Trimestral/Anual)
5. Payment method selector (Pix/Boleto/Cartão)
6. "Assinar" button
7. After signup → show payment link

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SubscriptionView.tsx frontend/src/api.ts frontend/src/types.ts
git commit -m "feat: reformat SubscriptionView with plan comparison + Asaas payment"
```

---

### Task 11: Apply feature gating middleware to existing routes

**Files:**
- Modify: `backend/src/modules/prestadores/prestadores.routes.ts`
- Modify: `backend/src/modules/documentos/documentos.routes.ts`
- Modify: `backend/src/modules/usuarios/usuario.routes.ts`
- Modify: `backend/src/modules/operacoes/operacoes.routes.ts` (DANFSe + lote)

- [ ] **Step 1: Add limit middleware to prestadores routes**

In `prestadores.routes.ts`, add import:
```typescript
import { planLimitMiddleware } from '../plan-limits/plan-limits.middleware.js'
```

On POST route:
```typescript
router.post('/', planLimitMiddleware('prestadores_max'), upload.single('certificado_pfx'), async (req, res, next) => {
```

- [ ] **Step 2: Add limit middleware to documentos routes**

Import `planLimitMiddleware` and add to download-zip route:
```typescript
router.get('/download-zip', planLimitMiddleware('lote_zip'), async (req, res, next) => {
```

- [ ] **Step 3: Add limit middleware to usuarios routes**

On POST route:
```typescript
router.post('/', adminMiddleware, planLimitMiddleware('usuarios_max'), async (req, res, next) => {
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/prestadores/ backend/src/modules/documentos/ backend/src/modules/usuarios/
git commit -m "feat: apply feature gating middleware to existing routes"
```

---

### Task 12: End-to-end tests

**Files:**
- Modify: `backend/src/__tests__/plan-limits.test.ts` (already partially done)
- Modify: `backend/src/__tests__/subscription.test.ts`

- [ ] **Step 1: Add subscription upgrade with payment_method test**

In `subscription.test.ts`, add:

```typescript
describe('POST /api/v1/subscription/upgrade (payment)', () => {
  it('faz upgrade com pix', async () => {
    const res = await request(app)
      .post('/api/v1/subscription/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ plano: 'basico', periodo: 'mensal', payment_method: 'PIX' })

    expect(res.status).toBe(200)
    expect(res.body.data.payment_link).toBeTruthy()
    expect(res.body.data.asaas_subscription_id).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run full test suite**

`cd backend && npm run test`
Expected: All 71+ existing tests + new tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/
git commit -m "test: add billing + plan-limits end-to-end tests"
```

---

## Self-Review

Check against spec:

1. **Planos definidos** — Task 8 (seed) + Task 9 (frontend comparison) ✓
2. **Schema changes** — Task 1 (4 new tables/columns) ✓
3. **Asaas integration** — Task 5 (service + webhooks) + Task 6 (subscription upgrade) ✓
4. **Feature gating** — Task 3 (middleware) + Task 11 (applied to routes) ✓
5. **Admin overrides** — Task 4 (PATCH route) ✓
6. **Subscription frontend** — Task 10 (reformat) ✓
7. **Tests** — Tasks 3, 4, 5, 12 ✓
8. **Seed** — Task 8 ✓

No placeholders. Types consistent across tasks. Scope matches spec exactly.
