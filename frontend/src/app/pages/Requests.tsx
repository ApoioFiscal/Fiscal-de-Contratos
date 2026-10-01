import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/services/api";
import {
  listarFilaPedidos,
  listarMeusPedidos,
  criarPedido,
  atualizarStatusPedido,
  type CriarPedidoPayload,
} from "@/services/pedidos";
import { listarLicitacoes } from "@/services/licitacoes";
import { obterSessao } from "@/services/auth";
import { format, parseISO } from "date-fns";
import {
  Plus, Search, FileText, CheckCircle, Clock, AlertCircle, X, Loader2,
  ChevronDown, ChevronUp, ShoppingCart, Truck, PackageCheck, Ban, RotateCcw
} from "lucide-react";
import type { Licitacao, Pedido, StatusPedido } from "@/types/domain";
import { STATUS_PEDIDO_LABEL } from "@/types/domain";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusChip: Record<StatusPedido, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  EM_COMPRA: "bg-blue-100 text-blue-800",
  ENTREGUE: "bg-cyan-100 text-cyan-800",
  CONCLUIDO: "bg-emerald-100 text-emerald-800",
  RECUSADO: "bg-rose-100 text-rose-800",
  DEVOLVIDO: "bg-orange-100 text-orange-800",
  CANCELADO: "bg-slate-200 text-slate-600",
};

const statusIcon: Record<StatusPedido, typeof Clock> = {
  PENDENTE: Clock,
  EM_COMPRA: ShoppingCart,
  ENTREGUE: Truck,
  CONCLUIDO: CheckCircle,
  RECUSADO: Ban,
  DEVOLVIDO: RotateCcw,
  CANCELADO: Ban,
};

export function Requests() {
  const sessao = obterSessao();
  const perfil = sessao?.perfil || "secretaria";
  const podeOperar = perfil === "contratos" || perfil === "fiscal";
  const podeCriar = perfil === "secretaria" || perfil === "gabinete" || perfil === "licitacoes";

  const [searchTerm, setSearchTerm] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [contratos, setContratos] = useState<Licitacao[]>([]);
  const [criando, setCriando] = useState(false);

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusPedido, setStatusPedido] = useState<Pedido | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusPedido>("EM_COMPRA");
  const [numeroOrdem, setNumeroOrdem] = useState("");
  const [dataPrevisao, setDataPrevisao] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    const fetcher = podeOperar ? listarFilaPedidos : listarMeusPedidos;
    fetcher()
      .then(setPedidos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [podeOperar, perfil]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!isCreateOpen) return;
    listarLicitacoes()
      .then((lics) => {
        if (podeCriar && perfil === "secretaria") {
          const mine = lics.filter((l) => l.setores.some((s) => s.idSetor === sessao?.idSetor));
          setContratos(mine);
        } else {
          setContratos(lics);
        }
      })
      .catch((err) => setError(err.message));
  }, [isCreateOpen, perfil, podeCriar, sessao]);

  const filtered = pedidos.filter(
    (p) =>
      p.numeroPedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.setor?.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.contrato?.numero || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const abrirCriacao = () => {
    setIsCreateOpen(true);
  };

  const handleCriar = async (payload: CriarPedidoPayload) => {
    setCriando(true);
    setError(null);
    try {
      await criarPedido(payload);
      setIsCreateOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar pedido.");
    } finally {
      setCriando(false);
    }
  };

  const abrirStatus = (pedido: Pedido, status: StatusPedido) => {
    setStatusPedido(pedido);
    setNovoStatus(status);
    setNumeroOrdem("");
    setDataPrevisao(pedido.dataPrevistaEntrega ? pedido.dataPrevistaEntrega.slice(0, 10) : "");
    setIsStatusOpen(true);
  };

  const confirmarStatus = async () => {
    if (!statusPedido) return;
    setCriando(true);
    setError(null);
    try {
      await atualizarStatusPedido(statusPedido.id, {
        status: novoStatus,
        numeroOrdem: novoStatus === "EM_COMPRA" ? numeroOrdem : undefined,
        dataPrevistaEntrega: novoStatus === "EM_COMPRA" ? dataPrevisao || undefined : undefined,
      });
      setIsStatusOpen(false);
      setStatusPedido(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar pedido.");
    } finally {
      setCriando(false);
    }
  };

  const acoesPorStatus = (pedido: Pedido): { status: StatusPedido; label: string; icon: typeof Clock; cor: string }[] => {
    if (!podeOperar) return [];
    switch (pedido.status) {
      case "PENDENTE":
        return [
          { status: "EM_COMPRA", label: "Registrar Compra", icon: ShoppingCart, cor: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
          { status: "CANCELADO", label: "Cancelar", icon: Ban, cor: "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200" },
        ];
      case "EM_COMPRA":
        return [
          { status: "ENTREGUE", label: "Confirmar Entrega", icon: Truck, cor: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-200" },
          { status: "DEVOLVIDO", label: "Devolver", icon: RotateCcw, cor: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200" },
        ];
      case "ENTREGUE":
        return [
          { status: "CONCLUIDO", label: "Concluir", icon: CheckCircle, cor: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos e Ordens de Compra</h1>
          <p className="text-sm text-slate-500 mt-1">
            {podeOperar
              ? "Fila de solicitações atendidas pela Fiscalização de Contratos."
              : "Solicitações do seu setor e saldos disponíveis."}
          </p>
        </div>
        {podeCriar && (
          <button
            onClick={abrirCriacao}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Pedido
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
        <div className="p-4 border-b border-slate-200 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, secretaria ou contrato..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading && <div className="p-8 text-center text-slate-500">Carregando pedidos...</div>}

        <div className="divide-y divide-slate-200">
          {filtered.map((pedido) => {
            const Icon = statusIcon[pedido.status];
            const total = pedido.itens.reduce((s, i) => s + i.valorTotal, 0);
            const expandido = expandedId === pedido.id;
            return (
              <div key={pedido.id} className="hover:bg-slate-50 transition-colors">
                <div className="p-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setExpandedId(expandido ? null : pedido.id)}
                      className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
                    >
                      <FileText className="w-4 h-4" />
                      {pedido.numeroPedido}
                    </button>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusChip[pedido.status]}`}>
                      <Icon className="w-3.5 h-3.5" /> {STATUS_PEDIDO_LABEL[pedido.status]}
                    </span>
                    <span className="text-sm text-slate-600">{pedido.setor?.nome}</span>
                    <span className="text-sm text-slate-400">· {pedido.contrato?.numero}</span>
                    <span className="text-sm text-slate-400">· {format(parseISO(pedido.dataPedido), "dd/MM/yyyy")}</span>
                    <span className="ml-auto text-sm font-semibold text-slate-900">{fmt.format(total)}</span>
                    <button onClick={() => setExpandedId(expandido ? null : pedido.id)} className="text-slate-400">
                      {expandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {podeOperar && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {acoesPorStatus(pedido).map((acao) => (
                        <button
                          key={acao.status}
                          onClick={() => abrirStatus(pedido, acao.status)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${acao.cor}`}
                        >
                          <acao.icon className="w-3.5 h-3.5" />
                          {acao.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {expandido && (
                    <div className="mt-4 bg-slate-50 border border-slate-100 rounded-lg p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Solicitante</span>
                          <span className="font-medium text-slate-900">{pedido.usuario?.nome}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Ordem de Compra</span>
                          <span className="font-medium text-slate-900">{pedido.numeroOrdem || "—"}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Previsão de Entrega</span>
                          <span className="font-medium text-slate-900">
                            {pedido.dataPrevistaEntrega ? format(parseISO(pedido.dataPrevistaEntrega), "dd/MM/yyyy") : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Observação</span>
                          <span className="font-medium text-slate-900 line-clamp-1">{pedido.observacao || "—"}</span>
                        </div>
                      </div>

                      <table className="min-w-full text-sm bg-white border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-500">Item</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-500">Qtd.</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-500">Valor Unit.</th>
                            <th className="px-3 py-2 text-right font-medium text-slate-500">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pedido.itens.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 text-slate-900">
                                {item.itemLicitado?.descricao || `Item ${item.idItemLicitado}`}
                                {item.itemLicitado?.marca ? ` (${item.itemLicitado.marca})` : ""}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-700">
                                {item.quantidade} {item.itemLicitado?.unidade}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-700">{fmt.format(item.valorUnitario)}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900">{fmt.format(item.valorTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {pedido.notasFiscais && pedido.notasFiscais.length > 0 && (
                        <p className="mt-3 text-xs text-slate-500">
                          Notas fiscais: {pedido.notasFiscais.map((n) => `${n.numeroNota} (${format(parseISO(n.dataEntrada), "dd/MM/yyyy")})`).join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && filtered.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum pedido encontrado.</div>}
        </div>
      </div>

      {isCreateOpen && <NovoPedidoModal
        contratos={contratos}
        carregando={criando}
        onCancel={() => setIsCreateOpen(false)}
        onSalvar={handleCriar}
      />}

      {isStatusOpen && statusPedido && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {novoStatus === "EM_COMPRA"
                  ? "Registrar Compra"
                  : `Alterar para ${STATUS_PEDIDO_LABEL[novoStatus]}`} — {statusPedido.numeroPedido}
              </h3>
              <button onClick={() => setIsStatusOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {novoStatus === "EM_COMPRA" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Número da Ordem de Compra <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={numeroOrdem}
                      onChange={(e) => setNumeroOrdem(e.target.value)}
                      placeholder="Ex.: OC-2026-0001"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Previsão de Entrega <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={dataPrevisao}
                      onChange={(e) => setDataPrevisao(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              {(novoStatus === "DEVOLVIDO" || novoStatus === "RECUSADO" || novoStatus === "CANCELADO") && (
                <p className="text-sm text-slate-600">
                  O pedido <strong>{statusPedido.numeroPedido}</strong> será marcado como{" "}
                  <strong>{STATUS_PEDIDO_LABEL[novoStatus]}</strong>. Confirma a alteração?
                </p>
              )}
              {novoStatus !== "EM_COMPRA" && !["DEVOLVIDO", "RECUSADO", "CANCELADO", "CONCLUIDO"].includes(novoStatus) && (
                <p className="text-sm text-slate-600">
                  O pedido passará para <strong>{STATUS_PEDIDO_LABEL[novoStatus]}</strong>.
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setIsStatusOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarStatus}
                disabled={novoStatus === "EM_COMPRA" && (!numeroOrdem.trim() || !dataPrevisao)}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl"
              >
                {criando && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NovoPedidoModal({
  contratos,
  carregando,
  onCancel,
  onSalvar,
}: {
  contratos: Licitacao[];
  carregando: boolean;
  onCancel: () => void;
  onSalvar: (payload: CriarPedidoPayload) => void;
}) {
  const [idContrato, setIdContrato] = useState<number | "">("");
  const [itens, setItens] = useState<{ idItemLicitado: number; quantidade: string }[]>([]);
  const [observacao, setObservacao] = useState("");

  const contrato = contratos.find((c) => c.id === idContrato);

  const selecionarContrato = (id: number) => {
    setIdContrato(id);
    const lic = contratos.find((c) => c.id === id);
    setItens(lic ? lic.itens.map((i) => ({ idItemLicitado: i.id, quantidade: "" })) : []);
  };

  const atualizarQtd = (idx: number, qtd: string) =>
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, quantidade: qtd } : it)));

  const selecionados = itens
    .map((it, idx) => ({ item: contrato?.itens[idx], quantidade: Number(it.quantidade) || 0 }))
    .filter((s) => s.item && s.quantidade > 0);

  const valido = Boolean(contrato) && selecionados.length > 0;

  const salvar = () => {
    if (!idContrato) return;
    onSalvar({
      idContrato: Number(idContrato),
      observacao: observacao.trim() || undefined,
      itens: selecionados.map((s) => ({ idItemLicitado: s.item!.id, quantidade: s.quantidade })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end" role="dialog" aria-label="Novo Pedido">
      <div className="w-full max-w-2xl bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Novo Pedido</h2>
            <p className="text-xs text-slate-500 mt-1">Solicite itens de um contrato vigente.</p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contrato <span className="text-red-500">*</span></label>
            <select
              value={idContrato}
              onChange={(e) => selecionarContrato(Number(e.target.value))}
              aria-label="Contrato do pedido"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um contrato...</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {c.fornecedor}
                </option>
              ))}
            </select>
            {idContrato !== "" && !contrato && (
              <p className="text-xs text-amber-600 mt-1">Seu setor não é beneficiário deste contrato.</p>
            )}
          </div>

          {contrato && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Itens Disponíveis</p>
                <PackageCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="divide-y divide-slate-100">
                {itens.map((linha, idx) => {
                  const item = contrato.itens[idx];
                  const saldo = item.quantidade - item.consumido;
                  return (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{item.descricao}</p>
                        <p className="text-xs text-slate-500">Saldo disponível: {saldo} {item.unidade}</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={saldo}
                        placeholder="0"
                        value={linha.quantidade}
                        onChange={(e) => atualizarQtd(idx, e.target.value)}
                        className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="px-8 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!valido || carregando}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Pedido
          </button>
        </div>
      </div>
    </div>
  );
}