import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import type { OutletContext } from "./ProtectedLayout";
import { Documento, Operacao, Empresa, ConfigToml } from "../types";
import { formatCurrency, formatDate, calculateRemainingDays, formatCnpj, generateUUID, maskRazao, maskNome } from "../utils";
import * as api from "../api";
import {
  FileText,
  RefreshCw,
  CheckCircle,
  TrendingUp,
  ShieldCheck,
  Building2,
  FileSearch2,
  ArrowRight,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
export default function DashboardView() {
  const { docs, ops, empresas = [], config, activeEmpresa, lgpdAtivo = false, onNavigate, onSetActiveEmpresa, onAddOperation, onAddDocuments } = useOutletContext<OutletContext>();
  // Aggregate multi-company stats
  const totalCompaniesCount = empresas.length;
  
  const validCertificatesCount = empresas.filter(emp => {
    if (!emp.certificado_caminho) return false;
    const days = calculateRemainingDays(emp.validade_fim);
    return days > 0;
  }).length;

  const expiredCertificatesCount = empresas.filter(emp => {
    if (!emp.certificado_caminho) return true;
    const days = calculateRemainingDays(emp.validade_fim);
    return days <= 0;
  }).length;

  const globalTotalDocsCount = docs.length;
  const globalTotalValueSum = docs.reduce((acc, d) => acc + d.valor_servicos, 0);

  // States for live interactive syncing on the Dashboard
  const [now, setNow] = useState(new Date());
  const [syncingCompanyId, setSyncingCompanyId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncLog, setSyncLog] = useState<string | null>(null);

  // Per-empresa document stats (count + total value) fetched from API
  const [empresaStats, setEmpresaStats] = useState<Record<string, { count: number; valorTotal: number }>>({});

  // Tick the clock every second to update remainers
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch accurate document counts per empresa (not limited by global page_size)
  useEffect(() => {
    const fetchStats = async () => {
      const result: Record<string, { count: number; valorTotal: number }> = {};
      for (const emp of empresas) {
        try {
          const data = await api.buscarDocumentosPaginated({ cnpj: emp.cnpj, page_size: 100 });
          const valorTotal = data.documentos.reduce((acc, d) => acc + d.valor_servicos, 0);
          result[emp.cnpj] = { count: data.total, valorTotal };
        } catch {
          // fallback: use local docs filter
          const empDocs = docs.filter(d => {
            const clean = emp.cnpj.replace(/\D/g, "");
            return d.prestador_cnpj.replace(/\D/g, "") === clean || d.tomador_cnpj.replace(/\D/g, "") === clean;
          });
          result[emp.cnpj] = {
            count: empDocs.length,
            valorTotal: empDocs.reduce((acc, d) => acc + d.valor_servicos, 0),
          };
        }
      }
      setEmpresaStats(result);
    };
    if (empresas.length > 0) fetchStats();
  }, [empresas]);

  // Helper to extract CNPJ from soap request like in HistoricoView.tsx
  const getCnpjFromXml = (xml: string) => {
    if (!xml) return "";
    const match = xml.match(/<CNPJ>([^<]+)<\/CNPJ>/);
    return match ? match[1] : "";
  };

  // Format remaining time to next query (1 hour limit)
  const formatRemainingTime = (ms: number): string => {
    if (ms <= 0) return "Livre";
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs}s`;
  };

  const syncOneCompany = async (emp: Empresa): Promise<{ ultimo_nsu: string; docsCount: number } | null> => {
    const empCnpjClean = emp.cnpj.replace(/\D/g, "");
    const { task_id } = await api.consultarDistribuicao(empCnpjClean);

    setSyncLog(`Consultando SEFAZ para "${emp.razao_social}"... (task ${task_id.slice(0, 8)}…)`);
    const task = await api.pollTask(task_id);

    if (task.status === "error") {
      throw new Error(task.mensagem_erro || "Erro desconhecido na consulta");
    }

    const docsData = await api.buscarDocumentosPaginated({ cnpj: empCnpjClean });
    if (docsData.documentos.length > 0 && onAddDocuments) {
      const parsedDocs: Documento[] = docsData.documentos.map(d => ({
        chave_acesso: d.chave_acesso,
        nsu: d.nsu,
        numero_nota: d.numero_nota || "",
        data_importacao: new Date().toISOString(),
        data_emissao: d.data_emissao,
        emissao_dh: d.emissao_dh,
        valor_servicos: d.valor_servicos,
        prestador_nome: d.prestador_nome,
        prestador_cnpj: d.prestador_cnpj,
        tomador_nome: d.tomador_nome,
        tomador_cnpj: d.tomador_cnpj,
        xml_nfse: d.xml_nfse,
        tem_pdf: d.tem_pdf,
      }))
      onAddDocuments(parsedDocs)
    }

    const ultimoNsu = (task.resultado && "ultimo_nsu" in task.resultado) ? (task.resultado as any).ultimo_nsu : ""
    return { ultimo_nsu: ultimoNsu, docsCount: docsData.total }
  }

  // Perform single-company sync
  const handleSyncCompany = async (companyId: string) => {
    const emp = empresas.find(e => e.id === companyId);
    if (!emp) return;

    // 1-hour interval check
    const empCnpjClean = emp.cnpj.replace(/\D/g, "");
    const empOps = ops.filter(op => {
      const opCnpj = getCnpjFromXml(op.xml_request).replace(/\D/g, "");
      return opCnpj === empCnpjClean;
    });
    const distributeOps = empOps.filter(o => o.tipo === "DISTRIBUICAO" && o.status === "SUCESSO");
    const latestOp = distributeOps.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];

    const oneHourMs = 3600000;
    if (latestOp) {
      const elapsed = now.getTime() - new Date(latestOp.data).getTime();
      if (elapsed < oneHourMs) {
        const remainingStr = formatRemainingTime(oneHourMs - elapsed);
        alert(`A SEFAZ limita consultas distribuídas (dFe) a no máximo 1 consulta por hora por CNPJ para evitar consumo indevido.\n\nAguarde mais ${remainingStr} para realizar o próximo escaneamento oficial.`);
        return;
      }
    }

    setSyncingCompanyId(companyId);
    setSyncLog(`Efetuando handshake SOAP para "${emp.razao_social}"...`);

    try {
      const result = await syncOneCompany(emp);
      if (result && onAddOperation) {
        const newOp: Operacao = {
          id: "op_" + generateUUID(),
          data: new Date().toISOString(),
          tipo: "DISTRIBUICAO",
          nsu_consultado: null,
          ultimo_nsu: result.ultimo_nsu,
          status: "SUCESSO",
          xml_request: "",
          xml_response: "",
          lote_dfe_count: result.docsCount,
        };
        onAddOperation(newOp);
      }
    } catch (err: any) {
      alert(`Erro na consulta SEFAZ: ${err.message}`);
    }

    setSyncingCompanyId(null);
    setSyncLog(null);
  };

  // Perform mass sync (sync all eligible clients in batch)
  const handleSyncAllCompanies = async () => {
    const eligibleCompanies = empresas.filter(emp => {
      const empCnpjClean = emp.cnpj.replace(/\D/g, "");
      const empOps = ops.filter(op => {
        const opCnpj = getCnpjFromXml(op.xml_request).replace(/\D/g, "");
        return opCnpj === empCnpjClean;
      });
      const distributeOps = empOps.filter(o => o.tipo === "DISTRIBUICAO" && o.status === "SUCESSO");
      const latestOp = distributeOps.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];

      if (latestOp) {
        const elapsed = now.getTime() - new Date(latestOp.data).getTime();
        if (elapsed < 3600000) return false;
      }
      return true;
    });

    if (eligibleCompanies.length === 0) {
      alert("Nenhuma empresa está elegível para sincronização em massa neste exato momento.\n\nMotivo: Todas as empresas já foram consultadas no intervalo de 1 hora (limitação anti-bloqueio da SEFAZ).");
      return;
    }

    setSyncingAll(true);
    setSyncLog(`Preparando lote para ${eligibleCompanies.length} empresa(s)...`);

    for (let i = 0; i < eligibleCompanies.length; i++) {
      const emp = eligibleCompanies[i];
      try {
        const result = await syncOneCompany(emp);
        if (result && onAddOperation) {
          const newOp: Operacao = {
            id: "op_" + generateUUID(),
            data: new Date().toISOString(),
            tipo: "DISTRIBUICAO",
            nsu_consultado: null,
            ultimo_nsu: result.ultimo_nsu,
            status: "SUCESSO",
            xml_request: "",
            xml_response: "",
            lote_dfe_count: result.docsCount,
          };
          onAddOperation(newOp);
        }
      } catch (err: any) {
        console.error(`Erro ao consultar ${emp.razao_social}:`, err);
      }
    }

    setSyncingAll(false);
    setSyncLog(null);
  };

  // Compute stats for each company list matching docs and operations
  const companyAggregateList = empresas.map(emp => {
    const cleanCnpj = emp.cnpj.replace(/\D/g, "");
    
    // We match docs where either the provider or receiver is this company
    const companyDocs = docs.filter(d => 
      d.prestador_cnpj.replace(/\D/g, "") === cleanCnpj ||
      d.tomador_cnpj.replace(/\D/g, "") === cleanCnpj
    );
    
    const docsCount = companyDocs.length;
    const valueSum = companyDocs.reduce((acc, d) => acc + d.valor_servicos, 0);
    
    const hasCert = !!emp.certificado_caminho;
    const daysLeft = hasCert ? calculateRemainingDays(emp.validade_fim) : -1;

    // Filter operations
    const empOps = ops.filter(op => {
      const opCnpj = getCnpjFromXml(op.xml_request).replace(/\D/g, "");
      return opCnpj === cleanCnpj;
    });

    const distributeOps = empOps.filter(o => o.tipo === "DISTRIBUICAO" && o.status === "SUCESSO");
    const latestOp = distributeOps.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];

    const lastQueryDateStr = latestOp ? formatDate(latestOp.data) : "Nunca realizada";

    // 1 hour check
    let msRemaining = 0;
    if (latestOp) {
      const lastTime = new Date(latestOp.data).getTime();
      const elapsed = now.getTime() - lastTime;
      msRemaining = Math.max(0, 3600000 - elapsed);
    }

    return {
      ...emp,
      docsCount,
      valueSum,
      daysLeft,
      hasCert,
      lastQueryDateStr,
      msRemaining
    };
  });

  const getUltimaSincronizacao = (cnpj: string): string => {
    const empresaOps = ops.filter(o => o.xml_request.includes(cnpj));
    if (empresaOps.length === 0) return "Nunca";
    const latest = empresaOps.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];
    return formatDate(latest.data);
  };

  const getDocsPorEmpresa = (cnpj: string): Documento[] => {
    const clean = cnpj.replace(/\D/g, "");
    return docs.filter(d =>
      d.prestador_cnpj.replace(/\D/g, "") === clean ||
      d.tomador_cnpj.replace(/\D/g, "") === clean
    );
  };

  const getStatusCertificado = (validade: string): { label: string; color: string } => {
    if (!validade) return { label: "Sem certificado", color: "text-slate-500" };
    const days = calculateRemainingDays(validade);
    if (days <= 0) return { label: "Vencido", color: "text-red-400" };
    if (days <= 30) return { label: `Vence em ${days} dias`, color: "text-yellow-400" };
    return { label: `Válido até ${formatDate(validade)}`, color: "text-emerald-400" };
  };

  return (
    <div className="space-y-6">
      {/* Accountant Welcome Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Escritório de Contabilidade Gestor • Licenciado
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase sm:text-3xl">
            {lgpdAtivo ? maskRazao(config?.prestador?.razao_social || "") : (config?.prestador?.razao_social || "NÃO CONFIGURADO")}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm max-w-2xl leading-relaxed">
            CNPJ do Administrador: <span className="font-mono font-bold text-indigo-300">{config?.prestador?.cnpj ? formatCnpj(config.prestador.cnpj, lgpdAtivo) : "NÃO CONFIGURADO"}</span> • 
            Este painel permite à sua assessoria gerenciar de forma centralizada a captação e download de notas (XMLs) de todos os seus clientes em lote, impulsionando a velocidade e eliminando downloads individuais.
          </p>
        </div>
        
        {/* Quick state stats */}
        <div className="mt-5 lg:mt-0 flex flex-wrap gap-4 relative z-10">
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-850 text-right min-w-[120px]">
            <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Empresa em Foco</span>
            <strong className="text-xs text-indigo-300 block uppercase truncate max-w-[150px]" title={activeEmpresa?.razao_social}>
              {lgpdAtivo ? maskRazao(activeEmpresa?.razao_social || "") : (activeEmpresa?.razao_social || "Nenhuma")}
            </strong>
            <span className="text-[10px] text-slate-400 font-mono tracking-tight block">
              {activeEmpresa?.cnpj ? formatCnpj(activeEmpresa.cnpj, lgpdAtivo) : ""}
            </span>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* Aggregate Fiscal KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Counter of registered businesses */}
        <motion.div 
          whileHover={{ y: -1 }}
          className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs hover:border-slate-705 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Empresas Cadastradas</span>
            <div className="p-2 rounded-lg bg-slate-950 text-indigo-400">
              <Building2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {totalCompaniesCount}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
              Clientes ativos na base SQLite
            </p>
          </div>
        </motion.div>

        {/* Protected Certificate tracker */}
        <motion.div 
          whileHover={{ y: -1 }}
          className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs hover:border-slate-705 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Certificados Ativos</span>
            <div className="p-2 rounded-lg bg-slate-950 text-emerald-450">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
              {validCertificatesCount} <span className="text-xs text-slate-500 font-normal">/ {totalCompaniesCount}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
              {expiredCertificatesCount > 0 ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <strong className="text-rose-450 font-semibold">{expiredCertificatesCount} pendentes ou expirados</strong>
                </>
              ) : (
                <>
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  Nenhum vencimento detectado
                </>
              )}
            </p>
          </div>
        </motion.div>

        {/* Cumulative global stored XML documents count */}
        <motion.div 
          whileHover={{ y: -1 }}
          className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs hover:border-slate-705 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Notas Coletadas (Total)</span>
            <div className="p-2 rounded-lg bg-slate-950 text-blue-450">
              <FileText className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {globalTotalDocsCount}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Sincronizadas progressivamente
            </p>
          </div>
        </motion.div>

        {/* Global managed financial tracking cumulative */}
        <motion.div 
          whileHover={{ y: -1 }}
          className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs hover:border-slate-705 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Volume Transacionado</span>
            <div className="p-2 rounded-lg bg-slate-950 text-amber-500">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xl font-extrabold text-white tracking-tight">
              {formatCurrency(globalTotalValueSum)}
            </div>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
              Total consolidado de todos os clientes
            </p>
          </div>
        </motion.div>
      </div>

      {/* Sync Mass/Individual Pulsating micro logs */}
      {syncLog && (
        <div className="bg-indigo-950/45 text-indigo-200 border border-indigo-500/15 rounded-xl p-3.5 text-xs font-mono flex items-center gap-3 animate-pulse">
          <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            {syncLog}
          </div>
        </div>
      )}

      {/* Stack of Control Panels and Feeds */}
      <div className="space-y-6">
        {/* Painel de Controle de Sincronização table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-pulse" />
                Painel de Controle de Sincronização
              </h2>
              <p className="text-xs text-slate-500">Realize varreduras das prefeituras sob demanda buscando por novos documentos com assinatura criptográfica A1</p>
            </div>
            
            <button
              onClick={() => onNavigate("empresas")}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-305 flex items-center gap-1 shrink-0 bg-indigo-500/5 px-2.5 py-1.5 rounded border border-indigo-500/10 hover:border-indigo-500/25 cursor-pointer"
            >
              Cadastrar Nova Empresa
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Micro-table for businesses list */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Razão Social / CNPJ</th>
                  <th className="py-2.5 px-3">Certificado A1 (.pfx)</th>
                  <th className="py-2.5 px-3">Total NFSe Baixadas</th>
                  <th className="py-2.5 px-3">Última Consulta & Próxima</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-855">
                {companyAggregateList.map(emp => {
                  const isSelected = activeEmpresa ? emp.id === activeEmpresa.id : false;
                  
                  let certBadgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/15";
                  let certLabel = `Válido (${emp.daysLeft} dias)`;

                  if (!emp.hasCert) {
                    certBadgeColor = "bg-rose-500/10 text-rose-550 border-rose-500/15";
                    certLabel = "Sem Certificado";
                  } else if (emp.daysLeft <= 0) {
                    certBadgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/15";
                    certLabel = "Certificado Expirado";
                  } else if (emp.daysLeft <= 30) {
                    certBadgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/15";
                    certLabel = `Expira em ${emp.daysLeft} dias!`;
                  }

                  const isSyncBlocked = emp.msRemaining > 0;
                  const certValid = emp.hasCert && emp.daysLeft > 0;
                  const isSyncingThis = syncingCompanyId === emp.id;
                  const isButtonDisabled = isSyncBlocked || !certValid || isSyncingThis || syncingAll;

                  let buttonLabel = "Sincronizar";
                  if (isSyncingThis) {
                    buttonLabel = "Sincronizando...";
                  } else if (isSyncBlocked) {
                    buttonLabel = "Aguarde (1h)";
                  } else if (!certValid) {
                    buttonLabel = "Certificado Inválido";
                  }

                  return (
                    <tr 
                      key={emp.id} 
                      className={`hover:bg-slate-950/45 transition-colors ${
                        isSelected ? "bg-indigo-950/20" : ""
                      }`}
                    >
                      {/* Company identification */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                            isSelected ? "bg-indigo-400 animate-pulse" : "bg-slate-650"
                          }`} />
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate max-w-[280px] uppercase">
                              {lgpdAtivo ? maskRazao(emp.razao_social) : emp.razao_social}
                            </span>
                            <span 
                              className="text-[10px] text-slate-500 font-mono tracking-tight block hover:text-indigo-300 cursor-pointer"
                              onClick={() => onSetActiveEmpresa(emp.id)}
                              title="Selecionar como empresa ativa"
                            >
                              {formatCnpj(emp.cnpj, lgpdAtivo)} {isSelected && "• (Foco Ativo)"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Certificate expiry state */}
                      <td className="py-3 px-3 align-middle">
                        <span className={`px-2 py-0.5 rounded border text-[9.5px] font-bold uppercase inline-block ${certBadgeColor}`}>
                          {certLabel}
                        </span>
                        {emp.hasCert && (
                          <span className="block text-[8px] text-slate-500 font-mono mt-0.5 truncate max-w-[150px]">
                            {emp.certificado_caminho.split("/").pop()}
                          </span>
                        )}
                      </td>

                      {/* Inform the total of downloaded NFSe */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-indigo-300 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                          {emp.docsCount} NFSe baixadas
                        </div>
                        <p className="text-[10px] text-slate-450 font-mono mt-0.5" onClick={() => onNavigate("historico")}>
                          Faturado: {formatCurrency(emp.valueSum)}
                        </p>
                      </td>

                      {/* Last Distribute Query Date and next eligibility countdown (1-hour lock) */}
                      <td className="py-3 px-3 font-sans align-middle">
                        <div className="text-[11px] text-slate-300 font-medium">
                          Última: {emp.lastQueryDateStr}
                        </div>
                        {emp.msRemaining > 0 ? (
                          <div className="text-[10px] text-amber-500 font-semibold flex items-center gap-1 mt-0.5">
                            <Lock className="w-3 h-3 text-amber-500 animate-pulse" />
                            Segurança SEFAZ: {formatRemainingTime(emp.msRemaining)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            Sincronização Disponível
                          </div>
                        )}
                      </td>

                      {/* Single Sync Trigger Action */}
                      <td className="py-3 px-3 text-right text-slate-200">
                        <button
                          disabled={isButtonDisabled}
                          onClick={() => handleSyncCompany(emp.id)}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 min-w-[120px] ${
                            isButtonDisabled
                              ? "bg-slate-950 text-slate-500 border border-slate-850 cursor-not-allowed opacity-60"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95 shadow-lg"
                          }`}
                        >
                          {isSyncingThis ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-200" />
                          ) : isSyncBlocked ? (
                            <Lock className="w-3 h-3 text-slate-400" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          {buttonLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Fast Batch Sync Shortcut Info line */}
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs leading-normal">
            <div className="flex items-start gap-2">
              <FileSearch2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Produtividade Automática Contábil:</strong>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Execute consultas em massa para todas as empresas elegíveis simultaneamente com assinatura digital em lote única!
                </p>
              </div>
            </div>

            <button
              disabled={syncingAll || syncingCompanyId !== null}
              onClick={handleSyncAllCompanies}
              className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-all text-white font-bold text-[10px] rounded uppercase shrink-0 tracking-wide flex items-center gap-2 ${
                (syncingAll || syncingCompanyId !== null)
                  ? "bg-slate-950 text-slate-500 border border-slate-850 cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:scale-[1.01] hover:shadow-indigo-500/20 hover:shadow-md"
              }`}
            >
              {syncingAll ? (
                <>
                  Sincronizando Lote...
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </>
              ) : (
                <>
                  Sincronizar Todas as Empresas
                  <RefreshCw className="w-3.5 h-3.5 font-bold" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Painel de Empresas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map((emp) => {
            const stats = empresaStats[emp.cnpj];
            const certStatus = getStatusCertificado(emp.validade_fim);
            const ultimaSync = getUltimaSincronizacao(emp.cnpj);
            return (
              <div
                key={emp.id}
                className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white uppercase truncate">{lgpdAtivo ? maskRazao(emp.razao_social) : emp.razao_social}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">{formatCnpj(emp.cnpj, lgpdAtivo)}</span>
                  </div>
                  <Building2 className="w-5 h-5 text-indigo-400 shrink-0 ml-2" />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-950/60 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Documentos</div>
                    <div className="text-lg font-bold text-white font-mono mt-1">{stats ? stats.count : "..."}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{stats ? formatCurrency(stats.valorTotal) : "..."}</div>
                  </div>
                  <div className="bg-slate-950/60 rounded-lg p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Sincronização</div>
                    <div className="text-sm font-bold text-white font-mono mt-1">{ultimaSync}</div>
                    <div className={`text-[10px] font-mono mt-0.5 ${certStatus.color}`}>{certStatus.label}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onSetActiveEmpresa(emp.id)}
                    className="flex-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 px-3 py-2 rounded uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 inline mr-1" />
                    Sincronizar
                  </button>
                  <button
                    onClick={() => onNavigate("documentos")}
                    className="flex-1 text-[10px] font-bold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-850 border border-slate-800 px-3 py-2 rounded uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <FileText className="w-3 h-3 inline mr-1" />
                    Ver Documentos
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {(() => {
          const outrosDocs = docs.filter(d => {
            const cnpjP = d.prestador_cnpj.replace(/\D/g, "");
            const cnpjT = d.tomador_cnpj.replace(/\D/g, "");
            const temEmpresa = empresas.some(e => {
              const clean = e.cnpj.replace(/\D/g, "");
              return clean === cnpjP || clean === cnpjT;
            });
            return !temEmpresa;
          });
          if (outrosDocs.length === 0) return null;
          const totalValue = outrosDocs.reduce((acc, d) => acc + d.valor_servicos, 0);
          return (
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs hover:border-slate-700 transition-all mt-4">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white uppercase">Outros</h4>
                  <span className="text-[10px] text-slate-500 font-sans">Documentos sem empresa vinculada</span>
                </div>
                <FileSearch2 className="w-5 h-5 text-slate-500 shrink-0 ml-2" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-950/60 rounded-lg p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Documentos</div>
                  <div className="text-lg font-bold text-white font-mono mt-1">{outrosDocs.length}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{formatCurrency(totalValue)}</div>
                </div>
              </div>
              <button
                onClick={() => onNavigate("documentos")}
                className="w-full text-[10px] font-bold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-850 border border-slate-800 px-3 py-2 rounded uppercase tracking-wider transition-all cursor-pointer"
              >
                <FileText className="w-3 h-3 inline mr-1" />
                Ver Documentos
              </button>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
