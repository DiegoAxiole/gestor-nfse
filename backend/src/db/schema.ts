import { pgTable, serial, varchar, text, integer, timestamp, boolean, customType, primaryKey, uuid } from 'drizzle-orm/pg-core'

export const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').notNull().unique().defaultRandom(),
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
  updated_by: integer('updated_by'),
})

export const tenantUsuarios = pgTable('tenant_usuarios', {
  id: serial('id').primaryKey(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  email: varchar('email', { length: 255 }).notNull().unique(),
  senha_hash: varchar('senha_hash', { length: 255 }).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
})

export const prestadores = pgTable('prestadores', {
  cnpj: varchar('cnpj', { length: 14 }).notNull(),
  tenant_id: integer('tenant_id').notNull().references(() => tenants.id),
  razao_social: varchar('razao_social', { length: 255 }).notNull(),
  ambiente: varchar('ambiente', { length: 20 }).notNull().default('Homologacao'),
  certificado_pfx: bytea('certificado_pfx'),
  certificado_senha: varchar('certificado_senha', { length: 255 }).notNull(),
  certificado_validade: varchar('certificado_validade', { length: 20 }).default(''),
  certificado_nome: varchar('certificado_nome', { length: 255 }).default(''),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenant_id, table.cnpj] }),
}))

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
