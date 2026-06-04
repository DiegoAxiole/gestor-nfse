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
CREATE TABLE "prestadores" (
	"cnpj" varchar(14) PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"razao_social" varchar(255) NOT NULL,
	"ambiente" varchar(20) DEFAULT 'Homologacao' NOT NULL,
	"certificado_pfx" "bytea",
	"certificado_senha" varchar(255) NOT NULL,
	"certificado_validade" varchar(20) DEFAULT '',
	"certificado_nome" varchar(255) DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"senha_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automacao_logs" ADD CONSTRAINT "automacao_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_tasks" ADD CONSTRAINT "background_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes" ADD CONSTRAINT "operacoes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestadores" ADD CONSTRAINT "prestadores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_usuarios" ADD CONSTRAINT "tenant_usuarios_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;