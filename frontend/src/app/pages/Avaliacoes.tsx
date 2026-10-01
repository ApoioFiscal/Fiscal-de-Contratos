import { useState, useEffect, useCallback } from "react";
import { listarLicitacoes } from "@/services/licitacoes";
import {
  listarAvaliacoes,
  criarAvaliacao,
  resumoFornecedor,
  type CriarAvaliacaoPayload,
} from "@/services/avaliacoes";
import { listarFilaPedidos } from "@/services/pedidos";
import { obterSessao } from "@/services/auth";
import { format, parseISO } from "date-fns";
import { Star, X, AlertCircle, Loader2, ClipboardCheck, ThumbsUp, Clock, AlertTriangle } from "lucide-react";
import type { Avaliacao, Pedido, ResumoAvaliacao, Licitacao } from "@/types/domain";
import { STATUS_PEDIDO_LABEL } from "@/types/domain";

export function Avaliacoes() {
  const sessao = obterSessao();
  const podeAvaliar = sessao?.perfil === "contratos" || sessao?.perfil === "fiscal" || sessao?.perfil === "gabinete";

  const [contratos, setContratos] = useState<Licitacao[]>([]);
  const [idContrato, setIdContrato] = useState<number | "">("");
  const [resumo, setResumo] = useState<ResumoAvaliacao | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    listarLicitacoes()
      .then(setContratos)
      .catch((err) => setError(err.message));
  }, []);

const reload = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const pe = podeAvaliar ? await listarFilaPedidos() : [];
      const [rs, av] = await Promise.all([
        resumoFornecedor(id),
        listarAvaliacoes(id),
      ]);
      setResumo(rs);
      setAvaliacoes(av);
      setPedidos(pe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar avaliações.");
    } finally {
      setLoading(false);
    }
  }, [podeAvaliar]);

  const selecionarContrato = (id: number) => {
    setIdContrato(id);
    reload(id);
  };

  const avaliados = new Set(avaliacoes.map((a) => a.pedido?.numeroPedido));
  const pendentes = pedidos.filter(
    (p) =>
      p.idContrato === Number(idContrato) &&
      ["ENTREGUE", "CONCLUIDO"].includes(p.status) &&
      !avaliados.has(p.numeroPedido)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Avaliações de Fornecedores</h1>
          <p className="text-sm text-slate-500 mt-1">Qualidade de entrega e cumprimento de prazos por contrato.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600 mb-1">Contrato</label>
<select
              value={idContrato}
              onChange={(e) => selecionarContrato(Number(e.target.value))}
              aria-label="Contrato da avaliacao"
              className="w-72 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Selecione um contrato...</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>{c.numero} — {c.fornecedor}</option>
              ))}
            </select>
          </div>
          {podeAvaliar && idContrato !== "" && (
            <button
              onClick={() => setIsOpen(true)}
              disabled={pendentes.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              <ClipboardCheck className="w-4 h-4" />
              Avaliar Pedido
            </button>
          )}
        </div>
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

      {idContrato === "" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          Selecione um contrato para ver as avaliações.
        </div>
      ) : loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-emerald-600" />
              Resumo do Fornecedor
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                  <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {resumo?.mediaNotaEntrega != null ? resumo.mediaNotaEntrega.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs font-medium text-slate-500">Média de Entrega</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {resumo?.mediaNotaPrazo != null ? resumo.mediaNotaPrazo.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs font-medium text-slate-500">Média de Prazo</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                <div className="p-3 rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{resumo?.entregasComProblema ?? 0}</p>
                  <p className="text-xs font-medium text-slate-500">Entregas com Problema</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                {resumo?.totalAvaliacoes ?? 0} avaliações registradas neste contrato.
              </p>
            </div>

            {resumo && resumo.problemas.length > 0 && (
              <div className="border border-rose-200 bg-rose-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-rose-800 mb-3">Problemas Reportados</h4>
                <ul className="space-y-3">
                  {resumo.problemas.map((p) => (
                    <li key={p.idAvaliacao} className="text-xs text-rose-700">
                      <strong>{p.numeroPedido}:</strong> {p.descricao}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Histórico de Avaliações</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {avaliacoes.map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">{a.pedido?.numeroPedido}</span>
                    <span className="text-xs text-slate-400">
                      {format(parseISO(a.dataAvaliacao), "dd/MM/yyyy")} · {a.usuarioFiscal?.nome}
                    </span>
                    {a.possuiProblema && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                        <AlertTriangle className="w-3 h-3" /> Com problema
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-slate-700">Entrega {a.notaEntrega}/5</span>
                    </span>
                    <span className="flex items-center gap-1 text-blue-500">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium text-slate-700">Prazo {a.notaPrazo}/5</span>
                    </span>
                  </div>
                  {a.descricaoProblema && <p className="mt-2 text-sm text-slate-600">{a.descricaoProblema}</p>}
                  {a.observacao && <p className="mt-1 text-sm text-slate-500 italic">{a.observacao}</p>}
                </div>
              ))}
              {avaliacoes.length === 0 && (
                <div className="p-8 text-center text-slate-500">Nenhuma avaliação registrada.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isOpen && idContrato !== "" && (
        <AvaliarModal
          pedidos={pendentes}
          onCancel={() => setIsOpen(false)}
          onSalvar={async (payload: CriarAvaliacaoPayload) => {
            try {
              await criarAvaliacao(payload);
              setIsOpen(false);
              reload(Number(idContrato));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro ao registrar avaliação.");
            }
          }}
        />
      )}
    </div>
  );
}

function Notas({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`p-1 rounded-lg transition-colors ${n <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-200"}`}
        >
          <Star className={`w-6 h-6 ${n <= value ? "fill-amber-400" : ""}`} />
        </button>
      ))}
    </div>
  );
}

function AvaliarModal({
  pedidos,
  onCancel,
  onSalvar,
}: {
  pedidos: Pedido[];
  onCancel: () => void;
  onSalvar: (payload: CriarAvaliacaoPayload) => Promise<void>;
}) {
  const [idPedido, setIdPedido] = useState<number | "">("");
  const [notaEntrega, setNotaEntrega] = useState(5);
  const [notaPrazo, setNotaPrazo] = useState(5);
  const [temProblema, setTemProblema] = useState(false);
  const [descricaoProblema, setDescricaoProblema] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valido = idPedido !== "" && (notaEntrega > 0) && (notaPrazo > 0) && (!temProblema || descricaoProblema.trim().length > 0);

  const salvar = async () => {
    if (idPedido === "") return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        idPedido: Number(idPedido),
        notaEntrega,
        notaPrazo,
        possuiProblema: temProblema,
        descricaoProblema: temProblema ? descricaoProblema.trim() : undefined,
        observacao: observacao.trim() || undefined,
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
            <h3 className="text-lg font-bold text-slate-900">Avaliar Entrega</h3>
            <p className="text-xs text-slate-500 mt-1">Avalie a última entrega do fornecedor.</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {erro && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />{erro}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pedido <span className="text-red-500">*</span></label>
<select
              value={idPedido}
              onChange={(e) => setIdPedido(Number(e.target.value))}
              aria-label="Pedido a avaliar"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Selecione o pedido...</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.numeroPedido} — {STATUS_PEDIDO_LABEL[p.status]}
                </option>
              ))}
            </select>
            {pedidos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Não há pedidos entregues/concluídos sem avaliação.</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Qualidade da Entrega <span className="text-red-500">*</span></p>
            <Notas value={notaEntrega} onChange={setNotaEntrega} />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">Cumprimento de Prazo <span className="text-red-500">*</span></p>
            <Notas value={notaPrazo} onChange={setNotaPrazo} />
          </div>

          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={temProblema}
              onChange={(e) => setTemProblema(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Houve problema na entrega (atraso, avaria, divergência)?
          </label>

          {temProblema && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descreva o problema <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={descricaoProblema}
                onChange={(e) => setDescricaoProblema(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
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
            Salvar Avaliação
          </button>
        </div>
      </div>
    </div>
  );
}
