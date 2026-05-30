import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Documento, Empresa } from "../types";
import { formatCurrency, formatDate, formatCnpj, maskRazao, maskNome, maskChave } from "../utils";
import { buscarDocumentosPaginated } from "../api";
import {
  FileText,
  ExternalLink,
  FileDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";

interface DocumentosViewProps {
  empresas: Empresa[];
  lgpdAtivo?: boolean;
  onViewXml: (chave: string) => void;
  onGenerateDanfe: (chave: string) => void;
}

export default function DocumentosView({
  empresas,
  lgpdAtivo = false,
  onViewXml,
  onGenerateDanfe,
}: DocumentosViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await buscarDocumentosPaginated({
        cnpj: empresaFilter || undefined,
        inicio: startDate || undefined,
        fim: endDate || undefined,
        page,
        page_size: pageSize,
      });
      setDocs(result.documentos);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar documentos");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, empresaFilter, startDate, endDate]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  const pagesToShow = () => {
    const pages: (number | "...")[] = [];
    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return pages;
  };

  const filteredDocs = searchTerm.trim()
    ? docs.filter((doc) => {
        const q = searchTerm.trim().toLowerCase();
        return (
          doc.prestador_nome.toLowerCase().includes(q) ||
          doc.tomador_nome.toLowerCase().includes(q) ||
          doc.numero_nota.toLowerCase().includes(q) ||
          doc.chave_acesso.toLowerCase().includes(q) ||
          doc.prestador_cnpj.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
        );
      })
    : docs;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white uppercase font-sans">
          <FileText className="w-5 h-5 text-indigo-400 inline mr-2" />
          Documentos Fiscais
        </h1>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">
          Consulte, filtre e exporte todas as NFSe armazenadas. {total} documento(s) no total.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Empresa</label>
            <select
              value={empresaFilter}
              onChange={(e) => { setEmpresaFilter(e.target.value); setPage(1); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Todas as empresas</option>
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.cnpj.replace(/\D/g, "")}>
                  {emp.razao_social}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Itens por página</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-550">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por prestador, tomador, NFSe ou chave..."
            className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-hidden transition-all font-sans"
          />
          <button type="submit" className="hidden" />
        </form>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xs overflow-auto max-h-[calc(100vh-320px)]">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span className="text-xs font-mono">Carregando documentos...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 gap-2 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs font-mono">{error}</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16 text-xs text-slate-500 font-sans border border-dashed border-slate-800 rounded-lg mx-4 my-4">
            Nenhum documento encontrado para os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Prestador</th>
                  <th className="py-2.5 px-3">No. Nota / NSU</th>
                  <th className="py-2.5 px-3">Tomador</th>
                  <th className="py-2.5 px-3">Data Emissão</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 px-3 text-center">PDF</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-855">
                {filteredDocs.map((doc) => (
                  <tr key={doc.chave_acesso} className="hover:bg-slate-950/45 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-bold text-white block uppercase truncate max-w-[200px]" title={doc.prestador_nome}>
                        {lgpdAtivo ? maskRazao(doc.prestador_nome) : (doc.prestador_nome || "-")}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tracking-tight block">
                        {formatCnpj(doc.prestador_cnpj, lgpdAtivo)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">
                        NFSe #{doc.numero_nota || "-"}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        NSU: {lgpdAtivo ? maskChave(doc.nsu) : (doc.nsu || "-")}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-300 block uppercase truncate max-w-[200px]" title={doc.tomador_nome}>
                        {lgpdAtivo ? maskNome(doc.tomador_nome) : (doc.tomador_nome || "-")}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        {formatCnpj(doc.tomador_cnpj, lgpdAtivo)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-450 font-mono align-middle">
                      {doc.data_emissao ? formatDate(doc.data_emissao).split(" ")[0] : "-"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-indigo-300 align-middle">
                      {formatCurrency(doc.valor_servicos)}
                    </td>
                    <td className="py-3 px-3 text-center align-middle">
                      {doc.tem_pdf ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded">
                          <Check className="w-3 h-3" />
                          OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                          <X className="w-3 h-3" />
                          Não
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right align-middle">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => onViewXml(doc.chave_acesso)}
                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-350 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 px-2.5 py-1.5 rounded uppercase tracking-wider transition-all inline-flex items-center gap-1 cursor-pointer"
                          title="Visualizar XML"
                        >
                          XML <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onGenerateDanfe(doc.chave_acesso)}
                          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-350 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-1.5 rounded uppercase tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer"
                          title="Baixar PDF / DANFE"
                        >
                          PDF <FileDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-xs flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500 font-mono">
            {total} documento(s) — Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {pagesToShow().map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-1.5 text-slate-600 text-[10px] font-mono">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`min-w-[28px] h-7 rounded text-[11px] font-bold font-mono cursor-pointer transition-all ${
                    p === page
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
