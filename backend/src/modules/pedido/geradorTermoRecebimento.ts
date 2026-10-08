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

export interface ItemPedidoParaTermo {
  idItemLicitado: number;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  itemLicitado?: {
    descricao: string;
    marca?: string;
    unidade: string;
  };
}

export interface PedidoParaTermo {
  numeroPedido: string;
  contrato: { numero: string };
  setor: { nome: string } | null;
  itens: ItemPedidoParaTermo[];
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

const linhaVazia = () => new Paragraph({ spacing: { after: 120 } });

function paragrafoJustificado(texto: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [new TextRun({ text: texto, size: 22 })],
  });
}

export class GeradorTermoRecebimentoDocx {
  async gerar(
    pedido: PedidoParaTermo,
    fiscalNome: string,
    fiscalCpf?: string,
    data: Date = new Date()
  ): Promise<Buffer> {
    const oficio = `${pedido.numeroPedido.replace(/^REQ-/i, "")}/${data.getFullYear()}`;
    const pregao = pedido.contrato.numero;
    const destino = pedido.setor?.nome ?? "secretaria solicitante";
    const total = pedido.itens.reduce((sum, item) => sum + item.valorTotal, 0);

    const cabecalho = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: "TERMO DE RECEBIMENTO DE PRODUTOS", bold: true, size: 26 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: `OFÍCIO N° ${oficio}`, bold: true, size: 22 })],
      }),
      linhaVazia(),
      paragrafoJustificado(
        `Atesto que eu ${fiscalNome}, CPF ${
          fiscalCpf || "xxx.xxx.xxx-xx"
        }, representado como Fiscal de Contratos, recebeu e verificou os produtos no dia ${fmtData(
          data
        )} conforme o Pregão Eletrônico Nº ${pregao}, referente a aquisição dos itens listados abaixo para uso do ${destino}.`
      ),
    ];

    const dadosItens: Array<Array<unknown>> = [
      ["CÓDIGO", "DISCRIMINAÇÃO", "UNIDADE", "QUANTIDADE", "P.UNITÁRIO", "P. TOTAL"],
      ...pedido.itens.map((item) => [
        String(item.idItemLicitado),
        item.itemLicitado?.descricao ?? `Item ${item.idItemLicitado}`,
        item.itemLicitado?.unidade ?? "UN",
        String(item.quantidade),
        fmtMoeda.format(item.valorUnitario),
        fmtMoeda.format(item.valorTotal),
      ]),
      ["", "TOTAL", "", "", "", fmtMoeda.format(total)],
    ];

    const tabela = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: dadosItens.map(
        (linha, idx) =>
          new TableRow({
            children: linha.map(
              (celula, colIdx) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: String(celula),
                          bold: idx === 0 || (idx === dadosItens.length - 1 && colIdx === 1),
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
      tabela,
      linhaVazia(),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: "(*) Anexar notas fiscais ou recibos válidos.", size: 18, italics: true })],
      }),
      paragrafoJustificado(
        `Nestes termos, os produtos entregues está de acordo com o Pregão Eletrônico Nº ${pregao} e totalizam o valor de ${fmtMoeda.format(
          total
        )}. Declaro ainda que o produto recebido está de acordo com os padrões de qualidade aceitos por esta instituição, pelo qual concedemos a aceitabilidade, comprometendo-nos a dar a destinação final aos produtos recebidos.`
      ),
      linhaVazia(),
      new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "Fiscal de Contratos", bold: true })] }),
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: "_________________________", size: 18 })],
      }),
      new Paragraph({
        spacing: { before: 400 },
        children: [new TextRun({ text: `Marizópolis-PB, ${fmtData(data)}`, size: 20 })],
      }),
    ];

    const documento = new Document({
      sections: [{ children: [...cabecalho, ...corpo] }],
    });

    return Packer.toBuffer(documento);
  }
}