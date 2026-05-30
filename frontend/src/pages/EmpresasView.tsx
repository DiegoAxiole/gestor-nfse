import React, { useState } from "react";
import { Empresa } from "../types";
import * as api from "../api";
import { formatCnpj, calculateRemainingDays, maskRazao } from "../utils";
import { extractCertData } from "../services/cert-extractor";
import { 
  Building2, 
  PlusCircle, 
  Trash2, 
  Edit2, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  Check, 
  Activity, 
  Clock, 
  Settings,
  AlertTriangle,
  UploadCloud,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface EmpresasViewProps {
  empresas: Empresa[];
  activeEmpresaId: string;
  lgpdAtivo?: boolean;
  onSetActive: (id: string) => void;
  onEmpresaAtualizada: () => void;
  onEmpresaSelecionada: (id: string) => void;
}

export default function EmpresasView({
  empresas,
  activeEmpresaId,
  lgpdAtivo = false,
  onSetActive,
  onEmpresaAtualizada,
  onEmpresaSelecionada
}: EmpresasViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);

  // Form states
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [certificadoPath, setCertificadoPath] = useState("");
  const [senha, setSenha] = useState("");
  const [validadeFim, setValidadeFim] = useState("");
  const [ambiente, setAmbiente] = useState<"Homologacao" | "Producao">("Homologacao");
  const [municipio, setMunicipio] = useState("3550308");

  // Saving state
  const [saving, setSaving] = useState(false);

  // Certificate file state
  const [certFile, setCertFile] = useState<File | null>(null);

  // Interactive certificate upload simulation states
  const [parsingCert, setParsingCert] = useState(false);
  const [certFileName, setCertFileName] = useState("");
  const [certParseStatus, setCertParseStatus] = useState<"idle" | "success" | "need_pass">("idle");
  const [extractionMsg, setExtractionMsg] = useState("");

  const startAddNew = () => {
    setEditingEmpresa(null);
    setRazao("");
    setCnpj("");
    setCertificadoPath("");
    setSenha("");
    setCertFileName("");
    setCertFile(null);
    setCertParseStatus("idle");
    setExtractionMsg("");
    // Default expiration to 1 year from now
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    setValidadeFim(oneYearLater.toISOString().split("T")[0]);
    setAmbiente("Homologacao");
    setMunicipio("3550308");
    setIsEditing(true);
  };

  const startEdit = (emp: Empresa) => {
    setEditingEmpresa(emp);
    setRazao(emp.razao_social);
    setCnpj(emp.cnpj);
    setCertificadoPath(emp.certificado_caminho);
    setSenha(emp.certificado_senha || "");
    setValidadeFim(emp.validade_fim ? emp.validade_fim.split("T")[0] : "");
    setAmbiente(emp.ambiente);
    setMunicipio(emp.codigo_municipio);
    setCertFileName(emp.certificado_caminho ? emp.certificado_caminho.split("/").pop() || "" : "");
    setCertFile(null);
    setCertParseStatus(emp.certificado_caminho ? "success" : "idle");
    setExtractionMsg("");
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razao.trim() || !cnpj.trim()) return;
    if (saving) return;

    const cnpjClean = cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) {
      alert("CNPJ deve ter exatamente 14 dígitos numéricos");
      return;
    }

    const formattedValidade = validadeFim 
      ? new Date(validadeFim + "T23:59:59Z").toISOString() 
      : "";

    const empData: Empresa = {
      id: cnpjClean,
      cnpj: cnpjClean,
      razao_social: razao.trim().toUpperCase(),
      certificado_caminho: certificadoPath.trim(),
      certificado_senha: senha,
      validade_fim: formattedValidade,
      ambiente,
      codigo_municipio: municipio.replace(/\D/g, "")
    };

    setSaving(true);
    try {
      if (editingEmpresa) {
        await api.updateEmpresa(empData.cnpj, empData, certFile ?? undefined);
      } else {
        await api.createEmpresa(empData, certFile ?? undefined);
        onEmpresaSelecionada(empData.cnpj);
      }
      await onEmpresaAtualizada();
      setIsEditing(false);
      setEditingEmpresa(null);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleExtrairCertificado = async () => {
    if (!certFile || saving) return;
    if (!senha) {
      alert("Informe a senha do certificado antes de enviar");
      return;
    }
    setParsingCert(true);
    setCertParseStatus("idle");
    setExtractionMsg("Extraindo dados do certificado...");
    try {
      const data = await extractCertData(certFile, senha);
      setRazao(data.razao);
      setCnpj(data.cnpj);
      setValidadeFim(data.validade.split("T")[0]);
      setCertParseStatus("success");
      setExtractionMsg("");
    } catch (err: any) {
      setCertParseStatus("idle");
      setExtractionMsg(err.message || "Erro ao extrair certificado");
    } finally {
      setParsingCert(false);
    }
  };

  // Helper to color/style the validity remaining days badge
  const renderValidadeBadge = (validadeFimStr: string, certificadoPathStr: string) => {
    if (!certificadoPathStr) {
      return (
        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 uppercase">
          <ShieldAlert className="w-3.5 h-3.5" />
          Pendente Certificado
        </span>
      );
    }

    const days = calculateRemainingDays(validadeFimStr);

    if (days <= 0) {
      return (
        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 uppercase">
          <Clock className="w-3.5 h-3.5 text-rose-400" />
          Expirado ({Math.abs(days)} dias atrás)
        </span>
      );
    } else if (days <= 30) {
      return (
        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          Expira em breve ({days} d)
        </span>
      );
    } else {
      return (
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Ativo ({days} dias)
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            Gestão de Empresas & Certificados Digitais
          </h1>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">
            Cadastre múltiplos CNPJs tomadores/prestadores de serviços. Cada empresa possui seu próprio arquivo de certificado digital A1 (.pfx) e canais SOAP independentes.
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={startAddNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 self-start cursor-pointer shadow-sm uppercase tracking-wider"
          >
            <PlusCircle className="w-4 h-4" />
            Nova Empresa
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List Area - takes remaining width */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {empresas.map((emp) => {
              const isActive = emp.id === activeEmpresaId;
              const hasCertificate = !!emp.certificado_caminho;
              const daysRemaining = emp.certificado_caminho ? calculateRemainingDays(emp.validade_fim) : -1;
              const isExpired = emp.certificado_caminho && daysRemaining <= 0;

              return (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`border rounded-xl p-5 transition-all ${
                    isActive 
                      ? "bg-slate-900/90 border-indigo-500/40 shadow-md shadow-indigo-600/5" 
                      : "bg-slate-900 border-slate-800/80 hover:border-slate-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    {/* Company basic metrics */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center font-bold text-slate-300 text-xs">
                          {emp.razao_social.slice(0, 2)}
                        </span>
                        <div>
                          <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
                            {lgpdAtivo ? maskRazao(emp.razao_social) : emp.razao_social}
                          </h3>
                          <span className="text-slate-500 font-mono text-[10.5px] font-semibold">
                            CNPJ: {formatCnpj(emp.cnpj, lgpdAtivo)}
                          </span>
                        </div>
                        
                        {isActive && (
                          <span className="text-[8.5px] font-bold bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/25 uppercase tracking-wider">
                            Ativa em Uso
                          </span>
                        )}
                      </div>

                      {/* Detail configurations */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-2 text-xs font-sans text-slate-400">
                        <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                          <Key className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[200px]" title={emp.certificado_caminho || "Pendente"}>
                            Certificado: {emp.certificado_caminho ? emp.certificado_caminho.split("/").pop() : <em className="text-rose-400">Nenhum</em>}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>Muni: <strong className="text-slate-300">{emp.codigo_municipio}</strong> | Amb: <strong className="text-slate-300">{emp.ambiente === "Homologacao" ? "Homol." : "Prod."}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Expiration and control buttons */}
                    <div className="flex flex-col items-end gap-3 shrink-0 w-full sm:w-auto">
                      {renderValidadeBadge(emp.validade_fim, emp.certificado_caminho)}

                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                        {!isActive && (
                          <button
                            onClick={() => onSetActive(emp.id)}
                            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-[10px] font-bold rounded-lg uppercase cursor-pointer transition-all"
                          >
                            Ativar
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(emp)}
                          className="p-1.5 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 rounded-lg cursor-pointer transition-all"
                          title="Editar cadastro"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Remover empresa ${emp.razao_social}? Esta ação não pode ser desfeita.`)) {
                              try {
                                await api.deleteEmpresa(emp.cnpj);
                                await onEmpresaAtualizada();
                              } catch (err: any) {
                                alert(err.message || "Erro ao excluir empresa");
                              }
                            }
                          }}
                          className="p-1.5 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-900/30 rounded-lg cursor-pointer transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Warning message if download is blocked */}
                  {!hasCertificate && (
                    <div className="mt-3.5 p-3 rounded-lg bg-rose-950/20 border border-rose-900/30 text-[11px] text-rose-350 flex items-start gap-2 font-sans">
                      <AlertTriangle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
                      <div>
                        <strong>Inoperante para download dFe.</strong> É obrigatória a indicação e senha de um Certificado Digital A1 ativo para a prefeitura validar solicitações SOAP da biblioteca Unimake.
                      </div>
                    </div>
                  )}

                  {hasCertificate && isExpired && (
                    <div className="mt-3.5 p-3 rounded-lg bg-rose-950/20 border border-rose-900/30 text-[11px] text-rose-350 flex items-start gap-2 font-sans">
                      <AlertTriangle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
                      <div>
                        <strong>Certificado Expirado!</strong> A prefeitura rejeitará qualquer lote ou consulta devido ao período de validade vencido. Efetue a renovação do documento PFX.
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Form Overlay/In-place Editor (1 column width) */}
        {isEditing && <div className="space-y-4">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-850">
              <Settings className="w-4 h-4 text-indigo-400" />
              {editingEmpresa ? "Editar Empresa" : "Cadastrar Empresa"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4 font-sans text-xs">                {/* UPGRADE: Interactive Certificate Upload Sim */}
                <div className="p-3 bg-slate-955 border border-slate-850/80 rounded-lg space-y-2.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase leading-normal">
                    Extrair Dados do Certificado A1 (.PFX)
                  </label>
                  
                  {/* Password is essential first */}
                  <div className="bg-slate-900/60 p-2 rounded-md border border-slate-850/50 space-y-1.5">
                    <span className="text-[8.5px] text-slate-500 font-bold block uppercase tracking-wider">PASSO 1: Senha do Certificado</span>
                    <input
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Senha do arquivo .pfx"
                      className="w-full p-2 bg-slate-950 border border-slate-850 rounded-md font-mono text-slate-300 focus:outline-hidden text-[10.5px]"
                    />
                  </div>

                  {/* File selector */}
                  <div className="bg-slate-900/60 p-2 rounded-md border border-slate-850/50 space-y-1.5">
                    <span className="text-[8.5px] text-slate-500 font-bold block uppercase tracking-wider">PASSO 2: Selecione o Arquivo</span>
                    
                    <label className="border border-dashed border-slate-800 hover:border-indigo-500/40 rounded-lg p-3 text-center block cursor-pointer transition-all bg-slate-950 hover:bg-slate-900/50">
                      <input 
                        type="file" 
                        accept=".pfx,.p12" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setCertFile(file);
                          setCertFileName(file.name);
                          setCertParseStatus("idle");
                          setExtractionMsg("");
                        }}
                      />
                      
                      <div className="space-y-1 text-center">
                        <UploadCloud className="w-5 h-5 text-slate-500 mx-auto" />
                        <span className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 block">Carregar arquivo .pfx</span>
                        <span className="text-[8px] text-slate-500 block">Clique ou arraste o certificado aqui</span>
                      </div>
                    </label>
                  </div>

                  {/* Extract button when file selected but not extracted */}
                  {certFileName && certParseStatus === "idle" && !parsingCert && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={handleExtrairCertificado}
                        disabled={!certFile || !senha}
                        className="w-full p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-lg cursor-pointer disabled:cursor-not-allowed text-center flex items-center justify-center gap-1.5 text-[10px] uppercase"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        Extrair Dados
                      </button>
                      {!senha && (
                        <p className="text-[8.5px] text-amber-400 text-center">Informe a senha do certificado para extrair</p>
                      )}
                    </div>
                  )}

                  {/* Extraction progress */}
                  {parsingCert && (
                    <div className="space-y-1 font-sans text-center bg-slate-900/60 p-2 rounded border border-slate-850">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-300">
                        <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                        <span>Extraindo Dados</span>
                      </div>
                      <div className="text-[9px] text-indigo-400 font-mono tracking-tight animate-pulse">{extractionMsg || "Lendo certificado..."}</div>
                    </div>
                  )}

                  {certParseStatus === "success" && certFileName && (
                    <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-md text-[9.5px] text-emerald-400 flex flex-col gap-1 leading-relaxed font-sans">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Dados Extraídos com Sucesso!</span>
                      </div>
                      <p className="text-slate-400">
                        CNPJ e Razão Social extraídos do arquivo <strong className="text-emerald-300 font-mono">{certFileName}</strong>. Revise os campos abaixo e clique em <strong>Gravar</strong> para salvar.
                      </p>
                    </div>
                  )}
                </div>

                {/* corporate name — disabled for new empresa until cert uploaded */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between">
                    <span>Razão Social</span>
                    {certParseStatus === "success" ? (
                      <span className="text-[8px] text-emerald-400 font-bold">Extraído do Certificado</span>
                    ) : !editingEmpresa && (
                      <span className="text-[8px] text-amber-400 font-medium">Envie o certificado primeiro</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={razao}
                    onChange={(e) => setRazao(e.target.value)}
                    placeholder={!editingEmpresa ? "Auto-preenchido após envio do .pfx" : "E.g., NOVA EMPRESA LTDA"}
                    disabled={!editingEmpresa && certParseStatus !== "success"}
                    className={`w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-hidden focus:border-slate-750 font-medium ${
                      !editingEmpresa && certParseStatus !== "success" ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>

                {/* cnpj — disabled for new empresa until cert uploaded */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between">
                    <span>CNPJ (14 dígitos)</span>
                    {certParseStatus === "success" ? (
                      <span className="text-[8px] text-emerald-400 font-bold">Extraído do Certificado</span>
                    ) : !editingEmpresa && (
                      <span className="text-[8px] text-amber-400 font-medium">Envie o certificado primeiro</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value.replace(/\D/g, "").slice(0, 14))}
                    placeholder={!editingEmpresa ? "Auto-preenchido após envio do .pfx" : "99999999000199"}
                    disabled={!editingEmpresa && certParseStatus !== "success"}
                    className={`w-full p-2 bg-slate-950 border border-slate-850 rounded-lg font-mono text-slate-200 focus:outline-hidden focus:border-slate-750 ${
                      !editingEmpresa && certParseStatus !== "success" ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>

                {/* expiry limit */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between">
                    <span>Data de Validade (Expiração)</span>
                    {certParseStatus === "success" && (
                      <span className="text-[8px] text-emerald-400 font-bold flex items-center gap-1 font-mono">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block animate-pulse" />
                        EXTRAÍDA DO CERTIFICADO
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={validadeFim}
                      onChange={(e) => setValidadeFim(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-hidden font-medium"
                    />
                  </div>
                  {certParseStatus === "success" && (
                    <p className="text-[9px] text-emerald-400 font-mono mt-1 font-semibold flex items-center gap-1 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10">
                      <span>✨ Validade do certificado importado preenchida automaticamente:</span>
                      <strong className="text-white">{validadeFim ? validadeFim.split("-").reverse().join("/") : ""}</strong>
                    </p>
                  )}
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        // simulate expired
                        const d = new Date();
                        d.setDate(d.getDate() - 5);
                        setValidadeFim(d.toISOString().split("T")[0]);
                      }}
                      className="text-[8.5px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/15 rounded px-1.5 py-0.5 cursor-pointer font-sans"
                    >
                      Expirado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // simulate expiring soon
                        const d = new Date();
                        d.setDate(d.getDate() + 15);
                        setValidadeFim(d.toISOString().split("T")[0]);
                      }}
                      className="text-[8.5px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/15 rounded px-1.5 py-0.5 cursor-pointer font-sans"
                    >
                      Expira logo (15 d)
                    </button>
                  </div>
                </div>

                {/* IBGE & Environment grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">
                      Município (IBGE)
                    </label>
                    <input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value.replace(/\D/g, "").slice(0, 7))}
                      className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">
                      Ambiente Sefaz
                    </label>
                    <select
                      value={ambiente}
                      onChange={(e: any) => setAmbiente(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-350 font-bold"
                    >
                      <option value="Homologacao">Homologação</option>
                      <option value="Producao">Produção</option>
                    </select>
                  </div>
                </div>

                {/* Form buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (!saving) {
                        setIsEditing(false);
                        setEditingEmpresa(null);
                      }
                    }}
                    className={`flex-1 p-2 border rounded-lg font-bold cursor-pointer text-center ${
                      saving
                        ? "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-slate-950 hover:bg-slate-850 border-slate-850 text-slate-400 hover:text-white"
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`flex-1 p-2 rounded-lg font-bold text-center flex items-center justify-center gap-1 ${
                      saving
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                    }`}
                  >
                    {saving ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                    ) : (
                      <><Check className="w-3.5 h-3.5" /> Gravar</>
                    )}
                  </button>
                </div>
              </form>
          </div>
        </div>}
      </div>
    </div>
  );
}
