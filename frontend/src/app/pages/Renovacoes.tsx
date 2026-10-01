import { useState, useEffect, useCallback } from "react";
import { listarLicitacoes } from "@/services/licitacoes";
import {
  listarTermos,
  emitirTermo,
  atualizarTermo,
  type CriarTermoPayload,
  type AtualizarTermoPayload,
} from "@/services/renovacoes";
import { obterSessao } from "@/services/auth";
import { format, parseISO } from "date-fns";
import { Plus, X, AlertCircle, Loader2, RefreshCcw, Scale, CalendarClock, FilePlus2, CheckCircle } from "lucide-react";
import type { AcaoTomada, Licitacao, StatusTermoRenovacao, TermoRenovacao, TipoRenovacao } from "@/types/domain";
import {
  TIPO_RENOVACAO_LABEL,
  STATUS_TERMO_LABEL,
  ACAO_TOMADA_LABEL,
} from "@/types/domain";

const statusChip: Record<StatusTermoRenovacao, string> = {
  EMITIDO: "bg-blue-100 text-blue-800",
  EM_ANALISE: "bg-amber-100 text-amber-800",
  RESOLVIDO: "bg-emerald-100 text-emerald-800",
  ARQUIVADO: "bg-slate-200 text-slate-600",
};

export function Renovacoes() {
  const sessao = obterSessao();
  const perfil = sessao?.perfil || "secretaria";
  const podeEmitir = perfil === "contratos" || perfil === "fiscal" || perfil === "gabinete";
  const podeResolver = perfil === "licitacoes" || perfil === "gabinete";

  const [termos, setTermos] = useState<TermoRenovacao[]>([]);
  const [contratos, setContratos] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEmitirOpen, setIsEmitirOpen] = useState(false);
  const [isResolverOpen, setIsResolverOpen] = useState(false);
  const [termoAtual, setTermoAtual] = useState<TermoRenovacao | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([listarTermos(), listarLicitacoes()])
      .then(([ts, cs]) => {
        setTermos(ts);
        setContratos(cs);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const abrirResolver = (termo: TermoRenovacao) => {
    setTermoAtual(termo);
    setIsResolverOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Termos de Renovação</h1>
          <p className="text-sm text-slate-500 mt-1">
            {podeEmitir
              ? "Emita termos de renovação de vigência, quantidade ou financeiros."
              : podeResolver
                ? "Analise e resolva os termos emitidos pela Fiscalização de Contratos."
                : "Acompanhamento de termos de renovação contratual."}
          </p>
        </div>
        {podeEmitir && (
          <button
            onClick={() => setIsEmitirOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Emitir Termo
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading && <div className="p-8 text-center text-slate-500">Carregando termos...</div>}
        <div className="divide-y divide-slate-200">
          {termos.map((t) => {
            const podeAtuar = t.status !== "RESOLVIDO" && t.status !== "ARQUIVADO";
            return (
              <div key={t.id} className="p-5 sm:px-6 hover:bg-slate-50 transition-colors">
                <div className="flex flex-wrap items-start gap-3">
                  <div className={`p-2.5 rounded-lg ${t.tipo === "VIGENCIA" ? "bg-blue-50 text-blue-600" : t.tipo === "QUANTITATIVO" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                    {t.tipo === "VIGENCIA" ? <CalendarClock className="w-5 h-5" /> : t.tipo === "QUANTITATIVO" ? <Scale className="w-5 h-5" /> : <RefreshCcw className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">Termo #{t.id}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusChip[t.status]}`}>
                        {STATUS_TERMO_LABEL[t.status]}
                      </span>
                      <span className="text-sm text-slate-500">{t.contrato?.numero} — {t.contrato?.fornecedor}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{t.justificativa}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Tipo: {TIPO_RENOVACAO_LABEL[t.tipo]}</span>
                      <span>Emitido: {format(parseISO(t.dataEmissao), "dd/MM/yyyy")} por {t.usuarioEmissor?.nome}</span>
                      {t.novaVigenciaFim && <span>Nova vigência: {format(parseISO(t.novaVigenciaFim), "dd/MM/yyyy")}</span>}
                      {t.percentualAcrescimo != null && <span>Acréscimo: {t.percentualAcrescimo}%</span>}
                    </div>
                    {t.status === "RESOLVIDO" && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>
                          {t.acaoTomada ? ACAO_TOMADA_LABEL[t.acaoTomada] : ""} — {t.parecerLicitacao}
                          {t.usuarioLicitacao ? ` · ${t.usuarioLicitacao.nome}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  {podeResolver && podeAtuar && (
                    <button
                      onClick={() => abrirResolver(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" />
                      Analisar e Resolver
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && termos.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum termo de renovação.</div>}
        </div>
      </div>

      {isEmitirOpen && (
        <EmitirTermoModal
          contratos={contratos}
          onCancel={() => setIsEmitirOpen(false)}
          onSalvar={async (payload: CriarTermoPayload) => {
            try {
              await emitirTermo(payload);
              setIsEmitirOpen(false);
              reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro ao emitir termo.");
            }
          }}
        />
      )}

      {isResolverOpen && termoAtual && (
        <ResolverTermoModal
          termo={termoAtual}
          onCancel={() => setIsResolverOpen(false)}
          onSalvar={async (payload: AtualizarTermoPayload) => {
            try {
              await atualizarTermo(termoAtual.id, payload);
              setIsResolverOpen(false);
              setTermoAtual(null);
              reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro ao resolver termo.");
            }
          }}
        />
      )}
    </div>
  );
}

function EmitirTermoModal({
  contratos,
  onCancel,
  onSalvar,
}: {
  contratos: Licitacao[];
  onCancel: () => void;
  onSalvar: (payload: CriarTermoPayload) => Promise<void>;
}) {
  const [idContrato, setIdContrato] = useState<number | "">("");
  const [tipo, setTipo] = useState<TipoRenovacao>("VIGENCIA");
  const [justificativa, setJustificativa] = useState("");
  const [novaVigenciaFim, setNovaVigenciaFim] = useState("");
  const [percentual, setPercentual] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valido =
    idContrato !== "" &&
    justificativa.trim().length >= 5 &&
    (tipo !== "VIGENCIA" || novaVigenciaFim !== "") &&
    (tipo !== "FINANCEIRO" || percentual !== "");

  const salvar = async () => {
    if (idContrato === "") return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        idContrato: Number(idContrato),
        tipo,
        justificativa: justificativa.trim(),
        novaVigenciaFim: tipo === "VIGENCIA" ? novaVigenciaFim : undefined,
        percentualAcrescimo: tipo === "FINANCEIRO" ? Number(percentual) : undefined,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
      <div className="w-full max-w-lg bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Emitir Termo de Renovação</h3>
            <p className="text-xs text-slate-500 mt-1">O termo será encaminhado à Secretaria de Licitações.</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {erro && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />{erro}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contrato <span className="text-red-500">*</span></label>
            <select
              value={idContrato}
              onChange={(e) => setIdContrato(Number(e.target.value))}
              aria-label="Contrato do termo"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Selecione o contrato...</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.fornecedor} (vigência até {format(parseISO(c.dataVigenciaFim), "dd/MM/yyyy")})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Renovação <span className="text-red-500">*</span></label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoRenovacao)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="VIGENCIA">Vigência</option>
              <option value="QUANTITATIVO">Quantitativo</option>
              <option value="FINANCEIRO">Financeiro</option>
            </select>
          </div>
          {tipo === "VIGENCIA" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nova Vigência <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={novaVigenciaFim}
                onChange={(e) => setNovaVigenciaFim(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {tipo === "FINANCEIRO" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Percentual de Acréscimo (%) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                max="25"
                step="0.1"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">Limite legal de 25%.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Justificativa <span className="text-red-500">*</span></label>
            <textarea
              rows={4}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!valido || salvando}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Emitir Termo
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolverTermoModal({
  termo,
  onCancel,
  onSalvar,
}: {
  termo: TermoRenovacao;
  onCancel: () => void;
  onSalvar: (payload: AtualizarTermoPayload) => Promise<void>;
}) {
  const [status, setStatus] = useState<StatusTermoRenovacao>(termo.status === "EMITIDO" ? "EM_ANALISE" : "RESOLVIDO");
  const [parecer, setParecer] = useState("");
  const [acaoTomada, setAcaoTomada] = useState<AcaoTomada | "">("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const sendoResolvido = status === "RESOLVIDO";
  const valido =
    (status === "ARQUIVADO" && parecer.trim().length > 0) ||
    (status === "EM_ANALISE") ||
    (sendoResolvido && acaoTomada !== "" && parecer.trim().length >= 5);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        status,
        parecerLicitacao: parecer.trim() || undefined,
        acaoTomada: sendoResolvido ? (acaoTomada as AcaoTomada) : undefined,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
      <div className="w-full max-w-lg bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Analisar Termo #{termo.id}</h3>
            <p className="text-xs text-slate-500 mt-1">{termo.contrato?.numero} — {termo.contrato?.fornecedor} · {TIPO_RENOVACAO_LABEL[termo.tipo]}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {erro && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />{erro}
            </div>
          )}
          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
            {termo.justificativa}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ação</label>
            <div className="flex gap-2">
              {termo.status === "EMITIDO" && (
                <button
                  onClick={() => setStatus("EM_ANALISE")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${status === "EM_ANALISE" ? "bg-amber-100 border-amber-300 text-amber-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  Em Análise
                </button>
              )}
              {(termo.status === "EMITIDO" || termo.status === "EM_ANALISE") && (
                <button
                  onClick={() => setStatus("RESOLVIDO")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${sendoResolvido ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                >
                  Resolver
                </button>
              )}
              <button
                onClick={() => setStatus("ARQUIVADO")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${status === "ARQUIVADO" ? "bg-slate-200 border-slate-400 text-slate-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
              >
                Arquivar
              </button>
            </div>
          </div>
          {sendoResolvido && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ação Tomada <span className="text-red-500">*</span></label>
              <select
                value={acaoTomada}
                onChange={(e) => setAcaoTomada(e.target.value as AcaoTomada)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Selecione a ação...</option>
                {(Object.keys(ACAO_TOMADA_LABEL) as AcaoTomada[]).map((a) => (
                  <option key={a} value={a}>{ACAO_TOMADA_LABEL[a]}</option>
                ))}
              </select>
              {acaoTomada === "DENEGADO" && (
                <p className="text-xs text-amber-600 mt-1">Ao negar, o contrato segue sem alteração.</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Parecer da Licitações {sendoResolvido && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!valido || salvando}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}