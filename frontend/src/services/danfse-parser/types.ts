export interface NfseData {
  // 1. Identificação da NFS-e
  chaveAcesso: string;
  nNFSe: string;
  competencia: string;
  dhEmi: string; // Data e Hora da emissão da NFS-e
  
  // 2. DPS (Declaração de Prestação de Serviço)
  nDPS: string;
  serieDPS: string;
  dhEmiDPS: string;

  // 3. Emitente (Prestador)
  emitente: {
    cnpjCpf: string;
    inscricaoMunicipal: string;
    telefone: string;
    nomeRazaoSocial: string;
    email: string;
    endereco: string;
    municipio: string;
    uf: string;
    cep: string;
    optanteSimples: string;
    regimeTributario: string;
  };

  // 4. Tomador do Serviço
  tomador: {
    cnpjCpf: string;
    inscricaoMunicipal: string;
    telefone: string;
    nomeRazaoSocial: string;
    email: string;
    endereco: string;
    municipio: string;
    uf: string;
    cep: string;
  };

  // 5. Intermediário (opcional)
  intermediario: {
    identificado: boolean;
    nomeRazaoSocial?: string;
    cnpjCpf?: string;
    inscricaoMunicipal?: string;
  };

  // 6. Serviço Prestado
  servico: {
    codigoTributacaoNacional: string;
    codigoTributacaoMunicipal: string;
    localPrestacao: string;
    paisPrestacao: string;
    descricao: string;
  };

  // 7. Tributação Municipal
  tributacaoMunicipal: {
    tributacaoIssqn: string;
    paisResultado: string;
    municipioIncidencia: string;
    regimeEspecial: string;
    tipoImunidade: string;
    suspensaoExigibilidade: string;
    processoSuspensao: string;
    beneficioMunicipal: string;
    
    // Valores
    valorServico: number;
    descontoIncondicionado: number;
    totalDeducoes: number;
    calculoBM: string;
    bcIssqn: number;
    aliquota: number; // ex: 2.00%
    retencaoIssqn: string;
    issqnApurado: number;
  };

  // 8. Tributação Federal
  tributacaoFederal: {
    irrf: number;
    contribPrevidenciaria: number;
    contribsSociais: number;
    descContribSociais: string;
    pis: number;
    cofins: number;
  };

  // 9. Valor Total da NFS-e
  valoresTotais: {
    valorServico: number;
    descontoCondicionado: number;
    descontoIncondicionado: number;
    issqnRetido: number;
    totalRetencoesFederais: number;
    pisCofinsAprio: number;
    valorLiquido: number;
  };

  // 10. Totais Aproximados dos Tributos (IBPT)
  totaisAproximados: {
    federais: number;
    estaduais: number;
    municipais: number;
  };

  // 11. IBS / CBS (Reforma Tributária - campos opcionais novos - NT008)
  ibsCbs?: {
    vTotNF: number;
    vIBSTot: number;
    vIBSUF: number;
    vIBSMun: number;
    vCBS: number;
    ufIbsPct?: number;
    munIbsPct?: number;
    fedCbsPct?: number;
    cLocalidadeIncid?: string;
    xLocalidadeIncid?: string;
  };

  // 12. Informações Complementares
  informacoesComplementares: string;
}
