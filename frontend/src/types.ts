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
