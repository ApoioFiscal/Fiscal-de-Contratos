import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

// Estrutura mínima de dados necessária para montar o contrato.
// Mudanças na shape retornada pelo repositório devem refletir aqui.
export interface ItemContratoParaGerador {
  descricao: string;
  marca: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  precoTotal: number;
}

export interface LicitacaoParaContrato {
  numero: string;
  numeroProcesso: string;
  modalidade: string;
  objeto: string;
  fornecedor: string;
  cnpjFornecedor: string;
  dataVigenciaFim: Date;
  valorTotal: number;
  setores: { setor: { nome: string } }[];
  itens: ItemContratoParaGerador[];
}

export interface GeradorContrato {
  gerar(licitacao: LicitacaoParaContrato, destinoDir: string): Promise<string>;
}

const fmtMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function fmtData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function nomeArquivo(numero: string): string {
  const seguranca = numero.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `CONTRATO-${seguranca}.docx`;
}

const linhaVazia = () => new Paragraph({ spacing: { after: 120 } });

function paragrafoRotulado(rotulo: string, valor: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: `${rotulo}: `, bold: true }),
      new TextRun({ text: valor }),
    ],
  });
}

// Implementação provisória (placeholder) baseada na lib `docx`.
// Quando o modelo oficial da Prefeitura estiver disponível, substituir
// por um motor de template (ex.: docxtemplater) mantendo a interface
// `GeradorContrato`.
export class GeradorContratoDocx implements GeradorContrato {
  async gerar(licitacao: LicitacaoParaContrato, destinoDir: string): Promise<string> {
    const cabecalho = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "PREFEITURA MUNICIPAL", bold: true, size: 32 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: "CONTRATO ADMINISTRATIVO", bold: true, size: 28 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: "MODELO TEMPORÁRIO — aguardando o modelo oficial de contrato da Prefeitura.",
            italics: true,
            size: 18,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(`Contrato nº ${licitacao.numero}`)],
      }),
      linhaVazia(),
    ];

    const identificacao = [
      paragrafoRotulado("Processo Administrativo nº", licitacao.numeroProcesso),
      paragrafoRotulado("Modalidade", licitacao.modalidade),
      paragrafoRotulado("Objeto", licitacao.objeto),
      paragrafoRotulado("Fornecedor", licitacao.fornecedor),
      paragrafoRotulado("CNPJ", licitacao.cnpjFornecedor),
      paragrafoRotulado(
        "Vigência até",
        licitacao.dataVigenciaFim ? fmtData(new Date(licitacao.dataVigenciaFim)) : "—"
      ),
      paragrafoRotulado(
        "Secretarias beneficiárias",
        licitacao.setores.map((s) => s.setor.nome).join("; ") || "—"
      ),
      linhaVazia(),
    ];

    const dadosItens: Array<Array<unknown>> = [
      ["#", "Descrição", "Marca", "Un.", "Qtde", "Preço Unit.", "Preço Total"],
      ...licitacao.itens.map((item, idx) => [
        String(idx + 1),
        item.descricao,
        item.marca || "—",
        item.unidade,
        String(item.quantidade),
        fmtMoeda.format(item.precoUnitario),
        fmtMoeda.format(item.precoTotal),
      ]),
    ];

    const tabela = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: dadosItens.map(
        (linha, idx) =>
          new TableRow({
            children: linha.map(
              (celula) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: String(celula),
                          bold: idx === 0,
                          size: 18,
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
      ),
    });

    const corpo = [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 160, after: 200 },
        children: [
          new TextRun({ text: "VALOR TOTAL: ", bold: true }),
          new TextRun({ text: fmtMoeda.format(licitacao.valorTotal), bold: true }),
        ],
      }),
      linhaVazia(),
      tabela,
      linhaVazia(),
      new Paragraph({
        spacing: { before: 600 },
        children: [new TextRun({ text: "Assinaturas:", bold: true })],
      }),
      new Paragraph({ spacing: { before: 800 }, children: [] }),
      paragrafoRotulado("Fornecedor", licitacao.fornecedor),
      new Paragraph({ spacing: { before: 800 }, children: [] }),
      paragrafoRotulado("Secretaria Municipal de Licitações", "_________________________________"),
      new Paragraph({ spacing: { before: 800 }, children: [] }),
      paragrafoRotulado("Setor de Fiscalização de Contratos", "_________________________________"),
    ];

    const documento = new Document({
      sections: [{ children: [...cabecalho, ...identificacao, ...corpo] }],
    });

    const buffer = await Packer.toBuffer(documento);
    await mkdir(destinoDir, { recursive: true });

    const filename = nomeArquivo(licitacao.numero);
    await writeFile(path.join(destinoDir, filename), buffer);
    return filename;
  }
}