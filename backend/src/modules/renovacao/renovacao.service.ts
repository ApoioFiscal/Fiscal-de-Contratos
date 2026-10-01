import { StatusTermoRenovacao } from "@prisma/client";
import { TermoRenovacaoRepository } from "./renovacao.repository";
import {
  AtualizarTermoRenovacaoInput,
  CreateTermoRenovacaoInput,
} from "../../common/schemas";
import { NotFoundError, ValidationError } from "../../common/errors";

export interface UsuarioTermo {
  id: number;
}

export class TermoRenovacaoService {
  constructor(private repository: TermoRenovacaoRepository) {}

  async emitir(user: UsuarioTermo, input: CreateTermoRenovacaoInput) {
    const contratoExiste = await this.repository.contratoExiste(input.idContrato);

    if (!contratoExiste) {
      throw new NotFoundError("Contrato");
    }

    return this.repository.create({
      idContrato: input.idContrato,
      idUsuarioEmissor: user.id,
      tipo: input.tipo,
      justificativa: input.justificativa,
      novaVigenciaFim: input.novaVigenciaFim,
      percentualAcrescimo: input.percentualAcrescimo,
    });
  }

  async listar(status?: StatusTermoRenovacao) {
    return this.repository.findAll(status);
  }

  async detalhe(id: number) {
    const termo = await this.repository.findById(id);

    if (!termo) {
      throw new NotFoundError("Termo de renovação");
    }

    return termo;
  }

  async alterarStatus(user: UsuarioTermo, id: number, input: AtualizarTermoRenovacaoInput) {
    const termo = await this.repository.findById(id);

    if (!termo) {
      throw new NotFoundError("Termo de renovação");
    }

    if (input.status === StatusTermoRenovacao.RESOLVIDO && !input.acaoTomada) {
      throw new ValidationError("Informe a ação tomada pela Secretaria de Licitações");
    }

    const data = {
      status: input.status,
      parecerLicitacao: input.parecerLicitacao ?? undefined,
      acaoTomada: input.acaoTomada ?? undefined,
    };

    if (input.status === StatusTermoRenovacao.RESOLVIDO || input.status === StatusTermoRenovacao.ARQUIVADO) {
      (data as Record<string, unknown>).idUsuarioLicitacao = user.id;
      (data as Record<string, unknown>).dataResolucao = new Date();
    }

    return this.repository.update(id, data);
  }
}