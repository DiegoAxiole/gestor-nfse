CREATE TABLE "agendamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"prestador_cnpj" varchar(14),
	"tipo" varchar(30) DEFAULT 'consulta_distribuicao',
	"intervalo_minutos" integer DEFAULT 60,
	"ativo" boolean DEFAULT true,
	"ultima_execucao" timestamp,
	"proxima_execucao" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asaas_webhooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" varchar(100) NOT NULL,
	"asaas_id" varchar(100),
	"subscription_id" integer,
	"raw_body" text,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automacao_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"prestador_cnpj" varchar(14),
	"tipo" varchar(30) DEFAULT '',
	"mensagem" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_tasks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"tipo" varchar(50) DEFAULT '',
	"chave_acesso" varchar(44),
	"cnpj" varchar(14),
	"status" varchar(20) DEFAULT 'pending',
	"progresso" integer DEFAULT 0,
	"mensagem" text DEFAULT '',
	"resultado_json" text,
	"erro_texto" text,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"ambiente" varchar(20) DEFAULT 'Homologacao',
	"codigo_municipio" integer DEFAULT 1001058,
	"lgpd_ativo" boolean DEFAULT false,
	"cnpj" varchar(14) DEFAULT '',
	"razao_social" varchar(255) DEFAULT '',
	"atualizada_em" timestamp DEFAULT now(),
	CONSTRAINT "configuracoes_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"chave_acesso" varchar(44) NOT NULL,
	"prestador_cnpj" varchar(14) NOT NULL,
	"operacao_id" integer,
	"nsu" varchar(20) DEFAULT '',
	"xml_nfse" text DEFAULT '',
	"data_emissao" varchar(20),
	"emissao_dh" varchar(30),
	"pdf_blob" "bytea",
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "documentos_chave_acesso_unique" UNIQUE("chave_acesso")
);
--> statement-breakpoint
CREATE TABLE "operacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"prestador_cnpj" varchar(14) NOT NULL,
	"tipo" varchar(20) DEFAULT '',
	"nsu_consultado" varchar(20),
	"ultimo_nsu" varchar(20) DEFAULT '',
	"status" varchar(30) DEFAULT '',
	"qtd_documentos" integer DEFAULT 0,
	"xml_request" text,
	"xml_response" text,
	"xml_erro" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano" varchar(50) NOT NULL,
	"prestadores_max" integer DEFAULT 1 NOT NULL,
	"documentos_mes_max" integer DEFAULT 50 NOT NULL,
	"usuarios_max" integer DEFAULT 2 NOT NULL,
	"danfse" boolean DEFAULT true NOT NULL,
	"lote_zip" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_limits_plano_unique" UNIQUE("plano")
);
--> statement-breakpoint
CREATE TABLE "prestadores" (
	"cnpj" varchar(14) NOT NULL,
	"tenant_id" integer NOT NULL,
	"razao_social" varchar(255) NOT NULL,
	"ambiente" varchar(20) DEFAULT 'Homologacao' NOT NULL,
	"certificado_pfx" "bytea",
	"certificado_senha" varchar(255) NOT NULL,
	"certificado_validade" varchar(20) DEFAULT '',
	"certificado_nome" varchar(255) DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prestadores_tenant_id_cnpj_pk" PRIMARY KEY("tenant_id","cnpj")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"plano" varchar(50) DEFAULT 'trial' NOT NULL,
	"status" varchar(50) DEFAULT 'trialing' NOT NULL,
	"trial_fim" timestamp NOT NULL,
	"periodo_fim" timestamp NOT NULL,
	"gateway_customer_id" varchar(100),
	"gateway_subscription_id" varchar(100),
	"cancelado_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"asaas_customer_id" varchar(100),
	"asaas_subscription_id" varchar(100),
	"documentos_este_mes" integer DEFAULT 0 NOT NULL,
	"documentos_mes_ref" varchar(7),
	CONSTRAINT "subscriptions_tenant_id_unique" UNIQUE("tenant_id"),
	CONSTRAINT "subscriptions_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "tenant_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"prestadores_max" integer,
	"documentos_mes_max" integer,
	"usuarios_max" integer,
	"danfse" boolean,
	"lote_zip" boolean,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "tenant_overrides_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"senha_hash" varchar(255) NOT NULL,
	"nome" varchar(255),
	"papel" varchar(20) DEFAULT 'operador' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tipo" varchar(2) DEFAULT 'pj' NOT NULL,
	"documento" varchar(20) DEFAULT '' NOT NULL,
	"nome" varchar(255) NOT NULL,
	"nome_fantasia" varchar(255),
	"inscricao_estadual" varchar(20),
	"email_contato" varchar(255) DEFAULT '' NOT NULL,
	"telefone_celular" varchar(20),
	"whatsapp" boolean DEFAULT false NOT NULL,
	"telefone_fixo" varchar(20),
	"cep" varchar(8),
	"logradouro" varchar(255),
	"numero" varchar(20),
	"complemento" varchar(100),
	"bairro" varchar(100),
	"cidade" varchar(100),
	"uf" varchar(2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "tenants_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "tenants_documento_unique" UNIQUE("documento")
);
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asaas_webhooks" ADD CONSTRAINT "asaas_webhooks_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automacao_logs" ADD CONSTRAINT "automacao_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_tasks" ADD CONSTRAINT "background_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes" ADD CONSTRAINT "operacoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestadores" ADD CONSTRAINT "prestadores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_overrides" ADD CONSTRAINT "tenant_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_overrides" ADD CONSTRAINT "tenant_overrides_updated_by_tenant_usuarios_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."tenant_usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;