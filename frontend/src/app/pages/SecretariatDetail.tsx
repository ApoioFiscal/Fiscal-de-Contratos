import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  LayoutDashboard,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  PackageSearch,
  TrendingUp,
} from "lucide-react";
import { apiRequest } from "@/services/api";
import { listarContratos } from "@/services/contratos";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Contrato, ContratoItem } from "@/types/domain";

type Tab = "dashboard" | "contratos";

export function SecretariatDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [secretariat, setSecretariat] = useState<{ id: number; nome: string; sigla: string } | null>(null);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiRequest<{ id: number; nome: string; sigla: string }[]>("/setores"), listarContratos()])
      .then(([setores, lista]) => {
        const found = setores.find((s) => String(s.id) === String(id));
        if (found) {
          setSecretariat({ id: found.id, nome: found.nome, sigla: found.sigla });
        }
        setContratos(lista);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao buscar secretaria:", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar os dados da secretaria.");
        setIsLoading(false);
      });
  }, [id]);

  // Contratos vinculados a esta secretaria (via `ContratoSetor` — origem DOTACAO/MANUAL)
  const linkedContratos = useMemo(() => {
    if (!secretariat) return [] as Contrato[];
    return contratos.filter((c) =>
      (c.setores ?? []).some((s) => s.idSetor === secretariat.id),
    );
  }, [contratos, secretariat]);

  // Stats
  const today = new Date();
  const expiringContratos = linkedContratos.filter((c) => {
    if (!c.vigenciaFim) return false;
    const daysLeft = differenceInDays(parseISO(c.vigenciaFim), today);
    return daysLeft <= 60 && daysLeft >= 0;
  });

  const lowStockItems = linkedContratos
    .flatMap((c) => (c.itens ?? []).map((item) => ({ ...item, contrato: c.numero })))
    .filter((item) => item.quantidade > 0 && item.consumido / item.quantidade > 0.85);

  const stats = [
    { label: "Contratos Vinculados", value: linkedContratos.length, icon: PackageSearch, color: "text-blue-600" },
    { label: "Contratos Ativos", value: linkedContratos.filter((c) => c.status === "ATIVA").length, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Contratos a Vencer (60d)", value: expiringContratos.length, icon: AlertCircle, color: "text-amber-600" },
    { label: "Itens em Alerta (Saldo)", value: lowStockItems.length, icon: AlertCircle, color: "text-rose-600" },
  ];

  const chartData = linkedContratos
    .flatMap((c) =>
      (c.itens ?? []).map((i) => ({
        name: i.descricao.length > 18 ? i.descricao.slice(0, 18) + "…" : i.descricao,
        consumido: i.consumido,
        restante: i.quantidade - i.consumido,
      })),
    )
    .sort((a, b) => b.consumido - a.consumido)
    .slice(0, 5);

  const nomeContratado = (c: Contrato) =>
    c.partes?.find((p) => p.papel === "CONTRATADO")?.nome ?? "—";

  const vigencia = (c: Contrato) =>
    c.vigenciaFim ? format(parseISO(c.vigenciaFim), "dd/MM/yyyy") : "—";

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 flex items-center justify-center py-20">
        <p className="text-slate-500 font-medium">Carregando dados da secretaria...</p>
      </div>
    );
  }

  if (!secretariat) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <button onClick={() => navigate("/secretarias")} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Setores e Secretarias
        </button>
        <p className="text-slate-500">Secretaria não encontrada no banco de dados.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "contratos", label: "Contratos", icon: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <button onClick={() => navigate("/secretarias")} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium">
        <ArrowLeft className="w-4 h-4" />
        Voltar para Setores e Secretarias
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {secretariat.nome}
        </h1>
        <p className="text-sm text-slate-500 mt-1">Sigla: {secretariat.sigla}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-6">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </div>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, i) => (
                  <div key={i} className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-white ${stat.color}`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                      <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <h3 className="text-base font-semibold text-slate-800 mb-4">Consumo de Itens</h3>
                  {chartData.length > 0 ? (
                    <div style={{ height: 260, minHeight: 260, minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11 }} />
                          <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                          <Bar isAnimationActive={false} dataKey="consumido" name="Consumido" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} />
                          <Bar isAnimationActive={false} dataKey="restante" name="Saldo Restante" stackId="a" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-16">Nenhum dado de consumo disponível.</p>
                  )}
                </div>

                {/* Alerts */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col">
                  <h3 className="text-base font-semibold text-slate-800 mb-4">Atenção Necessária</h3>
                  <div className="flex-1 space-y-3 overflow-auto">
                    {expiringContratos.map((c) => {
                      const daysLeft = differenceInDays(parseISO(c.vigenciaFim as string), today);
                      return (
                        <div key={c.id} className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-3">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-semibold text-amber-900">Contrato Vencendo: {c.numero}</h4>
                            <p className="text-xs text-amber-700 mt-0.5">
                              Válido até {format(parseISO(c.vigenciaFim as string), "dd/MM/yyyy")} ({daysLeft} dias).
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {lowStockItems.map((item) => (
                      <div key={`l-${item.contrato}-${item.id}`} className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex gap-3">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-rose-900">Saldo Crítico: {item.descricao}</h4>
                          <p className="text-xs text-rose-700 mt-0.5">
                            Apenas {item.quantidade - item.consumido} {item.unidade} restantes no contrato {item.contrato}.
                          </p>
                        </div>
                      </div>
                    ))}
                    {expiringContratos.length === 0 && lowStockItems.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-8">Nenhum alerta no momento.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contratos Tab */}
          {activeTab === "contratos" && (
            <div className="space-y-4">
              {linkedContratos.length === 0 ? (
                <p className="text-center text-slate-500 py-12">
                  Nenhum contrato vinculado a esta secretaria. O vínculo sai das dotações do contrato (beneficiárias).
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {linkedContratos.map((ctr) => (
                    <div key={ctr.id} className="hover:bg-slate-50 transition-colors">
                      <div
                        className="p-4 sm:px-6 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedId(expandedId === ctr.id ? null : ctr.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {ctr.numero}
                            </span>
                            {ctr.status === "RASCUNHO" && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                Rascunho
                              </span>
                            )}
                            <h3 className="text-sm font-semibold text-slate-900">{nomeContratado(ctr)}</h3>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-1">{ctr.objeto}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden sm:block text-right">
                            <p className="text-xs text-slate-500">Vigência</p>
                            <p className="text-sm font-medium text-slate-900">{vigencia(ctr)}</p>
                          </div>
                          {expandedId === ctr.id ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {expandedId === ctr.id && (
                        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100">
                          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="block text-slate-500 text-xs mb-1">Contratante</span>
                              <span className="font-medium text-slate-900">{ctr.partes?.find((p) => p.papel === "CONTRATANTE")?.nome ?? "—"}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 text-xs mb-1">Contratado</span>
                              <span className="font-medium text-slate-900">{nomeContratado(ctr)}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 text-xs mb-1">Vigência</span>
                              <span className="font-medium text-slate-900">{vigencia(ctr)}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 text-xs mb-1">Valor Total</span>
                              <span className="font-medium text-slate-900">
                                {ctr.valorTotal != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ctr.valorTotal) : "—"}
                              </span>
                            </div>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-medium text-slate-500">Item</th>
                                  <th className="px-4 py-3 text-left font-medium text-slate-500">Unidade</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Valor Unit.</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Qtd. Total</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Consumido</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Saldo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {(ctr.itens ?? []).map((item: ContratoItem) => {
                                  const balance = item.quantidade - item.consumido;
                                  const isLow = item.quantidade > 0 && balance / item.quantidade < 0.15;
                                  return (
                                    <tr key={item.id}>
                                      <td className="px-4 py-3 font-medium text-slate-900">{item.descricao}</td>
                                      <td className="px-4 py-3 text-slate-500">{item.unidade}</td>
                                      <td className="px-4 py-3 text-right text-slate-900">
                                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valorUnitario)}
                                      </td>
                                      <td className="px-4 py-3 text-right text-slate-900">{item.quantidade}</td>
                                      <td className="px-4 py-3 text-right text-slate-900">{item.consumido}</td>
                                      <td className={`px-4 py-3 text-right font-bold ${isLow ? "text-rose-600" : "text-emerald-600"}`}>
                                        {balance}
                                      </td>
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
