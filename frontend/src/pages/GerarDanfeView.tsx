import { useState, useEffect, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { Documento, Empresa } from "../types";
import { formatCurrency, formatDate, maskRazao, maskNome } from "../utils";
import type { NfseData } from "../services/danfse-parser";
import { parseNfseXml } from "../services/danfse-parser";
import DanfseView from "../components/DanfseView";
import { 
  Printer, 
  FileText, 
  AlertTriangle,
  Search,
  Download,
  FileSearch
} from "lucide-react";



export default function GerarDanfeView() {
  const { docs, empresas, activeEmpresaId, selectedChave = "", lgpdAtivo = false, onViewXml } = useOutletContext<any>();
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [chave, setChave] = useState(selectedChave);
  const [activeDanfe, setActiveDanfe] = useState<Documento | null>(
    selectedChave ? docs.find((d) => d.chave_acesso === selectedChave) || null : null
  );
  const [parsedNfse, setParsedNfse] = useState<NfseData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedChave && selectedChave !== chave) {
      setChave(selectedChave);
      const target = docs.find((d) => d.chave_acesso === selectedChave);
      if (target) setActiveDanfe(target);
    }
  }, [selectedChave, docs]);

  useEffect(() => {
    if (!activeDanfe || !activeDanfe.xml_nfse) {
      setParsedNfse(null);
      setParseError(activeDanfe && !activeDanfe.xml_nfse ? "XML da nota não disponível." : null);
      return;
    }

    try {
      const parsed = parseNfseXml(activeDanfe.xml_nfse);
      setParsedNfse(parsed);
      setParseError(null);
    } catch (err: any) {
      setParsedNfse(null);
      setParseError(err.message || "Erro ao processar XML da NFS-e.");
    }
  }, [activeDanfe]);

  const filteredDocs = docs.filter((doc) => {
    const term = searchTerm.toLowerCase().trim();
    const cleanDocPrestadorCnpj = doc.prestador_cnpj.replace(/\D/g, "");
    const cleanDocTomadorCnpj = doc.tomador_cnpj.replace(/\D/g, "");

    const matchesSearch = !term ||
      doc.prestador_nome.toLowerCase().includes(term) ||
      doc.tomador_nome.toLowerCase().includes(term) ||
      doc.numero_nota.toLowerCase().includes(term) ||
      doc.chave_acesso.toLowerCase().includes(term) ||
      cleanDocPrestadorCnpj.includes(term) ||
      cleanDocTomadorCnpj.includes(term);

    let matchesStartDate = true;
    if (startDate) {
      const start = new Date(startDate + "T00:00:00");
      matchesStartDate = new Date(doc.data_importacao) >= start;
    }

    let matchesEndDate = true;
    if (endDate) {
      const end = new Date(endDate + "T23:59:59");
      matchesEndDate = new Date(doc.data_importacao) <= end;
    }

    return matchesSearch && matchesStartDate && matchesEndDate;
  });



  const handleDownloadPdf = () => {
    window.print();
  };

  const handleBuscarChave = (e: FormEvent) => {
    e.preventDefault();
    const cleanKey = chave.trim();
    if (cleanKey.length !== 44 && cleanKey.length !== 50) {
      alert("A chave de acesso precisa ter 44 dígitos (municipal) ou 50 dígitos (nacional).");
      return;
    }

    const target = docs.find((d) => d.chave_acesso === cleanKey);
    if (target) {
      setActiveDanfe(target);
    } else {
      alert("Nota não encontrada na base local. O XML não está disponível para visualização.");
    }
  };

  return (
    <div className="space-y-6 select-none">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-5 rounded-xl border border-slate-800 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase font-sans flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            VISUALIZADOR DE DANFSe
          </h1>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">
            Selecione uma nota fiscal para visualizar o DANFSe em formato A4. O documento é gerado diretamente no navegador a partir do XML.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2 border-b border-slate-850 pb-2">
              <Search className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">Filtrar Documentos</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Empresa, CNPJ do Cliente ou Nota Nº
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filtrar por nome, CNPJ ou NFSe..."
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-600 outline-hidden focus:border-indigo-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-white outline-hidden focus:border-indigo-500 transition-all font-sans cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-white outline-hidden focus:border-indigo-500 transition-all font-sans cursor-pointer"
                  />
                </div>
              </div>

              {(searchTerm || startDate || endDate) && (
                <button
                  onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); }}
                  className="w-full text-center text-[10.5px] font-semibold text-indigo-400 hover:text-indigo-305 transition-colors pt-1 block"
                >
                  Limpar Todos os Filtros
                </button>
              )}
            </div>
          </div>

          {activeDanfe && parsedNfse && (
            <div className="bg-slate-900 p-4 rounded-xl border border-indigo-500/25 shadow-xs space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  NFSe #{activeDanfe.numero_nota}
                </h3>
              </div>
              <div className="text-[10px] text-slate-400 truncate uppercase">
                {lgpdAtivo ? maskRazao(activeDanfe.prestador_nome) : activeDanfe.prestador_nome}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadPdf}
                  className="flex-1 px-3 py-2 rounded-lg border border-emerald-600/30 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => onViewXml(activeDanfe.chave_acesso)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-850 text-slate-300 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  XML
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs flex flex-col max-h-[320px]">
            <div className="border-b border-slate-850 pb-2 mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                NFSe Localizadas ({filteredDocs.length})
              </h3>
              <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded font-mono">
                Banco SQLite
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {filteredDocs.map((doc) => {
                const isActive = activeDanfe?.chave_acesso === doc.chave_acesso;

                return (
                  <div
                    key={doc.chave_acesso}
                    onClick={() => { setChave(doc.chave_acesso); setActiveDanfe(doc); }}
                    className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2 group ${
                      isActive
                        ? "bg-indigo-950/35 border-indigo-500/50 hover:bg-indigo-950/45"
                        : "bg-slate-950/80 border-slate-850 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isActive ? "bg-indigo-400 animate-pulse" : "bg-slate-650"
                        }`} />
                        <span className="text-slate-200 font-bold block text-xs">
                          NFSe #{doc.numero_nota}
                        </span>
                      </div>

                      <div className="text-[10.5px] text-slate-400 truncate uppercase" title={doc.prestador_nome}>
                        De: {lgpdAtivo ? maskRazao(doc.prestador_nome) : doc.prestador_nome}
                      </div>
                      <div className="text-[9.5px] text-slate-500 truncate uppercase" title={doc.tomador_nome}>
                        Para: {lgpdAtivo ? maskNome(doc.tomador_nome) : doc.tomador_nome}
                      </div>

                      <div className="text-[9px] text-slate-500 font-mono flex items-center gap-2">
                        <span>{formatDate(doc.data_importacao).split(" ")[0]}</span>
                        <span>•</span>
                        <span className="text-[10px] text-indigo-300 font-bold">
                          {formatCurrency(doc.valor_servicos)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChave(doc.chave_acesso);
                        setActiveDanfe(doc);
                      }}
                      className="p-2 rounded-lg border border-indigo-500/20 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all shrink-0 cursor-pointer"
                      title="Visualizar DANFSe"
                    >
                      <FileSearch className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {filteredDocs.length === 0 && (
                <div className="text-center py-10 rounded-xl border border-dashed border-slate-800 px-4">
                  <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-550 font-medium italic font-mono">
                    Nenhum documento localizado para os filtros informados.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              Buscar por Chave de Acesso
            </h3>

            <form onSubmit={handleBuscarChave} className="space-y-2.5">
              <div>
                <textarea
                  value={chave}
                  onChange={(e) => setChave(e.target.value.replace(/\D/g, "").slice(0, 50))}
                  placeholder="Informe a Chave de Acesso (44 ou 50 dígitos)..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-850 rounded-lg font-mono text-[10.5px] text-center text-slate-200 focus:outline-hidden focus:border-slate-755 transition-all h-14 resize-none leading-relaxed placeholder-slate-700"
                  required
                />
                <div className="text-[9.5px] text-slate-500 text-right font-mono mt-1">
                  {chave.length}/50 dígitos
                </div>
              </div>

              <button
                type="submit"
                disabled={chave.length !== 44 && chave.length !== 50}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all disabled:bg-slate-850 disabled:text-slate-500 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <FileSearch className="w-4 h-4" />
                Buscar na Base Local
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-9 space-y-4">
          {activeDanfe && parsedNfse ? (
            <>
              <DanfseView data={parsedNfse} lgpdAtivo={lgpdAtivo} />
            </>
          ) : activeDanfe && parseError ? (
            <div className="bg-slate-900 p-16 rounded-xl border border-slate-800 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Erro ao processar XML</h3>
                <p className="text-xs text-slate-500 leading-normal font-sans">{parseError}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 p-16 rounded-xl border border-slate-800 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Nenhum DANFSe Selecionado</h3>
                <p className="text-xs text-slate-500 leading-normal font-sans">
                  Selecione uma nota fiscal na lista à esquerda para visualizar o DANFSe em formato A4.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
