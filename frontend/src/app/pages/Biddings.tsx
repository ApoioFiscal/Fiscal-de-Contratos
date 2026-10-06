import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/services/api";
import { listarLicitacoes, criarLicitacao, gerarContratoLicitacao, baixarArquivoContrato } from "@/services/licitacoes";
import { obterSessao } from "@/services/auth";
import { format, parseISO } from "date-fns";
import {
  Search, Plus, ChevronDown, ChevronUp, X, Trash2,
  Building2, FileText, CalendarDays, Package, Users, ArrowLeft,
  CheckCircle2, AlertCircle, UploadCloud, Loader2, FilePlus2, FileDown
} from "lucide-react";
import type { ItemLicitado, Licitacao, StatusContrato } from "@/types/domain";
import { STATUS_CONTRATO_LABEL } from "@/types/domain";

interface SecretariatOpt {
  id: number;
  name: string;
}

const UNITS = ["Un", "Cx", "Kg", "L", "m²", "m³", "Saco", "Pct", "Par", "Resma"];

const PARSING_BASE_URL = import.meta.env.VITE_PARSING_URL ?? "http://localhost:3000";

const emptyDraftItem = () => ({
  _key: crypto.randomUUID(),
  name: "",
  brand: "",
  unit: "Un",
  unitPrice: "",
  totalQuantity: "",
});

type DraftItem = ReturnType<typeof emptyDraftItem>;

const emptyForm = () => ({
  processNumber: "",
  modality: "",
  description: "",
  supplier: "",
  cnpj: "",
  validity: "",
  secretariats: [] as string[],
  items: [emptyDraftItem()],
});

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function cnpjMask(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const statusChip: Record<StatusContrato, string> = {
  RASCUNHO: "bg-slate-100 text-slate-700",
  ATIVA: "bg-emerald-100 text-emerald-800",
  EM_ADITAMENTO: "bg-amber-100 text-amber-800",
  ENCERRADA: "bg-slate-200 text-slate-600",
  VENCIDA: "bg-rose-100 text-rose-800",
};

export function Biddings() {
  const sessao = obterSessao();
  const podeCriar = sessao?.perfil === "licitacoes" || sessao?.perfil === "gabinete";

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [biddings, setBiddings] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);

  const [dbSecretariats, setDbSecretariats] = useState<SecretariatOpt[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formStep, setFormStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isPdfProcessed, setIsPdfProcessed] = useState(false);
  const [lockedFields, setLockedFields] = useState<Record<string, boolean>>({});

  const [swalError, setSwalError] = useState<string | null>(null);

  const [gerandoId, setGerandoId] = useState<number | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    listarLicitacoes()
      .then(setBiddings)
      .catch((err) => setSwalError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    apiRequest<{ id: number; nome: string }[]>("/setores")
      .then((setores) => {
        setDbSecretariats(setores.map((s) => ({ id: s.id, name: s.nome })));
      })
      .catch((err) => console.error("Erro ao buscar secretarias:", err));
  }, [reload]);

  const filtered = biddings.filter(
    (b) =>
      b.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.objeto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openForm = () => {
    setForm(emptyForm());
    setFormStep(1);
    setSubmitted(false);
    setIsPdfProcessed(false);
    setLockedFields({});
    setIsFormOpen(true);
  };

  const closeForm = () => setIsFormOpen(false);

  const handleGerarContrato = async (bidding: Licitacao) => {
    setGerandoId(bidding.id);
    setSwalError(null);
    try {
      await gerarContratoLicitacao(bidding.id);
      reload();
    } catch (err) {
      setSwalError(err instanceof Error ? err.message : "Erro ao gerar o contrato.");
    } finally {
      setGerandoId(null);
    }
  };

  const handleBaixarContrato = async (bidding: Licitacao) => {
    setSwalError(null);
    try {
      const blob = await baixarArquivoContrato(bidding.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = bidding.arquivoContrato || `contrato-${bidding.numero}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSwalError(err instanceof Error ? err.message : "Não foi possível baixar o contrato.");
    }
  };

  const setField = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const toggleSecretariat = (name: string) =>
    setForm((f) => ({
      ...f,
      secretariats: f.secretariats.includes(name)
        ? f.secretariats.filter((s) => s !== name)
        : [...f.secretariats, name],
    }));

  const updateItem = (key: string, field: keyof DraftItem, value: string) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => (it._key === key ? { ...it, [field]: value } : it)),
    }));

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyDraftItem()] }));
  const removeItem = (key: string) => setForm((f) => ({ ...f, items: f.items.filter((it) => it._key !== key) }));

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${PARSING_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Falha ao processar o arquivo.");

      const result = await response.json();
      const { structured_data } = result.documento;

      const processoExtraido = structured_data.processo || structured_data.campos_rotulados?.processo || "";
      const modalidadeExtraida = structured_data.modalidade || structured_data.tipo_documento || "";
      const objetoExtraido = structured_data.objeto || structured_data.campos_rotulados?.objeto || "";
      const empresaExtraida = structured_data.empresas?.[0] ||
                              structured_data.campos_rotulados?.razao_social ||
                              structured_data.campos_rotulados?.fornecedor ||
                              "";
      const cnpjExtraido = structured_data.cnpjs?.[0] || "";
      const dataExtraida = structured_data.datas?.[0] || "";

      let dataFormatada = "";
      if (dataExtraida && dataExtraida.includes("/")) {
        const [dia, mes, ano] = dataExtraida.split("/");
        dataFormatada = `${ano}-${mes}-${dia}`;
      } else if (dataExtraida) {
        dataFormatada = dataExtraida;
      }

      setForm((prev) => ({
        ...prev,
        processNumber: processoExtraido,
        modality: modalidadeExtraida.toUpperCase(),
        description: objetoExtraido,
        cnpj: cnpjExtraido ? cnpjMask(cnpjExtraido) : "",
        supplier: empresaExtraida,
        validity: dataFormatada,
      }));

      setLockedFields({
        processNumber: !!processoExtraido,
        modality: !!modalidadeExtraida,
        description: !!objetoExtraido,
        cnpj: !!cnpjExtraido,
        supplier: !!empresaExtraida,
        validity: !!dataFormatada,
      });

      setIsPdfProcessed(true);
    } catch (error) {
      console.error("Erro ao enviar PDF:", error);
      alert("Não foi possível ler os dados do PDF. Verifique se a API está rodando na porta 3000.");
    } finally {
      setIsUploadingPdf(false);
      e.target.value = "";
    }
  };

  const step1Valid = isPdfProcessed && form.processNumber.trim() && form.validity;
  const step2Valid = isPdfProcessed && form.supplier.trim() && form.cnpj.replace(/\D/g, "").length === 14;
  const step3Valid = form.secretariats.length > 0;
  const step4Valid = form.items.length > 0 && form.items.every(it => it.name.trim() && it.unit && Number(it.unitPrice) > 0 && Number(it.totalQuantity) > 0);

  const handleSave = async () => {
    const anoEdital = form.validity ? form.validity.split("-")[0] : new Date().getFullYear().toString();
    const novoNumero = `LIC-${anoEdital}-${String(biddings.length + 1).padStart(3, "0")}`;
    const idSetores = form.secretariats
      .map((name) => dbSecretariats.find((s) => s.name === name)?.id)
      .filter((id): id is number => typeof id === "number");

    try {
      await criarLicitacao({
        numero: novoNumero,
        numeroProcesso: form.processNumber,
        modalidade: form.modality || "PREGÃO",
        objeto: form.description,
        fornecedor: form.supplier,
        cnpjFornecedor: form.cnpj,
        dataAbertura: new Date().toISOString().split("T")[0],
        dataVigenciaFim: form.validity,
        idSetores,
        itens: form.items.map((it) => ({
          descricao: it.name,
          marca: it.brand || undefined,
          unidade: it.unit,
          quantidade: Number(it.totalQuantity),
          precoUnitario: Number(it.unitPrice),
        })),
      });
      setSubmitted(true);
      reload();
    } catch (err) {
      setSwalError(err instanceof Error ? err.message : "Erro ao cadastrar licitação.");
    }
  };

  const totalContractValue = form.items.reduce((sum, it) => sum + Number(it.unitPrice || 0) * Number(it.totalQuantity || 0), 0);

  const steps = [
    { n: 1, label: "Documento", icon: FileText },
    { n: 2, label: "Fornecedor", icon: Building2 },
    { n: 3, label: "Secretarias", icon: Users },
    { n: 4, label: "Itens", icon: Package },
    { n: 5, label: "Revisão", icon: CheckCircle2 },
  ];

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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Licitações e Contratos</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os contratos vigentes e saldos disponíveis.</p>
        </div>
        {podeCriar && (
          <button
            onClick={openForm}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Licitação
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, fornecedor ou descrição..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading && <div className="p-8 text-center text-slate-500">Carregando licitações...</div>}

        <div className="divide-y divide-slate-200">
          {filtered.map((bidding) => (
            <div key={bidding.id} className="hover:bg-slate-50 transition-colors">
              <div
                className="p-4 sm:px-6 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === bidding.id ? null : bidding.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {bidding.numero}
                    </span>
                    {bidding.modalidade && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {bidding.modalidade}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusChip[bidding.status]}`}>
                      {STATUS_CONTRATO_LABEL[bidding.status]}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">{bidding.fornecedor}</h3>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-1">{bidding.objeto}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-slate-500">Validade</p>
                    <p className="text-sm font-medium text-slate-900">
                      {format(parseISO(bidding.dataVigenciaFim), "dd/MM/yyyy")}
                    </p>
                  </div>
                  {expandedId === bidding.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {expandedId === bidding.id && (
                <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    {bidding.arquivoContrato ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-700">
                            Contrato gerado em{" "}
                            <span className="font-medium">
                              {bidding.dataGeracaoContrato ? format(parseISO(bidding.dataGeracaoContrato), "dd/MM/yyyy") : "—"}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => handleBaixarContrato(bidding)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
                          >
                            <FileDown className="w-4 h-4" />
                            Ver Contrato
                          </button>
                        </div>
                      </>
                    ) : podeCriar ? (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="text-amber-700">Contrato ainda não gerado.</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => handleGerarContrato(bidding)}
                            disabled={gerandoId === bidding.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {gerandoId === bidding.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FilePlus2 className="w-4 h-4" />
                            )}
                            Gerar Contrato
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">CNPJ</span>
                      <span className="font-medium text-slate-900">{bidding.cnpjFornecedor}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Secretarias Vinculadas</span>
                      <span className="font-medium text-slate-900">
                        {bidding.setores.map((s) => s.setor.nome).join(", ")}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Nº do Processo</span>
                      <span className="font-medium text-slate-900">{bidding.numeroProcesso}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-xs mb-1">Valor Global</span>
                      <span className="font-medium text-slate-900">{fmt.format(bidding.valorTotal)}</span>
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
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Recebido</th>
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Consumido</th>
                          <th className="px-4 py-3 text-right font-medium text-slate-500">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {bidding.itens.map((item: ItemLicitado) => {
                          const balance = item.quantidade - item.consumido;
                          const isLow = item.quantidade > 0 && balance / item.quantidade < 0.15;
                          return (
                            <tr key={item.id}>
                              <td className="px-4 py-3 font-medium text-slate-900">{item.descricao}</td>
                              <td className="px-4 py-3 text-slate-500">{item.marca ? `${item.marca} (${item.unidade})` : item.unidade}</td>
                              <td className="px-4 py-3 text-right text-slate-900">{fmt.format(item.precoUnitario)}</td>
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
          {!loading && filtered.length === 0 && <div className="p-8 text-center text-slate-500">Nenhuma licitação encontrada.</div>}
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-stretch justify-end">
          <div className="w-full max-w-3xl bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-3">
                {formStep > 1 && !submitted && (
                  <button onClick={() => setFormStep((s) => s - 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Nova Licitação</h2>
                  {!submitted && <p className="text-xs text-slate-500">Etapa {formStep} de {steps.length} — {steps[formStep - 1].label}</p>}
                </div>
              </div>
              <button onClick={closeForm} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!submitted && (
              <div className="px-8 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                <div className="flex items-center gap-0">
                  {steps.map((step, idx) => {
                    const done = formStep > step.n;
                    const active = formStep === step.n;
                    return (
                      <div key={step.n} className="flex items-center flex-1 min-w-0">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                            done ? "bg-blue-600 border-blue-600 text-white" : active ? "bg-white border-blue-600 text-blue-600" : "bg-white border-slate-200 text-slate-400"
                          }`}>
                            {done ? <CheckCircle2 className="w-4 h-4" /> : step.n}
                          </div>
                          <span className={`text-xs font-medium ${active ? "text-blue-600" : done ? "text-slate-600" : "text-slate-400"}`}>{step.label}</span>
                        </div>
                        {idx < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors ${done ? "bg-blue-600" : "bg-slate-200"}`} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {formStep === 1 && (
                <div className="space-y-6">
                  {!isPdfProcessed ? (
                    <div className="border-2 border-dashed border-blue-300 bg-blue-50/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center transition-all hover:bg-blue-50 h-full min-h-[350px]">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <UploadCloud className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-xl font-bold text-blue-900">Importar Edital ou Contrato</h4>
                      <p className="text-sm text-blue-700 mt-2 mb-8 max-w-md">
                        Anexe o documento original em PDF para o preenchimento automático dos dados.
                      </p>
                      <label className={`relative inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors cursor-pointer shadow-sm ${isUploadingPdf ? 'opacity-70 pointer-events-none' : ''}`}>
                        {isUploadingPdf ? (
                          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Lendo documento...</>
                        ) : "Selecionar Arquivo PDF"}
                        <input type="file" accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handlePdfUpload} disabled={isUploadingPdf} />
                      </label>
                    </div>
                  ) : (
                    <>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between animate-in fade-in duration-300">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
                          <div>
                            <h4 className="text-sm font-semibold text-emerald-900">Documento Processado e Validado</h4>
                            <p className="text-xs text-emerald-700">Preencha apenas as informações que o sistema não localizou.</p>
                          </div>
                        </div>
                        <button onClick={() => { setIsPdfProcessed(false); setForm(emptyForm()); }} className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline">
                          Enviar outro arquivo
                        </button>
                      </div>
                      <hr className="border-slate-100" />

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Número do Processo <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={form.processNumber}
                            onChange={(e) => setField("processNumber", e.target.value)}
                            readOnly={lockedFields.processNumber}
                            placeholder="Preencha o número"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${lockedFields.processNumber ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Modalidade</label>
                          <input
                            type="text"
                            value={form.modality}
                            onChange={(e) => setField("modality", e.target.value)}
                            readOnly={lockedFields.modality}
                            placeholder="Preencha a modalidade"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${lockedFields.modality ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Objeto da Licitação</label>
                          <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setField("description", e.target.value)}
                            readOnly={lockedFields.description}
                            placeholder="Descreva o objeto da licitação"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${lockedFields.description ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1"><CalendarDays className="w-3.5 h-3.5 inline mr-1 text-slate-400" /> Data / Vigência <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={form.validity}
                            onChange={(e) => setField("validity", e.target.value)}
                            readOnly={lockedFields.validity}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${lockedFields.validity ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {formStep === 2 && (
                <div className="space-y-5">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 mb-6">
                    <Building2 className="w-5 h-5 text-slate-400" />
                    <div>
                      <h4 className="text-sm font-medium text-slate-700">Validação de Credor</h4>
                      <p className="text-xs text-slate-500">Confirme ou preencha os dados do fornecedor.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.supplier}
                        onChange={(e) => setField("supplier", e.target.value)}
                        readOnly={lockedFields.supplier}
                        placeholder="Nome da empresa fornecedora"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${lockedFields.supplier ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.cnpj}
                        onChange={(e) => setField("cnpj", cnpjMask(e.target.value))}
                        readOnly={lockedFields.cnpj}
                        placeholder="00.000.000/0001-00"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${lockedFields.cnpj ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                      />
                      {form.cnpj && form.cnpj.replace(/\D/g, "").length < 14 && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> CNPJ incompleto.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {formStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" /> Secretarias Beneficiárias
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">Selecione quais secretarias terão acesso administrativo a este contrato.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dbSecretariats.length === 0 ? (
                      <p className="text-sm text-slate-500 col-span-2">Buscando secretarias no banco de dados...</p>
                    ) : (
                      dbSecretariats.map((sec) => {
                        const checked = form.secretariats.includes(sec.name);
                        return (
                          <label key={sec.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${checked ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                              {checked && <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${checked ? "text-blue-900" : "text-slate-800"}`}>{sec.name}</p>
                            </div>
                            <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleSecretariat(sec.name)} />
                          </label>
                        );
                      })
                    )}
                  </div>
                  {form.secretariats.length === 0 && <p className="text-xs text-red-500 mt-1">Selecione ao menos uma secretaria.</p>}
                </div>
              )}

              {formStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2"><Package className="w-4 h-4 text-blue-600" /> Itens do Contrato</h3>
                    <button onClick={addItem} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                      <Plus className="w-4 h-4" /> Adicionar Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.items.map((item, idx) => (
                      <div key={item._key} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item {idx + 1}</span>
                          {form.items.length > 1 && (
                            <button onClick={() => removeItem(item._key)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Descrição <span className="text-red-500">*</span></label>
                            <input type="text" value={item.name} onChange={(e) => updateItem(item._key, "name", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
                            <input type="text" value={item.brand} onChange={(e) => updateItem(item._key, "brand", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Unidade <span className="text-red-500">*</span></label>
                            <select value={item.unit} onChange={(e) => updateItem(item._key, "unit", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Valor Unitário (R$) <span className="text-red-500">*</span></label>
                            <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(item._key, "unitPrice", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Qtd Total <span className="text-red-500">*</span></label>
                            <input type="number" min="1" value={item.totalQuantity} onChange={(e) => updateItem(item._key, "totalQuantity", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                          </div>
                          <div className="flex items-end">
                            <div className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm">
                              <span className="text-xs text-slate-500 block">Total Item</span>
                              <span className="font-semibold text-slate-800">{fmt.format(Number(item.unitPrice || 0) * Number(item.totalQuantity || 0))}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end pt-2 border-t border-slate-200">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Valor Global do Contrato</p>
                      <p className="text-xl font-bold text-slate-900">{fmt.format(totalContractValue)}</p>
                    </div>
                  </div>
                </div>
              )}

              {formStep === 5 && !submitted && (
                <div className="space-y-6">
                  <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    Revisão Final
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Contrato</p>
                      <p className="text-sm font-semibold text-slate-900">{form.processNumber || "Não listado"}</p>
                      <p className="text-sm text-slate-600">{form.modality || "Não listada"}</p>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">{form.description}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Vigência até {form.validity ? format(parseISO(form.validity), "dd/MM/yyyy") : "Não listada"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Fornecedor</p>
                      <p className="text-sm font-semibold text-slate-900">{form.supplier || "Não listado"}</p>
                      <p className="text-sm text-slate-500">{form.cnpj || "Não listado"}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Secretarias</p>
                      <div className="flex flex-wrap gap-1.5">
                        {form.secretariats.map((s) => (
                          <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Valor Global</p>
                      <p className="text-xl font-bold text-slate-900">{fmt.format(totalContractValue)}</p>
                      <p className="text-xs text-slate-400 mt-1">{form.items.length} {form.items.length === 1 ? "item" : "itens"} no contrato</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Itens Cadastrados</p>
                    </div>
                    <table className="min-w-full text-sm divide-y divide-slate-100">
                      <thead>
                        <tr className="text-slate-400 text-xs">
                          <th className="px-4 py-2 text-left font-medium">Item</th>
                          <th className="px-4 py-2 text-left font-medium">Unidade</th>
                          <th className="px-4 py-2 text-right font-medium">Valor Unit.</th>
                          <th className="px-4 py-2 text-right font-medium">Qtd.</th>
                          <th className="px-4 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {form.items.map((it) => (
                          <tr key={it._key} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {it.name}{it.brand ? ` - ${it.brand}` : ""}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{it.unit}</td>
                            <td className="px-4 py-2.5 text-right text-slate-700">{fmt.format(Number(it.unitPrice))}</td>
                            <td className="px-4 py-2.5 text-right text-slate-700">{it.totalQuantity}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                              {fmt.format(Number(it.unitPrice) * Number(it.totalQuantity))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {submitted && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Licitação cadastrada!</h3>
                    <p className="text-sm text-slate-500 mt-1">O contrato foi adicionado à lista com sucesso.</p>
                  </div>
                  <button onClick={closeForm} className="mt-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors">
                    Fechar
                  </button>
                </div>
              )}
            </div>

            {!submitted && (
              <div className="px-8 py-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between">
                <span className="text-xs text-slate-400"><span className="text-red-500">*</span> Campos obrigatórios</span>
                <div className="flex gap-3">
                  <button onClick={closeForm} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                  {formStep < 5 ? (
                    <button
                      onClick={() => setFormStep((s) => s + 1)}
                      disabled={(formStep === 1 && !step1Valid) || (formStep === 2 && !step2Valid) || (formStep === 3 && !step3Valid) || (formStep === 4 && !step4Valid)}
                      className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
                    >
                      Próxima Etapa
                    </button>
                  ) : (
                    <button onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm">
                      Cadastrar Licitação
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}