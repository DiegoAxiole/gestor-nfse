import { useState, Fragment } from "react";
import { useOutletContext } from "react-router-dom";
import type { OutletContext } from "../components/ProtectedLayout";
import { Operacao, Empresa } from "../types";
import { formatDate, formatCnpj, maskRazao } from "../utils";
import { 
  Search, 
  Copy, 
  Check, 
  Clock, 
  FileCode, 
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion } from "motion/react";

export default function HistoricoView() {
  const { ops, empresas = [], lgpdAtivo = false, onViewXml } = useOutletContext<OutletContext>();
  const [filterTipo, setFilterTipo] = useState<string>("TODOS");
  const [filterStatus, setFilterStatus] = useState<string>("TODOS");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Expanded status of company rows
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  // Active operation selected for detailed inspect modal
  const [selectedOp, setSelectedOp] = useState<Operacao | null>(null);

  const cleanSearch = searchTerm.trim().toLowerCase();

  const getCnpjFromXml = (xml: string) => {
    if (!xml) return "";
    const match = xml.match(/<CNPJ>([^<]+)<\/CNPJ>/);
    return match ? match[1] : "";
  };

  const handleCopyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Group metrics and filter operations inside each company
  const companySyncStats = empresas.map((emp) => {
    const empCnpjClean = emp.cnpj.replace(/\D/g, "");
    
    // Filter operations matching this company
    const empOps = ops.filter((op) => {
      const opCnpjClean = getCnpjFromXml(op.xml_request).replace(/\D/g, "");
      return opCnpjClean === empCnpjClean;
    });

    // Apply active filters on this company's operations
    const filteredOpsOfCompany = empOps.filter((op) => {
      const matchesTipo = filterTipo === "TODOS" || op.tipo === filterTipo;
      const matchesStatus = filterStatus === "TODOS" || op.status === filterStatus;
      
      const matchesSearch = 
        cleanSearch === "" || 
        op.id.toLowerCase().includes(cleanSearch) ||
        (op.nsu_consultado && op.nsu_consultado.includes(cleanSearch)) ||
        op.ultimo_nsu.includes(cleanSearch) ||
        emp.razao_social.toLowerCase().includes(cleanSearch) ||
        emp.cnpj.replace(/\D/g, "").includes(cleanSearch.replace(/\D/g, ""));

      return matchesTipo && matchesStatus && matchesSearch;
    });

    const totalConsultas = empOps.length;
    const totalDocs = empOps.reduce((sum, op) => sum + (op.lote_dfe_count || 0), 0);
    
    // Sort operations to find the latest sync state info
    const sortedOps = [...empOps].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const latestOp = sortedOps[0];

    return {
      emp,
      totalConsultas,
      totalDocs,
      latestOp,
      ultimoNsuSefaz: latestOp?.ultimo_nsu || "-",
      ultimoNsuBusca: latestOp?.nsu_consultado || "-",
      ultimoStatus: latestOp?.status || "SEM CONSULTA",
      filteredOps: filteredOpsOfCompany,
      hasOps: empOps.length > 0
    };
  });

  // Calculate also any orphan operations which don't match any registered company, to avoid losing logs
  const orphanOps = ops.filter((op) => {
    const opCnpjClean = getCnpjFromXml(op.xml_request).replace(/\D/g, "");
    return !empresas.some(emp => emp.cnpj.replace(/\D/g, "") === opCnpjClean);
  });

  const filteredOrphanOps = orphanOps.filter((op) => {
    const matchesTipo = filterTipo === "TODOS" || op.tipo === filterTipo;
    const matchesStatus = filterStatus === "TODOS" || op.status === filterStatus;
    const matchesSearch = 
      cleanSearch === "" || 
      op.id.toLowerCase().includes(cleanSearch) ||
      op.ultimo_nsu.includes(cleanSearch);
    return matchesTipo && matchesStatus && matchesSearch;
  });

  // Automatically expand companies if there is an active search or active filters
  const isFiltering = cleanSearch !== "" || filterTipo !== "TODOS" || filterStatus !== "TODOS";
  
  const toggleCompany = (companyId: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Active title block */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white uppercase font-sans">
          HISTÓRICO E CONTROLE UNIFICADO DE NSU POR EMPRESA
        </h1>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
          Cada empresa cadastrada possui sua própria base individual de NSUs e histórico de consultas. Expanda a respectiva empresa para auditar os logs de SOAP enviados/recebidos coletados pela prefeitura e webservices.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs flex flex-wrap gap-4 justify-between items-center font-sans">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Empresa, ID ou NSU..."
              className="pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs font-semibold text-slate-200 placeholder-slate-600 focus:outline-hidden focus:border-slate-750 w-full sm:w-64"
            />
          </div>

          {/* Select filter Type */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Tipo:</span>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="bg-slate-950 border border-slate-850 text-slate-300 text-xs rounded-lg p-2 font-bold cursor-pointer focus:outline-hidden"
            >
              <option value="TODOS">Todos os Modelos</option>
              <option value="DISTRIBUICAO">Distribuição NSU</option>
              <option value="NSU_ESPECIFICO">NSU Específico</option>
            </select>
          </div>

          {/* Select filter Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-850 text-slate-300 text-xs rounded-lg p-2 font-bold cursor-pointer focus:outline-hidden"
            >
              <option value="TODOS">Qualquer Status</option>
              <option value="SUCESSO">Sucesso (Autorizado)</option>
              <option value="ERRO">Erro (Rejeição)</option>
            </select>
          </div>
        </div>

        {<div className="text-xs text-slate-500 font-semibold font-mono">
          Operações totais: <strong className="text-slate-300">{ops.length}</strong> logs
        </div>}
      </div>

      {/* Unified Table of Companies with nested detailed logs */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-850 bg-slate-950/20">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-sans">
            Sincronismo e Histórico Detalhado por Empresa Gestora/Cliente
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-850 text-slate-400 font-bold text-[10px] uppercase">
                <th className="p-3 w-8"></th>
                <th className="p-3">Empresa Cliente</th>
                <th className="p-3">CNPJ</th>
                <th className="p-3 text-center">NSU de Busca</th>
                <th className="p-3 text-center">Último NSU SEFAZ</th>
                <th className="p-3 text-center">Consultas</th>
                <th className="p-3 text-center animate-pulse">XMLs Baixados</th>
                <th className="p-3 text-center">Último Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 font-medium text-slate-300 font-sans">
              {companySyncStats.map(({ emp, totalConsultas, totalDocs, ultimoNsuSefaz, ultimoNsuBusca, ultimoStatus, filteredOps }) => {
                const isExpanded = expandedCompanies[emp.id] || (isFiltering && filteredOps.length > 0);
                
                return (
                  <Fragment key={emp.id}>
                    <tr 
                      onClick={() => toggleCompany(emp.id)}
                      className="hover:bg-slate-950/20 transition-colors cursor-pointer group select-none"
                    >
                      <td className="p-3 text-center">
                        <button className="text-slate-500 group-hover:text-white transition-colors focus:outline-hidden">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 font-bold text-slate-200 uppercase truncate max-w-[200px]" title={emp.razao_social}>
                        {lgpdAtivo ? maskRazao(emp.razao_social) : emp.razao_social}
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {formatCnpj(emp.cnpj, lgpdAtivo)}
                      </td>
                      <td className="p-3 text-center font-mono text-indigo-300 font-bold">
                        {ultimoNsuBusca}
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-400 font-bold">
                        {ultimoNsuSefaz}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-300">
                        {totalConsultas}
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-400 font-semibold">
                        +{totalDocs}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight border inline-block ${
                          ultimoStatus === "SUCESSO" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : ultimoStatus === "ERRO" || ultimoStatus === "REJEIÇÃO"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : "bg-slate-950 text-slate-500 border-slate-850"
                        }`}>
                          {ultimoStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompany(emp.id);
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded uppercase font-bold tracking-wider"
                        >
                          {isExpanded ? "Ocultar Logs" : `Ver Logs (${filteredOps.length})`}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Collapsible details subtable for each company */}
                    {isExpanded && (
                      <tr className="bg-slate-950/40">
                        <td colSpan={9} className="p-4 bg-slate-950/40 border-l-2 border-indigo-500">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block font-sans">
                                Histórico de Requisições SOAP • {emp.razao_social} ({filteredOps.length} registros correspondentes)
                              </span>
                              {isFiltering && (
                                <span className="text-[10px] text-indigo-400 font-semibold">
                                  Filtro ativo: exibindo {filteredOps.length} de {totalConsultas} logs
                                </span>
                              )}
                            </div>
                            
                            {filteredOps.length > 0 ? (
                              <div className="overflow-hidden border border-slate-850 rounded-lg bg-slate-900/40">
                                <table className="w-full text-left border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-950 text-slate-500 font-extrabold text-[9px] uppercase border-b border-slate-850">
                                      <th className="p-2.5 pl-4">ID Operação</th>
                                      <th className="p-2.5">Data / Hora Envio</th>
                                      <th className="p-2.5">Modelo</th>
                                      <th className="p-2.5 text-center">NSU de Busca</th>
                                      <th className="p-2.5 text-center">Retorno Último NSU</th>
                                      <th className="p-2.5 text-center">NFSe Baixadas</th>
                                      <th className="p-2.5">Status Retorno</th>
                                      <th className="p-2.5 text-center pr-4">Ações XML</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-850 font-sans text-slate-300 font-medium">
                                    {filteredOps.map((op) => (
                                      <tr key={op.id} className="hover:bg-slate-950/60 transition-colors">
                                        <td className="p-2.5 pl-4 font-mono font-bold text-slate-400 text-[10px]">
                                          {op.id}
                                        </td>
                                        <td className="p-2.5 text-slate-400">
                                          {formatDate(op.data)}
                                        </td>
                                        <td className="p-2.5">
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                            op.tipo === "DISTRIBUICAO" 
                                              ? "bg-slate-950 text-indigo-400 border-indigo-500/10" 
                                              : "bg-slate-950 text-blue-400 border-blue-500/10"
                                          }`}>
                                            {op.tipo === "DISTRIBUICAO" ? "DISTRIB" : "NSU_ESP"}
                                          </span>
                                        </td>
                                        <td className="p-2.5 text-center font-mono text-slate-400">
                                          {op.nsu_consultado || "PROG"}
                                        </td>
                                        <td className="p-2.5 text-center font-mono text-slate-200">
                                          {op.ultimo_nsu}
                                        </td>
                                        <td className="p-2.5 text-center">
                                          {op.lote_dfe_count > 0 ? (
                                            <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.5 rounded text-[10px]">
                                              +{op.lote_dfe_count} XML(s)
                                            </span>
                                          ) : (
                                            <span className="text-slate-600 font-mono">-</span>
                                          )}
                                        </td>
                                        <td className="p-2.5">
                                          {op.status === "SUCESSO" ? (
                                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                                              SUCESSO
                                            </span>
                                          ) : (
                                            <span className="text-rose-450 font-bold flex items-center gap-1 text-[10px]" title={op.xml_erro}>
                                              <span className="w-1.5 h-1.5 rounded-full bg-rose-455 inline-block" />
                                              REJEIÇÃO
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-2.5 text-center pr-4">
                                          <button
                                            onClick={() => setSelectedOp(op)}
                                            className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 hover:text-white hover:bg-slate-850 uppercase font-bold tracking-tight"
                                          >
                                            Inspecionar XML
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="p-5 text-center bg-slate-900/20 border border-slate-850 rounded-lg text-slate-500 font-mono italic">
                                Nenhum log encontrado para esta empresa com os filtros atuais.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {/* Orphan operations renderer (operations that do not match any currently registered company) */}
              {filteredOrphanOps.length > 0 && (
                <Fragment key="orphans">
                  <tr 
                    onClick={() => toggleCompany("orphans")}
                    className="hover:bg-slate-950/20 transition-colors cursor-pointer group bg-slate-900/30"
                  >
                    <td className="p-3 text-center">
                      <button className="text-slate-500 group-hover:text-white transition-colors focus:outline-hidden">
                        {expandedCompanies["orphans"] ? (
                          <ChevronUp className="w-4 h-4 text-orange-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 font-semibold text-orange-400 uppercase italic">
                      Operações Não Vinculadas / Outras Empresas
                    </td>
                    <td className="p-3 font-mono text-slate-500 italic">
                      Vários CNPJs
                    </td>
                    <td className="p-3 text-center font-mono text-slate-500 italic">-</td>
                    <td className="p-3 text-center font-mono text-slate-500 italic">-</td>
                    <td className="p-3 text-center font-mono text-slate-300">
                      {filteredOrphanOps.length}
                    </td>
                    <td className="p-3 text-center font-mono text-emerald-500">
                      +{filteredOrphanOps.reduce((s, o) => s + (o.lote_dfe_count || 0), 0)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-tight bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        AUDITAR
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompany("orphans");
                        }}
                        className="px-2 py-1 text-[10px] bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded uppercase font-bold tracking-wider"
                      >
                        {expandedCompanies["orphans"] ? "Ocultar" : "Ver Logs"}
                      </button>
                    </td>
                  </tr>

                  {expandedCompanies["orphans"] && (
                    <tr className="bg-slate-950/40">
                      <td colSpan={9} className="p-4 bg-slate-950/40 border-l-2 border-orange-400">
                        <div className="space-y-2">
                          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block font-sans">
                            Consultas SOAP sem Empresa Cadastrada Correspondente ({filteredOrphanOps.length} registros)
                          </span>
                          
                          <div className="overflow-hidden border border-slate-850 rounded-lg bg-slate-900/40">
                            <table className="w-full text-left border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-slate-950 text-slate-500 font-extrabold text-[9px] uppercase border-b border-slate-850">
                                  <th className="p-2.5 pl-4">ID Operação</th>
                                  <th className="p-2.5">CNPJ do XML</th>
                                  <th className="p-2.5">Data / Hora Envio</th>
                                  <th className="p-2.5">Modelo</th>
                                  <th className="p-2.5 text-center">NSU Busca</th>
                                  <th className="p-2.5 text-center">Último NSU</th>
                                  <th className="p-2.5 text-center">NFSe</th>
                                  <th className="p-2.5">Status</th>
                                  <th className="p-2.5 text-center pr-4">Ações XML</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850 font-sans text-slate-300 font-medium">
                                {filteredOrphanOps.map((op) => {
                                  const rawCnpj = getCnpjFromXml(op.xml_request);
                                  return (
                                    <tr key={op.id} className="hover:bg-slate-950/60 transition-colors">
                                      <td className="p-2.5 pl-4 font-mono font-bold text-slate-400 text-[10px]">
                                        {op.id}
                                      </td>
                                      <td className="p-2.5 font-mono text-orange-400">
                                        {rawCnpj ? formatCnpj(rawCnpj) : "NÃO IDENTIFICADO"}
                                      </td>
                                      <td className="p-2.5 text-slate-400">
                                        {formatDate(op.data)}
                                      </td>
                                      <td className="p-2.5">
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-slate-950 text-slate-400 border-slate-800">
                                          {op.tipo}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-center font-mono text-slate-400">
                                        {op.nsu_consultado || "PROG"}
                                      </td>
                                      <td className="p-2.5 text-center font-mono text-slate-200">
                                        {op.ultimo_nsu}
                                      </td>
                                      <td className="p-2.5 text-center">
                                        {op.lote_dfe_count || "-"}
                                      </td>
                                      <td className="p-2.5">
                                        <span className={op.status === "SUCESSO" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                          {op.status}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-center pr-4">
                                        <button
                                          onClick={() => setSelectedOp(op)}
                                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400 hover:text-white hover:bg-slate-850 uppercase font-bold tracking-tight"
                                        >
                                          Inspecionar XML
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )}

              {companySyncStats.length === 0 && filteredOrphanOps.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 font-mono italic">
                    Nenhuma empresa ou operação localizada no histórico.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal/Drawer */}
      {selectedOp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-end">
          <motion.div 
            initial={{ opacity: 0, x: 250 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-screen shadow-2xl p-6 overflow-y-auto flex flex-col justify-between"
          >
            {/* Header */}
            <div>
              <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4">
                <div>
                  <div className="text-[9px] bg-slate-950 border border-slate-850 px-2 py-0.5 rounded font-mono font-bold text-slate-400 uppercase inline-block mb-1.5">
                    ID Interno: {selectedOp.id}
                  </div>
                  <h2 className="text-base font-bold text-white uppercase tracking-wider">
                    Visualização das Cargas XML SEFAZ
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 font-mono">Timestamp: {formatDate(selectedOp.data)}</p>
                </div>
                <button
                  onClick={() => setSelectedOp(null)}
                  className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 cursor-pointer text-[10px] font-bold uppercase transition-all"
                >
                  Fechar
                </button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-lg mb-4 text-xs font-sans">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Tipo de Post</span>
                  <span className="font-bold text-slate-200">{selectedOp.tipo}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">NSU Consultado</span>
                  <span className="font-bold text-slate-200 font-mono">{selectedOp.nsu_consultado || "Automático"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Resposta XML</span>
                  <span className={`font-bold ${selectedOp.status === "SUCESSO" ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedOp.status === "SUCESSO" ? "Código 138" : "Erro / Código 137"}
                  </span>
                </div>
              </div>

              {/* Accordions Request XML and Response XML */}
              <div className="space-y-4">
                {/* 1. Request Body */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1 uppercase tracking-wider text-[10px]">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      Instrução Enviada (Request SOAP XML)
                    </span>
                    <button
                      onClick={() => handleCopyText(selectedOp.xml_request, "req")}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-0.5 font-bold uppercase"
                    >
                      {copiedText === "req" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar XML
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-slate-950 text-emerald-400 p-3.5 rounded-lg text-[10.5px] font-mono overflow-x-auto max-h-[140px] border border-slate-850 shadow-inner">
                    {selectedOp.xml_request || "(Sem request associado)"}
                  </pre>
                </div>

                {/* 2. Response Body */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1 uppercase tracking-wider text-[10px]">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      Retorno de Distribuição (Response SOAP XML)
                    </span>
                    <button
                      onClick={() => handleCopyText(selectedOp.xml_response || selectedOp.xml_erro || "", "res")}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-0.5 font-bold uppercase"
                      disabled={!selectedOp.xml_response && !selectedOp.xml_erro}
                    >
                      {copiedText === "res" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar XML
                        </>
                      )}
                    </button>
                  </div>
                  
                  {selectedOp.status === "SUCESSO" ? (
                    <pre className="bg-slate-950 text-indigo-400 p-3.5 rounded-lg text-[10.5px] font-mono overflow-x-auto max-h-[220px] border border-slate-850 shadow-inner">
                      {selectedOp.xml_response}
                    </pre>
                  ) : (
                    <div className="p-3.5 bg-rose-500/5 border border-rose-500/15 text-rose-300 font-medium rounded-lg text-xs space-y-1.5 font-sans">
                      <div className="flex items-center gap-1 font-bold text-rose-455 uppercase text-[10.5px]">
                        <AlertTriangle className="w-4 h-4 text-rose-455" />
                        O webservice retornou uma rejeição
                      </div>
                      <pre className="font-mono text-[10.5px] bg-slate-950 text-rose-400 p-3 rounded-lg max-h-[140px] overflow-x-auto whitespace-pre-wrap border border-slate-850">
                        {selectedOp.xml_erro || "Erro de timeout de conexão com os servidores."}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom guide info */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Duração da consulta: {selectedOp.status === "SUCESSO" ? "420ms" : "2.1s"}
              </span>
              <span className="font-bold text-slate-400 uppercase">Unimake SEFAZ</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
