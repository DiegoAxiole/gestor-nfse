import React, { useState } from "react";
import { ConfigToml } from "../types";
import { 
  Settings, 
  ShieldCheck, 
  Save, 
  HelpCircle, 
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";
import { motion } from "motion/react";

interface ConfiguracoesViewProps {
  config: ConfigToml;
  onSaveConfig: (newConfig: ConfigToml) => void;
  onResetDatabase: () => void;
}

export default function ConfiguracoesView({
  config,
  onSaveConfig,
  onResetDatabase
}: ConfiguracoesViewProps) {
  // Local states for form editing
  const [razao, setRazao] = useState(config.prestador.razao_social);
  const [cnpj, setCnpj] = useState(config.prestador.cnpj);
  const [certPath, setCertPath] = useState(config.certificado.caminho);
  const [certPass, setCertPass] = useState("••••••••••••");
  const [ambiente, setAmbiente] = useState<"Homologacao" | "Producao">(config.geral.ambiente);
  const [municipio, setMunicipio] = useState(config.geral.codigo_municipio);
  const [lgpdAtivo, setLgpdAtivo] = useState(config.lgpd_ativo ?? false);
  
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      await onSaveConfig({
        prestador: {
          cnpj: cnpj.trim(),
          razao_social: razao.trim().toUpperCase()
        },
        certificado: {
          caminho: certPath.trim(),
          senha_mascarada: certPass
        },
        geral: {
          ambiente,
          codigo_municipio: municipio.trim()
        },
        lgpd_ativo: lgpdAtivo
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = () => {
    if (confirm("Deseja realmente redefinir o banco de dados simulado? Isso apagará as notas baixadas e histórico de consultas de teste.")) {
      setResetting(true);
      setTimeout(() => {
        setResetting(false);
        onResetDatabase();
      }, 1000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white uppercase font-sans">
          CONFIGURAÇÕES DA CONSULTA NFSe
        </h1>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
           Configure a empresa titular do certificado digital A1 para consulta e download de NFSe emitidas para o seu CNPJ.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Column: Editable Settings Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xs space-y-5">
            <h2 className="text-xs font-bold text-slate-350 flex items-center gap-1.5 pb-2 border-b border-slate-850 uppercase tracking-wider">
              <Settings className="w-4 h-4 text-indigo-450" />
              Empresa Gestora
            </h2>

            {/* Success flash */}
            {savedSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-2 font-sans"
              >
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                Configurações gravadas e aplicadas nas instâncias com sucesso!
              </motion.div>
            )}

            <div className="space-y-4 font-sans">
              {/* Prestador */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dados do Titular do Certificado</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5">Razão Social</label>
                    <input
                      type="text"
                      value={razao}
                      onChange={(e) => setRazao(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg text-xs font-medium text-slate-200 focus:outline-hidden focus:border-slate-750"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5">CNPJ do Emitente</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg font-mono text-xs text-slate-200 focus:outline-hidden focus:border-slate-750"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Município */}
              <div className="space-y-3 pt-4 border-t border-slate-850">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5">Código de Município (IBGE)</label>
                    <input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value.replace(/\D/g, ""))}
                      className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg font-mono text-xs text-slate-200 focus:outline-hidden focus:border-slate-750"
                      maxLength={7}
                      required
                    />
                  </div>
                </div>
              </div>
              {/* LGPD Protection */}
              <div className="space-y-3 pt-4 border-t border-slate-850">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Proteção de Dados (LGPD)</h3>
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-850">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      {lgpdAtivo ? <EyeOff className="w-4 h-4 text-indigo-400" /> : <Eye className="w-4 h-4 text-slate-500" />}
                      Ocultar dados sensíveis
                    </span>
                    <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">
                      Quando ativo, CNPJ, razão social, nome do tomador e chave NFSe são mascarados em todas as telas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLgpdAtivo(!lgpdAtivo)}
                    className={`relative w-11 h-6 rounded-full transition-all cursor-pointer shrink-0 ${
                      lgpdAtivo ? "bg-indigo-600" : "bg-slate-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-xs transition-all ${
                        lgpdAtivo ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-850 flex justify-end font-sans">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:bg-slate-850 disabled:text-slate-500"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Gravando no config.toml...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Salvar Arquivo de Config
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Database Reset Block */}
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-xs space-y-3 font-sans">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              Reset de Simulação
            </h3>
            <p className="text-xs text-slate-450 leading-relaxed font-sans">
              Deseja redefinir as consultas obtidas de teste por dFe e recarregar as notas originais do projeto?
            </p>

            <button
              onClick={handleResetData}
              disabled={resetting}
              className="w-full bg-rose-500/10 text-rose-400 hover:bg-rose-500/15 border border-rose-500/20 font-bold text-xs p-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider font-sans"
            >
              {resetting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Redefinindo sqlite local...
                </>
              ) : (
                "Limpar Memória de Consulta"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
