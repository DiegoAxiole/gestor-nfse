export interface Operacao {
  id: string;
  data: string;
  tipo: "DISTRIBUICAO" | "NSU_ESPECIFICO" | "CONSULTA_LOTE";
  nsu_consultado: string | null;
  ultimo_nsu: string;
  status: "SUCESSO" | "ERRO" | "FATAL";
  xml_request: string;
  xml_response: string;
  xml_erro?: string;
  lote_dfe_count: number;
}

export interface Documento {
  chave_acesso: string;
  nsu: string;
  xml_nfse: string;
  data_importacao: string;
  data_emissao: string;
  emissao_dh: string;
  valor_servicos: number;
  prestador_nome: string;
  prestador_cnpj: string;
  tomador_nome: string;
  tomador_cnpj: string;
  numero_nota: string;
  tem_pdf: boolean;
}

export interface Empresa {
  id: string;
  cnpj: string;
  razao_social: string;
  certificado_caminho: string;
  certificado_senha?: string;
  validade_fim: string; // Data ISO, e.g., "2027-05-24"
  ambiente: "Homologacao" | "Producao";
  codigo_municipio: string;
}

export interface TenantProfile {
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

export interface LoginResponse {
  token: string
  usuario: { id: number; email: string }
}

export interface CadastroResponse {
  token: string
  tenant: { id: number; uuid: string; tipo: string; documento: string; nome: string }
}

export interface CadastroData {
  tipo: string
  documento: string
  nome: string
  nome_fantasia?: string
  email: string
  senha: string
}

export interface Subscription {
  id: number
  tenant_id: number
  uuid: string
  plano: string
  status: string
  trial_fim: string
  periodo_fim: string
  gateway_customer_id: string | null
  gateway_subscription_id: string | null
  cancelado_em: string | null
  created_at: string
  updated_at: string
  diasRestantes: number
}

export interface UsuarioPerfil {
  id: number
  email: string
  nome: string | null
  papel: 'admin' | 'operador'
  created_at: string
}

export interface ConfigToml {
  prestador: {
    cnpj: string;
    razao_social: string;
  };
  certificado: {
    caminho: string;
    senha_mascarada: string;
  };
  geral: {
    ambiente: "Homologacao" | "Producao";
    codigo_municipio: string;
  };
  lgpd_ativo?: boolean;
}
