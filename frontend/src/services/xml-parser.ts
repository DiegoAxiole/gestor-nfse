export interface NfseParsed {
  numero_nota: string
  data_emissao: string
  valor_servicos: number
  prestador_nome: string
  prestador_cnpj: string
  tomador_nome: string
  tomador_cnpj: string
  discriminacao: string
}

const NFSE_NS = 'http://www.sped.fazenda.gov.br/nfse'

function text(tag: string, parent?: Element | null): string {
  if (!parent) return ''
  return parent.getElementsByTagNameNS(NFSE_NS, tag)[0]?.textContent ?? ''
}

function regexTag(xml: string, tag: string): string {
  const re = new RegExp(`<[^:]*:?${tag}[^>]*>([^<]*)</[^:]*:?${tag}>`, 'i')
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

export function parseNfseXml(xml: string): NfseParsed | null {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) throw new Error('DOMParser error')

    const infNFSe = doc.getElementsByTagNameNS(NFSE_NS, 'infNFSe')[0]
    const emit = infNFSe?.getElementsByTagNameNS(NFSE_NS, 'emit')[0]
    const dpsInf = doc.getElementsByTagNameNS(NFSE_NS, 'infDPS')[0]
    const toma = dpsInf?.getElementsByTagNameNS(NFSE_NS, 'toma')[0]
    const serv = dpsInf?.getElementsByTagNameNS(NFSE_NS, 'serv')[0]
    const valoresDps = dpsInf?.getElementsByTagNameNS(NFSE_NS, 'valores')[0]
    const vServPrest = valoresDps?.getElementsByTagNameNS(NFSE_NS, 'vServPrest')[0]

    return {
      numero_nota: text('nNFSe', infNFSe) || text('nDPS', dpsInf),
      data_emissao: text('dhProc', infNFSe) || text('dhEmi', dpsInf),
      valor_servicos: parseFloat(text('vServ', vServPrest)) || 0,
      prestador_nome: text('xNome', emit),
      prestador_cnpj: text('CNPJ', emit),
      tomador_nome: text('xNome', toma),
      tomador_cnpj: text('CNPJ', toma) || text('CPF', toma),
      discriminacao: text('xDescServ', serv),
    }
  } catch {
    return parseNfseXmlFallback(xml)
  }
}

function parseNfseXmlFallback(xml: string): NfseParsed | null {
  try {
    return {
      numero_nota: regexTag(xml, 'nNFSe') || regexTag(xml, 'nDPS'),
      data_emissao: regexTag(xml, 'dhProc') || regexTag(xml, 'dhEmi'),
      valor_servicos: parseFloat(regexTag(xml, 'vServ')) || 0,
      prestador_nome: regexTag(xml, 'xNome'),
      prestador_cnpj: regexTag(xml, 'CNPJ'),
      tomador_nome: '',
      tomador_cnpj: '',
      discriminacao: regexTag(xml, 'xDescServ'),
    }
  } catch {
    return null
  }
}
