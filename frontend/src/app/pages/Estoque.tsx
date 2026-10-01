import { useState, useEffect, useCallback } from "react";
import {
  listarLicitacoes,
} from "@/services/licitacoes";
import {
  resumoContrato,
  listarMovimentacoes,
  registrarEntradaNota,
  registrarBaixa,
  type EntradaNotaPayload,
  type BaixaPayload,
} from "@/services/estoque";
import { listarFilaPedidos } from "@/services/pedidos";
import { obterSessao } from "@/services/auth";
import { format, parseISO } from "date-fns";
import {
  X, AlertCircle, Loader2, ArrowDownToLine, ArrowUpFromLine,
  Package, Layers, ReceiptText
} from "lucide-react";
import type { ItemSaldo, Licitacao, Movimentacao, Pedido } from "@/types/domain";
import { STATUS_PEDIDO_LABEL } from "@/types/domain";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function Estoque() {
  const sessao = obterSessao();
  const podeOperar = sessao?.perfil === "contratos" || sessao?.perfil === "fiscal" || sessao?.perfil === "gabinete";

  const [contratos, setContratos] = useState<Licitacao[]>([]);
  const [idContrato, setIdContrato] = useState<number | "">("");
  const [saldos, setSaldos] = useState<ItemSaldo[]>([]);
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEntradaOpen, setIsEntradaOpen] = useState(false);
  const [isBaixaOpen, setIsBaixaOpen] = useState(false);

  useEffect(() => {
    listarLicitacoes()
      .then(setContratos)
      .catch((err) => setError(err.message));
  }, []);

  const reload = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const pe = podeOperar ? await listarFilaPedidos() : [];
      const [sa, mv] = await Promise.all([
        resumoContrato(id),
        listarMovimentacoes({ contratoId: id }),
      ]);
      setSaldos(sa);
      setMovs(mv);
      setPedidos(pe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar estoque.");
    } finally {
      setLoading(false);
    }
  }, [podeOperar]);

  const selecionarContrato = (id: number) => {
    setIdContrato(id);
    reload(id);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estoque dos Contratos</h1>
          <p className="text-sm text-slate-500 mt-1">Entradas por nota fiscal, baixas por consumo e saldos por item.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600 mb-1">Contrato</label>
            <select
              value={idContrato}
              onChange={(e) => selecionarContrato(Number(e.target.value))}
              aria-label="Contrato do estoque"
              className="w-72 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Selecione um contrato...</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>{c.numero} — {c.fornecedor}</option>
              ))}
            </select>
          </div>
          {podeOperar && idContrato !== "" && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEntradaOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                <ArrowDownToLine className="w-4 h-4" />
                Entrada de Nota
              </button>
              <button
                onClick={() => setIsBaixaOpen(true)}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                Dar Baixa
              </button>
            </div>
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
          Selecione um contrato para visualizar o estoque.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Saldos por Item</h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-500">Carregando...</div>
              ) : (
                <table className="min-w-full text-sm divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Item</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Contratado</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Recebido</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Consumido</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Disponível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {saldos.map((item) => {
                      const disponivel = item.recebido - item.consumido;
                      const restoContrato = item.quantidade - item.consumido;
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {item.descricao}{item.marca ? ` (${item.marca})` : ""}
                            <span className="block text-xs text-slate-400">{item.unidade} · {fmt.format(item.precoUnitario)}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">{item.quantidade}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{item.recebido}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{item.consumido}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${disponivel === 0 && item.recebido > 0 ? "text-slate-400" : disponivel < restoContrato * 0.15 ? "text-rose-600" : "text-emerald-600"}`}>
                              {disponivel} {item.unidade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {saldos.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Sem itens neste contrato.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Movimentações</h3>
              </div>
              <div className="flex-1 overflow-auto divide-y divide-slate-100">
                {movs.map((m) => (
                  <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.tipo === "ENTRADA" ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>
                      {m.tipo === "ENTRADA" ? "Entrada" : "Baixa"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{m.itemLicitado?.descricao}</p>
                      <p className="text-xs text-slate-500">
                        {m.quantidade} {m.itemLicitado?.unidade}
                        {m.pedido ? ` · ${m.pedido.numeroPedido}` : ""}
                        {m.notaFiscal ? ` · NF ${m.notaFiscal.numeroNota}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400">{format(parseISO(m.data), "dd/MM/yyyy")}</span>
                  </div>
                ))}
                {movs.length === 0 && <div className="p-8 text-center text-slate-500">Sem movimentações.</div>}
              </div>
            </div>
          </div>

          {podeOperar && idContrato !== "" && (
            isEntradaOpen ? (
              <EntradaNotaModal
                pedidos={pedidos.filter((p) => p.idContrato === Number(idContrato) && ["EM_COMPRA", "ENTREGUE"].includes(p.status))}
                contratos={contratos}
                onCancel={() => setIsEntradaOpen(false)}
                onSalvar={async (payload: EntradaNotaPayload, id: number) => {
                  try {
                    await registrarEntradaNota(payload);
                    setIsEntradaOpen(false);
                    reload(id);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erro ao registrar nota.");
                  }
                }}
              />
            ) : isBaixaOpen ? (
              <BaixaModal
                itens={saldos}
                pedidos={pedidos.filter((p) => p.idContrato === Number(idContrato))}
                onCancel={() => setIsBaixaOpen(false)}
                onSalvar={async (payload) => {
                  try {
                    await registrarBaixa(payload);
                    setIsBaixaOpen(false);
                    reload(Number(idContrato));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erro ao dar baixa.");
                  }
                }}
              />
            ) : null
          )}
        </>
      )}
    </div>
  );
}

function EntradaNotaModal({
  pedidos,
  onCancel,
  onSalvar,
}: {
  pedidos: Pedido[];
  onCancel: () => void;
  onSalvar: (payload: EntradaNotaPayload, contratoId: number) => Promise<void>;
}) {
  const [idPedido, setIdPedido] = useState<number | "">("");
  const [numeroNota, setNumeroNota] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [quantidades, setQuantidades] = useState<Record<number, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pedido = pedidos.find((p) => p.id === idPedido);

  const selecionarPedido = (id: number) => {
    setIdPedido(id);
    const pe = pedidos.find((p) => p.id === id);
    const qtds: Record<number, string> = {};
    pe?.itens.forEach((i) => { qtds[i.idItemLicitado] = ""; });
    setQuantidades(qtds);
  };

  const selecionados = pedido
    ? pedido.itens
        .map((item) => ({ item, quantidade: Number(quantidades[item.idItemLicitado]) || 0 }))
        .filter((s) => s.quantidade > 0)
    : [];

  const valido = Boolean(pedido) && numeroNota.trim() && dataEmissao && selecionados.length > 0;

  const salvar = async () => {
    if (!pedido) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(
        {
          idPedido: pedido.id,
          numeroNota: numeroNota.trim(),
          dataEmissao: dataEmissao,
          itens: selecionados.map((s) => ({ idItemLicitado: s.item.idItemLicitado, quantidade: s.quantidade })),
        },
        pedido.idContrato
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
      <div className="w-full max-w-xl bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Entrada de Nota Fiscal</h3>
            <p className="text-xs text-slate-500 mt-1">Vincule a NF ao pedido correspondente.</p>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Pedido <span className="text-red-500">*</span></label>
              <select
                value={idPedido}
                onChange={(e) => selecionarPedido(Number(e.target.value))}
                aria-label="Pedido da nota"
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
                <p className="text-xs text-amber-600 mt-1">Nenhum pedido em compra/entregue neste contrato.</p>
              )}
            </div>
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

          {pedido && (
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
          )}
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

function BaixaModal({
  itens,
  pedidos,
  onCancel,
  onSalvar,
}: {
  itens: ItemSaldo[];
  pedidos: Pedido[];
  onCancel: () => void;
  onSalvar: (payload: BaixaPayload) => Promise<void>;
}) {
  const [idItem, setIdItem] = useState<number | "">("");
  const [quantidade, setQuantidade] = useState("");
  const [idPedido, setIdPedido] = useState<number | "">("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const item = itens.find((i) => i.id === idItem);
  const disponivel = item ? item.recebido - item.consumido : 0;
  const valido = Boolean(item) && Number(quantidade) > 0 && disponivel > 0 && Number(quantidade) <= disponivel;

  const salvar = async () => {
    if (!item) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        idItemLicitado: item.id,
        quantidade: Number(quantidade),
        idPedido: idPedido === "" ? undefined : Number(idPedido),
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
            <h3 className="text-lg font-bold text-slate-900">Dar Baixa no Estoque</h3>
            <p className="text-xs text-slate-500 mt-1">Registra o consumo de um item.</p>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Item <span className="text-red-500">*</span></label>
            <select
              value={idItem}
              onChange={(e) => setIdItem(Number(e.target.value))}
              aria-label="Item de baixa"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Selecione o item...</option>
              {itens.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.descricao} — disp. {i.recebido - i.consumido} {i.unidade}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                max={disponivel || undefined}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder={`Disponível: ${disponivel}`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pedido vinculado</label>
              <select
                value={idPedido}
                onChange={(e) => setIdPedido(e.target.value === "" ? "" : Number(e.target.value))}
                aria-label="Pedido vinculado da baixa"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— nenhum —</option>
                {pedidos.filter((p) => ["ENTREGUE", "CONCLUIDO"].includes(p.status)).map((p) => (
                  <option key={p.id} value={p.id}>{p.numeroPedido} — {STATUS_PEDIDO_LABEL[p.status]}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Vincular ao pedido finaliza o ciclo.</p>
            </div>
          </div>
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
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40 rounded-xl"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar Baixa
          </button>
        </div>
      </div>
    </div>
  );
}