# Asaas Billing + Feature Gating — Design Doc

**Date:** 2026-06-06
**Project:** Gestor NFSe
**Status:** Draft

## 1. Goals

- Replace manual subscription upgrade with real payment via Asaas (Pix, boleto, cartão)
- Enforce per-plan limits via backend middleware
- Allow admin to override limits per tenant
- Keep existing trial (30d) flow intact

## 2. Pricing & Plans

| Tier | Mensal | Trimestral | Anual | Prestadores | Docs/mês | Usuários | DANFSe | Lote ZIP |
|------|--------|------------|-------|-------------|----------|----------|--------|----------|
| Trial (30d) | Grátis | – | – | 1 | 50 total | 2 | Sim | Sim |
| Básico | R$29 | R$79 (2 meses) | R$299 (2.8 meses) | 2 | 100 | 3 | Sim | Não |
| Profissional | R$79 | R$199 (2.5 meses) | R$799 (2.5 meses) | 10 | 2000 | 10 | Sim | Sim |

- **Períodos adicionais**: Semestral (opcional futuro)
- **Desconto anual**: ~14% sobre mensal × 12
- **Cobrança**: Asaas gerencia recorrência automaticamente

## 3. Schema Changes

### 3.1 New table: `plan_limits`

```sql
CREATE TABLE plan_limits (
  id          SERIAL PRIMARY KEY,
  plano       VARCHAR(50) NOT NULL UNIQUE,  -- 'trial', 'basico', 'profissional'
  prestadores_max    INTEGER NOT NULL DEFAULT 1,
  documentos_mes_max INTEGER NOT NULL DEFAULT 50,
  usuarios_max       INTEGER NOT NULL DEFAULT 2,
  danfse             BOOLEAN NOT NULL DEFAULT true,
  lote_zip           BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

### 3.2 New table: `tenant_overrides`

```sql
CREATE TABLE tenant_overrides (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) UNIQUE,
  prestadores_max    INTEGER,  -- NULL = usa default do plano
  documentos_mes_max INTEGER,
  usuarios_max       INTEGER,
  danfse             BOOLEAN,
  lote_zip           BOOLEAN,
  updated_at  TIMESTAMP DEFAULT NOW(),
  updated_by  INTEGER REFERENCES tenant_usuarios(id)
);
```

### 3.3 New column on `subscriptions`

```sql
ALTER TABLE subscriptions ADD COLUMN asaas_customer_id   VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN asaas_subscription_id VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN documentos_este_mes  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN documentos_mes_ref   VARCHAR(7);   -- '2026-06'
```

### 3.4 New table: `asaas_webhooks`

```sql
CREATE TABLE asaas_webhooks (
  id            SERIAL PRIMARY KEY,
  event         VARCHAR(100) NOT NULL,
  asaas_id      VARCHAR(100),
  subscription_id INTEGER REFERENCES subscriptions(id),
  raw_body      JSONB,
  processed_at  TIMESTAMP DEFAULT NOW()
);
```

## 4. Asaas Integration

### 4.1 API Setup

```env
ASAAS_API_KEY=key_production
ASAAS_SANDBOX=false
ASAAS_WEBHOOK_SECRET=shared_secret
```

Ambiente separado por `ASAAS_SANDBOX=true/false`. Sandbox usa `sandbox.asaas.com/api/v3`, produção usa `api.asaas.com/v3`.

### 4.2 Endpoints a usar (Asaas API v3)

| Operação | Endpoint | Uso |
|----------|----------|-----|
| Criar cliente | `POST /customers` | Ao cadastrar tenant |
| Criar assinatura | `POST /subscriptions` | No upgrade/pós-trial |
| Listar assinaturas | `GET /subscriptions` | Sincronizar status |
| Cancelar assinatura | `DELETE /subscriptions/{id}` | No cancelamento |
| Obter QR Code Pix | `GET /payments/{id}/pixQrCode` | Exibir link pagamento |
| Obter boleto | `GET /payments/{id}/bankSlip` | Exibir link boleto |

### 4.3 Fluxo de contratação

```
Usuário no trial
  → Clica "Assinar Plano" (Básico/Profissional)
  → Backend:
      1. Cria/usa customer Asaas existente (asaas_customer_id)
      2. Cria subscription no Asaas com plano + período escolhido
      3. Salva asaas_subscription_id
      4. Retorna link de pagamento (Pix/boleto/cartão)
  → Frontend:
      - Se Pix: mostra QR Code + link pagamento
      - Se boleto: mostra link pra download
      - Se cartão: processa na hora
  → Asaas webhook PAYMENT_RECEIVED:
      - Backend atualiza subscription.status = 'active'
      - Atualiza periodo_fim
  → Usuário liberado
```

### 4.4 Webhooks a registrar no Asaas

| Evento Asaas | Ação no backend |
|--------------|----------------|
| `PAYMENT_RECEIVED` | Ativar subscription (+30/90/365d) |
| `PAYMENT_OVERDUE` | Enviar email "boleto vencido" |
| `PAYMENT_REFUNDED` | Reverter subscription, alertar admin |
| `SUBSCRIPTION_CANCELED` | Atualizar status no banco |
| `SUBSCRIPTION_UPDATED` | Sincronizar dados |

Webhook endpoint: `POST /api/v1/webhooks/asaas` — sem auth JWT, validado por `ASAAS_WEBHOOK_SECRET` + whitelist de IPs.

### 4.5 Grace periods

| Método | Confirmação | Grace antes de bloquear |
|--------|-------------|------------------------|
| Pix | Instantânea | – |
| Cartão | Instantânea ou pendente | 5 dias (retentar 3x) |
| Boleto | Até 3 dias úteis | 5 dias após vencimento |

Durante o grace period, o tenant continua ativo. Se não pagar, middleware 402 bloqueia.

## 5. Feature Gating

### 5.1 Middleware: `planLimitMiddleware`

```typescript
// Uso:
router.post('/prestadores', planLimitMiddleware('prestadores_max'), criarPrestador)
router.get('/documentos', planLimitMiddleware('documentos_mes_max'), listarDocumentos)
router.post('/usuarios', planLimitMiddleware('usuarios_max'), criarUsuario)
router.post('/gerar-danfse', planLimitMiddleware('danfse'), gerarDanfse)
router.get('/download-zip', planLimitMiddleware('lote_zip'), downloadZip)
```

### 5.2 Lógica do middleware

```
1. Buscar subscription do tenant (trial/basico/profissional)
2. Se trial expirado → 402 (já existe)
3. Buscar plan_limits[plano] + tenant_overrides[tenant]
4. Para cada override existente, sobrescrever default do plano
5. Se for limite numérico (prestadores, docs, usuarios):
   a. Contar quantos já existem/usados no mês
   b. Se count >= max → 403 "Limite do plano excedido"
6. Se for booleano (danfse, lote_zip):
   a. Se false → 403 "Recurso não disponível no seu plano"
7. next()
```

### 5.3 Reset mensal de contadores

- `documentos_este_mes` e `documentos_mes_ref` na tabela `subscriptions`
- Reset automático quando `documentos_mes_ref !== mes_atual` (YYYY-MM)
- Ou usar cron mensal: `UPDATE subscriptions SET documentos_este_mes = 0`

### 5.4 Overrides (admin)

Rota: `PATCH /api/v1/admin/tenants/:id/limits`

```json
{
  "prestadores_max": 10,
  "documentos_mes_max": 9999
}
```

Isso permite flexibilidade sem mudar o plano do cliente.

## 6. Backend Changes

### 6.1 Novas rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/v1/webhooks/asaas` | Receber eventos Asaas |
| `GET` | `/api/v1/subscription/payment-link` | Obter link de pagamento após upgrade |
| `PATCH` | `/api/v1/admin/tenants/:id/limits` | Override de limites |

### 6.2 Novos módulos

```
backend/src/modules/
  billing/
    billing.routes.ts        — rotas de pagamento + webhook
    billing.service.ts       — lógica Asaas
    billing.config.ts        — credenciais
  plan-limits/
    plan-limits.middleware.ts — feature gating
    plan-limits.service.ts   — buscar limites + contar uso
    plan-limits.routes.ts    — rota admin de overrides
```

### 6.3 Mudanças no subscription existente

- `subscription.service.ts`: upgrade agora cria assinatura no Asaas, não apenas seta data
- `subscription.service.ts`: cancelar agora cancela no Asaas também
- `subscription.routes.ts`: `POST /upgrade` agora aceita `payment_method` (pix/boleto/credit_card)

### 6.4 Variáveis de ambiente novas

```env
ASAAS_API_KEY=
ASAAS_SANDBOX=true
ASAAS_WEBHOOK_SECRET=
```

## 7. Frontend Changes

### 7.1 SubscriptionView.tsx — reformulada

- Mostrar planos Básico vs Profissional lado a lado com comparação de features
- Após escolher, mostrar método de pagamento (Pix / boleto / cartão)
- Exibir QR Code Pix ou link do boleto
- Mostrar status real da assinatura (Pendente, Ativa, Vencida, Cancelada)
- Botão "Alterar plano" (upgrade/downgrade)

### 7.2 SubscriptionView.tsx — upgrade/downgrade

- Upgrade no meio do ciclo: Asaas faz prorata automaticamente
- Downgrade: só aplica no fim do ciclo atual
- Cancelamento: confirmação, cancela no Asaas, mantém acesso até fim do período

### 7.3 Novo componente: `PlanComparison.tsx`

Tabela comparativa visual dos planos com checkmarks / "—".

## 8. Testes

| Cenário | O que testar |
|---------|-------------|
| Criar subscription Asaas | Mock API externa, verificar asaas_subscription_id salvo |
| Webhook PAYMENT_RECEIVED | Simular callback, verificar status virado 'active' |
| Webhook PAYMENT_OVERDUE | Simular callback, verificar status e grace period |
| Feature gating prestadores | Criar 2 prestadores no Básico, 3º deve dar 403 |
| Feature gating documentos | Exceder limite mensal, verificar 403 |
| Feature gating no trial | Trial com 1 prestador, 2º deve dar 403 |
| Override admin | Setar override, verificar que limite subiu |
| Reset mensal | Simular mudança de mês, contador zerar |
| Cancelamento | Cancelar Asaas + banco, verificar middleware bloqueia |
| Upgrade com prorata | Upgrade no meio do mês, valor correto no Asaas |
| Grace period boleto | Não pagar, verificar que ainda acessa por 5 dias |
| Downgrade | Mudar de Profissional para Básico com 8 prestadores, soft block |

## 9. Seed Updates

```typescript
// Inserir plan_limits defaults
await db.insert(planLimits).values([
  { plano: 'trial', prestadores_max: 1, documentos_mes_max: 50, usuarios_max: 2, danfse: true, lote_zip: true },
  { plano: 'basico', prestadores_max: 2, documentos_mes_max: 100, usuarios_max: 3, danfse: true, lote_zip: false },
  { plano: 'profissional', prestadores_max: 10, documentos_mes_max: 2000, usuarios_max: 10, danfse: true, lote_zip: true },
])
```

## 10. Migration Order

1. Criar tabelas: `plan_limits`, `tenant_overrides`, `asaas_webhooks`
2. Adicionar colunas: `asaas_customer_id`, `asaas_subscription_id`, `documentos_este_mes`, `documentos_mes_ref`
3. Seed `plan_limits` com defaults
4. Deploy backend com novas rotas e middleware
5. Deploy frontend com SubscriptionView reformulada
6. Configurar webhook no Asaas dashboard
7. Testar fluxo completo em sandbox
8. Migrar para produção
