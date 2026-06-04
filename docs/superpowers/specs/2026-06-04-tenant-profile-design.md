# Tenant Profile — Dados PJ/PF

Expandir o cadastro e perfil do tenant para suportar Pessoa Jurídica e Pessoa Física com campos completos de identificação, endereço e contato.

## Contexto

Hoje o tenant tem apenas `nome`, `slug` e `created_at`. Não há distinção entre PJ e PF, nem
dados de endereço ou telefone. O cadastro pede `{ nome, slug, email, senha }` — o `slug` é um
identificador URL que o usuário precisa inventar, o que é frágil e desnecessário.

## Objetivo

- Suportar tenant como PJ (CNPJ + Razão Social) ou PF (CPF + Nome)
- Remover `slug` — identificador passa a ser o `id` serial
- Adicionar endereço (CEP, logradouro, etc.) e telefones (celular com flag WhatsApp, fixo)
- Fluxo de cadastro único com dados obrigatórios mínimos; complementos opcionais preenchidos depois

## Mudanças no Schema

### `tenants` — campos alterados

| Coluna | Tipo | Obrigatório | Notas |
|--------|------|-------------|-------|
| ~~slug~~ | removido | — | Substituído por `documento` como identificador único |
| `tipo` | `varchar(2)` | sim | `"pj"` ou `"pf"` |
| `documento` | `varchar(14)` | sim | CNPJ (14 dígitos) se PJ, CPF (11 dígitos) se PF |
| `nome` | `varchar(255)` | sim | Razão social (PJ) ou nome completo (PF) |
| `nome_fantasia` | `varchar(255)` | não | Só PJ |
| `inscricao_estadual` | `varchar(20)` | não | Só PJ |
| `email_contato` | `varchar(255)` | sim | Email de contato do tenant |
| `telefone_celular` | `varchar(20)` | não | Apenas dígitos (DDD + número) |
| `whatsapp` | `boolean` | não | Default false; indica se o celular é WhatsApp |
| `telefone_fixo` | `varchar(20)` | não | |
| `cep` | `varchar(8)` | não | |
| `logradouro` | `varchar(255)` | não | |
| `numero` | `varchar(20)` | não | |
| `complemento` | `varchar(100)` | não | |
| `bairro` | `varchar(100)` | não | |
| `cidade` | `varchar(100)` | não | |
| `uf` | `varchar(2)` | não | |

`documento` deve ter constraint UNIQUE — CNPJ e CPF são identificadores nacionais únicos, não podem se repetir entre tenants.

Os campos existentes `id`, `nome`, `created_at` permanecem.

### `tenant_usuarios` — sem alterações

Permanece: `id`, `tenant_id`, `email`, `senha_hash`, `created_at`.

### Migration

1. Adicionar colunas à tabela `tenants` via `ALTER TABLE` (tipo, documento, nome_fantasia, inscricao_estadual, email_contato, telefone_celular, whatsapp, telefone_fixo, cep, logradouro, numero, complemento, bairro, cidade, uf)
2. `UPDATE tenants SET tipo = 'pj', documento = '00000000000000', email_contato = (SELECT email FROM tenant_usuarios WHERE tenant_usuarios.tenant_id = tenants.id LIMIT 1)` para registros existentes
3. Alterar `slug` para nullable e remover UNIQUE
4. Opcional: remover coluna `slug` (pode ficar como nullable sem uso)

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
- `documento` obrigatório: 14 dígitos (PJ) ou 11 dígitos (PF)
- Remove validação de `slug`
- Valida unicidade de `documento` (CNPJ/CPF não pode duplicar entre tenants)
- Cria tenant + usuário admin em transação
- Retorna JWT com `{ token, tenant_id, email }`

### `GET /api/v1/tenant`

Retorna todos os dados do tenant do usuário logado.

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

### Validações (Zod)

- `tipo`: enum `"pj"` | `"pf"`
- `documento`: string de 14 dígitos se PJ, 11 se PF
- `email_contato`: email válido
- `telefone_celular`: só dígitos, 10-11 caracteres se preenchido
- `cep`: 8 dígitos se preenchido
- `uf`: 2 caracteres, sigla válida se preenchido

## Frontend

### CadastroPage (`/cadastrar`)

Substituir o formulário atual:

- **Tipo:** seletor PJ/PF (radio ou toggle)
- **Documento:** input com máscara — CNPJ (14 dígitos) ou CPF (11 dígitos) conforme tipo
- **Nome:** input — label muda pra "Razão Social" (PJ) ou "Nome Completo" (PF)
- **Email:** input (mantém atual)
- **Senha:** input (mantém atual)
- **Botão:** "Criar Conta"

Remove campo `slug` / `Identificador`.

### PerfilView (`/perfil`)

Nova rota protegida para preencher/editar dados complementares. Pode ser:

- Página separada (`/perfil`)
- Ou seção expandida em `/configuracoes`

**Formulário:**
- Tipo (PJ/PF) — exibido como label, não editável
- Documento — exibido como label, não editável
- Nome — exibido como label, não editável
- Nome Fantasia (só PJ) — opcional, editável
- Inscrição Estadual (só PJ) — opcional, editável
- Email de contato — obrigatório, editável
- Celular — opcional, com toggle WhatsApp ao lado
- Telefone Fixo — opcional
- CEP — opcional, com auto-preenchimento ViaCEP no `onBlur`
- Logradouro, Número, Complemento, Bairro, Cidade, UF — opcionais, alguns auto-preenchidos

**ViaCEP:** ao sair do campo CEP (`onBlur`), faz fetch em `https://viacep.com.br/ws/${cep}/json/` e preenche logradouro, bairro, cidade, UF.

### Redirect pós-cadastro

Após cadastro bem-sucedido, o frontend verifica se `email_contato` está vazio no response do JWT/tenant. Se estiver, redireciona para `/perfil`. Caso contrário, segue para o dashboard (`/`).

### api.ts

Adicionar:

```ts
export async function fetchTenantProfile(): Promise<TenantProfile>
export async function updateTenantProfile(data: Partial<TenantProfile>): Promise<TenantProfile>
```

Atualizar `cadastrar` no AuthContext para aceitar `tipo` e `documento` além de `nome`, `email`, `senha`.

### Types

```ts
interface TenantProfile {
  id: number
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

Ajustar seed para usar os novos campos: `tipo: 'pj'`, `documento`, `email_contato` para o tenant admin.

## Fora de Escopo

- Multi-usuário (convites, papéis) — será o sub-projeto #2
- Planos/assinatura — sub-projeto #3
- Pagamentos — sub-projeto #4
- Painel admin — sub-projeto #5
- Onboarding (email de boas-vindas, tour) — sub-projeto #6
- Remoção de `slug` de outras partes do código (prestadores.buscarPorSlug, etc.) — verificar se existe
