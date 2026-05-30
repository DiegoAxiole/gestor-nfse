import React, { useState, useEffect } from "react";
import { Empresa, Documento } from "../types";
import { formatCnpj, maskRazao } from "../utils";
import * as api from "../api";
import { 
  Download, 
  Search, 
  Calendar, 
  FileArchive, 
  Loader2,
  Code2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DownloadLoteViewProps {
  empresas: Empresa[];
  docs: Documento[];
  lgpdAtivo?: boolean;
}

export default function DownloadLoteView({ empresas, docs, lgpdAtivo = false }: DownloadLoteViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");
  
  // Date states - default to current month
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    if (!dataInicio) {
      const now = new Date();
      setDataInicio(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
      setDataFim(now.toISOString().split("T")[0]);
    }
  }, []);

  const [downloading, setDownloading] = useState(false);
  const [downloadStep, setDownloadStep] = useState<string>("");
  const [downloadSuccessInfo, setDownloadSuccessInfo] = useState<{
    fileName: string;
    totalNotas: number;
  } | null>(null);

  // Filter companies by search
  const filteredEmpresas = empresas.filter(emp => 
    emp.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cnpj.replace(/\D/g, "").includes(searchTerm.replace(/\D/g, ""))
  );

  const selectedEmpresa = empresas.find(e => e.id === selectedEmpresaId);

  // Filter documents in memory for preview (by emission/competence date)
  const getFilteredDocsCount = (cnpj: string) => {
    return docs.filter(d => {
      const cnpjClean = cnpj.replace(/\D/g, "");
      const docCnpjClean = d.prestador_cnpj.replace(/\D/g, "");
      if (cnpjClean !== docCnpjClean) return false;

      const docDate = d.data_emissao || d.data_importacao.split("T")[0];
      return docDate >= dataInicio && docDate <= dataFim;
    }).length;
  };

  const handleDownloadZip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpresa) return;

    setDownloading(true);
    setDownloadSuccessInfo(null);

    const count = getFilteredDocsCount(selectedEmpresa.cnpj);
    const cnpjClean = selectedEmpresa.cnpj.replace(/\D/g, "");

    const dateToBr = (dateStr: string) => {
      const [y, m, d] = dateStr.split("-");
      return `${d}_${m}_${y}`;
    };

    const cleanName = selectedEmpresa.razao_social
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .replace(/\s+/g, "_")
      .toUpperCase();

    const fileName = `${cleanName}_${dateToBr(dataInicio)}_a_${dateToBr(dataFim)}.zip`;

    setDownloadStep("Buscando XMLs no servidor para o CNPJ " + formatCnpj(cnpjClean) + "...");

    try {
      const blob = await api.downloadZip(cnpjClean, dataInicio, dataFim);

      setDownloadStep("Gerando arquivo ZIP...");

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloading(false);
      setDownloadSuccessInfo({ fileName, totalNotas: count });
    } catch (err: any) {
      setDownloading(false);
      alert(err.message || "Erro ao baixar ZIP");
    }
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white uppercase flex items-center gap-2 font-sans">
          <FileArchive className="w-5 h-5 text-indigo-400" />
          Download de NFSe em Lote por Período
        </h1>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
          Facilite a rotina fiscal contábil de fechamento mensal. Pesquise por empresas e gere um arquivo unificado compactado contendo todos os arquivos XMLs NFSe das empresas desejadas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Search and Select Company */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <h2 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-850">
            <span className="w-4 h-4 rounded-full bg-indigo-500/10 text-indigo-400 inline-flex items-center justify-center font-bold font-mono text-[10px]">1</span>
            Selecione a Empresa
          </h2>

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar por Nome ou CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 text-slate-200 border border-slate-850 rounded-lg text-xs placeholder-slate-600 focus:outline-hidden focus:border-slate-750"
            />
          </div>

          {/* List scrollbox */}
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {filteredEmpresas.map(emp => {
              const count = getFilteredDocsCount(emp.cnpj);
              const isSelected = emp.id === selectedEmpresaId;
              const hasCert = !!emp.certificado_caminho;

              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmpresaId(emp.id)}
                  type="button"
                  className={`w-full text-left p-3 rounded-lg border flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-indigo-600/10 border-indigo-500/45"
                      : "bg-slate-950/70 border-slate-850 hover:bg-slate-950 hover:border-slate-800"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[11.5px] font-bold text-white block uppercase truncate leading-snug">
                      {lgpdAtivo ? maskRazao(emp.razao_social) : emp.razao_social}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono tracking-tight block mt-0.5">
                      CNPJ: {formatCnpj(emp.cnpj, lgpdAtivo)}
                    </span>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border ${
                      hasCert 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15" 
                        : "bg-amber-500/10 text-amber-500 border-amber-500/15"
                    }`}>
                      {hasCert ? "Cert. OK" : "Sem Cert"}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-bold block">
                      {count} nota{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredEmpresas.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs font-sans">
                Nenhuma empresa correspondente localizada.
              </div>
            )}
          </div>
        </div>

        {/* Step 2 & 3: Filter Date & Action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-5">
            <h2 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-850">
              <span className="w-4 h-4 rounded-full bg-indigo-500/10 text-indigo-400 inline-flex items-center justify-center font-bold font-mono text-[10px]">2</span>
              Período de Emissão & Parâmetros
            </h2>

            {!selectedEmpresa ? (
              <div className="py-14 text-center text-slate-500 space-y-2 font-sans">
                <FileArchive className="w-8 h-8 text-slate-700 mx-auto" />
                <p className="font-bold text-xs text-slate-400">Nenhuma Empresa Selecionada</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Por favor, escolha uma empresa no menu à esquerda para estipular o intervalo mensal e compilar o arquivo ZIP de exportação.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDownloadZip} className="space-y-5 font-sans">
                {/* Active company summary metadata */}
                <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-lg flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Empresa Alvo</span>
                    <strong className="text-xs text-indigo-300 block uppercase truncate">{lgpdAtivo ? maskRazao(selectedEmpresa.razao_social) : selectedEmpresa.razao_social}</strong>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider">{formatCnpj(selectedEmpresa.cnpj, lgpdAtivo)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Município IBGE</span>
                    <strong className="text-xs text-white block font-mono">{selectedEmpresa.codigo_municipio}</strong>
                  </div>
                </div>

                {/* Date range grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      Data de Emissão / Início
                    </label>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full p-2 bg-slate-950 text-slate-200 border border-slate-850 rounded-lg text-xs font-semibold focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      Data de Emissão / Fim
                    </label>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full p-2 bg-slate-950 text-slate-200 border border-slate-850 rounded-lg text-xs font-semibold focus:outline-hidden"
                      required
                    />
                  </div>
                </div>

                {/* Filter counts preview */}
                <div className="p-3.5 bg-slate-950/40 rounded-lg border border-slate-850 flex items-center justify-between">
                  <span className="text-xs text-slate-400 leading-none">
                    Notas emitidas no período:
                  </span>
                  <span className="text-xs font-extrabold text-white font-mono bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/15 rounded-md">
                    {getFilteredDocsCount(selectedEmpresa.cnpj)} XMLs listados
                  </span>
                </div>

                {/* Action button */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
                  <div className="text-[10.5px] text-slate-500 leading-normal font-sans">
                    * O arquivo gerado obedece ao padrão nacional unificado.
                  </div>
                  
                  <button
                    type="submit"
                    disabled={downloading}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer disabled:bg-slate-850 disabled:text-slate-500 w-full sm:w-auto shrink-0"
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                        Montando ZIP...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Baixar Notas (ZIP)
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Simulated file system log */}
            <AnimatePresence>
              {downloading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-slate-950 border border-slate-850 rounded-lg space-y-2 font-mono"
                >
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Procedimento de Exportação</span>
                  </div>
                  <div className="text-[11px] text-indigo-400 font-medium">
                    {downloadStep}
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden relative">
                    <motion.div 
                      initial={{ left: "-100%" }}
                      animate={{ left: "100%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute top-0 bottom-0 w-1/3 bg-indigo-500 rounded"
                    />
                  </div>
                </motion.div>
              )}

              {downloadSuccessInfo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-start gap-3 text-xs"
                >
                  <FileArchive className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-white uppercase text-[10.5px]">Download Concluído com Sucesso!</h4>
                    <p className="text-slate-300 leading-normal">
                      O arquivo compactado <strong className="text-emerald-400 font-mono font-bold text-[11px] bg-slate-950 px-1 py-0.5 border border-slate-850 rounded">{downloadSuccessInfo.fileName}</strong> foi gerado e enviado para a sua máquina contendo <strong className="text-emerald-300">{downloadSuccessInfo.totalNotas} XMLs</strong>.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          
        </div>
      </div>
    </div>
  );
}
