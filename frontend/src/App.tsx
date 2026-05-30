import { useState, useEffect } from "react";
import { Documento, Operacao, ConfigToml, Empresa } from "./types";
import * as api from "./api";
import { formatCurrency } from "./utils";

// Views
import DashboardView from "./components/DashboardView";
import GerarDanfeView from "./pages/GerarDanfeView";
import HistoricoView from "./pages/HistoricoView";
import ConfiguracoesView from "./pages/ConfiguracoesView";
import EmpresasView from "./pages/EmpresasView";
import DownloadLoteView from "./pages/DownloadLoteView";
import DocumentosView from "./pages/DocumentosView";

// Icons
import { 
  LayoutDashboard, 
  Printer, 
  History, 
  FileCode2, 
  Settings2, 
  Menu, 
  X, 
  ShieldCheck, 
  AlertCircle,
  FolderDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [state, setState] = useState<{
    docs: Documento[];
    ops: Operacao[];
    config: ConfigToml;
    empresas: Empresa[];
    activeEmpresaId: string;
  }>({
    docs: [],
    ops: [],
    config: {
      prestador: { cnpj: "", razao_social: "" },
      certificado: { caminho: "", senha_mascarada: "" },
      geral: { ambiente: "Homologacao", codigo_municipio: "" }
    },
    empresas: [],
    activeEmpresaId: ""
  });

  // Navigation and active selectors
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [selectedChave, setSelectedChave] = useState<string>("");
  
  // Responsive sidebar drawer toggle for mobile screens
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Custom polished toast state
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // On mount: fetch all data from API
  useEffect(() => {
    Promise.all([
      api.fetchEmpresas(),
      api.fetchDocumentos(),
      api.fetchOperacoes(),
      api.fetchConfig(),
    ]).then(([empresas, docs, ops, config]) => {
      setState(prev => ({ ...prev, empresas, docs, ops, config }));
    }).catch(err => {
      triggerToast(`Erro ao carregar dados: ${err.message}`, "error");
    });
  }, []);

  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // State Manipulation hooks
  const handleAddOperation = (newOp: Operacao) => {
    setState(prev => {
      const updatedOps = [newOp, ...prev.ops];
      return { ...prev, ops: updatedOps };
    });

    if (newOp.status === "SUCESSO") {
      triggerToast(
        `Consulta com sucesso! Proximo NSU: ${newOp.ultimo_nsu}. Registrado dFe.`,
        "success"
      );
    } else {
      triggerToast(
        `Rejeição SEFAZ: Consulta retornou erro ou rejeição. Verifique o histórico.`,
        "error"
      );
    }
  };

  const handleAddDocuments = (newDocs: Documento[]) => {
    setState(prev => {
      const currentDocs = [...prev.docs];

      newDocs.forEach((newDoc) => {
        const idx = currentDocs.findIndex((d) => d.chave_acesso === newDoc.chave_acesso);
        if (idx !== -1) {
          currentDocs[idx] = { ...currentDocs[idx], ...newDoc, tem_pdf: currentDocs[idx].tem_pdf || newDoc.tem_pdf };
        } else {
          currentDocs.unshift(newDoc);
        }
      });

      return { ...prev, docs: currentDocs };
    });

    if (newDocs.length > 0) {
      triggerToast(
        `Novo documento fiscal importado! Nota ${newDocs[0].numero_nota} no valor de ${formatCurrency(newDocs[0].valor_servicos)}`,
        "success"
      );
    }
  };

  const handleSaveConfig = async (newConfig: ConfigToml) => {
    setState(prev => ({ ...prev, config: newConfig }));
    await api.saveConfigToml(newConfig);
    triggerToast("Arquivo config.toml de credenciamento do Unimake salvo!", "success");
  };

  // MULTI-COMPANY HANDLERS
  const handleSetActiveEmpresa = (id: string) => {
    setState(prev => {
      const active = prev.empresas.find(e => e.id === id);
      if (active) {
        triggerToast(`Empresa ativa alterada para: ${active.razao_social}`, "info");
      }
      return { ...prev, activeEmpresaId: id };
    });
  };

  const handleEmpresaAtualizada = async () => {
    try {
      const empresas = await api.fetchEmpresas();
      setState(prev => ({ ...prev, empresas }));
    } catch (err: any) {
      triggerToast(err.message || "Erro ao atualizar lista de empresas", "error");
    }
  };

  const handleResetDatabase = () => {
    setState({
      docs: [],
      ops: [],
      config: {
        prestador: { cnpj: "", razao_social: "" },
        certificado: { caminho: "", senha_mascarada: "" },
        geral: { ambiente: "Homologacao", codigo_municipio: "" }
      },
      empresas: [],
      activeEmpresaId: ""
    });
    triggerToast("Dados limpos! Notas e histórico de consultas redefinidos.", "info");
  };

  // Shortcuts jumps between pages
  const handleViewXmlPage = (chave: string) => {
    const doc = state.docs.find(d => d.chave_acesso === chave);
    if (!doc) {
      triggerToast("Nota fiscal não localizada no microbanco local.", "error");
      return;
    }
    
    // Direct instant download of raw XML file as requested
    const blob = new Blob([doc.xml_nfse], { type: "text/xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `NFSe_${doc.numero_nota}_Chave_${doc.chave_acesso}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    triggerToast(`XML da Nota ${doc.numero_nota} baixado com sucesso!`, "success");
  };

  const handleGenerateDanfePage = (chave: string) => {
    setSelectedChave(chave);
    setActiveTab("gerar");
    setMobileMenuOpen(false);
  };

  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

     const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documentos", label: "Documentos", icon: FileCode2 },
    { id: "empresas", label: "Gestão de Empresas", icon: ShieldCheck },
    { id: "download_lote", label: "Exportar XMLs (ZIP)", icon: FolderDown },
    { id: "gerar", label: "Gerar DANFSe", icon: Printer },
    { id: "historico", label: "Histórico NSU", icon: History },
    { id: "configuracoes", label: "Configuração Toml", icon: Settings2 }
  ];

  const activeEmpresa = state.empresas.find(e => e.id === state.activeEmpresaId) || state.empresas[0];
  const lgpdAtivo = state.config.lgpd_ativo ?? false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col antialiased selection:bg-indigo-500/30">
      {/* Toast Alert overlay */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className={`p-4 rounded-xl shadow-2xl border text-xs font-semibold flex items-start gap-2.5 ${
              toast.type === "success" 
                ? "bg-slate-900 border-indigo-500/30 text-white shadow-indigo-500/5" 
                : toast.type === "error"
                ? "bg-rose-950 border-rose-900 text-rose-200 shadow-rose-950/20"
                : "bg-slate-900 border-slate-850 text-slate-200 shadow-slate-950/30"
            }`}>
              {toast.type === "success" ? (
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${toast.type === "error" ? "text-rose-400" : "text-indigo-400"}`} />
              )}
              <div className="flex-1">
                {toast.message}
              </div>
              <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 p-0.5 cursor-pointer text-[10px]">
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Structural Frame */}
      <div className="flex flex-1 relative">
        {/* DESKTOP SIDEBAR - High Density Dark theme */}
        <aside className="hidden lg:flex flex-col w-64 bg-slate-950 text-slate-300 border-r border-slate-900 p-5 shrink-0 select-none">
          <div className="flex items-center gap-2.5 px-2 py-4 border-b border-slate-900">
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-indigo-500/10">
              <span className="text-white text-sm font-bold">NFSe</span>
            </div>
          </div>

          {/* Navigation link blocks */}
          <nav className="mt-6 flex-1 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    isActive 
                      ? "bg-slate-900 text-white shadow-xs border border-slate-800 font-bold" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer info */}
          <div className="pt-4 border-t border-slate-900 space-y-2 text-center text-[10.5px]">
            <div className="text-slate-500 flex justify-between px-2 font-mono">
              <span>DLL Unimake</span>
              <span className="text-emerald-400 font-bold">Ativa</span>
            </div>
            <div className="text-slate-500 flex justify-between px-2 font-mono">
              <span>Banco SQLite</span>
              <span className="text-slate-400">nfse.db</span>
            </div>
            <div className="text-[9.5px] text-slate-700 pt-1 font-mono">
              v1.4.15-python3.12+
            </div>
          </div>
        </aside>

        {/* MOBILE DRAWER TRIGGER NAVBAR */}
        <header className="lg:hidden w-full bg-slate-950 border-b border-slate-900 h-16 flex items-center justify-between px-4 text-white shrink-0 absolute top-0 left-0 z-40 select-none">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center font-extrabold text-white text-sm">
              NFSe
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 focus:outline-hidden" /> : <Menu className="w-5 h-5 focus:outline-hidden" />}
          </button>
        </header>

        {/* MOBILE MENU NAV EXPANSION */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden absolute top-16 left-0 right-0 z-35 bg-slate-950 border-b border-slate-900 overflow-hidden shadow-xl"
            >
              <nav className="p-4 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        isActive 
                          ? "bg-slate-900 text-white font-bold border border-slate-850" 
                          : "text-slate-400 hover:text-white hover:bg-slate-900"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-slate-500" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WORKSPACE AREA */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto pt-20 lg:pt-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === "dashboard" && (
              <DashboardView
                docs={state.docs}
                ops={state.ops}
                empresas={state.empresas}
                config={state.config}
                activeEmpresa={activeEmpresa}
                lgpdAtivo={lgpdAtivo}
                onNavigate={handleNavigation}
                onSetActiveEmpresa={handleSetActiveEmpresa}
                onAddOperation={handleAddOperation}
                onAddDocuments={handleAddDocuments}
              />
            )}

            {activeTab === "documentos" && (
              <DocumentosView
                empresas={state.empresas}
                lgpdAtivo={lgpdAtivo}
                onViewXml={handleViewXmlPage}
                onGenerateDanfe={handleGenerateDanfePage}
              />
            )}

            {activeTab === "empresas" && (
              <EmpresasView
                empresas={state.empresas}
                activeEmpresaId={state.activeEmpresaId}
                lgpdAtivo={lgpdAtivo}
                onSetActive={handleSetActiveEmpresa}
                onEmpresaAtualizada={handleEmpresaAtualizada}
                onEmpresaSelecionada={handleSetActiveEmpresa}
              />
            )}

            {activeTab === "download_lote" && (
              <DownloadLoteView
                docs={state.docs}
                empresas={state.empresas}
                lgpdAtivo={lgpdAtivo}
              />
            )}

            {activeTab === "gerar" && (
              <GerarDanfeView
                docs={state.docs}
                empresas={state.empresas}
                activeEmpresaId={state.activeEmpresaId}
                selectedChave={selectedChave}
                lgpdAtivo={lgpdAtivo}
                onViewXml={handleViewXmlPage}
              />
            )}

            {activeTab === "historico" && (
              <HistoricoView
                ops={state.ops}
                empresas={state.empresas}
                lgpdAtivo={lgpdAtivo}
                onViewXml={handleViewXmlPage}
              />
            )}

            {activeTab === "configuracoes" && (
              <ConfiguracoesView
                config={state.config}
                onSaveConfig={handleSaveConfig}
                onResetDatabase={handleResetDatabase}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
