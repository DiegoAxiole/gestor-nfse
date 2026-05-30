import { NfseData } from './types';

// Helper to format CNPJ or CPF
export function formatCNPJOrCPF(val: string): string {
  if (!val) return '-';
  const raw = val.replace(/\D/g, '');
  if (raw.length === 14) {
    return raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (raw.length === 11) {
    return raw.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return val;
}

// Helper to format CEP
export function formatCEP(val: string): string {
  if (!val) return '-';
  const raw = val.replace(/\D/g, '');
  if (raw.length === 8) {
    return raw.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }
  return val;
}

// Helper to format Phone number
export function formatPhone(val: string): string {
  if (!val || val === '-') return '-';
  const raw = val.replace(/\D/g, '');
  if (raw.length === 10) {
    return raw.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  if (raw.length === 11) {
    return raw.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  return val;
}

// Helper to format Date to Brazilian Standard DD/MM/YYYY
export function formatDate(val: string): string {
  if (!val || val === '-') return '-';
  try {
    if (val.includes('T')) {
      const parts = val.split('T');
      const dateParts = parts[0].split('-');
      const timePart = parts[1].substring(0, 8);
      if (dateParts.length === 3) {
        return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${timePart}`;
      }
    }
    const parts = val.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  } catch (e) {
    // Return original if parsing fails
  }
  return val;
}

// Dictionary for common IBGE codes in the samples
const MUNICIPALITIES_DICT: Record<string, string> = {
  '3304557': 'Rio de Janeiro - RJ',
  '2406908': 'Lucrécia - RN',
  '2504306': 'Catolé do Rocha - PB',
  '3550308': 'São Paulo - SP',
  '3106200': 'Belo Horizonte - MG',
  '4106902': 'Curitiba - PR',
  '4314902': 'Porto Alegre - RS',
};

export function getMunicipalityName(code: string): string {
  if (!code || code === '-') return '-';
  return MUNICIPALITIES_DICT[code] || `${code} (Código Município)`;
}

// Namespace-agnostic element locator
function findElement(parent: Document | Element, localName: string): Element | null {
  const elements = parent.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].localName === localName) {
      return elements[i];
    }
  }
  return null;
}

function getTagValue(parent: Document | Element, localName: string, defaultValue: string = '-'): string {
  const el = findElement(parent, localName);
  return el && el.textContent ? el.textContent.trim() : defaultValue;
}

function getTagFloat(parent: Document | Element, localName: string, defaultValue: number = 0): number {
  const val = getTagValue(parent, localName, '');
  if (!val) return defaultValue;
  const num = parseFloat(val);
  return isNaN(num) ? defaultValue : num;
}

// Main parser function
export function parseNfseXml(xmlString: string, domParserInstance?: DOMParser): NfseData {
  // Use provided DOMParser or fallback to global window DOMParser
  const parser = domParserInstance || (typeof window !== 'undefined' ? new window.DOMParser() : new DOMParser());
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check parsing errors
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Falha ao decodificar arquivo XML. Verifique se o conteúdo é um XML válido da NFS-e.');
  }

  // InfNFSe Id -> Key
  const infNfseEl = findElement(xmlDoc, 'infNFSe');
  let chaveAcesso = '';
  if (infNfseEl) {
    chaveAcesso = infNfseEl.getAttribute('Id') || '';
    chaveAcesso = chaveAcesso.replace(/^NFS/, '');
  }

  const nNFSe = getTagValue(xmlDoc, 'nNFSe', '-');
  const dhProc = getTagValue(xmlDoc, 'dhProc', '-');
  const nDFSe = getTagValue(xmlDoc, 'nDFSe', '-');

  // DPS Tag (Declaração de Prestação de Serviço)
  const dpsEl = findElement(xmlDoc, 'DPS');
  let nDPS = nDFSe !== '-' ? nDFSe : '-';
  let serieDPS = '-';
  let dhEmiDPS = '-';
  let competencia = '-';
  
  if (dpsEl) {
    const infDpsEl = findElement(dpsEl, 'infDPS');
    if (infDpsEl) {
      nDPS = getTagValue(infDpsEl, 'nDPS', nDPS);
      serieDPS = getTagValue(infDpsEl, 'serie', '-');
      dhEmiDPS = getTagValue(infDpsEl, 'dhEmi', '-');
      competencia = getTagValue(infDpsEl, 'dCompet', '-');
    }
  }

  // Emitente (Prestador)
  const emitEl = findElement(xmlDoc, 'emit');
  const prestEl = dpsEl ? findElement(dpsEl, 'prest') : null;
  
  let emitCnpj = '-';
  let emitNome = '-';
  let emitIM = '-';
  let emitPhone = '-';
  let emitEmail = '-';
  let emitLgr = '';
  let emitNro = '';
  let emitBairro = '';
  let emitCep = '';
  let emitMunCode = '';
  let emitUf = '';
  let emitOptanteSimples = 'Não';
  let emitRegimeTributario = 'Regime Geral';

  if (emitEl) {
    emitCnpj = getTagValue(emitEl, 'CNPJ', getTagValue(emitEl, 'CPF', '-'));
    emitNome = getTagValue(emitEl, 'xNome', '-');
    emitIM = getTagValue(emitEl, 'IM', '-');
    emitPhone = getTagValue(emitEl, 'fone', '-');
    emitEmail = getTagValue(emitEl, 'email', '-');
    
    const enderNac = findElement(emitEl, 'enderNac');
    if (enderNac) {
      emitLgr = getTagValue(enderNac, 'xLgr', '');
      emitNro = getTagValue(enderNac, 'nro', '');
      emitBairro = getTagValue(enderNac, 'xBairro', '');
      emitCep = getTagValue(enderNac, 'CEP', '');
      emitMunCode = getTagValue(enderNac, 'cMun', '');
      emitUf = getTagValue(enderNac, 'UF', '');
    }
  }

  if (prestEl) {
    // If not found in emit, check prest
    if (emitCnpj === '-') emitCnpj = getTagValue(prestEl, 'CNPJ', '-');
    const regTrib = findElement(prestEl, 'regTrib');
    if (regTrib) {
      const opSimp = getTagValue(regTrib, 'opSimpNac', '');
      if (opSimp === '1') {
        emitOptanteSimples = 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)';
      } else if (opSimp === '2') {
        emitOptanteSimples = 'Não Optante';
      }
      
      const regEsp = getTagValue(regTrib, 'regEspTrib', '');
      if (regEsp === '1') {
        emitRegimeTributario = 'Microempresa Municipal';
      } else if (regEsp === '2') {
        emitRegimeTributario = 'Estimativa';
      } else if (regEsp === '0' || regEsp === '00' || !regEsp) {
        emitRegimeTributario = 'Nenhum';
      } else {
        emitRegimeTributario = `Regime Especial ${regEsp}`;
      }
    }
  }

  // Tomador
  const tomaEl = dpsEl ? findElement(dpsEl, 'toma') : null;
  let tomaCnpjCpf = '-';
  let tomaNome = '-';
  let tomaIM = '-';
  let tomaPhone = '-';
  let tomaEmail = '-';
  let tomaLgr = '';
  let tomaNro = '';
  let tomaBairro = '';
  let tomaCep = '';
  let tomaMunCode = '';
  let tomaUf = '';

  if (tomaEl) {
    tomaCnpjCpf = getTagValue(tomaEl, 'CNPJ', getTagValue(tomaEl, 'CPF', '-'));
    tomaNome = getTagValue(tomaEl, 'xNome', '-');
    tomaIM = getTagValue(tomaEl, 'IM', '-');
    tomaPhone = getTagValue(tomaEl, 'fone', '-');
    tomaEmail = getTagValue(tomaEl, 'email', '-');

    const endEl = findElement(tomaEl, 'end');
    if (endEl) {
      tomaLgr = getTagValue(endEl, 'xLgr', '');
      tomaNro = getTagValue(endEl, 'nro', '');
      tomaBairro = getTagValue(endEl, 'xBairro', '');
      
      const endNac = findElement(endEl, 'endNac');
      if (endNac) {
        tomaCep = getTagValue(endNac, 'CEP', '');
        tomaMunCode = getTagValue(endNac, 'cMun', '');
        tomaUf = getTagValue(endNac, 'UF', 'PB'); // fallback PB
      } else {
        tomaCep = getTagValue(endEl, 'CEP', '');
        tomaMunCode = getTagValue(endEl, 'cMun', '');
        tomaUf = getTagValue(endEl, 'UF', '');
      }
    }
  }

  // Servico
  const servEl = dpsEl ? findElement(dpsEl, 'serv') : null;
  let cTribNac = '-';
  let cTribMun = '-';
  let xDescServ = '-';
  let locPrestCode = '';
  let paisPrest = 'Brasil';
  
  if (servEl) {
    const cServ = findElement(servEl, 'cServ');
    if (cServ) {
      cTribNac = getTagValue(cServ, 'cTribNac', '-');
      cTribMun = getTagValue(cServ, 'cTribMun', '-');
      xDescServ = getTagValue(cServ, 'xDescServ', '-');
    }
    const locPrest = findElement(servEl, 'locPrest');
    if (locPrest) {
      locPrestCode = getTagValue(locPrest, 'cLocPrestacao', '');
      const cPaisEl = findElement(locPrest, 'cPaisPrestacao');
      if (cPaisEl) paisPrest = cPaisEl.textContent || 'Brasil';
    }
  }

  // Valores / Tributacao Municipal
  const dpsValoresEl = dpsEl ? findElement(dpsEl, 'valores') : null;
  const nfseValoresEl = findElement(xmlDoc, 'valores');

  let valorServico = 0;
  let bcIssqn = 0;
  let aliquota = 0;
  let issqnApurado = 0;
  let tpRetISSQN = 'Não';
  let tribISSQN = 'Operação Tributável';
  let suspensaoExigibilidade = 'Não';
  let descontoIncondicionado = 0;
  let totalDeducoes = 0;

  if (dpsValoresEl) {
    const vServPrest = findElement(dpsValoresEl, 'vServPrest');
    if (vServPrest) {
      valorServico = getTagFloat(vServPrest, 'vServ', 0);
    } else {
      valorServico = getTagFloat(dpsValoresEl, 'vServ', 0);
    }
  }

  if (nfseValoresEl) {
    if (valorServico === 0) valorServico = getTagFloat(nfseValoresEl, 'vServ', 0);
    bcIssqn = getTagFloat(nfseValoresEl, 'vBC', valorServico);
    aliquota = getTagFloat(nfseValoresEl, 'pAliqAplic', 0);
    issqnApurado = getTagFloat(nfseValoresEl, 'vISSQN', 0);
  } else if (dpsValoresEl) {
    bcIssqn = getTagFloat(dpsValoresEl, 'vBC', valorServico);
    aliquota = getTagFloat(dpsValoresEl, 'pAliq', 0);
    issqnApurado = getTagFloat(dpsValoresEl, 'vISSQN', 0);
  }

  if (servEl) {
    const trib = findElement(servEl, 'trib');
    if (trib) {
      const tribMun = findElement(trib, 'tribMun');
      if (tribMun) {
        const ret = getTagValue(tribMun, 'tpRetISSQN', '');
        if (ret === '1') {
          tpRetISSQN = 'Retido pelo Tomador';
        } else if (ret === '2') {
          tpRetISSQN = 'Não Retido (Retido pelo Prestador)';
        } else {
          tpRetISSQN = ret || 'Não';
        }

        const isqnCode = getTagValue(tribMun, 'tribISSQN', '');
        if (isqnCode === '1') {
          tribISSQN = 'Operação Tributável';
        } else if (isqnCode === '2') {
          tribISSQN = 'Exportação de Serviço';
        } else if (isqnCode === '3') {
          tribISSQN = 'Não Incidência';
        } else if (isqnCode === '4') {
          tribISSQN = 'Imune';
        } else {
          tribISSQN = isqnCode || 'Operação Tributável';
        }

        const susp = getTagValue(tribMun, 'tpExigQuote', '');
        if (susp === '1' || susp === 'Sim') {
          suspensaoExigibilidade = 'Sim';
        }
      }
    }
  }

  // Tributacao Federal
  let irrf = 0;
  let contribPrevidenciaria = 0;
  let contribsSociais = 0;
  let pis = 0;
  let cofins = 0;

  if (dpsValoresEl) {
    const trib = findElement(dpsValoresEl, 'trib');
    if (trib) {
      const tribFed = findElement(trib, 'tribFed');
      if (tribFed) {
        irrf = getTagFloat(tribFed, 'vIRRF', 0);
        contribPrevidenciaria = getTagFloat(tribFed, 'vCP', 0);
        contribsSociais = getTagFloat(tribFed, 'vCSLL', 0);
        
        const piscofins = findElement(tribFed, 'piscofins');
        if (piscofins) {
          pis = getTagFloat(piscofins, 'vPis', 0);
          cofins = getTagFloat(piscofins, 'vCofins', 0);
        }
      }
    }
  }

  // Values totals
  let issqnRetido = tpRetISSQN.includes('Tomador') ? issqnApurado : 0;
  let totalRetencoesFederais = irrf + contribPrevidenciaria + contribsSociais;
  let pisCofinsAprio = pis + cofins;
  let valorLiquido = valorServico - issqnRetido - totalRetencoesFederais - pisCofinsAprio;

  if (nfseValoresEl) {
    valorLiquido = getTagFloat(nfseValoresEl, 'vLiq', valorLiquido);
  }

  // IBS CBS fields (New reform - NT 008)
  let ibsCbsData: NfseData['ibsCbs'] | undefined = undefined;
  const ibscbsEl = findElement(xmlDoc, 'IBSCBS');
  if (ibscbsEl) {
    const ibscbsValoresEl = findElement(ibscbsEl, 'valores');
    const totCibsEl = findElement(ibscbsEl, 'totCIBS');
    
    let vBCIbs = 0;
    let pUF = 0;
    let pMun = 0;
    let pCBS = 0;

    if (ibscbsValoresEl) {
      vBCIbs = getTagFloat(ibscbsValoresEl, 'vBC', 0);
      const ufEl = findElement(ibscbsValoresEl, 'uf');
      if (ufEl) pUF = getTagFloat(ufEl, 'pIBSUF', 0) * 100;
      
      const munEl = findElement(ibscbsValoresEl, 'mun');
      if (munEl) pMun = getTagFloat(munEl, 'pIBSMun', 0) * 100;

      const fedEl = findElement(ibscbsValoresEl, 'fed');
      if (fedEl) pCBS = getTagFloat(fedEl, 'pCBS', 0) * 100;
    }

    let vTotNF = valorServico;
    let vIBSTot = 0;
    let vIBSUF = 0;
    let vIBSMun = 0;
    let vCBS = 0;

    if (totCibsEl) {
      vTotNF = getTagFloat(totCibsEl, 'vTotNF', valorServico);
      const gIbs = findElement(totCibsEl, 'gIBS');
      if (gIbs) {
        vIBSTot = getTagFloat(gIbs, 'vIBSTot', 0);
        const gIbsUFTot = findElement(gIbs, 'gIBSUFTot');
        if (gIbsUFTot) vIBSUF = getTagFloat(gIbsUFTot, 'vIBSUF', 0);
        
        const gIbsMunTot = findElement(gIbs, 'gIBSMunTot');
        if (gIbsMunTot) vIBSMun = getTagFloat(gIbsMunTot, 'vIBSMun', 0);
      }

      const gCbs = findElement(totCibsEl, 'gCBS');
      if (gCbs) {
        vCBS = getTagFloat(gCbs, 'vCBS', 0);
      }
    }

    ibsCbsData = {
      vTotNF,
      vIBSTot,
      vIBSUF,
      vIBSMun,
      vCBS,
      ufIbsPct: pUF,
      munIbsPct: pMun,
      fedCbsPct: pCBS,
      cLocalidadeIncid: getTagValue(ibscbsEl, 'cLocalidadeIncid', ''),
      xLocalidadeIncid: getTagValue(ibscbsEl, 'xLocalidadeIncid', ''),
    };
  }

  // Info Complementar
  const infoComplEl = findElement(xmlDoc, 'infoCompl');
  const xInfComp = infoComplEl ? getTagValue(infoComplEl, 'xInfComp', '-') : '-';

  // Construct structured data object
  return {
    chaveAcesso,
    nNFSe,
    competencia,
    dhEmi: formatDate(dhProc !== '-' ? dhProc : dhEmiDPS),
    
    nDPS,
    serieDPS,
    dhEmiDPS: formatDate(dhEmiDPS),

    emitente: {
      cnpjCpf: formatCNPJOrCPF(emitCnpj),
      inscricaoMunicipal: emitIM,
      telefone: formatPhone(emitPhone),
      nomeRazaoSocial: emitNome,
      email: emitEmail,
      endereco: [emitLgr, emitNro, emitBairro].filter(Boolean).join(', '),
      municipio: getMunicipalityName(emitMunCode),
      uf: emitUf,
      cep: formatCEP(emitCep),
      optanteSimples: emitOptanteSimples,
      regimeTributario: emitRegimeTributario,
    },

    tomador: {
      cnpjCpf: formatCNPJOrCPF(tomaCnpjCpf),
      inscricaoMunicipal: tomaIM,
      telefone: formatPhone(tomaPhone),
      nomeRazaoSocial: tomaNome,
      email: tomaEmail,
      endereco: [tomaLgr, tomaNro, tomaBairro].filter(Boolean).join(', '),
      municipio: getMunicipalityName(tomaMunCode),
      uf: tomaUf,
      cep: formatCEP(tomaCep),
    },

    intermediario: {
      identificado: false,
    },

    servico: {
      codigoTributacaoNacional: cTribNac,
      codigoTributacaoMunicipal: cTribMun,
      localPrestacao: getMunicipalityName(locPrestCode),
      paisPrestacao: paisPrest,
      descricao: xDescServ,
    },

    tributacaoMunicipal: {
      tributacaoIssqn: tribISSQN,
      paisResultado: '-',
      municipioIncidencia: getMunicipalityName(locPrestCode),
      regimeEspecial: emitRegimeTributario,
      tipoImunidade: '-',
      suspensaoExigibilidade,
      processoSuspensao: '-',
      beneficioMunicipal: '-',
      
      valorServico,
      descontoIncondicionado,
      totalDeducoes,
      calculoBM: '-',
      bcIssqn,
      aliquota,
      retencaoIssqn: tpRetISSQN,
      issqnApurado,
    },

    tributacaoFederal: {
      irrf,
      contribPrevidenciaria,
      contribsSociais,
      descContribSociais: '-',
      pis,
      cofins,
    },

    valoresTotais: {
      valorServico,
      descontoCondicionado: 0,
      descontoIncondicionado,
      issqnRetido,
      totalRetencoesFederais,
      pisCofinsAprio,
      valorLiquido,
    },

    totaisAproximados: {
      federais: pis + cofins + irrf + contribPrevidenciaria,
      estaduais: 0,
      municipais: issqnApurado,
    },

    ibsCbs: ibsCbsData,
    informacoesComplementares: xInfComp,
  };
}

/**
 * Super conveniente async wrapper function that accepts:
 * - Raw XML String text content
 * - Browser File object or Blob object
 */
export async function parseNfseXmlAsync(input: string | File | Blob, domParserInstance?: DOMParser): Promise<NfseData> {
  if (typeof input !== 'string') {
    if (input instanceof Blob) {
      const text = await input.text();
      return parseNfseXml(text, domParserInstance);
    }
    throw new Error('Entrada inválida. Esperado string de texto XML ou objeto File/Blob do navegador.');
  }
  return parseNfseXml(input, domParserInstance);
}
