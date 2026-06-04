export class NfseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NfseError'
  }
}

export class ErroAutenticacao extends NfseError {
  constructor(message: string) {
    super(message)
    this.name = 'ErroAutenticacao'
  }
}

export class ErroCertificado extends NfseError {
  constructor(message: string) {
    super(message)
    this.name = 'ErroCertificado'
  }
}

export class ErroRateLimit extends NfseError {
  aguardarSegundos: number

  constructor(message: string, aguardarSegundos = 0) {
    super(message)
    this.name = 'ErroRateLimit'
    this.aguardarSegundos = aguardarSegundos
  }
}

export class ErroServidor extends NfseError {
  constructor(message: string) {
    super(message)
    this.name = 'ErroServidor'
  }
}

export class ErroNaoEncontrado extends NfseError {
  constructor(message: string) {
    super(message)
    this.name = 'ErroNaoEncontrado'
  }
}

const MENSAGENS_HTTP: Record<number, string> = {
  400: 'Requisição inválida — verifique os parâmetros enviados',
  401: 'Não autorizado — certifique-se de que o certificado é válido',
  403: 'Acesso negado — o certificado não tem permissão para este recurso',
  404: 'Recurso não encontrado — verifique o identificador informado',
  429: 'Muitas requisições — aguarde antes de novas consultas',
  500: 'Erro interno do servidor ADN',
  502: 'Servidor ADN temporariamente indisponível',
  503: 'Serviço ADN em manutenção',
}

export function levantarPorStatus(statusCode: number): never {
  const msg = MENSAGENS_HTTP[statusCode] ?? `Erro HTTP ${statusCode}`

  if (statusCode === 401 || statusCode === 403) throw new ErroAutenticacao(msg)
  if (statusCode === 404) throw new ErroNaoEncontrado(msg)
  if (statusCode === 429) throw new ErroRateLimit(msg)
  if ([500, 502, 503].includes(statusCode)) throw new ErroServidor(msg)
  if (statusCode === 400) throw new NfseError(msg)

  throw new NfseError(msg)
}
