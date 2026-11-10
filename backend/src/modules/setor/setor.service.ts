import { SetorRepository } from "./setor.repository";
import { CreateSetorInput, UpdateSetorInput } from "../../common/schemas";
import { DuplicateDataError, ForbiddenError, NotFoundError, ValidationError } from "../../common/errors";
import { ehSetorRaiz, NOMES_SETORES_RAIZ, SIGLAS_SETORES_RAIZ } from "../../common/setores";

export class SetorService {
  constructor(private repository: SetorRepository) {}

  async create(input: CreateSetorInput) {
    const siglaJaExiste = await this.repository.findBySigla(input.sigla);
    if (siglaJaExiste) {
      throw new DuplicateDataError("Sigla");
    }

    return this.repository.create(input);
  }

  async update(id: number, input: UpdateSetorInput){
    const setor = await this.repository.findById(id)

    if(!setor){
      throw new NotFoundError("Setor não encontrado")
    }

    await this.repository.update(id, input)
  }

  async findAll() {
    return this.repository.findAll();
  }

  async findById(id: number) {
    const setor = await this.repository.findById(id);
    if (!setor) {
      throw new NotFoundError("Setor");
    }
    return setor;
  }

  async deleteById(id: number) {
    const setor = await this.repository.findById(id)

    if(!setor){
      throw new NotFoundError("Setor não encontrado")
    }

    // Setores raízes (Gabinete, Licitações, Fiscalização e Compras) são
    // estruturais: só o responsável vinculado pode ser alterado.
    if (ehSetorRaiz(setor.sigla)) {
      throw new ForbiddenError(
        `O setor ${setor.sigla} é um setor raiz do sistema e não pode ser excluído. ` +
          `Setores raízes: ${SIGLAS_SETORES_RAIZ.map((s) => `${s} (${NOMES_SETORES_RAIZ[s]})`).join(", ")}.`
      )
    }

    const vinculos = await this.repository.contarVinculos(id)
    const bloqueios: string[] = []

    if (vinculos.usuarios > 0) {
      bloqueios.push(`${vinculos.usuarios} usuário(s)`)
    }
    if (vinculos.pedidos > 0) {
      bloqueios.push(`${vinculos.pedidos} pedido(s)`)
    }
    if (vinculos.termosRenovacao > 0) {
      bloqueios.push(`${vinculos.termosRenovacao} termo(s) de renovação`)
    }
    if (vinculos.subSetores > 0) {
      bloqueios.push(`${vinculos.subSetores} sub-setor(es)`)
    }

    if (bloqueios.length > 0) {
      throw new ValidationError(
        `Não é possível excluir o setor ${setor.sigla}: ainda há ${bloqueios.join(", ")} vinculado(s). ` +
          `Remova esses vínculos antes de excluir.`
      )
    }

    return await this.repository.deleteById(id)
  }
}
