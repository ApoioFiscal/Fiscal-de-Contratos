import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Contrato, ContratoItem, ContratoParte, PapelParte } from "@/types/domain";
import {
  atualizarContrato,
  type AtualizarContratoPayload,
  type DotacaoContratoPayload,
  type ItemContratoPayload,
  type ParteContratoPayload,
} from "@/services/contratos";
import {
  MENSAGEM_DADOS_NAO_EXTRAIDOS,
  calcularConferenciaItens,
  listarCamposPendentes,
  podeConfirmarContrato,
  type EstadoContratoValidacao,
} from "@/services/validacaoContrato";

// ---------------------------------------------------------------------------
// Rascunhos do formulário. Números e datas ficam como string para o usuário
// poder apagar o campo; a conversão acontece só no envio.
// ---------------------------------------------------------------------------

type ParteDraft = {
  papel: PapelParte;
  nome: string;
  documento: string;
};

type ItemDraft = {
  key: string;
  id?: number;
  codigo: string;
  descricao: string;
  unidade: string;
  unidadeOriginal: string;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
};

type DotacaoDraft = {
  key: string;
  unidadeCodigo: string;
  unidade: string;
  funcionalProgramatica: string;
  acao: string;
  ficha: string;
  elementoCodigo: string;
  elementoDescricao: string;
  naturezaCodigo: string;
  natureza: string;
  complemento: string;
};

let sequencia = 0;
const novaChave = () => `revisao-${Date.now()}-${sequencia++}`;

const texto = (valor: string | null | undefined) => valor ?? "";
const textoOuNull = (valor: string) => {
  const limpo = valor.trim();
  return limpo ? limpo : null;
};
// Nomes propositalmente diferentes do estado `numero` (número do contrato):
// antes o helper se chamava `numero` e era sombreado pelo useState, o que
// quebrava a renderização da lista de itens (`numero is not a function`).
const paraNumero = (valor: string) => {
  const convertido = Number(valor.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : 0;
};
const paraNumeroOuNull = (valor: string) => {
  if (!valor.trim()) return null;
  const convertido = Number(valor.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : null;
};
const dataInput = (valor: string | null) => (valor ? valor.slice(0, 10) : "");

const criarParteDraft = (papel: PapelParte, parte?: ContratoParte): ParteDraft => ({
  papel,
  nome: texto(parte?.nome),
  documento: texto(parte?.documento),
});

const criarItemDraft = (item: ContratoItem): ItemDraft => ({
  key: novaChave(),
  id: item.id,
  codigo: item.codigo != null ? String(item.codigo) : "",
  descricao: texto(item.descricao),
  unidade: texto(item.unidade),
  unidadeOriginal: texto(item.unidadeOriginal),
  quantidade: item.quantidade != null ? String(item.quantidade) : "",
  valorUnitario: item.valorUnitario != null ? String(item.valorUnitario) : "",
  valorTotal: item.valorTotal != null ? String(item.valorTotal) : "",
});

const novoItemDraft = (): ItemDraft => ({
  key: novaChave(),
  codigo: "",
  descricao: "",
  unidade: "",
  unidadeOriginal: "",
  quantidade: "",
  valorUnitario: "",
  valorTotal: "",
});

const criarDotacaoDraft = (dotacao: Contrato["dotacoes"][number]): DotacaoDraft => ({
  key: novaChave(),
  unidadeCodigo: texto(dotacao.unidadeCodigo),
  unidade: texto(dotacao.unidade),
  funcionalProgramatica: texto(dotacao.funcionalProgramatica),
  acao: texto(dotacao.acao),
  ficha: texto(dotacao.ficha),
  elementoCodigo: texto(dotacao.elementoCodigo),
  elementoDescricao: texto(dotacao.elementoDescricao),
  naturezaCodigo: texto(dotacao.naturezaCodigo),
  natureza: texto(dotacao.natureza),
  complemento: texto(dotacao.complemento),
});

const novaDotacaoDraft = (): DotacaoDraft => ({
  key: novaChave(),
  unidadeCodigo: "",
  unidade: "",
  funcionalProgramatica: "",
  acao: "",
  ficha: "",
  elementoCodigo: "",
  elementoDescricao: "",
  naturezaCodigo: "",
  natureza: "",
  complemento: "",
});

const inputClass =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
const inputPendenteClass =
  "w-full px-3 py-2 border border-rose-400 bg-rose-50 text-rose-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500";
const campoClass = (pendente: boolean) => (pendente ? inputPendenteClass : inputClass);
const labelClass = "block text-xs font-medium text-slate-600 mb-1";
const botaoSecundario =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors";
const botaoPerigo =
  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors";

function Campo({
  rotulo,
  children,
  className,
  pendente = false,
}: {
  rotulo: string;
  children: ReactNode;
  className?: string;
  pendente?: boolean;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={`${labelClass} ${pendente ? "text-rose-700" : ""}`}>{rotulo}</span>
      {children}
    </label>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-6 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{titulo}</h3>
        {descricao && <p className="text-xs text-slate-500 mt-1">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export function ContratoReviewDrawer({
  contrato,
  podeConfirmar,
  somenteLeitura = false,
  onClose,
  onSaved,
}: {
  contrato: Contrato;
  podeConfirmar: boolean;
  /** Quando true, exibe os dados sem permitir edição (visualização). */
  somenteLeitura?: boolean;
  onClose: () => void;
  onSaved: (contrato: Contrato) => void;
}) {
  const [numero, setNumero] = useState(texto(contrato.numero));
  const [numeroProcesso, setNumeroProcesso] = useState(texto(contrato.numeroProcesso));
  const [modalidade, setModalidade] = useState(texto(contrato.modalidade));
  const [numeroModalidade, setNumeroModalidade] = useState(texto(contrato.numeroModalidade));
  const [objeto, setObjeto] = useState(texto(contrato.objeto));
  const [valorTotal, setValorTotal] = useState(
    contrato.valorTotal != null ? String(contrato.valorTotal) : "",
  );
  const [vigenciaInicio, setVigenciaInicio] = useState(dataInput(contrato.vigenciaInicio));
  const [vigenciaFim, setVigenciaFim] = useState(dataInput(contrato.vigenciaFim));

  const [partes, setPartes] = useState<ParteDraft[]>(() => {
    const porPapel = new Map(contrato.partes.map((parte) => [parte.papel, parte]));
    return (["CONTRATANTE", "CONTRATADO"] as const).map((papel) =>
      criarParteDraft(papel, porPapel.get(papel)),
    );
  });
  const [itens, setItens] = useState<ItemDraft[]>(() => contrato.itens.map(criarItemDraft));
  const [dotacoes, setDotacoes] = useState<DotacaoDraft[]>(() =>
    contrato.dotacoes.map(criarDotacaoDraft),
  );

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<"rascunho" | "confirmar" | null>(null);

  // Destaque em vermelho e bloqueio vêm do estado atual do formulário, nunca
  // de `dadosExtraidos` (que é só auditoria do OCR).
  const estadoAtual: EstadoContratoValidacao = {
    numero: textoOuNull(numero),
    valorTotal: paraNumeroOuNull(valorTotal),
    vigenciaInicio: textoOuNull(vigenciaInicio),
    vigenciaFim: textoOuNull(vigenciaFim),
    partes: partes.map((parte) => ({
      papel: parte.papel,
      nome: textoOuNull(parte.nome),
      documento: textoOuNull(parte.documento),
    })),
    itens: itens.map((item) => ({
      id: item.key,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: paraNumero(item.quantidade),
      valorUnitario: paraNumero(item.valorUnitario),
      valorTotal: paraNumeroOuNull(item.valorTotal),
    })),
    dotacoes: dotacoes.map((dotacao) => ({
      id: dotacao.key,
      unidadeCodigo: dotacao.unidadeCodigo,
      unidade: dotacao.unidade,
    })),
  };

  const pendentes = new Set(listarCamposPendentes(estadoAtual));
  const conferencia = calcularConferenciaItens(estadoAtual.itens, estadoAtual.valorTotal);
  const bloqueado = pendentes.size > 0 || conferencia !== true;
  const podeConfirmarAgora = podeConfirmar && !bloqueado && salvando === null;
  const haAviso = contrato.status === "RASCUNHO" && (contrato.avisos.length > 0 || bloqueado);

  const atualizarParte = (papel: PapelParte, campo: keyof ParteDraft, valor: string) => {
    setPartes((atuais) =>
      atuais.map((parte) =>
        parte.papel === papel ? ({ ...parte, [campo]: valor } as ParteDraft) : parte,
      ),
    );
  };

  const atualizarItem = (key: string, campo: keyof ItemDraft, valor: string) => {
    setItens((atuais) =>
      atuais.map((item) => (item.key === key ? ({ ...item, [campo]: valor } as ItemDraft) : item)),
    );
  };

  const atualizarDotacao = (key: string, campo: keyof DotacaoDraft, valor: string) => {
    setDotacoes((atuais) =>
      atuais.map((dotacao) =>
        dotacao.key === key ? ({ ...dotacao, [campo]: valor } as DotacaoDraft) : dotacao,
      ),
    );
  };

  const montarPayload = (confirmar: boolean): AtualizarContratoPayload => {
    const partesPayload: ParteContratoPayload[] = partes.map((parte) => ({
      papel: parte.papel,
      nome: textoOuNull(parte.nome),
      documento: textoOuNull(parte.documento),
    }));

    const itensPayload: ItemContratoPayload[] = itens.map((item) => ({
      id: item.id,
      codigo: paraNumeroOuNull(item.codigo),
      descricao: item.descricao.trim(),
      unidade: item.unidade.trim(),
      unidadeOriginal: textoOuNull(item.unidadeOriginal),
      quantidade: paraNumero(item.quantidade),
      valorUnitario: paraNumero(item.valorUnitario),
      valorTotal: item.valorTotal.trim() ? paraNumero(item.valorTotal) : undefined,
    }));

    const dotacoesPayload: DotacaoContratoPayload[] = dotacoes.map((dotacao) => ({
      unidadeCodigo: dotacao.unidadeCodigo.trim(),
      unidade: dotacao.unidade.trim(),
      funcionalProgramatica: textoOuNull(dotacao.funcionalProgramatica),
      acao: textoOuNull(dotacao.acao),
      ficha: textoOuNull(dotacao.ficha),
      elementoCodigo: textoOuNull(dotacao.elementoCodigo),
      elementoDescricao: textoOuNull(dotacao.elementoDescricao),
      naturezaCodigo: textoOuNull(dotacao.naturezaCodigo),
      natureza: textoOuNull(dotacao.natureza),
      complemento: textoOuNull(dotacao.complemento),
    }));

    return {
      numero: numero.trim(),
      numeroProcesso: textoOuNull(numeroProcesso),
      modalidade: textoOuNull(modalidade),
      numeroModalidade: textoOuNull(numeroModalidade),
      objeto: textoOuNull(objeto),
      valorTotal: paraNumeroOuNull(valorTotal),
      vigenciaInicio: textoOuNull(vigenciaInicio),
      vigenciaFim: textoOuNull(vigenciaFim),
      partes: partesPayload,
      itens: itensPayload,
      dotacoes: dotacoesPayload,
      confirmar,
    };
  };

  const validar = (confirmar: boolean): string | null => {
    // O Zod do backend exige descrição/unidade do item e código/unidade da
    // dotação mesmo para rascunho; avisamos aqui para não depender do 400.
    const itemInvalido = itens.find((item) => !item.descricao.trim() || !item.unidade.trim());
    if (itemInvalido) return "Todo item precisa de descrição e unidade.";
    const dotacaoInvalida = dotacoes.find(
      (dotacao) => !dotacao.unidadeCodigo.trim() || !dotacao.unidade.trim(),
    );
    if (dotacaoInvalida) return "Toda dotação precisa de código e unidade.";
    if (confirmar && bloqueado) {
      return "Revise os campos destacados em vermelho e confira os valores antes de confirmar.";
    }
    return null;
  };

  const salvar = async (confirmar: boolean) => {
    const problema = validar(confirmar);
    if (problema) {
      setErro(problema);
      return;
    }

    setErro(null);
    setSalvando(confirmar ? "confirmar" : "rascunho");
    try {
      const atualizado = await atualizarContrato(contrato.id, montarPayload(confirmar));
      onSaved(atualizado);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a revisão.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end"
      role="dialog"
      aria-label={
        somenteLeitura
          ? `Dados do contrato ${contrato.numero}`
          : `Revisar contrato ${contrato.numero}`
      }
    >
      <div className="w-full max-w-3xl h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {somenteLeitura
                ? `Dados do contrato ${contrato.numero}`
                : `Revisar contrato ${contrato.numero}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {somenteLeitura
                ? "Dados importados do PDF, em modo somente leitura."
                : "Confira e corrija os dados lidos do PDF. Os campos em vermelho precisam ser revisados antes de salvar."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={somenteLeitura ? "Fechar visualização" : "Fechar revisão"}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <fieldset
          disabled={somenteLeitura}
          className="flex-1 min-w-0 overflow-y-auto px-6 py-5 space-y-6 [&_input:disabled]:bg-slate-50 [&_input:disabled]:text-slate-700 [&_input:disabled]:border-slate-200 [&_input:disabled]:cursor-default [&_textarea:disabled]:bg-slate-50 [&_textarea:disabled]:text-slate-700 [&_textarea:disabled]:border-slate-200"
        >
          {erro && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />
              {erro}
            </div>
          )}

          {contrato.status !== "RASCUNHO" && !somenteLeitura && (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />
              Este contrato já foi confirmado e está em modo somente leitura.
            </div>
          )}

          {haAviso && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {MENSAGEM_DADOS_NAO_EXTRAIDOS}
            </div>
          )}

          <Secao titulo="Dados gerais" descricao="Identificação, objeto, valor e vigência.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo rotulo="Número do contrato *" pendente={pendentes.has("numero")}>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className={campoClass(pendentes.has("numero"))}
                  aria-label="Número do contrato"
                />
              </Campo>
              <Campo rotulo="Número do processo">
                <input
                  value={numeroProcesso}
                  onChange={(e) => setNumeroProcesso(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Modalidade">
                <input
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Número da modalidade">
                <input
                  value={numeroModalidade}
                  onChange={(e) => setNumeroModalidade(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Objeto" className="sm:col-span-2">
                <textarea
                  rows={4}
                  value={objeto}
                  onChange={(e) => setObjeto(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </Campo>
              <Campo rotulo="Valor total (R$) *" pendente={pendentes.has("valorTotal")}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  className={campoClass(pendentes.has("valorTotal"))}
                />
              </Campo>
              <Campo
                rotulo="Vigência — início *"
                pendente={pendentes.has("vigenciaInicio")}
              >
                <input
                  type="date"
                  value={vigenciaInicio}
                  onChange={(e) => setVigenciaInicio(e.target.value)}
                  className={campoClass(pendentes.has("vigenciaInicio"))}
                />
              </Campo>
              <Campo rotulo="Vigência — fim *" pendente={pendentes.has("vigenciaFim")}>
                <input
                  type="date"
                  value={vigenciaFim}
                  onChange={(e) => setVigenciaFim(e.target.value)}
                  className={campoClass(pendentes.has("vigenciaFim"))}
                />
              </Campo>
            </div>
            {conferencia === false && (
              <p className="text-xs text-rose-700">
                A soma dos itens não confere com o valor total do contrato.
              </p>
            )}
          </Secao>

          <Secao titulo="Partes" descricao="Contratante e contratado lidos do PDF.">
            <div className="space-y-4">
              {partes.map((parte) => {
                const chaveNome = `parte.${parte.papel}.nome`;
                const chaveDocumento = `parte.${parte.papel}.documento`;
                return (
                  <div key={parte.papel} className="border border-slate-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">
                      {parte.papel === "CONTRATANTE" ? "Contratante" : "Contratado"}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Campo
                        rotulo="Nome / razão social *"
                        pendente={pendentes.has(chaveNome)}
                      >
                        <input
                          value={parte.nome}
                          onChange={(e) => atualizarParte(parte.papel, "nome", e.target.value)}
                          className={campoClass(pendentes.has(chaveNome))}
                        />
                      </Campo>
                      <Campo
                        rotulo="Documento (CNPJ/CPF) *"
                        pendente={pendentes.has(chaveDocumento)}
                      >
                        <input
                          value={parte.documento}
                          onChange={(e) => atualizarParte(parte.papel, "documento", e.target.value)}
                          className={campoClass(pendentes.has(chaveDocumento))}
                        />
                      </Campo>
                    </div>
                  </div>
                );
              })}
            </div>
          </Secao>

          <Secao
            titulo="Itens"
            descricao="Confira descrição, unidade, quantidade e valores."
          >
            <div className="space-y-4">
              {itens.map((item, indice) => {
                const totalSugerido = paraNumero(item.quantidade) * paraNumero(item.valorUnitario);
                const id = `item:${item.key}`;
                const pendente = (campo: string) => pendentes.has(`${id}.${campo}`);
                return (
                  <div key={item.key} className="border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Item {indice + 1}
                        {item.codigo ? ` · código ${item.codigo}` : ""}
                      </p>
                      {!somenteLeitura && (
                        <button
                          type="button"
                          onClick={() =>
                            setItens((atuais) => atuais.filter((atual) => atual.key !== item.key))
                          }
                          className={botaoPerigo}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Campo rotulo="Código">
                        <input
                          value={item.codigo}
                          onChange={(e) => atualizarItem(item.key, "codigo", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Unidade *" pendente={pendente("unidade")}>
                        <input
                          value={item.unidade}
                          onChange={(e) => atualizarItem(item.key, "unidade", e.target.value)}
                          className={campoClass(pendente("unidade"))}
                        />
                      </Campo>
                      <Campo rotulo="Quantidade *" pendente={pendente("quantidade")}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(item.key, "quantidade", e.target.value)}
                          className={campoClass(pendente("quantidade"))}
                        />
                      </Campo>
                      <Campo
                        rotulo="Descrição *"
                        className="col-span-2 sm:col-span-4"
                        pendente={pendente("descricao")}
                      >
                        <textarea
                          rows={2}
                          value={item.descricao}
                          onChange={(e) => atualizarItem(item.key, "descricao", e.target.value)}
                          className={`${campoClass(pendente("descricao"))} resize-none`}
                        />
                      </Campo>
                      <Campo
                        rotulo="Valor unitário (R$) *"
                        pendente={pendente("valorUnitario")}
                      >
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valorUnitario}
                          onChange={(e) =>
                            atualizarItem(item.key, "valorUnitario", e.target.value)
                          }
                          className={campoClass(pendente("valorUnitario"))}
                        />
                      </Campo>
                      <Campo rotulo="Valor total (R$) *" pendente={pendente("valorTotal")}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valorTotal}
                          onChange={(e) => atualizarItem(item.key, "valorTotal", e.target.value)}
                          className={campoClass(pendente("valorTotal"))}
                        />
                      </Campo>
                      <div className="col-span-2 flex items-end pb-2">
                        <p className="text-xs text-slate-500">
                          Sugerido (qtd × unitário):{" "}
                          <span className="font-medium text-slate-700">
                            {totalSugerido.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => setItens((atuais) => [...atuais, novoItemDraft()])}
                  className={botaoSecundario}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar item
                </button>
              )}
            </div>
          </Secao>

          <Secao
            titulo="Dotações orçamentárias"
            descricao="Unidades beneficiárias. O vínculo com as secretarias vem do campo Unidade."
          >
            <div className="space-y-4">
              {dotacoes.map((dotacao, indice) => {
                const id = `dotacao:${dotacao.key}`;
                const pendente = (campo: string) => pendentes.has(`${id}.${campo}`);
                return (
                  <div key={dotacao.key} className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">Dotação {indice + 1}</p>
                      {!somenteLeitura && (
                        <button
                          type="button"
                          onClick={() =>
                            setDotacoes((atuais) =>
                              atuais.filter((atual) => atual.key !== dotacao.key),
                            )
                          }
                          className={botaoPerigo}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Campo
                        rotulo="Código da unidade *"
                        pendente={pendente("unidadeCodigo")}
                      >
                        <input
                          value={dotacao.unidadeCodigo}
                          onChange={(e) =>
                            atualizarDotacao(dotacao.key, "unidadeCodigo", e.target.value)
                          }
                          className={campoClass(pendente("unidadeCodigo"))}
                        />
                      </Campo>
                      <Campo rotulo="Unidade *" pendente={pendente("unidade")}>
                        <input
                          value={dotacao.unidade}
                          onChange={(e) => atualizarDotacao(dotacao.key, "unidade", e.target.value)}
                          className={campoClass(pendente("unidade"))}
                        />
                      </Campo>
                      <Campo rotulo="Funcional programática">
                        <input
                          value={dotacao.funcionalProgramatica}
                          onChange={(e) =>
                            atualizarDotacao(dotacao.key, "funcionalProgramatica", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Ação">
                        <input
                          value={dotacao.acao}
                          onChange={(e) => atualizarDotacao(dotacao.key, "acao", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Ficha">
                        <input
                          value={dotacao.ficha}
                          onChange={(e) => atualizarDotacao(dotacao.key, "ficha", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Código do elemento">
                        <input
                          value={dotacao.elementoCodigo}
                          onChange={(e) =>
                            atualizarDotacao(dotacao.key, "elementoCodigo", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Descrição do elemento">
                        <input
                          value={dotacao.elementoDescricao}
                          onChange={(e) =>
                            atualizarDotacao(dotacao.key, "elementoDescricao", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Código da natureza">
                        <input
                          value={dotacao.naturezaCodigo}
                          onChange={(e) =>
                            atualizarDotacao(dotacao.key, "naturezaCodigo", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Natureza">
                        <input
                          value={dotacao.natureza}
                          onChange={(e) => atualizarDotacao(dotacao.key, "natureza", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Complemento" className="sm:col-span-2">
                        <textarea
                          rows={2}
                          value={dotacao.complemento}
                          onChange={(e) =>
                            atualizarDotacao(dotacao.key, "complemento", e.target.value)
                          }
                          className={`${inputClass} resize-none`}
                        />
                      </Campo>
                    </div>
                  </div>
                );
              })}

              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => setDotacoes((atuais) => [...atuais, novaDotacaoDraft()])}
                  className={botaoSecundario}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar dotação
                </button>
              )}
            </div>
          </Secao>
        </fieldset>

        <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
          {somenteLeitura ? (
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => void salvar(false)}
                disabled={salvando !== null}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-xl"
              >
                {salvando === "rascunho" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Salvar revisão
              </button>
              {podeConfirmar && (
                <button
                  onClick={() => void salvar(true)}
                  disabled={!podeConfirmarAgora}
                  title={
                    bloqueado
                      ? "Revise os campos destacados em vermelho e a conferência dos valores"
                      : undefined
                  }
                  className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed rounded-xl"
                >
                  {salvando === "confirmar" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Salvar e confirmar (ATIVA)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
