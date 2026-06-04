export type Ambiente = 'producao' | 'homologacao'

export interface Configuracao {
  certificadoPfx: string
  senha: string
  cnpj?: string
  ambiente?: Ambiente
}

export interface CertificadoInfo {
  cnpj: string | null
  valido: boolean
  validoAte: string
  emissor: string
  arquivo: string
}

export interface DFeDocumento {
  nsu: number
  chaveAcesso: string
  tipoDocumento: string | null
  tipoEvento: string | null
  dataHoraGeracao: string
  xmlCompactado: string
  cnpjEmitente: string | null
  cnpjDestinatario: string | null
  valorServicos: string | null
}

export interface DFeLoteResponse {
  statusProcessamento: string
  loteDfe: DFeDocumento[]
  ultimoNsu: string | null
  maxNsu: string | null
}

export interface DownloadResult {
  nsu: number
  chaveAcesso: string
  tipo: string
  tipoEvento: string | null
  dataHoraGeracao: string
  xml: string
}

export interface SincronizarResult {
  status: string
  documentos: DownloadResult[]
  ultimoNsu: string | null
}
