export interface Prestador {
  cnpj: string
  razao_social: string
  ambiente: "Homologacao" | "Producao"
}

export interface PrestadorInput {
  cnpj: string
  razao_social: string
  ambiente: string
  certificado_pfx: File
  certificado_senha: string
}

export interface LoteDFe {
  chave_acesso: string
  nsu: string
}

export interface ResultadoDistribuicao {
  sucesso: boolean
  status_processamento: string
  lote_dfe: LoteDFe[]
  proximo_nsu: string
  mensagem_erro: string
}

export interface UltimoNsuResponse {
  ultimo_nsu: string
}

export interface ResultadoDanfse {
  sucesso: boolean
  chave_acesso: string
  mensagem_erro: string
}

export interface Documento {
  chave_acesso: string
  prestador_cnpj: string
  nsu: string
  tem_pdf: boolean
}

export interface DocumentosPaginados {
  documentos: Documento[]
  total: number
}

export interface Agendamento {
  id: number
  prestador_cnpj: string
  intervalo_minutos: number
  ativo: boolean
  proxima_execucao: string | null
}

export interface AgendamentoInput {
  cnpj: string
  intervalo_minutos: number
}

export interface AutomacaoLog {
  id: number
  prestador_cnpj: string
  tipo: string
  mensagem: string
  created_at: string | null
}

export interface ResultadoDistribuicaoTask {
  status: string
  documentos: number
  ultimo_nsu: string
  operacao_id: number
}

export interface TaskStatus {
  task_id: string
  tipo: "gerar_danfse" | "consultar_distribuicao"
  chave_acesso: string | null
  cnpj: string
  status: "processing" | "completed" | "error"
  progresso: number
  mensagem: string
  resultado: ResultadoDistribuicaoTask | ResultadoDanfse | null
  mensagem_erro: string | null
  criado_em: string
  atualizado_em: string
}

export interface TaskIniciada {
  task_id: string
  status: "processing"
}

export interface HealthCheck {
  status: string
  version: string
}
