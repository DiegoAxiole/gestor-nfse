import https from 'node:https'
import { URL } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join, dirname } from 'node:path'

import { CertificadoA1 } from './auth.js'
import { ErroRateLimit, levantarPorStatus } from './errors.js'
import type {
  Ambiente,
  Configuracao,
  CertificadoInfo,
  DFeDocumento,
  DFeLoteResponse,
  DownloadResult,
  SincronizarResult,
} from './models.js'

const INTERVALO_DISTRIBUICAO_HORAS = 1
const MAX_RETRIES = 3
const RETRY_BACKOFF = 2000
const RATE_LIMIT_FILE = join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.consulta_nfse_api',
  'rate_limit.json',
)

function normalizarCnpj(v: string): string {
  return v.replace(/[.\-/]/g, '')
}

class RateLimiter {
  private _dados: Record<string, number> = {}

  constructor() {
    this._carregar()
  }

  private _carregar(): void {
    try {
      const raw = readFileSync(RATE_LIMIT_FILE, 'utf-8')
      this._dados = JSON.parse(raw)
    } catch {
      this._dados = {}
    }
  }

  private _salvar(): void {
    try {
      mkdirSync(dirname(RATE_LIMIT_FILE), { recursive: true })
      writeFileSync(RATE_LIMIT_FILE, JSON.stringify(this._dados, null, 2), 'utf-8')
    } catch { /* ignora */ }
  }

  registrar(chave: string): void {
    this._dados[chave] = Date.now()
    this._salvar()
  }

  verificarIntervalo(chave: string): number | null {
    const ts = this._dados[chave]
    if (!ts) return null
    const decorrido = Date.now() - ts
    const minMs = INTERVALO_DISTRIBUICAO_HORAS * 3600 * 1000
    if (decorrido < minMs) return minMs - decorrido
    return null
  }

  aguardarSeNecessario(chave: string, force = false): void {
    const esperar = this.verificarIntervalo(chave)
    if (esperar !== null && esperar > 0 && !force) {
      throw new ErroRateLimit(
        `Aguardar ${(esperar / 60000).toFixed(1)} min ate proxima consulta ` +
          `(intervalo minimo de ${INTERVALO_DISTRIBUICAO_HORAS}h, regra ADN 6.4)`,
        Math.ceil(esperar / 1000),
      )
    }
  }
}

export class NfseClient {
  private _cert: CertificadoA1
  private _config: Configuracao
  private _rateLimiter: RateLimiter
  private _baseUrl: string
  private _pemPaths: ReturnType<typeof CertificadoA1.prototype.exportarPem> | null = null
  private _debug = false

  constructor(config?: Configuracao) {
    this._config = config ?? this._loadFromEnv()
    this._cert = new CertificadoA1(this._config.certificadoPfx, this._config.senha)
    this._rateLimiter = new RateLimiter()
    this._baseUrl =
      this._config.ambiente === 'homologacao'
        ? 'https://adn.producaorestrita.nfse.gov.br/contribuintes'
        : 'https://adn.nfse.gov.br/contribuintes'
  }

  private _loadFromEnv(): Configuracao {
    const env = this._parseEnvFile()
    return {
      certificadoPfx:
        env.NFSE_CERTIFICADO_PFX ?? process.env.NFSE_CERTIFICADO_PFX ?? '',
      senha:
        env.NFSE_SENHA_CERTIFICADO ?? process.env.NFSE_SENHA_CERTIFICADO ?? '',
      cnpj:
        env.NFSE_CNPJ_PRESTADOR ??
        process.env.NFSE_CNPJ_PRESTADOR ??
        undefined,
      ambiente:
        ((env.NFSE_AMBIENTE ??
          process.env.NFSE_AMBIENTE ??
          'producao') as Ambiente),
    }
  }

  private _parseEnvFile(): Record<string, string> {
    try {
      const content = readFileSync('.env', 'utf-8')
      const vars: Record<string, string> = {}
      for (const line of content.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const key = t.slice(0, eq).trim()
        let val = t.slice(eq + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        vars[key] = val
      }
      return vars
    } catch {
      return {}
    }
  }

  get infoCert(): CertificadoInfo {
    return this._cert.info
  }

  get tipoContribuinte(): 'PF' | 'PJ' {
    if (!this._cert.cnpj) return 'PJ'
    return normalizarCnpj(this._cert.cnpj).length === 11 ? 'PF' : 'PJ'
  }

  get docConsulta(): string {
    const raw = this._cert.cnpj ?? ''
    const parts = raw.split(':')
    return normalizarCnpj(parts[parts.length - 1])
  }

  setDebug(active: boolean): void {
    this._debug = active
  }

  private _getAgent(): https.Agent {
    if (!this._pemPaths) {
      this._pemPaths = this._cert.exportarPem()
    }
    return new https.Agent({
      cert: readFileSync(this._pemPaths.certPath),
      key: readFileSync(this._pemPaths.keyPath),
      rejectUnauthorized: true,
    })
  }

  private _parametrosConsulta(
    doc: string,
  ): { param: string; value: string } {
    const num = normalizarCnpj(doc)
    return {
      param: num.length === 11 ? 'cpfConsulta' : 'cnpjConsulta',
      value: num,
    }
  }

  private async _request(
    method: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<any> {
    const url = new URL(`${this._baseUrl}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
      }
    }
    const agent = this._getAgent()

    if (this._debug) {
      console.log(`[NFSE] ${method} ${url.toString()}`)
    }

    return new Promise((resolve, reject) => {
      let tentativa = 0

      const doRequest = () => {
        const req = https.request(
          url.toString(),
          {
            method,
            agent,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            rejectUnauthorized: true,
          },
          (res) => {
            const chunks: Buffer[] = []
            res.on('data', (chunk: Buffer) => chunks.push(chunk))
            res.on('end', () => {
              const body = Buffer.concat(chunks).toString('utf-8')

              if (this._debug) {
                console.log(`[NFSE] ${res.statusCode}`)
                if (body.length < 2000) console.log(body)
              }

              if (res.statusCode && res.statusCode >= 400) {
                try {
                  const json = JSON.parse(body)
                  if (json?.Erros?.[0]?.Descricao) {
                    reject(new Error(json.Erros[0].Descricao))
                    return
                  }
                } catch { /* nao e JSON */ }
                levantarPorStatus(res.statusCode)
                return
              }

              try {
                resolve(JSON.parse(body))
              } catch {
                reject(new Error(`Resposta invalida: ${body.slice(0, 200)}`))
              }
            })
          },
        )

        req.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
            tentativa++
            if (tentativa < MAX_RETRIES) {
              const backoff = RETRY_BACKOFF * Math.pow(2, tentativa)
              if (this._debug) {
                console.log(`[NFSE] Retry ${tentativa}/${MAX_RETRIES}`)
              }
              setTimeout(doRequest, backoff)
              return
            }
          }
          reject(err)
        })

        req.setTimeout(60000, () => req.destroy(new Error('Timeout')))
        req.end()
      }

      doRequest()
    })
  }

  async consultarPorNsu(
    nsu: number,
    docConsultaOverride?: string,
    force = false,
  ): Promise<DFeLoteResponse> {
    const doc = docConsultaOverride ?? this.docConsulta
    const { param, value } = this._parametrosConsulta(doc)

    const chaveRate = `distribuicao:${value}`
    this._rateLimiter.aguardarSeNecessario(chaveRate, force)
    this._rateLimiter.registrar(chaveRate)

    const raw = await this._request('GET', `/dfe/${nsu}`, {
      [param]: value,
      lote: 'true',
    })

    return this._parseResposta(raw)
  }

  private _parseResposta(raw: any): DFeLoteResponse {
    const docs: DFeDocumento[] = (raw.LoteDFe ?? []).map((d: any) => ({
      nsu: d.NSU,
      chaveAcesso: d.ChaveAcesso ?? '',
      tipoDocumento: d.TipoDocumento ?? null,
      tipoEvento: d.TipoEvento ?? null,
      dataHoraGeracao: d.DataHoraGeracao,
      xmlCompactado: d.ArquivoXml ?? '',
      cnpjEmitente: d.CnpjEmitente ?? null,
      cnpjDestinatario: d.CnpjDestinatario ?? null,
      valorServicos: d.ValorServicos ?? null,
    }))

    return {
      statusProcessamento: raw.StatusProcessamento ?? '',
      loteDfe: docs,
      ultimoNsu: raw.UltimoNSU ?? null,
      maxNsu: raw.MaxNSU ?? null,
    }
  }

  descompactarXml(conteudo: string): string {
    return gunzipSync(Buffer.from(conteudo, 'base64')).toString('utf-8')
  }

  async sincronizar(options?: {
    nsu?: number
    destino?: string
    force?: boolean
  }): Promise<SincronizarResult> {
    const nsu = options?.nsu ?? 0
    const destino = options?.destino

    const resposta = await this.consultarPorNsu(nsu, undefined, options?.force)

    const documentos: DownloadResult[] = resposta.loteDfe.map((doc) => {
      const xml = this.descompactarXml(doc.xmlCompactado)

      if (destino) {
        const data = new Date(doc.dataHoraGeracao)
        const pasta = `${data.getFullYear()}.${String(data.getMonth() + 1).padStart(2, '0')}`
        mkdirSync(join(destino, pasta), { recursive: true })
        const arquivo = join(destino, pasta, `${doc.chaveAcesso}.xml`)
        writeFileSync(arquivo, xml, 'utf-8')
      }

      return {
        nsu: doc.nsu,
        chaveAcesso: doc.chaveAcesso,
        tipo: doc.tipoDocumento ?? 'NFSE',
        tipoEvento: doc.tipoEvento,
        dataHoraGeracao: doc.dataHoraGeracao,
        xml,
      }
    })

    return {
      status: resposta.statusProcessamento,
      documentos,
      ultimoNsu: resposta.ultimoNsu,
    }
  }

  fechar(): void {
    if (this._pemPaths) {
      this._pemPaths.limpar()
      this._pemPaths = null
    }
  }
}
