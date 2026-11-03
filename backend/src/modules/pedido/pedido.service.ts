import { StatusPedido } from "@prisma/client";
import path from "path";
import { existsSync, promises as fs } from "fs";
import { PedidoRepository } from "./pedido.repository";
import { CreatePedidoInput, AtualizarStatusPedidoInput } from "../../common/schemas";
import { ForbiddenError, NotFoundError, ValidationError } from "../../common/errors";
import { PerfilAcesso } from "../../common/perfil";
import { GeradorTermoRecebimentoDocx } from "./geradorTermoRecebimento";
import { gerarNumeroOrdem } from "./pedidoUtils";

const TERMOS_DIR = path.join(process.cwd(), "uploads", "termos");

interface UsuarioAutenticado {
  id: number;
  idSetor?: number;
  isAdmin?: boolean;
  nome?: string;
  perfil?: PerfilAcesso;
}

// Transições de status permitidas no ciclo do pedido.
// Compras conduz o pedido (registra compra, efetiva e informa a chegada) até
// ENTREGUE. O FCON (contratos/fiscal) faz a conferência final em ENTREGUE:
// informa a nota fiscal, as quantidades/marcas conferidas, gera o termo e
// conclui — ou devolve/cancela.
const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  [StatusPedido.PENDENTE]: [StatusPedido.CONFIRMADO, StatusPedido.CANCELADO],
  [StatusPedido.CONFIRMADO]: [StatusPedido.EFETUADO, StatusPedido.CANCELADO],
  [StatusPedido.EFETUADO]: [StatusPedido.ENTREGUE],
  [StatusPedido.ENTREGUE]: [StatusPedido.CONCLUIDO, StatusPedido.DEVOLVIDO, StatusPedido.CANCELADO],
  [StatusPedido.CONCLUIDO]: [],
  [StatusPedido.DEVOLVIDO]: [],
  [StatusPedido.CANCELADO]: [],
};

// Quem executa cada transição: Compras opera o pedido até a chegada; o FCON
// apenas confere/conclui (ou devolve/cancela) quando o pedido está ENTREGUE.
const PERFIS_POR_TRANSICAO: Record<string, PerfilAcesso[]> = {
  [`${StatusPedido.PENDENTE}->${StatusPedido.CONFIRMADO}`]: ["compras"],
  [`${StatusPedido.PENDENTE}->${StatusPedido.CANCELADO}`]: ["compras"],
  [`${StatusPedido.CONFIRMADO}->${StatusPedido.EFETUADO}`]: ["compras"],
  [`${StatusPedido.CONFIRMADO}->${StatusPedido.CANCELADO}`]: ["compras"],
  [`${StatusPedido.EFETUADO}->${StatusPedido.ENTREGUE}`]: ["compras"],
  [`${StatusPedido.ENTREGUE}->${StatusPedido.CONCLUIDO}`]: ["contratos", "fiscal"],
  [`${StatusPedido.ENTREGUE}->${StatusPedido.DEVOLVIDO}`]: ["contratos", "fiscal"],
  [`${StatusPedido.ENTREGUE}->${StatusPedido.CANCELADO}`]: ["contratos", "fiscal"],
};

export class PedidoService {
  constructor(
    private repository: PedidoRepository,
    private geradorTermo = new GeradorTermoRecebimentoDocx()
  ) {}

  private gerarNumeroPedido(quantidade: number): string {
    const proximo = quantidade + 1;
    return `REQ-${String(proximo).padStart(3, "0")}`;
  }

  private validarBeneficiaria(contrato: { setores: { idSetor: number }[] }, user: UsuarioAutenticado) {
    if (user.isAdmin) {
      return;
    }

    const eBeneficiaria = contrato.setores.some((s) => s.idSetor === user.idSetor);
    if (!eBeneficiaria) {
      throw new ForbiddenError("Seu setor não é beneficiário deste contrato");
    }
  }

  async create(user: UsuarioAutenticado, input: CreatePedidoInput) {
    const contrato = await this.repository.findContratoComSetoresEItens(input.idContrato);
    if (!contrato) {
      throw new NotFoundError("Contrato");
    }

    this.validarBeneficiaria(contrato, user);

    if (!user.idSetor) {
      throw new ValidationError("Usuário sem setor vinculado");
    }

    const itensDoPedido: { idItemLicitado: number; quantidade: number; valorUnitario: number }[] = [];
    const erros: Record<string, string> = {};

    for (const itemInput of input.itens) {
      const itemContrato = contrato.itens.find((item) => item.id === itemInput.idItemLicitado);

      if (!itemContrato) {
        erros[`itens.${itemInput.idItemLicitado}`] = "Item não pertence a este contrato";
        continue;
      }

      const comprometido = await this.repository.somarComprometido(itemInput.idItemLicitado);
      const disponivel = itemContrato.quantidade - itemContrato.consumido - comprometido;

      if (itemInput.quantidade > disponivel) {
        erros[`itens.${itemInput.idItemLicitado}`] =
          `Quantidade (${itemInput.quantidade}) excede o saldo disponível do item (${disponivel} ${itemContrato.unidade})`;
        continue;
      }

      itensDoPedido.push({
        idItemLicitado: itemInput.idItemLicitado,
        quantidade: itemInput.quantidade,
        valorUnitario: itemContrato.precoUnitario,
      });
    }

    if (itensDoPedido.length === 0 || Object.keys(erros).length > 0) {
      throw new ValidationError("Pedido não pode ser registrado", erros);
    }

    const totalPedidos = await this.repository.countPedidos();
    const numeroPedido = this.gerarNumeroPedido(totalPedidos);

    return this.repository.create(
      {
        idContrato: input.idContrato,
        idUsuarioCriador: user.id,
        idSetorCriador: user.idSetor,
        dataPrevistaEntrega: input.dataPrevistaEntrega,
        observacao: input.observacao,
      },
      itensDoPedido,
      numeroPedido
    );
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findBySetor(idSetor: number) {
    return this.repository.findBySetor(idSetor);
  }

  async findById(id: number) {
    const pedido = await this.repository.findById(id);
    if (!pedido) {
      throw new NotFoundError("Pedido");
    }
    return pedido;
  }

  async atualizarStatus(id: number, user: UsuarioAutenticado, input: AtualizarStatusPedidoInput) {
    const pedido = await this.repository.findById(id);
    if (!pedido) {
      throw new NotFoundError("Pedido");
    }

    if (input.status === pedido.status) {
      throw new ValidationError(`O pedido já está ${input.status.toLowerCase()}`);
    }

    const permitidos = TRANSICOES[pedido.status] ?? [];
    if (!permitidos.includes(input.status)) {
      throw new ValidationError(
        `Transição inválida de "${pedido.status}" para "${input.status}" no ciclo do pedido`
      );
    }

    const perfisPermitidos = PERFIS_POR_TRANSICAO[`${pedido.status}->${input.status}`] ?? [];
    if (!user.perfil || !perfisPermitidos.includes(user.perfil)) {
      throw new ForbiddenError("Seu perfil não pode executar esta etapa do pedido");
    }

    let dados = { ...input };
    let arquivoTermo: string | undefined;

    if (input.status === StatusPedido.CONFIRMADO) {
      const totalOrdens = await this.repository.countOrdensPorSetor(pedido.idSetorCriador);
      dados = { ...dados, numeroOrdem: gerarNumeroOrdem(pedido.setor?.sigla, totalOrdens + 1) };
    }

    if (input.status === StatusPedido.CONCLUIDO) {
      const cpf = (input.cpf ?? "").replace(/\D/g, "");
      if (cpf.length !== 11) {
        throw new ValidationError("Informe o CPF do fiscal (11 dígitos) para gerar o termo de recebimento");
      }

      // O termo usa as quantidades conferidas na nota fiscal (o que de fato
      // chegou); se a NF ainda não foi lançada, cai para a quantidade pedida.
      const itensNota = pedido.notasFiscais?.[0]?.itens ?? [];
      const itensTermo = pedido.itens.map((item) => {
        const conferido = itensNota.find((notaItem) => notaItem.idItemLicitado === item.idItemLicitado);
        const quantidade = conferido?.quantidade ?? item.quantidade;
        return { ...item, quantidade, valorTotal: item.valorUnitario * quantidade };
      });

      const buffer = await this.geradorTermo.gerar(
        {
          numeroPedido: pedido.numeroPedido,
          contrato: { numero: pedido.contrato.numero },
          setor: pedido.setor ? { nome: pedido.setor.nome } : null,
          itens: itensTermo,
        },
        user.nome || "Fiscal de Contratos",
        cpf
      );

      const filename = `TERMO-RECEBIMENTO-${pedido.numeroPedido.replace(/[^a-zA-Z0-9-_]/g, "_")}.docx`;
      await fs.mkdir(TERMOS_DIR, { recursive: true });
      await fs.writeFile(path.join(TERMOS_DIR, filename), buffer);
      arquivoTermo = filename;
    }

    return this.repository.updateStatus(id, input.status, dados, user.id, arquivoTermo);
  }

  async registrarAviso(id: number, user: UsuarioAutenticado, mensagem: string) {
    const pedido = await this.repository.findById(id);
    if (!pedido) {
      throw new NotFoundError("Pedido");
    }

    return this.repository.registrarAviso(id, user.id, mensagem);
  }

  async obterArquivoTermo(id: number) {
    const pedido = await this.repository.findById(id);
    if (!pedido) {
      throw new NotFoundError("Pedido");
    }
    if (!pedido.arquivoTermo) {
      throw new NotFoundError("Termo de recebimento");
    }

    const caminho = path.join(TERMOS_DIR, pedido.arquivoTermo);
    if (!existsSync(caminho)) {
      throw new NotFoundError("Arquivo do termo de recebimento");
    }

    return { caminho, filename: pedido.arquivoTermo };
  }
}