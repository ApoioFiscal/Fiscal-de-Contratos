import { PackageSearch, TrendingUp, AlertCircle, FileClock } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { apiRequest } from "@/services/api";
import { listarLicitacoes } from "@/services/licitacoes";
import { listarFilaPedidos, listarMeusPedidos } from "@/services/pedidos";
import { listarTermos } from "@/services/renovacoes";
import { obterSessao } from "@/services/auth";
import type { Licitacao, Pedido, TermoRenovacao } from "@/types/domain";

export function Dashboard() {
  const { id } = useParams();
  const sessao = obterSessao();
  const [sigla, setSigla] = useState("");
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [termos, setTermos] = useState<TermoRenovacao[]>([]);

  useEffect(() => {
    if (id) {
      apiRequest<any[]>("/setores")
        .then((setores) => {
          const setorClicado = setores.find((s: any) => String(s.id) === String(id));
          if (setorClicado?.sigla) setSigla(setorClicado.sigla);
        })
        .catch(() => undefined);
    } else {
      setSigla("");
    }
  }, [id]);

  const podeOperar =
    sessao?.perfil === "contratos" || sessao?.perfil === "fiscal";

  const podeVerTermos =
    sessao?.perfil === "licitacoes" || sessao?.perfil === "gabinete";

  useEffect(() => {
    listarLicitacoes()
      .then(setLicitacoes)
      .catch(() => setLicitacoes([]));
    (podeOperar ? listarFilaPedidos() : listarMeusPedidos())
      .then(setPedidos)
      .catch(() => setPedidos([]));
    if (podeVerTermos) {
      listarTermos()
        .then(setTermos)
        .catch(() => setTermos([]));
    }
  }, [podeOperar, podeVerTermos]);

  const today = new Date();
  const expiringBiddings = licitacoes.filter((b) => {
    const daysLeft = differenceInDays(parseISO(b.dataVigenciaFim), today);
    return daysLeft <= 60 && daysLeft >= 0;
  });

  const lowStockItems = licitacoes
    .flatMap((b) =>
      b.itens.map((item) => ({ ...item, contrato: b.numero, fornecedor: b.fornecedor }))
    )
    .filter((item) => item.quantidade > 0 && item.consumido / item.quantidade > 0.85);

  const termosPendentes = termos.filter((t) => t.status === "EMITIDO" || t.status === "EM_ANALISE");

  const stats = [
    { label: "Licitações Ativas", value: licitacoes.filter((l) => l.status === "ATIVA").length, icon: PackageSearch, color: "text-blue-600" },
    {
      label: "Pedidos em Andamento",
      value: pedidos.filter((p) => ["PENDENTE", "CONFIRMADO", "EFETUADO", "ENTREGUE", "CONFERENCIA"].includes(p.status)).length,
      icon: TrendingUp,
      color: "text-emerald-600",
    },
    { label: "Contratos a Vencer (60d)", value: expiringBiddings.length, icon: AlertCircle, color: "text-amber-600" },
    ...(podeVerTermos
      ? [{ label: "Termos de Renovação Pendentes", value: termosPendentes.length, icon: FileClock, color: "text-rose-600" }]
      : []),
  ];

  const chartData = licitacoes
    .flatMap((b) =>
      b.itens.map((i) => ({
        name: i.descricao.length > 18 ? i.descricao.slice(0, 18) + "…" : i.descricao,
        consumido: i.consumido,
        restante: i.quantidade - i.consumido,
      }))
    )
    .sort((a, b) => b.consumido - a.consumido)
    .slice(0, 6);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {sigla ? `Visão Geral (${sigla})` : `Visão Geral — ${sessao?.setor?.nome || "Município"}`}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Acompanhamento de licitações, pedidos, saldos e renovações.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-slate-50 ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Consumo de Itens Principais</h3>
          {chartData.length === 0 ? (
            <div className="text-center text-slate-400 py-12">Sem dados de consumo.</div>
          ) : (
            <div className="w-full" style={{ height: 300, minHeight: 300, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar isAnimationActive={false} dataKey="consumido" name="Consumido" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} />
                  <Bar isAnimationActive={false} dataKey="restante" name="Saldo Restante" stackId="a" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Atenção Necessária</h3>

          <div className="flex-1 overflow-auto space-y-4">
            {expiringBiddings.map((b) => {
              const daysLeft = differenceInDays(parseISO(b.dataVigenciaFim), today);
              return (
                <div key={`v-${b.id}`} className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900">Contrato Vencendo: {b.numero}</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Válido até {format(parseISO(b.dataVigenciaFim), "dd/MM/yyyy")} ({daysLeft} dias). Considere solicitar aditivo ou nova licitação.
                    </p>
                  </div>
                </div>
              );
            })}

            {lowStockItems.map((item) => (
              <div key={`l-${item.id}`} className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-rose-900">Saldo Crítico: {item.descricao}</h4>
                  <p className="text-xs text-rose-700 mt-1">
                    Apenas {item.quantidade - item.consumido} {item.unidade} restantes no contrato {item.contrato}.
                  </p>
                </div>
              </div>
            ))}

            {podeVerTermos && termosPendentes.map((t) => (
              <div key={`t-${t.id}`} className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex gap-3">
                <FileClock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900">Solicitação de Renovação #{t.id}</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    {t.contrato?.numero} aguarda análise da Licitações — solicitado por{" "}
                    {t.setorSolicitante?.sigla || t.setorSolicitante?.nome || "secretaria"}.
                  </p>
                </div>
              </div>
            ))}

            {expiringBiddings.length === 0 && lowStockItems.length === 0 && (!podeVerTermos || termosPendentes.length === 0) && (
              <div className="text-center text-slate-400 py-8">Nenhum alerta no momento.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}