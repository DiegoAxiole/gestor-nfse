# Tenant Profile — Dados PJ/PF

Expandir o cadastro e perfil do tenant para suportar Pessoa Jurídica e Pessoa Física com
campos completos de identificação, endereço e contato.

## Contexto

Hoje o tenant tem apenas `nome`, `slug` e `created_at`. Não há distinção entre PJ e PF, nem
dados de endereço ou telefone. O cadastro pede `{ nome, slug, email, senha }` — o `slug` é um
identificador URL que o usuário precisa inventar, o que é frágil e desnecessário.

## Objetivo

- Suportar tenant como PJ (CNPJ + Razão Social) ou PF (CPF + Nome)
- Remover `slug` — identificador público passa a ser UUIDv4 (evita IDOR com serial ID)
- Adicionar endereço (CEP, logradouro, etc.) e telefones (celular com flag WhatsApp, fixo)
- Fluxo de cadastro único com dados obrigatórios; endereço e telefone opcionais
- Validação matemática de CNPJ/CPF (dígitos verificadores)
- Auditoria: `updated_at` e `updated_by`

## Mudanças no Schema

### `tenants` — campos alterados

| Coluna | Tipo | Obrigatório | Notas |
|--------|------|-------------|-------|
| ~~slug~~ | removido | — | Substituído por `uuid` como identificador público |
| `uuid` | `varchar(36)` | sim | UUIDv4 gerado automaticamente — único, não sequencial |
| `tipo` | `varchar(2)` | sim | `"pj"` ou `"pf"` |
| `documento` | `varchar(20)` | sim | CNPJ ou CPF **apenas dígitos** (sanitizado no backend) |
| `nome` | `varchar(255)` | sim | Razão social (PJ) ou nome completo (PF) |
| `nome_fantasia` | `varchar(255)` | não | Só PJ |
| `inscricao_estadual` | `varchar(20)` | não | Só PJ |
| `email_contato` | `varchar(255)` | sim | Email de contato do tenant — preenchido automaticamente com o email do usuário no cadastro |
| `telefone_celular` | `varchar(20)` | não | Apenas dígitos (DDD + número) |
| `whatsapp` | `boolean` | não | Default false |
| `telefone_fixo` | `varchar(20)` | não | |
| `cep` | `varchar(8)` | não | |
| `logradouro` | `varchar(255)` | não | |
| `numero` | `varchar(20)` | não | |
| `complemento` | `varchar(100)` | não | |
| `bairro` | `varchar(100)` | não | |
| `cidade` | `varchar(100)` | não | |
| `uf` | `varchar(2)` | não | |
| `updated_at` | `timestamp` | sim | Atualizado automaticamente a cada alteração |
| `updated_by` | `integer` | não | FK → `tenant_usuarios.id` do usuário que fez a última alteração |

`documento` deve ter constraint UNIQUE. `uuid` deve ter constraint UNIQUE.

**Índices adicionais:**
- INDEX em `documento` (busca por documento)
- INDEX em `tipo` (filtro por tipo de pessoa)

Os campos existentes `id` (serial), `nome`, `created_at` permanecem.

### `tenant_usuarios` — sem alterações

Permanece: `id`, `tenant_id`, `email`, `senha_hash`, `created_at`.

### Migration

1. Adicionar colunas à tabela `tenants`: uuid, tipo, documento, nome_fantasia,
   inscricao_estadual, email_contato, telefone_celular, whatsapp, telefone_fixo,
   cep, logradouro, numero, complemento, bairro, cidade, uf, updated_at, updated_by
2. Gerar UUIDv4 para cada tenant existente via `gen_random_uuid()` (pgcrypto)
3. `UPDATE tenants SET tipo = 'pj', documento = '00000000000000', email_contato = (SELECT email FROM tenant_usuarios WHERE tenant_usuarios.tenant_id = tenants.id LIMIT 1)`
4. Alterar `slug` para nullable e remover UNIQUE
5. Criar UNIQUE INDEX em `uuid` e `documento`
6. Criar INDEX em `tipo`

## API

### `POST /api/v1/auth/cadastrar`

**Body (JSON):**
```json
{
  "tipo": "pj",
  "documento": "12345678000199",
  "nome": "Empresa Exemplo Ltda",
  "email": "admin@exemplo.com",
  "senha": "senha123"
}
```

- `tipo` obrigatório: `"pj"` ou `"pf"`
- `documento` obrigatório: validado matematicamente (dígitos verificadores) com `cpf-cnpj-validator`
- Remove validação de `slug`
- `email_contato` do tenant é preenchido automaticamente com o `email` informado (evita NOT NULL conflict)
- `uuid` gerado automaticamente via `gen_random_uuid()`
- Valida unicidade de `documento` e `email`
- Cria tenant + usuário admin em transação
- Retorna JWT com `{ token, tenant_id, email }`

### `GET /api/v1/tenant`

Retorna todos os dados do tenant do usuário logado (lê `tenant_id` do JWT, sem expor ID na URL).

### `PUT /api/v1/tenant`

**Body (JSON)** — atualiza campos do perfil:
```json
{
  "email_contato": "contato@exemplo.com",
  "telefone_celular": "11999999999",
  "whatsapp": true,
  "cep": "01310100",
  "logradouro": "Av Paulista",
  "numero": "1000",
  "bairro": "Bela Vista",
  "cidade": "São Paulo",
  "uf": "SP"
}
```

- Apenas campos enviados são alterados (PATCH semantics)
- `tipo` e `documento` não podem ser alterados após criação
- Atualiza `updated_at` para NOW() e `updated_by` com o ID do usuário logado

### Validações (Zod + cpf-cnpj-validator)

- `tipo`: enum `"pj"` | `"pf"`
- `documento`: sanitizado (remove não-dígitos) + validado matematicamente com
  `cpf-cnpj-validator` — 14 dígitos c/ dígitos verificadores válidos (PJ) ou
  11 dígitos c/ dígitos verificadores válidos (PF)
- `email_contato`: email válido
- `telefone_celular`: só dígitos, 10-11 caracteres se preenchido
- `cep`: 8 dígitos se preenchido
- `uf`: 2 caracteres maiúsculos, sigla brasileira válida se preenchido

## Frontend

### CadastroPage (`/cadastrar`)

Substituir o formulário atual:

- **Tipo:** seletor PJ/PF (radio ou toggle)
- **Documento:** input com máscara — CNPJ (14 dígitos c/ validação) ou CPF (11 dígitos c/ validação) conforme tipo; feedback visual se inválido
- **Nome:** input — label muda pra "Razão Social" (PJ) ou "Nome Completo" (PF)
- **Email:** input (mantém atual)
- **Senha:** input (mantém atual)
- **Botão:** "Criar Conta"

Remove campo `slug` / `Identificador`.

### PerfilView (`/perfil`)

Nova rota protegida para preencher/editar dados complementares.

**Formulário:**
- Tipo (PJ/PF) — exibido como label, não editável
- Documento — exibido como label, não editável (CNPJ ou CPF mascarado)
- Nome — exibido como label, não editável
- Nome Fantasia (só PJ) — opcional, editável
- Inscrição Estadual (só PJ) — opcional, editável
- Email de contato — obrigatório, editável
- Celular — opcional, com toggle WhatsApp ao lado
- Telefone Fixo — opcional
- CEP — opcional, com auto-preenchimento ViaCEP no `onBlur`
- Logradouro, Número, Complemento, Bairro, Cidade, UF — opcionais, alguns auto-preenchidos

**ViaCEP:** ao sair do campo CEP (`onBlur`), faz fetch em
`https://viacep.com.br/ws/${cep}/json/` com **timeout de 3 segundos**.
Se falhar ou expirar, os campos de endereço ficam livres para preenchimento manual
— sem travar a tela, sem mensagem de erro bloqueante.

### Redirect pós-cadastro

Após cadastro bem-sucedido, o frontend redireciona para `/perfil` se for o primeiro
acesso (JWT recém-criado). Nas próximas vezes, vai direto para `/`.

Critério: o JWT pode incluir um claim `primeiro_acesso: true` no cadastro, ou o
frontend verifica se `email_contato` ou `cep` estão vazios ao carregar o perfil.

### api.ts

Adicionar:

```ts
export async function fetchTenantProfile(): Promise<TenantProfile>
export async function updateTenantProfile(data: Partial<TenantProfile>): Promise<TenantProfile>
```

Atualizar `cadastrar` no AuthContext para aceitar `tipo` e `documento` além de
`nome`, `email`, `senha`.

### Types

```ts
interface TenantProfile {
  id: number
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

## Seed

Ajustar seed para usar os novos campos: `tipo: 'pj'`, `documento`, `email_contato`,
gerar `uuid` via `gen_random_uuid()`.

## Dependências

- `cpf-cnpj-validator` — validação matemática de CNPJ/CPF no backend (Zod refinements)

## Fora de Escopo

- Multi-usuário (convites, papéis) — será o sub-projeto #2
- Planos/assinatura — sub-projeto #3
- Pagamentos — sub-projeto #4
- Painel admin — sub-projeto #5
- Onboarding (email de boas-vindas, tour) — sub-projeto #6
