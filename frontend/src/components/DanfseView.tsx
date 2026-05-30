import { useState, useEffect } from 'react';
import type { NfseData } from '../services/danfse-parser';
import {
  formatCEP,
  formatPhone,
  formatDate,
} from '../services/danfse-parser';
import QRCode from 'qrcode';
import { maskRazao, maskEmail, maskChave, formatCnpj } from '../utils';

interface DanfseViewProps {
  data: NfseData;
  lgpdAtivo?: boolean;
}

export default function DanfseView({ data, lgpdAtivo = false }: DanfseViewProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    const verificationUrl = data.chaveAcesso 
      ? `https://www.nfse.gov.br/consultanacional/chaveacesso/${data.chaveAcesso}`
      : 'https://www.nfse.gov.br/consultanacional';
      
    QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 150,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
    .then(url => setQrCodeUrl(url))
    .catch(err => console.error('Erro ao gerar QR Code:', err));
  }, [data.chaveAcesso]);

  const formatBrl = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const formatPct = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return '0,00 %';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + ' %';
  };

  return (
    <div className="flex flex-col items-center w-full" id="danfse-view-wrapper">

      <div 
        className="w-full max-w-4xl bg-white select-text transition-all origin-top duration-200 print:w-full print:max-w-none print:shadow-none print:p-0 print:border-0 rounded-sm border border-gray-300 shadow-md p-4 overflow-x-auto"
        id="danfse-document-view"
      >
        <div 
          className="mx-auto text-black font-sans leading-tight text-[11px]"
          style={{ 
            transform: `scale(${zoom / 100})`, 
            transformOrigin: 'top center',
            width: '100%',
            maxWidth: '210mm',
            minWidth: '780px',
            marginBottom: zoom !== 100 ? `${(zoom - 100) * 10}px` : '0px'
          }}
        >
          <div className="border-[1.5px] border-black bg-white">
            
            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-2 flex flex-col justify-center items-center">
                <div className="flex items-baseline gap-1 select-none">
                  <span className="text-2xl font-black text-[#1e4620] tracking-tighter">NFS</span>
                  <span className="text-xl font-bold text-[#cc9c1d]">e</span>
                </div>
                <div className="text-[7px] text-[#1e4620] font-bold text-center mt-0.5 leading-none tracking-wide">
                  Nota Fiscal de <br /> Serviço eletrônica
                </div>
              </div>

              <div className="col-span-5 border-r border-black p-2 flex flex-col justify-center text-center">
                <h1 className="text-sm font-black tracking-tight text-black leading-none">DANFSe v1.0</h1>
                <h2 className="text-[10px] font-bold tracking-tight text-black mt-0.5 uppercase">Documento Auxiliar da NFS-e</h2>
              </div>

              <div className="col-span-4 p-2 flex flex-col justify-center items-end text-right">
                <div className="text-[8px] font-bold text-gray-500 uppercase">Município Autorizador</div>
                <div className="text-xs font-black tracking-tight text-black">{lgpdAtivo ? maskRazao(data.emitente.municipio.replace(/ - \w{2}$/, '')) || '-' : data.emitente.municipio.replace(/ - \w{2}$/, '') || '-'}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-9 border-r border-black p-1.5">
                <div className="text-[7px] font-bold text-black uppercase">Chave de Acesso da NFS-e</div>
                <div className="text-xs font-mono font-black tracking-widest text-black mt-0.5 select-all">
                  {lgpdAtivo ? maskChave(data.chaveAcesso) : (data.chaveAcesso.match(/.{1,4}/g)?.join(' ') || data.chaveAcesso)}
                </div>
              </div>
              <div className="col-span-3 p-1.5 flex items-center justify-center">
                <div className="text-[7.5px] font-bold text-black text-center leading-none">
                  CONSULTA NACIONAL<br />
                  <span className="text-[6.5px] font-semibold text-gray-600 mt-1 block">www.nfse.gov.br</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-9 border-r border-black grid grid-cols-3">
                <div className="border-r border-b border-black p-1">
                  <div className="text-[7px] font-bold text-black uppercase">Número da NFS-e</div>
                  <div className="text-xs font-bold text-black">{lgpdAtivo ? maskRazao(data.nNFSe) : data.nNFSe}</div>
                </div>
                <div className="border-r border-b border-black p-1">
                  <div className="text-[7px] font-bold text-black uppercase">Competência da NFS-e</div>
                  <div className="text-xs font-bold text-black">{formatDate(data.competencia.split('T')[0])}</div>
                </div>
                <div className="border-b border-black p-1">
                  <div className="text-[7px] font-bold text-black uppercase">Data e Hora de emissão</div>
                  <div className="text-xs font-bold text-black">{formatDate(data.dhEmi)}</div>
                </div>

                <div className="border-r border-black p-1">
                  <div className="text-[7px] font-bold text-black uppercase">Número da DPS</div>
                  <div className="text-xs font-bold text-black">{lgpdAtivo ? maskRazao(data.nDPS) : data.nDPS}</div>
                </div>
                <div className="border-r border-black p-1">
                  <div className="text-[7px] font-bold text-black uppercase">Série da DPS</div>
                  <div className="text-xs font-bold text-black">{lgpdAtivo ? "***" : data.serieDPS}</div>
                </div>
                <div className="p-1">
                  <div className="text-[7px] font-bold text-black uppercase">Data e Hora de emissão dps</div>
                  <div className="text-xs font-bold text-black">{formatDate(data.dhEmiDPS)}</div>
                </div>
              </div>

              <div className="col-span-3 p-1 flex gap-2 items-center justify-start bg-slate-50 print:bg-white">
                {lgpdAtivo ? (
                  <div className="w-11 h-11 flex-shrink-0 border border-gray-300 bg-gray-100 flex items-center justify-center text-gray-400 select-none">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 9h1v1H9zM14 9h1v1h-1zM9 14h1v1H9zM14 14h1v1h-1z" />
                    </svg>
                  </div>
                ) : qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code de Verificação" 
                    className="w-11 h-11 flex-shrink-0 p-0.5 border border-black bg-white select-none pointer-events-none"
                  />
                ) : (
                  <svg className="w-10 h-10 flex-shrink-0 text-black p-0.5 border border-black bg-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.25 2.25H6.75V6.75H2.25V2.25Z M3.75 3.75V5.25H5.25V3.75H3.75Z" />
                    <path d="M17.25 2.25H21.75V6.75H17.25V2.25Z M18.75 3.75V5.25H20.25V3.75H18.75Z" />
                    <path d="M2.25 17.25H6.75V21.75H2.25V17.25Z M3.75 18.75V20.25H5.25V18.75H3.75Z" />
                    <path d="M11 2.25H13V7H11V2.25Z" />
                    <path d="M11 11H13V15H11V11Z" />
                    <path d="M17.25 11H21.75V13H17.25V11Z" />
                    <path d="M15 15H17V17H15V15Z" />
                    <path d="M17.25 17H21.75V21.75H17.25V17Z M18.75 18.25V20.25H20.25V18.25H18.75Z" />
                  </svg>
                )}
                <div className="text-[6.5px] leading-tight text-gray-700 font-bold">
                  CONSULTA PORTAL<br />
                  Leitura de QR Code<br />
                  ou Chave de Acesso
                </div>
              </div>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-emerald-500 rounded-sm print:hidden"></span>
                EMITENTE DA NFS-e (Prestador do Serviço)
              </span>
            </div>
            
            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">CNPJ / CPF / NIF</div>
                <div className="text-xs font-bold text-black">{formatCnpj(data.emitente.cnpjCpf, lgpdAtivo)}</div>
              </div>
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Inscrição Municipal</div>
                <div className="text-xs font-bold text-black">{data.emitente.inscricaoMunicipal}</div>
              </div>
              <div className="col-span-4 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Telefone</div>
                <div className="text-xs font-bold text-black">{lgpdAtivo ? maskRazao(formatPhone(data.emitente.telefone)) : formatPhone(data.emitente.telefone)}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-7 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Nome / Nome Empresarial</div>
                <div className="text-xs font-black text-black tracking-tight">{lgpdAtivo ? maskRazao(data.emitente.nomeRazaoSocial) : data.emitente.nomeRazaoSocial}</div>
              </div>
              <div className="col-span-5 p-1">
                <div className="text-[7px] font-bold text-black uppercase">E-mail</div>
                <div className="text-xs font-bold text-black">{lgpdAtivo ? maskEmail(data.emitente.email) : data.emitente.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-13 border-b border-black grid-flow-col">
              <div className="col-span-7 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Endereço</div>
                <div className="text-xs font-bold text-black truncate">{lgpdAtivo ? maskRazao(data.emitente.endereco) : data.emitente.endereco}</div>
              </div>
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Município</div>
                <div className="text-xs font-bold text-black">{lgpdAtivo ? maskRazao(data.emitente.municipio) : data.emitente.municipio}</div>
              </div>
              <div className="col-span-2 p-1">
                <div className="text-[7px] font-bold text-black uppercase">CEP</div>
                <div className="text-xs font-bold text-black">{lgpdAtivo ? `***-${formatCEP(data.emitente.cep).slice(-3)}` : formatCEP(data.emitente.cep)}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-6 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Simples Nacional na Competência</div>
                <div className="text-xs font-bold text-black">{data.emitente.optanteSimples}</div>
              </div>
              <div className="col-span-6 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Regime de Apuração Tributária</div>
                <div className="text-xs font-bold text-black">{data.emitente.regimeTributario}</div>
              </div>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm print:hidden"></span>
                TOMADOR DO SERVIÇO
              </span>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">CNPJ / CPF / NIF</div>
                <div className="text-xs font-bold text-black">{formatCnpj(data.tomador.cnpjCpf, lgpdAtivo)}</div>
              </div>
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Inscrição Municipal</div>
                <div className="text-xs font-bold text-black">{data.tomador.inscricaoMunicipal}</div>
              </div>
              <div className="col-span-4 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Telefone</div>
                <div className="text-xs font-bold text-black">{lgpdAtivo ? maskRazao(formatPhone(data.tomador.telefone)) : formatPhone(data.tomador.telefone)}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-7 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Nome / Nome Empresarial</div>
                <div className="text-xs font-black text-black tracking-tight">{lgpdAtivo ? maskRazao(data.tomador.nomeRazaoSocial) : data.tomador.nomeRazaoSocial}</div>
              </div>
              <div className="col-span-5 p-1">
                <div className="text-[7px] font-bold text-black uppercase">E-mail</div>
                <div className="text-xs font-bold text-black">{lgpdAtivo ? maskEmail(data.tomador.email) : data.tomador.email}</div>
              </div>
            </div>

            <div className="grid grid-cols-13 border-b border-black grid-flow-col">
              <div className="col-span-7 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Endereço</div>
                <div className="text-xs font-bold text-black truncate">{lgpdAtivo ? maskRazao(data.tomador.endereco) : data.tomador.endereco}</div>
              </div>
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Município</div>
                <div className="text-xs font-bold text-black">
                  {lgpdAtivo ? maskRazao(data.tomador.municipio) : `${data.tomador.municipio} ${data.tomador.uf ? `- ${data.tomador.uf}` : ''}`}
                </div>
              </div>
              <div className="col-span-2 p-1">
                <div className="text-[7px] font-bold text-black uppercase">CEP</div>
                <div className="text-xs font-bold text-black">{lgpdAtivo ? `***-${formatCEP(data.tomador.cep).slice(-3)}` : formatCEP(data.tomador.cep)}</div>
              </div>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 text-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase">
                INTERMEDIÁRIO DO SERVIÇO NÃO IDENTIFICADO NA NFS-e
              </span>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-amber-500 rounded-sm print:hidden"></span>
                SERVIÇO PRESTADO
              </span>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Código de Tributação Nacional</div>
                <div className="text-[10px] font-bold text-black leading-none mt-1">{data.servico.codigoTributacaoNacional}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Código de Tributação Municipal</div>
                <div className="text-[10px] font-semibold text-black leading-none mt-1">{data.servico.codigoTributacaoMunicipal}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Local da Prestação</div>
                <div className="text-[10px] font-semibold text-black leading-none mt-1">{data.servico.localPrestacao}</div>
              </div>
              <div className="col-span-3 p-1">
                <div className="text-[7px] font-bold text-black uppercase">País da Prestação</div>
                <div className="text-[10px] font-semibold text-black leading-none mt-1">{data.servico.paisPrestacao}</div>
              </div>
            </div>

            <div className="p-1.5 min-h-[70px] border-b border-black flex flex-col bg-stone-50/20">
              <div className="text-[7px] font-bold text-black uppercase mb-1">Descrição do Serviço</div>
              <p className="text-[10px] font-bold text-black leading-relaxed whitespace-pre-wrap select-all font-mono">
                {data.servico.descricao}
              </p>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-indigo-500 rounded-sm print:hidden"></span>
                TRIBUTAÇÃO MUNICIPAL
              </span>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Tributação do ISSQN</div>
                <div className="text-[10px] font-bold text-black leading-tight mt-0.5">{data.tributacaoMunicipal.tributacaoIssqn}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">País Resultado do Serviço</div>
                <div className="text-[10px] font-bold text-black leading-tight mt-0.5">{data.tributacaoMunicipal.paisResultado}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Município de Incidência</div>
                <div className="text-[10px] font-bold text-black leading-tight mt-0.5">{data.tributacaoMunicipal.municipioIncidencia}</div>
              </div>
              <div className="col-span-3 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Regime Especial de Tributação</div>
                <div className="text-[10px] font-bold text-black leading-tight mt-0.5">{data.tributacaoMunicipal.regimeEspecial}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Tipo de Imunidade</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoMunicipal.tipoImunidade}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Suspensão de Exigibilidade?</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoMunicipal.suspensaoExigibilidade}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Processo de Suspensão</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoMunicipal.processoSuspensao}</div>
              </div>
              <div className="col-span-3 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Benefício Municipal</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoMunicipal.beneficioMunicipal}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Valor do Serviço</div>
                <div className="text-[11px] font-black text-black mt-0.5">{formatBrl(data.tributacaoMunicipal.valorServico)}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Desconto Incondicionado</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoMunicipal.descontoIncondicionado > 0 ? formatBrl(data.tributacaoMunicipal.descontoIncondicionado) : '-'}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Deduções / Reduções</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoMunicipal.totalDeducoes > 0 ? formatBrl(data.tributacaoMunicipal.totalDeducoes) : '-'}</div>
              </div>
              <div className="col-span-3 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Cálculo do BM</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoMunicipal.calculoBM}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">BC ISSQN</div>
                <div className="text-[11px] font-black text-black mt-0.5">{formatBrl(data.tributacaoMunicipal.bcIssqn)}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Alíquota Aplicada</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{formatPct(data.tributacaoMunicipal.aliquota)}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Retenção do ISSQN</div>
                <div className="text-[10px] font-bold text-black mt-0.5 text-red-700">{data.tributacaoMunicipal.retencaoIssqn}</div>
              </div>
              <div className="col-span-3 p-1">
                <div className="text-[7px] font-bold text-black uppercase">ISSQN Apurado</div>
                <div className="text-[11px] font-black text-black mt-0.5">{formatBrl(data.tributacaoMunicipal.issqnApurado)}</div>
              </div>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-violet-500 rounded-sm print:hidden"></span>
                TRIBUTAÇÃO FEDERAL
              </span>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">IRRF</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoFederal.irrf > 0 ? formatBrl(data.tributacaoFederal.irrf) : '-'}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Contr. Previdenciária - Retida</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoFederal.contribPrevidenciaria > 0 ? formatBrl(data.tributacaoFederal.contribPrevidenciaria) : '-'}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Contr. Sociais - Retidas</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoFederal.contribsSociais > 0 ? formatBrl(data.tributacaoFederal.contribsSociais) : '-'}</div>
              </div>
              <div className="col-span-3 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Desc. Contrib. Sociais</div>
                <div className="text-[10px] font-bold text-slate-500 mt-0.5 text-center truncate">{data.tributacaoFederal.descContribSociais}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-6 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">PIS - Débito / Apuração Própria</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoFederal.pis > 0 ? formatBrl(data.tributacaoFederal.pis) : '-'}</div>
              </div>
              <div className="col-span-6 p-1">
                <div className="text-[7px] font-bold text-black uppercase">COFINS - Débito / Apuração Própria</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.tributacaoFederal.cofins > 0 ? formatBrl(data.tributacaoFederal.cofins) : '-'}</div>
              </div>
            </div>

            {data.ibsCbs && (
              <>
                <div className="bg-emerald-900 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
                  <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-emerald-400 rounded-sm print:hidden"></span>
                    Reforma Tributária (Campos IBS e CBS do Sped Nacional)
                  </span>
                </div>
                
                <div className="grid grid-cols-12 border-b border-black bg-[#fafdfb] print:bg-white">
                  <div className="col-span-3 border-r border-black p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">Valor Total do Documento</div>
                    <div className="text-[10px] font-black text-black mt-0.5">{formatBrl(data.ibsCbs.vTotNF)}</div>
                  </div>
                  <div className="col-span-3 border-r border-black p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">Alíquota Efetiva CBS (Fed)</div>
                    <div className="text-[10px] font-bold text-black mt-0.5">{formatPct(data.ibsCbs.fedCbsPct)}</div>
                  </div>
                  <div className="col-span-3 border-r border-black p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">Alíquota Efetiva IBS (UF)</div>
                    <div className="text-[10px] font-bold text-black mt-0.5">{formatPct(data.ibsCbs.ufIbsPct)}</div>
                  </div>
                  <div className="col-span-3 p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">Alíquota Efetiva IBS (Mun)</div>
                    <div className="text-[10px] font-bold text-black mt-0.5">{formatPct(data.ibsCbs.munIbsPct)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-12 border-b border-black bg-[#fafdfb] print:bg-white">
                  <div className="col-span-3 border-r border-black p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">CBS Federal Apurado</div>
                    <div className="text-[11px] font-black text-black mt-0.5">{formatBrl(data.ibsCbs.vCBS)}</div>
                  </div>
                  <div className="col-span-3 border-r border-black p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">IBS Estadual Apurado</div>
                    <div className="text-[11px] font-black text-black mt-0.5">{formatBrl(data.ibsCbs.vIBSUF)}</div>
                  </div>
                  <div className="col-span-3 border-r border-black p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">IBS Municipal Apurado</div>
                    <div className="text-[11px] font-black text-black mt-0.5">{formatBrl(data.ibsCbs.vIBSMun)}</div>
                  </div>
                  <div className="col-span-3 p-1">
                    <div className="text-[7px] font-bold text-[#14441a] uppercase">Incidência do IBS</div>
                    <div className="text-[10px] font-bold text-black mt-0.5">
                      {data.ibsCbs.xLocalidadeIncid || '-'}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-pink-500 rounded-sm print:hidden"></span>
                VALOR TOTAL DA NFS-E
              </span>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Valor do Serviço</div>
                <div className="text-[11px] font-extrabold text-black mt-0.5">{formatBrl(data.valoresTotais.valorServico)}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Desconto Condicionado</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.valoresTotais.descontoCondicionado > 0 ? formatBrl(data.valoresTotais.descontoCondicionado) : '-'}</div>
              </div>
              <div className="col-span-3 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Desconto Incondicionado</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.valoresTotais.descontoIncondicionado > 0 ? formatBrl(data.valoresTotais.descontoIncondicionado) : '-'}</div>
              </div>
              <div className="col-span-3 p-1">
                <div className="text-[7px] font-bold text-black uppercase">ISSQN Retido</div>
                <div className="text-[11px] font-bold text-red-700 mt-0.5">{data.valoresTotais.issqnRetido > 0 ? formatBrl(data.valoresTotais.issqnRetido) : '-'}</div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Total de Retenções Federais</div>
                <div className="text-[11px] font-bold text-black mt-0.5">{data.valoresTotais.totalRetencoesFederais > 0 ? formatBrl(data.valoresTotais.totalRetencoesFederais) : '-'}</div>
              </div>
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">PIS/COFINS - Apur. Própria</div>
                <div className="text-[10px] font-bold text-black mt-0.5">{data.valoresTotais.pisCofinsAprio > 0 ? formatBrl(data.valoresTotais.pisCofinsAprio) : '-'}</div>
              </div>
              <div className="col-span-4 p-1.5 bg-neutral-50/50 flex flex-col justify-center border-l border-black">
                <div className="text-[8px] font-black text-slate-800 uppercase leading-none">Valor Líquido da NFS-e</div>
                <div className="text-sm font-black text-black leading-none mt-1">{formatBrl(data.valoresTotais.valorLiquido)}</div>
              </div>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-cyan-500 rounded-sm print:hidden"></span>
                TOTAIS APROXIMADOS DOS TRIBUTOS
              </span>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Federais</div>
                <div className="text-[10px] font-bold text-gray-700 mt-0.5">{data.totaisAproximados.federais > 0 ? formatBrl(data.totaisAproximados.federais) : '-'}</div>
              </div>
              <div className="col-span-4 border-r border-black p-1">
                <div className="text-[7px] font-bold text-black uppercase">Estaduais</div>
                <div className="text-[10px] font-bold text-gray-700 mt-0.5">{data.totaisAproximados.estaduais > 0 ? formatBrl(data.totaisAproximados.estaduais) : '-'}</div>
              </div>
              <div className="col-span-4 p-1">
                <div className="text-[7px] font-bold text-black uppercase">Municipais</div>
                <div className="text-[10px] font-bold text-gray-700 mt-0.5">{data.totaisAproximados.municipais > 0 ? formatBrl(data.totaisAproximados.municipais) : '-'}</div>
              </div>
            </div>

            <div className="bg-slate-800 print:bg-gray-200 border-b-2 border-black px-3 py-2 flex justify-between items-center shadow-sm select-none">
              <span className="text-[10.5px] font-black text-white print:text-black tracking-widest uppercase flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-gray-500 rounded-sm print:hidden"></span>
                INFORMAÇÕES COMPLEMENTARES
              </span>
            </div>
            
            <div className="p-2 min-h-[50px] bg-neutral-50/10">
              <p className="text-[10px] font-bold text-gray-800 leading-normal whitespace-pre-wrap select-all font-mono">
                {data.informacoesComplementares || 'Sem informações complementares.'}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
