import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, LayoutDashboard, FileText, ShoppingCart, AlertCircle, PackageSearch, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { MOCK_BIDDINGS, MOCK_REQUESTS } from "../data/mock";
import { apiRequest } from "@/services/api";
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

type Tab = "dashboard" | "licitacoes" | "pedidos";

export function SecretariatDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Novos estados para buscar os dados do Backend
  const [secretariat, setSecretariat] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Busca a secretaria real pela API quando a página carrega
  useEffect(() => {
    apiRequest<any[]>("/setores")
      .then((setores) => {
        const found = setores.find((s: any) => String(s.id) === String(id));
        if (found) {
          // Adapta o nome da propriedade para não quebrar o layout
          setSecretariat({ ...found, name: found.nome || found.name });
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao buscar secretaria:", err);
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 flex items-center justify-center py-20">
        <p className="text-slate-500 font-medium">Carregando dados da secretaria...</p>
      </div>
    );
  }

  // O erro de não encontrada só aparece se a API realmente não achar o ID
  if (!secretariat) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <button onClick={() => navigate("/secretarias")} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Gestão de Secretarias
        </button>
        <p className="text-slate-500">Secretaria não encontrada no banco de dados.</p>
      </div>
    );
  }

  // Filter data for this secretariat (Por enquanto usando Mocks para Licitações e Pedidos)
  const secretariatBiddings = MOCK_BIDDINGS.filter(b =>
    b.secretariats.includes(secretariat.name)
  );

  const secretariatRequests = MOCK_REQUESTS.filter(r =>
    r.secretariat === secretariat.name
  );

  // Dashboard stats
  const today = new Date();
  const expiringBiddings = secretariatBiddings.filter(b => {
    const daysLeft = differenceInDays(parseISO(b.validity), today);
    return daysLeft <= 60 && daysLeft >= 0;
  });

  const lowStockItems = secretariatBiddings
    .flatMap(b => b.items.map(item => ({ ...item, bidding: b.id })))
    .filter(item => item.consumed / item.totalQuantity > 0.85);

  const stats = [
    { label: "Licitações Ativas", value: secretariatBiddings.length, icon: PackageSearch, color: "text-blue-600" },
    { label: "Pedidos no Mês", value: secretariatRequests.length, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Contratos a Vencer", value: expiringBiddings.length, icon: AlertCircle, color: "text-amber-600" },
    { label: "Itens em Alerta (Saldo)", value: lowStockItems.length, icon: AlertCircle, color: "text-rose-600" },
  ];

  const chartData = secretariatBiddings
    .flatMap(b => b.items.map(i => ({
      name: i.name,
      consumido: i.consumed,
      restante: i.totalQuantity - i.consumed,
    })))
    .slice(0, 5);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "licitacoes", label: "Licitações & Contratos", icon: FileText },
    { id: "pedidos", label: "Pedidos e Ordens", icon: ShoppingCart },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Secretaria de {secretariat.name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Visão detalhada dos dados desta secretaria
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-6">
          <div className="flex gap-6">
            {tabs.map(tab => (
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
                    {expiringBiddings.map(b => (
                      <div key={b.id} className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex gap-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-amber-900">Contrato Vencendo: {b.id}</h4>
                          <p className="text-xs text-amber-700 mt-0.5">
                            Válido até {format(parseISO(b.validity), "dd/MM/yyyy")}.
                          </p>
                        </div>
                      </div>
                    ))}
                    {lowStockItems.map(item => (
                      <div key={item.id} className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex gap-3">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-rose-900">Saldo Crítico: {item.name}</h4>
                          <p className="text-xs text-rose-700 mt-0.5">
                            Apenas {item.totalQuantity - item.consumed} unidades restantes.
                          </p>
                        </div>
                      </div>
                    ))}
                    {expiringBiddings.length === 0 && lowStockItems.length === 0 && (
                      <p className="text-sm text-slate-400 text-center py-8">Nenhum alerta no momento.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Licitações Tab */}
          {activeTab === "licitacoes" && (
            <div className="space-y-4">
              {secretariatBiddings.length === 0 ? (
                <p className="text-center text-slate-500 py-12">Nenhuma licitação vinculada a esta secretaria.</p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {secretariatBiddings.map(bidding => (
                    <div key={bidding.id} className="hover:bg-slate-50 transition-colors">
                      <div
                        className="p-4 sm:px-6 flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedId(expandedId === bidding.id ? null : bidding.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {bidding.id}
                            </span>
                            <h3 className="text-sm font-semibold text-slate-900">{bidding.supplier}</h3>
                          </div>
                          <p className="text-sm text-slate-500">{bidding.description}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="hidden sm:block text-right">
                            <p className="text-xs text-slate-500">Validade</p>
                            <p className="text-sm font-medium text-slate-900">
                              {format(parseISO(bidding.validity), "dd/MM/yyyy")}
                            </p>
                          </div>
                          {expandedId === bidding.id ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {expandedId === bidding.id && (
                        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100">
                          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="block text-slate-500 text-xs mb-1">CNPJ</span>
                              <span className="font-medium text-slate-900">{bidding.cnpj}</span>
                            </div>
                            <div>
                              <span className="block text-slate-500 text-xs mb-1">Secretarias Vinculadas</span>
                              <span className="font-medium text-slate-900">{bidding.secretariats.join(", ")}</span>
                            </div>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-medium text-slate-500">Item</th>
                                  <th className="px-4 py-3 text-left font-medium text-slate-500">Marca/Unidade</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Valor Unit.</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Qtd. Total</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Consumido</th>
                                  <th className="px-4 py-3 text-right font-medium text-slate-500">Saldo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {bidding.items.map(item => {
                                  const balance = item.totalQuantity - item.consumed;
                                  const isLow = balance / item.totalQuantity < 0.15;
                                  return (
                                    <tr key={item.id}>
                                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                      <td className="px-4 py-3 text-slate-500">{item.brand} ({item.unit})</td>
                                      <td className="px-4 py-3 text-right text-slate-900">
                                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.unitPrice)}
                                      </td>
                                      <td className="px-4 py-3 text-right text-slate-900">{item.totalQuantity}</td>
                                      <td className="px-4 py-3 text-right text-slate-900">{item.consumed}</td>
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

          {/* Pedidos Tab */}
          {activeTab === "pedidos" && (
            <div>
              {secretariatRequests.length === 0 ? (
                <p className="text-center text-slate-500 py-12">Nenhum pedido registrado para esta secretaria.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">Pedido</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">Data</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">Licitação</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {secretariatRequests.map(req => {
                        const total = req.items.reduce(
                          (sum, item) => sum + item.quantity * item.unitPrice,
                          0
                        );
                        return (
                          <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900">{req.id}</td>
                            <td className="px-4 py-3 text-slate-500">
                              {format(parseISO(req.date), "dd/MM/yyyy")}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{req.biddingId}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                req.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {req.status === "completed" ? "Finalizado" : "Pendente"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}