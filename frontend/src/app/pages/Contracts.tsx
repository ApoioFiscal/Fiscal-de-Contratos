import { useState, useEffect, useCallback } from "react";
import {
  listarContratos,
  importarContratoArquivo,
  atualizarContrato,
  baixarArquivoContrato,
  excluirContrato,
} from "@/services/contratos";
import { obterSessao } from "@/services/auth";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Loader2,
  FileDown,
  CalendarDays,
  PencilLine,
} from "lucide-react";
import type { Contrato, ContratoItem, StatusContrato } from "@/types/domain";
import { STATUS_CONTRATO_LABEL } from "@/types/domain";
import type { ImportacaoContratoResult } from "@/services/contratos";
import { ContratoReviewDrawer } from "@/app/components/ContratoReviewDrawer";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusChip: Record<StatusContrato, string> = {
  RASCUNHO: "bg-slate-100 text-slate-700",
  ATIVA: "bg-emerald-100 text-emerald-800",
  EM_ADITAMENTO: "bg-amber-100 text-amber-800",
  ENCERRADA: "bg-slate-200 text-slate-600",
  VENCIDA: "bg-rose-100 text-rose-800",
};

function nomeParte(c: Contrato, papel: string): string {
  const parte = c.partes?.find((p) => p.papel === papel);
  return parte?.nome ?? "—";
}

export function Contracts() {
  const sessao = obterSessao();
  const podeCriar = sessao?.perfil === "licitacoes" || sessao?.perfil === "gabinete";

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  const [isImporting, setIsImporting] = useState(false);
  const [ultimoImport, setUltimoImport] = useState<ImportacaoContratoResult | null>(null);
  const [contratoEmRevisao, setContratoEmRevisao] = useState<Contrato | null>(null);

  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [contratoParaExcluir, setContratoParaExcluir] = useState<Contrato | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [swalError, setSwalError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    listarContratos()
      .then(setContratos)
      .catch((err) => setSwalError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = contratos.filter((c) => {
    const termo = searchTerm.trim().toLowerCase();
    if (!termo) return true;
    const nomesPartes = (c.partes ?? []).map((p) => `${p.nome ?? ""} ${p.documento ?? ""}`).join(" ");
    return [c.numero, c.numeroProcesso, c.modalidade, c.numeroModalidade, c.objeto, nomesPartes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(termo);
  });

  const handleImportarPdf = async (arquivo: File) => {
    setIsImporting(true);
    setSwalError(null);
    try {
      const resultado = await importarContratoArquivo(arquivo);
      setUltimoImport(resultado);
      await reload();
      // O OCR avisou que algo não foi lido: abre a revisão manual já preenchida.
      // Só abre se o contrato completo voltou do backend (senão faltam coleções).
      if ((resultado.avisos?.length ?? 0) > 0 && Array.isArray(resultado.partes)) {
        setContratoEmRevisao(resultado as Contrato);
      }
    } catch (err) {
      setSwalError(err instanceof Error ? err.message : "Erro ao importar o contrato.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmarRevisao = async (contrato: Contrato) => {
    setConfirmandoId(contrato.id);
    setSwalError(null);
    try {
      await atualizarContrato(contrato.id, { confirmar: true });
      await reload();
    } catch (err) {
      setSwalError(err instanceof Error ? err.message : "Erro ao confirmar a revisão do contrato.");
    } finally {
      setConfirmandoId(null);
    }
  };

  const handleExcluir = (contrato: Contrato) => {
    setSwalError(null);
    setContratoParaExcluir(contrato);
  };

  const confirmarExclusao = async () => {
    if (!contratoParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirContrato(contratoParaExcluir.id);
      setContratoParaExcluir(null);
      await reload();
    } catch (err) {
      setSwalError(err instanceof Error ? err.message : "Nao foi possivel excluir o contrato.");
      setContratoParaExcluir(null);
    } finally {
      setExcluindo(false);
    }
  };

  const handleBaixarPdf = async (contrato: Contrato) => {
    try {
      const blob = await baixarArquivoContrato(contrato.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = contrato.arquivoPdfNome || `contrato-${contrato.numero}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSwalError(err instanceof Error ? err.message : "Não foi possível baixar o contrato.");
    }
  };

  // As datas do banco vêm como ISO em UTC (meia-noite). `slice(0, 10)` evita o
  // deslocamento de um dia ao formatar no fuso local (UTC-3).
  const dataLocal = (iso: string) => parseISO(iso.slice(0, 10));

  const vigenciaFim = (c: Contrato) =>
    c.vigenciaFim ? format(dataLocal(c.vigenciaFim), "dd/MM/yyyy") : "—";

  const diasRestantes = (c: Contrato) => {
    if (!c.vigenciaFim) return null;
    const hoje = new Date();
    const hojeLocal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const dias = differenceInDays(dataLocal(c.vigenciaFim), hojeLocal);
    return dias;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {swalError && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4" />
          {swalError}
          <button onClick={() => setSwalError(null)} className="ml-auto text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {ultimoImport && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold">Contrato importado com sucesso.</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              ID {ultimoImport.id} · Status: {STATUS_CONTRATO_LABEL[ultimoImport.status as StatusContrato] ?? ultimoImport.status}
            </p>
            {ultimoImport.avisos.length > 0 && (
              <div className="mt-2 text-xs text-amber-700">
                {ultimoImport.avisos.map((a, i) => (
                  <p key={i}>• {a}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contratos</h1>
          <p className="text-sm text-slate-500 mt-1">Contratos vigentes e saldos disponíveis.</p>
        </div>
        {podeCriar && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Importar contrato a partir do PDF assinado:</span>
            <label
              className={`relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer shadow-sm ${
                isImporting ? "opacity-70 pointer-events-none" : ""
              }`}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Selecionar Arquivo PDF
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportarPdf(file);
                  e.target.value = "";
                }}
                disabled={isImporting}
              />
            </label>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, processo, parte ou objeto..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading && <div className="p-8 text-center text-slate-500">Carregando contratos...</div>}

        <div className="divide-y divide-slate-200">
          {filtered.map((c) => (
            <div key={c.id} className="hover:bg-slate-50 transition-colors">
              <div
                className="p-4 sm:px-6 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {c.numero}
                    </span>
                    {c.numeroProcesso && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {c.numeroProcesso}
                      </span>
                    )}
                    {c.modalidade && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {c.modalidade}
                        {c.numeroModalidade ? ` ${c.numeroModalidade}` : ""}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusChip[c.status]}`}>
                      {STATUS_CONTRATO_LABEL[c.status]}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">{nomeParte(c, "CONTRATADO")}</h3>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-1">{c.objeto}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-slate-500">Valor Total</p>
                    <p className="text-sm font-medium text-slate-900">
                      {c.valorTotal != null ? fmt.format(c.valorTotal) : "—"}
                    </p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-slate-500">Vigência</p>
                    <p className="text-sm font-medium text-slate-900">{vigenciaFim(c)}</p>
                  </div>
                  {expandedId === c.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {expandedId === c.id && (
                <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100">
                  {/* Ações de revisão / download */}
                  {(c.status === "RASCUNHO" && podeCriar) || c.arquivoPdf ? (
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      {c.status === "RASCUNHO" && podeCriar && (
                        <>
                          <button
                            onClick={() => setContratoEmRevisao(c)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <PencilLine className="w-4 h-4" />
                            Revisar dados
                          </button>
                          <button
                            onClick={() => void handleConfirmarRevisao(c)}
                            disabled={confirmandoId === c.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {confirmandoId === c.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Confirmar Revisão (ATIVA)
                          </button>
                        </>
                      )}
                      {c.arquivoPdf && (
                        <button
                          onClick={() => void handleBaixarPdf(c)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
                        >
                          <FileDown className="w-4 h-4" />
                          Baixar PDF
                        </button>
                      )}
                      {podeCriar && (
                        <button
                          onClick={() => handleExcluir(c)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Excluir
                        </button>
                      )}
                      {c.status === "RASCUNHO" && !podeCriar && (
                        <span className="text-xs text-slate-500">Apenas Licitações/Gabinete confirmam a revisão.</span>
                      )}
                    </div>
                  ) : null}

                  <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Contratante</span>
                      <span className="font-medium text-slate-900">{nomeParte(c, "CONTRATANTE")}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Contratado</span>
                      <span className="font-medium text-slate-900">{nomeParte(c, "CONTRATADO")}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Foro</span>
                      <span className="font-medium text-slate-900">{c.foro ?? "—"}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Valor Global</span>
                      <span className="font-medium text-slate-900">{c.valorTotal != null ? fmt.format(c.valorTotal) : "—"}</span>
                    </div>
                  </div>

                  {c.vigenciaInicio && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-slate-700">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      <span>
                        Vigência: {format(dataLocal(c.vigenciaInicio), "dd/MM/yyyy")} até {vigenciaFim(c)}
                        {diasRestantes(c) != null && diasRestantes(c)! >= 0 && (
                          <span className="text-slate-500"> ({diasRestantes(c)} dias restantes)</span>
                        )}
                      </span>
                    </div>
                  )}

                  {c.status === "RASCUNHO" &&
                    (c.itensConferemTotalTabela !== null || c.itensConferemValorContrato !== null) && (
                      <div className="mb-4 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-semibold text-slate-700 mb-1">Validações da extração</p>
                        <p className="text-slate-600">
                          Soma dos itens confere o total da tabela: {c.itensConferemTotalTabela ? "sim" : "não"}
                        </p>
                        <p className="text-slate-600">
                          Soma dos itens confere o valor do contrato: {c.itensConferemValorContrato ? "sim" : "não"}
                        </p>
                      </div>
                    )}

                  {c.status === "RASCUNHO" && c.avisos.length > 0 && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">Avisos do OCR</p>
                      <ul className="text-xs text-amber-700 space-y-1">
                        {c.avisos.map((a, i) => (
                          <li key={i}>• {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-slate-500">Item</th>
                          <th className="px-4 py-3 text-left font-medium text-slate-500">Unidade</th>
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Valor Unit.</th>
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Qtd. Total</th>
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Recebido</th>
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Consumido</th>
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {(c.itens ?? []).map((item: ContratoItem) => {
                          const balance = (item.quantidade ?? 0) - (item.consumido ?? 0);
                          const isLow = (item.quantidade ?? 0) > 0 && balance / (item.quantidade || 1) < 0.15;
                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3 font-medium text-slate-900">{item.descricao}</td>
                              <td className="px-4 py-3 text-slate-500">{item.unidade}</td>
                              <td className="px-4 py-3 text-right text-slate-900">{fmt.format(item.valorUnitario ?? 0)}</td>
                              <td className="px-4 py-3 text-right text-slate-900">{item.quantidade}</td>
                              <td className="px-4 py-3 text-right text-slate-500">{item.recebido}</td>
                              <td className="px-4 py-3 text-right text-slate-900">{item.consumido}</td>
                              <td className={`px-4 py-3 text-right font-bold ${isLow ? "text-rose-600" : "text-emerald-600"}`}>{balance}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500">Nenhum contrato encontrado.</div>
          )}
        </div>
      </div>

      {contratoEmRevisao && (
        <ContratoReviewDrawer
          key={contratoEmRevisao.id}
          contrato={contratoEmRevisao}
          podeConfirmar={podeCriar}
          onClose={() => setContratoEmRevisao(null)}
          onSaved={() => {
            setContratoEmRevisao(null);
            setUltimoImport(null);
            void reload();
          }}
        />
      )}

      <ConfirmDialog
        aberto={contratoParaExcluir !== null}
        titulo="Excluir contrato"
        descricao={
          contratoParaExcluir ? (
            <>
              Excluir o contrato <strong className="text-slate-900">{contratoParaExcluir.numero}</strong>?
              Esta ação não pode ser desfeita.
            </>
          ) : null
        }
        rotuloConfirmar="Excluir contrato"
        processando={excluindo}
        onConfirmar={() => void confirmarExclusao()}
        onCancelar={() => setContratoParaExcluir(null)}
      />
    </div>
  );
}
