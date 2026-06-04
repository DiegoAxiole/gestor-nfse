import { randomBytes, createPrivateKey } from 'node:crypto'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import forge from 'node-forge'

export interface CertPemPaths {
  certPath: string
  keyPath: string
  limpar: () => void
}

export interface CertificadoA1Info {
  cnpj: string | null
  valido: boolean
  validoAte: string
  emissor: string
  arquivo: string
}

export class CertificadoA1 {
  readonly arquivo: string
  private _certPem: string | null = null
  private _keyPem: string | null = null
  private _cnpj: string | null = null
  private _validoAte: Date | null = null
  private _validoDesde: Date | null = null
  private _emissor: string | null = null
  private _tempDir: string | null = null

  constructor(arquivoPfx: string, senha: string) {
    this.arquivo = arquivoPfx
    const buffer = readFileSync(arquivoPfx)
    this._parsePkcs12(buffer, senha)
  }

  private _parsePkcs12(buffer: Buffer, senha: string): void {
    const p12 = forge.pkcs12.pkcs12FromAsn1(
      forge.asn1.fromDer(forge.util.createBuffer(buffer.toString('binary'))),
      senha,
    )

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag }) ||
                    p12.getBags({ bagType: forge.pki.oids.keyBag })

    const certEntry = certBags?.[forge.pki.oids.certBag]?.[0]
    const keyEntry = keyBags?.[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ||
                     keyBags?.[forge.pki.oids.keyBag]?.[0]

    if (!certEntry?.cert) throw new Error('Certificado nao encontrado no PFX')
    if (!keyEntry?.key) throw new Error('Chave privada nao encontrada no PFX')

    const cert = certEntry.cert
    const key = keyEntry.key

    this._certPem = forge.pki.certificateToPem(cert)
    this._keyPem = forge.pki.privateKeyToPem(key)
    this._validoAte = cert.validity.notAfter
    this._validoDesde = cert.validity.notBefore

    this._emissor =
      cert.issuer?.attributes
        ?.map((a: forge.pki.CertificateField) => `${a.name}=${a.value}`)
        .join(', ') ?? 'desconhecido'

    if (cert.subject?.attributes) {
      const cn = cert.subject.attributes.find(
        (a: forge.pki.CertificateField) => a.name === 'commonName',
      )
      if (cn) this._cnpj = String(cn.value)
    }
  }

  get cnpj(): string | null {
    return this._cnpj
  }

  get certPem(): string {
    return this._certPem!
  }

  get keyPem(): string {
    return this._keyPem!
  }

  get info(): CertificadoA1Info {
    return {
      cnpj: this._cnpj,
      valido: this._valido,
      validoAte: this._validoAte?.toISOString() ?? '',
      emissor: this._emissor ?? '',
      arquivo: this.arquivo,
    }
  }

  private get _valido(): boolean {
    if (!this._validoAte || !this._validoDesde) return false
    const agora = new Date()
    return agora >= this._validoDesde && agora <= this._validoAte
  }

  exportarPem(): CertPemPaths {
    const dir = mkdtempSync(join(tmpdir(), 'cert-a1-'))
    const suffix = randomBytes(4).toString('hex')
    const certPath = join(dir, `cert-${suffix}.pem`)
    const keyPath = join(dir, `key-${suffix}.pem`)

    writeFileSync(certPath, this._certPem!)
    writeFileSync(keyPath, this._keyPem!)
    this._tempDir = dir

    return { certPath, keyPath, limpar: () => this.limpar() }
  }

  limpar(): void {
    if (this._tempDir) {
      try {
        rmSync(this._tempDir, { recursive: true })
      } catch { /* ja removido */ }
      this._tempDir = null
    }
  }
}
