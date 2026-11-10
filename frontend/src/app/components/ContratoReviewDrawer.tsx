import { useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileWarning,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  Contrato,
  ContratoItem,
  ContratoParte,
  ContratoSignatario,
  PapelParte,
  PapelSignatario,
  TipoDocumento,
} from "@/types/domain";
import {
  atualizarContrato,
  type AtualizarContratoPayload,
  type DotacaoContratoPayload,
  type ItemContratoPayload,
  type ParteContratoPayload,
  type SignatarioContratoPayload,
} from "@/services/contratos";

// ---------------------------------------------------------------------------
// Rascunhos do formulário. Os números/datas ficam como string para o usuário
// poder apagar o campo; a conversão acontece só no envio.
// ---------------------------------------------------------------------------

type ParteDraft = {
  papel: PapelParte;
  nome: string;
  documento: string;
  tipoDocumento: TipoDocumento | "";
  endereco: string;
  representanteNome: string;
  representanteCargo: string;
  representanteCpf: string;
  representanteRg: string;
  representanteOrgaoEmissorRg: string;
  representanteNacionalidade: string;
  representanteEstadoCivil: string;
  representanteProfissao: string;
  representanteEndereco: string;
};

type SignatarioDraft = {
  key: string;
  papel: PapelSignatario;
  nome: string;
  cargo: string;
  cpf: string;
  cnpj: string;
  rg: string;
  orgaoEmissorRg: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  endereco: string;
  confirmadoNoBloco: boolean;
  legivel: boolean;
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
  correcoes: string[];
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
const numero = (valor: string) => {
  const convertido = Number(valor.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : 0;
};
const numeroOuNull = (valor: string) => {
  if (!valor.trim()) return null;
  const convertido = Number(valor.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : null;
};
const dataInput = (valor: string | null) => (valor ? valor.slice(0, 10) : "");

const criarParteDraft = (
  papel: PapelParte,
  parte?: ContratoParte,
): ParteDraft => ({
  papel,
  nome: texto(parte?.nome),
  documento: texto(parte?.documento),
  tipoDocumento: parte?.tipoDocumento ?? "",
  endereco: texto(parte?.endereco),
  representanteNome: texto(parte?.representanteNome),
  representanteCargo: texto(parte?.representanteCargo),
  representanteCpf: texto(parte?.representanteCpf),
  representanteRg: texto(parte?.representanteRg),
  representanteOrgaoEmissorRg: texto(parte?.representanteOrgaoEmissorRg),
  representanteNacionalidade: texto(parte?.representanteNacionalidade),
  representanteEstadoCivil: texto(parte?.representanteEstadoCivil),
  representanteProfissao: texto(parte?.representanteProfissao),
  representanteEndereco: texto(parte?.representanteEndereco),
});

const criarSignatarioDraft = (signatario: ContratoSignatario): SignatarioDraft => ({
  key: novaChave(),
  papel: signatario.papel,
  nome: texto(signatario.nome),
  cargo: texto(signatario.cargo),
  cpf: texto(signatario.cpf),
  cnpj: texto(signatario.cnpj),
  rg: texto(signatario.rg),
  orgaoEmissorRg: texto(signatario.orgaoEmissorRg),
  nacionalidade: texto(signatario.nacionalidade),
  estadoCivil: texto(signatario.estadoCivil),
  profissao: texto(signatario.profissao),
  endereco: texto(signatario.endereco),
  confirmadoNoBloco: signatario.confirmadoNoBloco,
  legivel: signatario.legivel,
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
  correcoes: item.correcoes ?? [],
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
  correcoes: [],
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
const labelClass = "block text-xs font-medium text-slate-600 mb-1";
const botaoSecundario =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors";
const botaoPerigo =
  "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors";

function Campo({
  rotulo,
  children,
  className,
}: {
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={labelClass}>{rotulo}</span>
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

function labelSignatario(signatario: SignatarioDraft, indice: number): string {
  if (signatario.papel === "CONTRATANTE") return "Contratante (contratante assina)";
  if (signatario.papel === "CONTRATADO") return "Contratado (contratado assina)";
  return `Testemunha ${indice + 1}`;
}

export function ContratoReviewDrawer({
  contrato,
  podeConfirmar,
  onClose,
  onSaved,
}: {
  contrato: Contrato;
  podeConfirmar: boolean;
  onClose: () => void;
  onSaved: (contrato: Contrato) => void;
}) {
  const condicoes = contrato.condicoes;

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
  const [foro, setForo] = useState(texto(contrato.foro));
  const [fundamentacao, setFundamentacao] = useState(contrato.fundamentacaoLegal.join("\n"));

  const [assinaturaLocal, setAssinaturaLocal] = useState(texto(contrato.assinaturaLocal));
  const [assinaturaData, setAssinaturaData] = useState(dataInput(contrato.assinaturaData));
  const [assinaturaDigital, setAssinaturaDigital] = useState(contrato.assinaturaDigital);
  const [assinaturaPlataforma, setAssinaturaPlataforma] = useState(
    texto(contrato.assinaturaPlataforma),
  );
  const [assinaturaAssinante, setAssinaturaAssinante] = useState(
    texto(contrato.assinaturaAssinante),
  );

  const [prazoExecucaoQuantidade, setPrazoExecucaoQuantidade] = useState(
    condicoes?.prazo_execucao?.quantidade != null
      ? String(condicoes.prazo_execucao.quantidade)
      : "",
  );
  const [prazoExecucaoUnidade, setPrazoExecucaoUnidade] = useState(
    texto(condicoes?.prazo_execucao?.unidade),
  );
  const [prazoExecucaoMarco, setPrazoExecucaoMarco] = useState(
    texto(condicoes?.prazo_execucao?.marco),
  );
  const [prazoPagamentoQuantidade, setPrazoPagamentoQuantidade] = useState(
    condicoes?.prazo_pagamento?.quantidade != null
      ? String(condicoes.prazo_pagamento.quantidade)
      : "",
  );
  const [prazoPagamentoUnidade, setPrazoPagamentoUnidade] = useState(
    texto(condicoes?.prazo_pagamento?.unidade),
  );
  const [reajustePrazo, setReajustePrazo] = useState(texto(condicoes?.reajuste?.prazo));
  const [reajusteIndice, setReajusteIndice] = useState(texto(condicoes?.reajuste?.indice));

  const [partes, setPartes] = useState<ParteDraft[]>(() => {
    const porPapel = new Map(contrato.partes.map((parte) => [parte.papel, parte]));
    return (["CONTRATANTE", "CONTRATADO"] as const).map((papel) =>
      criarParteDraft(papel, porPapel.get(papel)),
    );
  });

  const [signatarios, setSignatarios] = useState<SignatarioDraft[]>(() =>
    contrato.signatarios.map(criarSignatarioDraft),
  );

  const [itens, setItens] = useState<ItemDraft[]>(() => contrato.itens.map(criarItemDraft));

  const [dotacoes, setDotacoes] = useState<DotacaoDraft[]>(() =>
    contrato.dotacoes.map(criarDotacaoDraft),
  );

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<"rascunho" | "confirmar" | null>(null);

  const atualizarParte = (papel: PapelParte, campo: keyof ParteDraft, valor: string) => {
    setPartes((atuais) =>
      atuais.map((parte) =>
        parte.papel === papel ? ({ ...parte, [campo]: valor } as ParteDraft) : parte,
      ),
    );
  };

  const atualizarSignatario = (
    key: string,
    campo: keyof SignatarioDraft,
    valor: string | boolean,
  ) => {
    setSignatarios((atuais) =>
      atuais.map((signatario) =>
        signatario.key === key
          ? ({ ...signatario, [campo]: valor } as SignatarioDraft)
          : signatario,
      ),
    );
  };

  const atualizarItem = (key: string, campo: keyof ItemDraft, valor: string) => {
    setItens((atuais) =>
      atuais.map((item) =>
        item.key === key ? ({ ...item, [campo]: valor } as ItemDraft) : item,
      ),
    );
  };

  const atualizarDotacao = (key: string, campo: keyof DotacaoDraft, valor: string) => {
    setDotacoes((atuais) =>
      atuais.map((dotacao) =>
        dotacao.key === key ? ({ ...dotacao, [campo]: valor } as DotacaoDraft) : dotacao,
      ),
    );
  };

  const montarCondicoes = (): AtualizarContratoPayload["condicoes"] => {
    const temExecucao =
      prazoExecucaoQuantidade.trim() !== "" ||
      prazoExecucaoUnidade.trim() !== "" ||
      prazoExecucaoMarco.trim() !== "";
    const temPagamento =
      prazoPagamentoQuantidade.trim() !== "" || prazoPagamentoUnidade.trim() !== "";
    const temReajuste = reajustePrazo.trim() !== "" || reajusteIndice.trim() !== "";

    if (!temExecucao && !temPagamento && !temReajuste) return null;

    return {
      prazo_execucao: temExecucao
        ? {
            quantidade: numero(prazoExecucaoQuantidade),
            unidade: prazoExecucaoUnidade.trim() || "dias",
            marco: textoOuNull(prazoExecucaoMarco),
          }
        : null,
      prazo_pagamento: temPagamento
        ? {
            quantidade: numero(prazoPagamentoQuantidade),
            unidade: prazoPagamentoUnidade.trim() || "dias",
          }
        : null,
      reajuste: temReajuste
        ? {
            prazo: textoOuNull(reajustePrazo),
            indice: textoOuNull(reajusteIndice),
          }
        : null,
    };
  };

  const montarPayload = (confirmar: boolean): AtualizarContratoPayload => {
    const partesPayload: ParteContratoPayload[] = partes.map((parte) => ({
      papel: parte.papel,
      nome: textoOuNull(parte.nome),
      documento: textoOuNull(parte.documento),
      tipoDocumento: parte.tipoDocumento || null,
      endereco: textoOuNull(parte.endereco),
      representanteNome: textoOuNull(parte.representanteNome),
      representanteCargo: textoOuNull(parte.representanteCargo),
      representanteCpf: textoOuNull(parte.representanteCpf),
      representanteRg: textoOuNull(parte.representanteRg),
      representanteOrgaoEmissorRg: textoOuNull(parte.representanteOrgaoEmissorRg),
      representanteNacionalidade: textoOuNull(parte.representanteNacionalidade),
      representanteEstadoCivil: textoOuNull(parte.representanteEstadoCivil),
      representanteProfissao: textoOuNull(parte.representanteProfissao),
      representanteEndereco: textoOuNull(parte.representanteEndereco),
    }));

    const signatariosPayload: SignatarioContratoPayload[] = signatarios.map((signatario, ordem) => ({
      papel: signatario.papel,
      ordem,
      nome: textoOuNull(signatario.nome),
      cargo: textoOuNull(signatario.cargo),
      cpf: textoOuNull(signatario.cpf),
      cnpj: textoOuNull(signatario.cnpj),
      rg: textoOuNull(signatario.rg),
      orgaoEmissorRg: textoOuNull(signatario.orgaoEmissorRg),
      nacionalidade: textoOuNull(signatario.nacionalidade),
      estadoCivil: textoOuNull(signatario.estadoCivil),
      profissao: textoOuNull(signatario.profissao),
      endereco: textoOuNull(signatario.endereco),
      confirmadoNoBloco: signatario.confirmadoNoBloco,
      legivel: signatario.legivel,
    }));

    const itensPayload: ItemContratoPayload[] = itens.map((item) => ({
      id: item.id,
      codigo: numeroOuNull(item.codigo),
      descricao: item.descricao.trim(),
      unidade: item.unidade.trim(),
      unidadeOriginal: textoOuNull(item.unidadeOriginal),
      quantidade: numero(item.quantidade),
      valorUnitario: numero(item.valorUnitario),
      valorTotal: item.valorTotal.trim() ? numero(item.valorTotal) : undefined,
      correcoes: item.correcoes,
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
      valorTotal: numeroOuNull(valorTotal),
      vigenciaInicio: textoOuNull(vigenciaInicio),
      vigenciaFim: textoOuNull(vigenciaFim),
      vigenciaFimCalculada: contrato.vigenciaFimCalculada,
      vigenciaTrecho: contrato.vigenciaTrecho,
      foro: textoOuNull(foro),
      assinaturaLocal: textoOuNull(assinaturaLocal),
      assinaturaData: textoOuNull(assinaturaData),
      assinaturaDigital,
      assinaturaPlataforma: textoOuNull(assinaturaPlataforma),
      assinaturaAssinante: textoOuNull(assinaturaAssinante),
      fundamentacaoLegal: fundamentacao
        .split("\n")
        .map((linha) => linha.trim())
        .filter(Boolean),
      condicoes: montarCondicoes(),
      partes: partesPayload,
      signatarios: signatariosPayload,
      itens: itensPayload,
      dotacoes: dotacoesPayload,
      confirmar,
    };
  };

  const validar = (confirmar: boolean): string | null => {
    if (!numero.trim()) return "Informe o número do contrato.";
    if (confirmar && itens.length === 0) {
      return "Inclua pelo menos um item antes de confirmar o contrato.";
    }
    const itemInvalido = itens.find((item) => !item.descricao.trim() || !item.unidade.trim());
    if (itemInvalido) return "Todo item precisa de descrição e unidade.";
    const dotacaoInvalida = dotacoes.find(
      (dotacao) => !dotacao.unidadeCodigo.trim() || !dotacao.unidade.trim(),
    );
    if (dotacaoInvalida) return "Toda dotação precisa de código e unidade.";
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
      aria-label={`Revisar contrato ${contrato.numero}`}
    >
      <div className="w-full max-w-3xl h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Revisar contrato {contrato.numero}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Confira e corrija os dados lidos do PDF. O que você salvar aqui substitui os dados
              importados; os avisos do OCR continuam registrados como histórico.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar revisão"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {erro && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />
              {erro}
            </div>
          )}

          {contrato.status !== "RASCUNHO" && (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />
              Este contrato já foi confirmado e está em modo somente leitura.
            </div>
          )}

          {contrato.avisos.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-800">
                <FileWarning className="w-4 h-4" />
                <p className="text-sm font-semibold">Avisos do OCR (histórico)</p>
              </div>
              <ul className="mt-2 text-xs text-amber-700 space-y-1">
                {contrato.avisos.map((aviso, indice) => (
                  <li key={indice}>• {aviso}</li>
                ))}
              </ul>
            </div>
          )}

          <Secao
            titulo="Dados gerais"
            descricao="Número, objeto, valor e vigência do contrato."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo rotulo="Número do contrato *">
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className={inputClass}
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
              <Campo rotulo="Valor total (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Foro">
                <input value={foro} onChange={(e) => setForo(e.target.value)} className={inputClass} />
              </Campo>
              <Campo rotulo="Vigência — início">
                <input
                  type="date"
                  value={vigenciaInicio}
                  onChange={(e) => setVigenciaInicio(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Vigência — fim">
                <input
                  type="date"
                  value={vigenciaFim}
                  onChange={(e) => setVigenciaFim(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Fundamentação legal (uma por linha)" className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={fundamentacao}
                  onChange={(e) => setFundamentacao(e.target.value)}
                  className={`${inputClass} resize-none`}
                />
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Assinatura" descricao="Local, data e assinatura digital do PDF.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo rotulo="Local">
                <input
                  value={assinaturaLocal}
                  onChange={(e) => setAssinaturaLocal(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Data">
                <input
                  type="date"
                  value={assinaturaData}
                  onChange={(e) => setAssinaturaData(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Plataforma de assinatura digital">
                <input
                  value={assinaturaPlataforma}
                  onChange={(e) => setAssinaturaPlataforma(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Assinante digital">
                <input
                  value={assinaturaAssinante}
                  onChange={(e) => setAssinaturaAssinante(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={assinaturaDigital}
                  onChange={(e) => setAssinaturaDigital(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                O PDF possui assinatura digital detectada
              </label>
            </div>
          </Secao>

          <Secao
            titulo="Partes"
            descricao="Contratante e contratado, com a qualificação de quem assina por cada parte."
          >
            <div className="space-y-4">
              {partes.map((parte) => (
                <div key={parte.papel} className="border border-slate-200 rounded-xl p-4 space-y-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {parte.papel === "CONTRATANTE" ? "Contratante" : "Contratado"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Campo rotulo="Nome / razão social">
                      <input
                        value={parte.nome}
                        onChange={(e) => atualizarParte(parte.papel, "nome", e.target.value)}
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Documento (CNPJ/CPF)">
                      <input
                        value={parte.documento}
                        onChange={(e) => atualizarParte(parte.papel, "documento", e.target.value)}
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Tipo do documento">
                      <select
                        value={parte.tipoDocumento}
                        onChange={(e) =>
                          atualizarParte(parte.papel, "tipoDocumento", e.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="">Não informado</option>
                        <option value="CNPJ">CNPJ</option>
                        <option value="CPF">CPF</option>
                      </select>
                    </Campo>
                    <Campo rotulo="Endereço">
                      <input
                        value={parte.endereco}
                        onChange={(e) => atualizarParte(parte.papel, "endereco", e.target.value)}
                        className={inputClass}
                      />
                    </Campo>
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-600">Representante legal</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Campo rotulo="Nome">
                        <input
                          value={parte.representanteNome}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteNome", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Cargo">
                        <input
                          value={parte.representanteCargo}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteCargo", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="CPF">
                        <input
                          value={parte.representanteCpf}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteCpf", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="RG">
                        <input
                          value={parte.representanteRg}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteRg", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Órgão emissor do RG">
                        <input
                          value={parte.representanteOrgaoEmissorRg}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteOrgaoEmissorRg", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Nacionalidade">
                        <input
                          value={parte.representanteNacionalidade}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteNacionalidade", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Estado civil">
                        <input
                          value={parte.representanteEstadoCivil}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteEstadoCivil", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Profissão">
                        <input
                          value={parte.representanteProfissao}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteProfissao", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Endereço" className="sm:col-span-2">
                        <input
                          value={parte.representanteEndereco}
                          onChange={(e) =>
                            atualizarParte(parte.papel, "representanteEndereco", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Secao>

          <Secao
            titulo="Signatários"
            descricao="Quem assinou o PDF. Preencha as testemunhas que o OCR não conseguiu ler."
          >
            <div className="space-y-4">
              {signatarios.map((signatario, indice) => (
                <div key={signatario.key} className="border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {labelSignatario(signatario, indice)}
                      </p>
                      {!signatario.legivel && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800">
                          OCR não leu
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSignatarios((atuais) =>
                          atuais.filter((atual) => atual.key !== signatario.key),
                        )
                      }
                      className={botaoPerigo}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo rotulo="Papel">
                      <select
                        value={signatario.papel}
                        onChange={(e) =>
                          atualizarSignatario(
                            signatario.key,
                            "papel",
                            e.target.value as PapelSignatario,
                          )
                        }
                        className={inputClass}
                      >
                        <option value="CONTRATANTE">Contratante</option>
                        <option value="CONTRATADO">Contratado</option>
                        <option value="TESTEMUNHA">Testemunha</option>
                      </select>
                    </Campo>
                    <Campo rotulo="Nome">
                      <input
                        value={signatario.nome}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "nome", e.target.value)
                        }
                        className={inputClass}
                        aria-label={
                          signatario.papel === "TESTEMUNHA"
                            ? `Nome da testemunha ${
                                signatarios
                                  .slice(0, indice + 1)
                                  .filter((s) => s.papel === "TESTEMUNHA").length
                              }`
                            : "Nome do signatário"
                        }
                      />
                    </Campo>
                    <Campo rotulo="Cargo">
                      <input
                        value={signatario.cargo}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "cargo", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="CPF">
                      <input
                        value={signatario.cpf}
                        onChange={(e) => atualizarSignatario(signatario.key, "cpf", e.target.value)}
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="CNPJ">
                      <input
                        value={signatario.cnpj}
                        onChange={(e) => atualizarSignatario(signatario.key, "cnpj", e.target.value)}
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="RG">
                      <input
                        value={signatario.rg}
                        onChange={(e) => atualizarSignatario(signatario.key, "rg", e.target.value)}
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Órgão emissor do RG">
                      <input
                        value={signatario.orgaoEmissorRg}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "orgaoEmissorRg", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Nacionalidade">
                      <input
                        value={signatario.nacionalidade}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "nacionalidade", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Estado civil">
                      <input
                        value={signatario.estadoCivil}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "estadoCivil", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Profissão">
                      <input
                        value={signatario.profissao}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "profissao", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Endereço" className="sm:col-span-2">
                      <input
                        value={signatario.endereco}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "endereco", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={signatario.confirmadoNoBloco}
                        onChange={(e) =>
                          atualizarSignatario(
                            signatario.key,
                            "confirmadoNoBloco",
                            e.target.checked,
                          )
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Confirmado no bloco de assinatura
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={signatario.legivel}
                        onChange={(e) =>
                          atualizarSignatario(signatario.key, "legivel", e.target.checked)
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Dados legíveis no PDF
                    </label>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setSignatarios((atuais) => [
                    ...atuais,
                    {
                      key: novaChave(),
                      papel: "TESTEMUNHA",
                      nome: "",
                      cargo: "",
                      cpf: "",
                      cnpj: "",
                      rg: "",
                      orgaoEmissorRg: "",
                      nacionalidade: "",
                      estadoCivil: "",
                      profissao: "",
                      endereco: "",
                      confirmadoNoBloco: false,
                      legivel: true,
                    },
                  ])
                }
                className={botaoSecundario}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar signatário
              </button>
            </div>
          </Secao>

          <Secao
            titulo="Itens"
            descricao="Confira descrição, unidade, quantidade e valores. Ao remover um item sem pedidos, ele sai do contrato."
          >
            <div className="space-y-4">
              {itens.map((item, indice) => {
                const totalSugerido = numero(item.quantidade) * numero(item.valorUnitario);
                return (
                  <div key={item.key} className="border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Item {indice + 1}
                        {item.codigo ? ` · código ${item.codigo}` : ""}
                      </p>
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
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Campo rotulo="Código">
                        <input
                          value={item.codigo}
                          onChange={(e) => atualizarItem(item.key, "codigo", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Unidade">
                        <input
                          value={item.unidade}
                          onChange={(e) => atualizarItem(item.key, "unidade", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Unidade original">
                        <input
                          value={item.unidadeOriginal}
                          onChange={(e) => atualizarItem(item.key, "unidadeOriginal", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Quantidade">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(item.key, "quantidade", e.target.value)}
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Descrição" className="col-span-2 sm:col-span-4">
                        <textarea
                          rows={2}
                          value={item.descricao}
                          onChange={(e) => atualizarItem(item.key, "descricao", e.target.value)}
                          className={`${inputClass} resize-none`}
                        />
                      </Campo>
                      <Campo rotulo="Valor unitário (R$)">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valorUnitario}
                          onChange={(e) =>
                            atualizarItem(item.key, "valorUnitario", e.target.value)
                          }
                          className={inputClass}
                        />
                      </Campo>
                      <Campo rotulo="Valor total (R$)">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.valorTotal}
                          onChange={(e) => atualizarItem(item.key, "valorTotal", e.target.value)}
                          className={inputClass}
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

                    {item.correcoes.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-[11px] font-semibold text-amber-800">
                          Correções aplicadas pelo OCR
                        </p>
                        <ul className="text-[11px] text-amber-700 mt-1 space-y-0.5">
                          {item.correcoes.map((correcao, i) => (
                            <li key={i}>• {correcao}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setItens((atuais) => [...atuais, novoItemDraft()])}
                className={botaoSecundario}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar item
              </button>
            </div>
          </Secao>

          <Secao
            titulo="Dotações orçamentárias"
            descricao="Unidades beneficiárias. O vínculo com as secretarias vem do campo Unidade."
          >
            <div className="space-y-4">
              {dotacoes.map((dotacao, indice) => (
                <div key={dotacao.key} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">Dotação {indice + 1}</p>
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
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Campo rotulo="Código da unidade *">
                      <input
                        value={dotacao.unidadeCodigo}
                        onChange={(e) =>
                          atualizarDotacao(dotacao.key, "unidadeCodigo", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Campo>
                    <Campo rotulo="Unidade *">
                      <input
                        value={dotacao.unidade}
                        onChange={(e) => atualizarDotacao(dotacao.key, "unidade", e.target.value)}
                        className={inputClass}
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
              ))}

              <button
                type="button"
                onClick={() => setDotacoes((atuais) => [...atuais, novaDotacaoDraft()])}
                className={botaoSecundario}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar dotação
              </button>
            </div>
          </Secao>

          <Secao titulo="Condições" descricao="Prazos de execução/pagamento e reajuste.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Campo rotulo="Prazo de execução — quantidade">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={prazoExecucaoQuantidade}
                  onChange={(e) => setPrazoExecucaoQuantidade(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Prazo de execução — unidade">
                <input
                  value={prazoExecucaoUnidade}
                  onChange={(e) => setPrazoExecucaoUnidade(e.target.value)}
                  placeholder="dias úteis"
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Marco do prazo">
                <input
                  value={prazoExecucaoMarco}
                  onChange={(e) => setPrazoExecucaoMarco(e.target.value)}
                  placeholder="Ordem de Fornecimento"
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Prazo de pagamento — quantidade">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={prazoPagamentoQuantidade}
                  onChange={(e) => setPrazoPagamentoQuantidade(e.target.value)}
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Prazo de pagamento — unidade">
                <input
                  value={prazoPagamentoUnidade}
                  onChange={(e) => setPrazoPagamentoUnidade(e.target.value)}
                  placeholder="dias corridos"
                  className={inputClass}
                />
              </Campo>
              <div />
              <Campo rotulo="Reajuste — prazo">
                <input
                  value={reajustePrazo}
                  onChange={(e) => setReajustePrazo(e.target.value)}
                  placeholder="um ano"
                  className={inputClass}
                />
              </Campo>
              <Campo rotulo="Reajuste — índice" className="sm:col-span-2">
                <input
                  value={reajusteIndice}
                  onChange={(e) => setReajusteIndice(e.target.value)}
                  placeholder="IPCA"
                  className={inputClass}
                />
              </Campo>
            </div>
          </Secao>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
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
              disabled={salvando !== null}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl"
            >
              {salvando === "confirmar" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Salvar e confirmar (ATIVA)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
