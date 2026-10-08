import { useState, useEffect, useCallback } from "react";
import {
  listarFilaPedidos,
  listarMeusPedidos,
  criarPedido,
  atualizarStatusPedido,
  registrarAvisoPedido,
  baixarTermoRecebimento,
  type CriarPedidoPayload,
} from "@/services/pedidos";
import { registrarEntradaNota, resumoContrato, listarMovimentacoes } from "@/services/estoque";
import { listarLicitacoes } from "@/services/licitacoes";
import { obterSessao } from "@/services/auth";
import { format, parseISO, isAfter, startOfToday } from "date-fns";
import {
  Plus, Search, FileText, CheckCircle, Clock, AlertCircle, X, Loader2,
  ChevronDown, ChevronUp, ShoppingCart, Truck, Ban, RotateCcw, ClipboardCheck,
  MessageSquareWarning, ReceiptText, Upload, FileDown, Filter
} from "lucide-react";
import type { ItemSaldo, Licitacao, Movimentacao, Pedido, StatusPedido } from "@/types/domain";
import { STATUS_PEDIDO_LABEL } from "@/types/domain";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PARSING_BASE_URL = import.meta.env.VITE_PARSING_URL ?? "http://localhost:3000";

type FiltroStatus = "TODOS" | StatusPedido;

const ORDEM_STATUS: StatusPedido[] = [
  "PENDENTE",
  "CONFIRMADO",
  "EFETUADO",
  "ENTREGUE",
  "CONFERENCIA",
  "CONCLUIDO",
  "DEVOLVIDO",
  "CANCELADO",
];

const statusChip: Record<StatusPedido, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  CONFIRMADO: "bg-blue-100 text-blue-800",
  EFETUADO: "bg-violet-100 text-violet-800",
  ENTREGUE: "bg-cyan-100 text-cyan-800",
  CONFERENCIA: "bg-yellow-100 text-yellow-800",
  CONCLUIDO: "bg-emerald-100 text-emerald-800",
  DEVOLVIDO: "bg-orange-100 text-orange-800",
  CANCELADO: "bg-slate-200 text-slate-600",
};

const statusIcon: Record<StatusPedido, typeof Clock> = {
  PENDENTE: Clock,
  CONFIRMADO: ShoppingCart,
  EFETUADO: ReceiptText,
  ENTREGUE: Truck,
  CONFERENCIA: ClipboardCheck,
  CONCLUIDO: CheckCircle,
  DEVOLVIDO: RotateCcw,
  CANCELADO: Ban,
};

const STATUS_TERMINAL: StatusPedido[] = ["CONCLUIDO", "DEVOLVIDO", "CANCELADO"];

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

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [filtroSetor, setFiltroSetor] = useState<string>("TODOS");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [contratos, setContratos] = useState<Licitacao[]>([]);
  const [criando, setCriando] = useState(false);

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusPedido, setStatusPedido] = useState<Pedido | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusPedido>("CONFIRMADO");
  const [numeroOrdem, setNumeroOrdem] = useState("");
  const [avisoStatus, setAvisoStatus] = useState("");

  const [isNotaOpen, setIsNotaOpen] = useState(false);
  const [notaPedido, setNotaPedido] = useState<Pedido | null>(null);

  const [isAvisoOpen, setIsAvisoOpen] = useState(false);
  const [avisoPedido, setAvisoPedido] = useState<Pedido | null>(null);
  const [avisoTexto, setAvisoTexto] = useState("");

  const [isTermoOpen, setIsTermoOpen] = useState(false);
  const [termoPedido, setTermoPedido] = useState<Pedido | null>(null);
  const [termoCpf, setTermoCpf] = useState("");
  const [gerandoTermo, setGerandoTermo] = useState(false);

  const [saldos, setSaldos] = useState<ItemSaldo[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);

  const reload = useCallback(() => {
    setLoading(true);
    const fetcher = podeOperar ? listarFilaPedidos : listarMeusPedidos;
    fetcher()
      .then(setPedidos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [podeOperar]);

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

  useEffect(() => {
    if (expandedId === null) return;
    const pedido = pedidos.find((p) => p.id === expandedId);
    if (!pedido) return;
    resumoContrato(pedido.idContrato)
      .then(setSaldos)
      .catch(() => setSaldos([]));
    listarMovimentacoes({ contratoId: pedido.idContrato })
      .then(setMovs)
      .catch(() => setMovs([]));
  }, [expandedId, pedidos]);

  const setoresLista = Array.from(new Map(pedidos.map((p) => [p.setor?.id, p.setor])).values())
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const atrasado = (p: Pedido) =>
    Boolean(p.dataPrevistaEntrega) &&
    !STATUS_TERMINAL.includes(p.status) &&
    isAfter(startOfToday(), parseISO(p.dataPrevistaEntrega!));

  const filtered = pedidos
    .filter((p) => {
      if (filtroStatus !== "TODOS" && p.status !== filtroStatus) return false;
      if (filtroSetor !== "TODOS" && p.setor?.id !== Number(filtroSetor)) return false;
      if (dataDe && isAfter(parseISO(dataDe).setHours(0, 0, 0, 0), parseISO(p.dataPedido).getTime())) return false;
      if (dataAte) {
        const fim = parseISO(dataAte).setHours(23, 59, 59, 999);
        if (isAfter(parseISO(p.dataPedido).getTime(), fim)) return false;
      }
      const termo = searchTerm.toLowerCase();
      if (!termo) return true;
      return (
        p.numeroPedido.toLowerCase().includes(termo) ||
        (p.setor?.nome || "").toLowerCase().includes(termo) ||
        (p.contrato?.numero || "").toLowerCase().includes(termo) ||
        (p.contrato?.fornecedor || "").toLowerCase().includes(termo)
      );
    })
    .sort((a, b) =>
      ordem === "recentes"
        ? parseISO(b.dataPedido).getTime() - parseISO(a.dataPedido).getTime()
        : parseISO(a.dataPedido).getTime() - parseISO(b.dataPedido).getTime()
    );

  const contagemPorStatus = (status: FiltroStatus) =>
    status === "TODOS" ? pedidos.length : pedidos.filter((p) => p.status === status).length;

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
    setAvisoStatus("");
    setIsStatusOpen(true);
  };

  const confirmarStatus = async () => {
    if (!statusPedido) return;
    setCriando(true);
    setError(null);
    try {
      await atualizarStatusPedido(statusPedido.id, {
        status: novoStatus,
        numeroOrdem: novoStatus === "CONFIRMADO" ? numeroOrdem.trim() || undefined : undefined,
        aviso: avisoStatus.trim() || undefined,
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

  const abrirNota = (pedido: Pedido) => {
    setNotaPedido(pedido);
    setIsNotaOpen(true);
  };

  const abrirAviso = (pedido: Pedido) => {
    setAvisoPedido(pedido);
    setAvisoTexto("");
    setIsAvisoOpen(true);
  };

  const confirmarAviso = async () => {
    if (!avisoPedido) return;
    setCriando(true);
    setError(null);
    try {
      await registrarAvisoPedido(avisoPedido.id, avisoTexto.trim());
      setIsAvisoOpen(false);
      setAvisoPedido(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar aviso.");
    } finally {
      setCriando(false);
    }
  };

  const gerarTermo = async () => {
    if (!termoPedido) return;
    setGerandoTermo(true);
    setError(null);
    try {
      await baixarTermoRecebimento(termoPedido.id, termoCpf);
      setIsTermoOpen(false);
      setTermoPedido(null);
      setTermoCpf("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar termo.");
    } finally {
      setGerandoTermo(false);
    }
  };

  const acoesPorStatus = (pedido: Pedido): { kind: "status" | "nota" | "aviso" | "termo"; status?: StatusPedido; label: string; icon: typeof Clock; cor: string }[] => {
    if (!podeOperar) return [];
    const btn = (label: string, icon: typeof Clock, cor: string, kind: "status" | "nota" | "aviso" | "termo", status?: StatusPedido) => ({ kind, status, label, icon, cor });
    switch (pedido.status) {
      case "PENDENTE":
        return [
          btn("Registrar Compra", ShoppingCart, "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200", "status", "CONFIRMADO"),
          btn("Cancelar", Ban, "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200", "status", "CANCELADO"),
        ];
      case "CONFIRMADO":
        return [
          btn("Registrar NF (Efetuar)", ReceiptText, "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200", "nota"),
        ];
      case "EFETUADO":
        return [
          btn("Confirmar Entrega", Truck, "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-200", "status", "ENTREGUE"),
          btn("Devolver", RotateCcw, "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200", "status", "DEVOLVIDO"),
        ];
      case "ENTREGUE":
        return [
          btn("Registrar Conferência", ClipboardCheck, "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200", "status", "CONFERENCIA"),
          btn("Informar Problema", MessageSquareWarning, "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200", "aviso"),
          btn("Devolver", RotateCcw, "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200", "status", "DEVOLVIDO"),
        ];
      case "CONFERENCIA":
        return [
          btn("Concluir", CheckCircle, "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200", "status", "CONCLUIDO"),
          btn("Informar Divergência", MessageSquareWarning, "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200", "aviso"),
          btn("Termo de Recebimento", FileDown, "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300", "termo"),
          btn("Devolver", RotateCcw, "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200", "status", "DEVOLVIDO"),
        ];
      case "CONCLUIDO":
        return [
          btn("Termo de Recebimento", FileDown, "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300", "termo"),
        ];
      default:
        return [];
    }
  };

  const handleAcao = (pedido: Pedido, acao: (typeof acoesPorStatus)[0]) => {
    if (acao.kind === "status" && acao.status) abrirStatus(pedido, acao.status);
    else if (acao.kind === "nota") abrirNota(pedido);
    else if (acao.kind === "aviso") abrirAviso(pedido);
    else if (acao.kind === "termo") {
      setTermoPedido(pedido);
      setTermoCpf("");
      setIsTermoOpen(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos e Ordens de Compra</h1>
          <p className="text-sm text-slate-500 mt-1">
            {podeOperar
              ? "Fila de solicitações: acompanhe compra, entrega, conferência e conclusão."
              : "Solicitações do seu setor, prazos e avisos da Fiscalização."}
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

      {podeOperar && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroStatus("TODOS")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtroStatus === "TODOS" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            Todos ({contagemPorStatus("TODOS")})
          </button>
          {ORDEM_STATUS.map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filtroStatus === s ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {STATUS_PEDIDO_LABEL[s]} ({contagemPorStatus(s)})
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, secretaria, contrato ou fornecedor..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {podeOperar && (
            <>
              <select
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
                aria-label="Filtrar por secretaria"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="TODOS">Secretaria: todas</option>
                {setoresLista.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
              <input
                type="date"
                value={dataDe}
                onChange={(e) => setDataDe(e.target.value)}
                aria-label="Data inicial"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">até</span>
              <input
                type="date"
                value={dataAte}
                onChange={(e) => setDataAte(e.target.value)}
                aria-label="Data final"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as "recentes" | "antigos")}
                aria-label="Ordenar pedidos"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
              </select>
              <Filter className="w-4 h-4 text-slate-400" />
            </>
          )}
        </div>

        {loading && <div className="p-8 text-center text-slate-500">Carregando pedidos...</div>}

        <div className="divide-y divide-slate-200">
          {filtered.map((pedido) => {
            const Icon = statusIcon[pedido.status];
            const total = pedido.itens.reduce((s, i) => s + i.valorTotal, 0);
            const expandido = expandedId === pedido.id;
            const prazoVencido = atrasado(pedido);
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
                    <div className="ml-auto flex items-center gap-3">
                      {pedido.dataPrevistaEntrega && (
                        <span className={`text-xs font-medium ${prazoVencido ? "text-rose-600" : "text-slate-500"}`}>
                          {prazoVencido ? "Prazo vencido · " : "Prazo · "}
                          {format(parseISO(pedido.dataPrevistaEntrega), "dd/MM/yyyy")}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-slate-900">{fmt.format(total)}</span>
                      <button onClick={() => setExpandedId(expandido ? null : pedido.id)} className="text-slate-400">
                        {expandido ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {pedido.historico?.some((h) => h.tipo === "AVISO") && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
                      <MessageSquareWarning className="w-4 h-4 shrink-0" />
                      Há avisos da Fiscalização neste pedido — confira a timeline.
                    </div>
                  )}

                  {podeOperar && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {acoesPorStatus(pedido).map((acao, i) => (
                        <button
                          key={i}
                          onClick={() => handleAcao(pedido, acao)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${acao.cor}`}
                        >
                          <acao.icon className="w-3.5 h-3.5" />
                          {acao.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {expandido && (
                    <div className="mt-4 bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Solicitante</span>
                          <span className="font-medium text-slate-900">{pedido.usuario?.nome}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Secretaria</span>
                          <span className="font-medium text-slate-900">{pedido.setor?.nome}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Fornecedor</span>
                          <span className="font-medium text-slate-900">{pedido.contrato?.fornecedor}</span>
                          <span className="block text-xs text-slate-400">{pedido.contrato?.cnpjFornecedor}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Processo / Contrato</span>
                          <span className="font-medium text-slate-900">{pedido.contrato?.numeroProcesso}</span>
                          <span className="block text-xs text-slate-400">{pedido.contrato?.numero}</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Prazo de Entrega</span>
                          <span className={`font-medium ${prazoVencido ? "text-rose-600" : "text-slate-900"}`}>
                            {pedido.dataPrevistaEntrega ? format(parseISO(pedido.dataPrevistaEntrega), "dd/MM/yyyy") : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-500 mb-1">Ordem de Compra</span>
                          <span className="font-medium text-slate-900">{pedido.numeroOrdem || "—"}</span>
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
                            <th className="px-3 py-2 text-right font-medium text-slate-500">Un.</th>
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
                              <td className="px-3 py-2 text-right text-slate-700">{item.itemLicitado?.unidade || "—"}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{item.quantidade}</td>
                              <td className="px-3 py-2 text-right text-slate-700">{fmt.format(item.valorUnitario)}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900">{fmt.format(item.valorTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {pedido.notasFiscais && pedido.notasFiscais.length > 0 && (
                        <p className="text-xs text-slate-500">
                          Notas fiscais: {pedido.notasFiscais.map((n) => `${n.numeroNota} (${format(parseISO(n.dataEntrada), "dd/MM/yyyy")})`).join(", ")}
                        </p>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                            Linha do tempo
                          </div>
                          <div className="divide-y divide-slate-100 max-h-64 overflow-auto">
                            {(pedido.historico?.length ? pedido.historico : []).map((h) => (
                              <div key={h.id} className="px-3 py-2 flex items-start gap-2 text-xs">
                                {h.tipo === "AVISO" ? (
                                  <MessageSquareWarning className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                                ) : h.tipo === "STATUS" ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-slate-800">
                                    <span className="font-medium">
                                      {h.tipo === "AVISO" ? "Aviso" : h.status ? STATUS_PEDIDO_LABEL[h.status] : "Criação"}
                                    </span>
                                    {h.mensagem ? ` — ${h.mensagem}` : ""}
                                  </p>
                                  <p className="text-slate-400">
                                    {format(parseISO(h.data), "dd/MM/yyyy HH:mm")} · {h.usuario?.nome}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {!pedido.historico?.length && (
                              <div className="px-3 py-4 text-center text-slate-400">Sem histórico.</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                            Saldos do contrato · {pedido.contrato?.numero}
                          </div>
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 text-left text-slate-500">
                              <tr>
                                <th className="px-3 py-1.5 font-medium">Item</th>
                                <th className="px-3 py-1.5 text-right font-medium">Contr.</th>
                                <th className="px-3 py-1.5 text-right font-medium">Rec.</th>
                                <th className="px-3 py-1.5 text-right font-medium">Cons.</th>
                                <th className="px-3 py-1.5 text-right font-medium">Disp.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {saldos.map((s) => (
                                <tr key={s.id}>
                                  <td className="px-3 py-1.5 text-slate-800 line-clamp-1">{s.descricao}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-600">{s.quantidade}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-600">{s.recebido}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-600">{s.consumido}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-900 font-medium">{s.recebido - s.consumido}</td>
                                </tr>
                              ))}
                              {saldos.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-3 text-center text-slate-400">Sem dados.</td></tr>
                              )}
                            </tbody>
                          </table>
                          <div className="px-3 py-2 border-t border-slate-100 max-h-40 overflow-auto">
                            {movs.map((m) => (
                              <p key={m.id} className="text-[11px] text-slate-500">
                                <span className={`font-medium ${m.tipo === "ENTRADA" ? "text-emerald-600" : "text-orange-600"}`}>
                                  {m.tipo === "ENTRADA" ? "Entrada" : "Baixa"}
                                </span>{" "}
                                · {m.itemLicitado?.descricao} · {m.quantidade} {m.itemLicitado?.unidade}
                                {m.notaFiscal ? ` · NF ${m.notaFiscal.numeroNota}` : ""} · {format(parseISO(m.data), "dd/MM/yyyy")}
                              </p>
                            ))}
                            {movs.length === 0 && <p className="text-[11px] text-slate-400 text-center py-1">Sem movimentações.</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && filtered.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum pedido encontrado.</div>}
        </div>
      </div>

      {isCreateOpen && (
        <NovoPedidoModal
          contratos={contratos}
          carregando={criando}
          onCancel={() => setIsCreateOpen(false)}
          onSalvar={handleCriar}
        />
      )}

      {isStatusOpen && statusPedido && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {novoStatus === "CONFIRMADO"
                  ? "Registrar Compra"
                  : `Alterar para ${STATUS_PEDIDO_LABEL[novoStatus]}`} — {statusPedido.numeroPedido}
              </h3>
              <button onClick={() => setIsStatusOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {novoStatus === "CONFIRMADO" && (
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
              )}
              {["ENTREGUE", "CONFERENCIA", "CONCLUIDO", "DEVOLVIDO"].includes(novoStatus) && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Aviso ao secretário {novoStatus === "CONCLUIDO" ? "(opcional)" : "(opcional)"}
                  </label>
                  <textarea
                    rows={3}
                    value={avisoStatus}
                    onChange={(e) => setAvisoStatus(e.target.value)}
                    placeholder={
                      novoStatus === "DEVOLVIDO"
                        ? "Motivo da devolução... (recomendado)"
                        : "Ex.: entrega parcial, atraso, divergência em item... (opcional)"
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
              {(novoStatus === "DEVOLVIDO" || novoStatus === "CANCELADO") && (
                <p className="text-sm text-slate-600">
                  O pedido <strong>{statusPedido.numeroPedido}</strong> será marcado como{" "}
                  <strong>{STATUS_PEDIDO_LABEL[novoStatus]}</strong>. Confirma?
                </p>
              )}
              {novoStatus === "CONCLUIDO" && (
                <p className="text-sm text-slate-600">
                  Ao concluir, as quantidades do pedido serão <strong>descontadas automaticamente</strong> do saldo do contrato.
                </p>
              )}
              {!["CONFIRMADO", "DEVOLVIDO", "CANCELADO", "CONCLUIDO"].includes(novoStatus) && (
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
                disabled={novoStatus === "CONFIRMADO" && !numeroOrdem.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl"
              >
                {criando && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {isNotaOpen && notaPedido && (
        <RegistrarNotaModal
          pedido={notaPedido}
          onCancel={() => setIsNotaOpen(false)}
          onSalvar={async (payload) => {
            try {
              await registrarEntradaNota(payload);
              setIsNotaOpen(false);
              setNotaPedido(null);
              reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro ao registrar nota.");
            }
          }}
        />
      )}

      {isAvisoOpen && avisoPedido && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Informar à secretaria — {avisoPedido.numeroPedido}</h3>
              <button onClick={() => setIsAvisoOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do aviso <span className="text-red-500">*</span></label>
              <textarea
                rows={4}
                value={avisoTexto}
                onChange={(e) => setAvisoTexto(e.target.value)}
                placeholder="Ex.: entrega veio parcial, item com avaria, estoque divergente..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setIsAvisoOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={confirmarAviso}
                disabled={avisoTexto.trim().length < 3 || criando}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-xl"
              >
                {criando && <Loader2 className="w-4 h-4 animate-spin" />}
                Registrar Aviso
              </button>
            </div>
          </div>
        </div>
      )}

      {isTermoOpen && termoPedido && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Termo de Recebimento — {termoPedido.numeroPedido}</h3>
              <button onClick={() => setIsTermoOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                Gera o documento <strong>Termo de Recebimento de Produtos</strong> no padrão do ofício da prefeitura, assinado pelo fiscal logado.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CPF do fiscal <span className="text-slate-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={termoCpf}
                  onChange={(e) => setTermoCpf(e.target.value)}
                  placeholder="xxx.xxx.xxx-xx"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Se não informado, usa o placeholder do modelo.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setIsTermoOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
                Cancelar
              </button>
              <button
                onClick={gerarTermo}
                disabled={gerandoTermo}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl"
              >
                {gerandoTermo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Gerar e Baixar
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
  const [dataPrevista, setDataPrevista] = useState("");

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

  const valido = Boolean(contrato) && dataPrevista !== "" && selecionados.length > 0;

  const salvar = () => {
    if (!idContrato) return;
    onSalvar({
      idContrato: Number(idContrato),
      dataPrevistaEntrega: dataPrevista,
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
            <p className="text-xs text-slate-500 mt-1">Solicite itens de um contrato vigente e informe até quando precisa.</p>
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prazo de Entrega (até quando) <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {contrato && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Itens Disponíveis</p>
                <ReceiptText className="w-4 h-4 text-slate-400" />
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

function RegistrarNotaModal({
  pedido,
  onCancel,
  onSalvar,
}: {
  pedido: Pedido;
  onCancel: () => void;
  onSalvar: (payload: { idPedido: number; numeroNota: string; dataEmissao: string; itens: { idItemLicitado: number; quantidade: number }[] }) => Promise<void>;
}) {
  const [numeroNota, setNumeroNota] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [fornecedorExtraido, setFornecedorExtraido] = useState("");
  const [quantidades, setQuantidades] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const selecionados = pedido.itens
    .map((item) => ({ item, quantidade: Number(quantidades[item.idItemLicitado]) || 0 }))
    .filter((s) => s.quantidade > 0);

  const valido = numeroNota.trim() && dataEmissao && selecionados.length > 0;

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErro(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${PARSING_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Falha ao processar o arquivo.");

      const result = await response.json();
      const nf = result.documento?.structured_data?.nota_fiscal;

      if (nf?.numero) setNumeroNota(String(nf.numero));
      if (nf?.data_de_emissao) {
        const d = String(nf.data_de_emissao);
        if (d.includes("/")) {
          const [dia, mes, ano] = d.split("/");
          setDataEmissao(`${ano}-${mes}-${dia}`);
        } else {
          setDataEmissao(d);
        }
      }
      if (nf?.fornecedor || nf?.cnpj_emitente) {
        setFornecedorExtraido([nf.fornecedor, nf.cnpj_emitente].filter(Boolean).join(" · "));
      }

      if (!nf?.numero && !nf?.data_de_emissao) {
        setErro("Não foi possível extrair a nota. Preencha manualmente os campos abaixo.");
      }
    } catch (err) {
      setErro("Não foi possível ler os dados do PDF. Preencha manualmente (fallback).");
      console.error("Erro ao enviar PDF:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        idPedido: pedido.id,
        numeroNota: numeroNota.trim(),
        dataEmissao,
        itens: selecionados.map((s) => ({ idItemLicitado: s.item.idItemLicitado, quantidade: s.quantidade })),
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
      <div className="w-full max-w-xl bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Registrar Nota Fiscal</h3>
            <p className="text-xs text-slate-500 mt-1">{pedido.numeroPedido} — efetua a compra do pedido.</p>
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

          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4">
            <label className="flex items-center justify-center gap-2 cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
              <Upload className="w-4 h-4" />
              {uploading ? "Lendo o PDF..." : "Importar dados da NF (PDF)"}
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
            </label>
            <p className="text-xs text-slate-400 text-center mt-1">
              A IA preenche número e data. Se falhar, preencha manualmente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Número da Nota <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={numeroNota}
                onChange={(e) => setNumeroNota(e.target.value)}
                placeholder="NF 0001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data de Emissão <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {fornecedorExtraido && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Fornecedor extraído: {fornecedorExtraido}
            </p>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <ReceiptText className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">Itens a Receber</p>
            </div>
            <div className="divide-y divide-slate-100">
              {pedido.itens.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{item.itemLicitado?.descricao}</p>
                    <p className="text-xs text-slate-500">Qtd pedida: {item.quantidade} {item.itemLicitado?.unidade}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={item.quantidade}
                    placeholder="0"
                    value={quantidades[item.idItemLicitado] ?? ""}
                    onChange={(e) => setQuantidades((q) => ({ ...q, [item.idItemLicitado]: e.target.value }))}
                    className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!valido || salvando}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar Entrada
          </button>
        </div>
      </div>
    </div>
  );
}