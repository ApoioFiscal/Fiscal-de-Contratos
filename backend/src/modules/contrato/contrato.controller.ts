import { Request, Response } from "express";
import { ContratoService } from "./contrato.service";
import { AtualizarContratoSchema, AtualizarContratoInput } from "../../common/contrato.schema";
import { sendSuccess, asyncHandler, validateBody, validateParams } from "../../common/middleware";

export class ContratoController {
  constructor(private readonly service: ContratoService) {}

  async importar(req: Request, res: Response): Promise<void> {
    const buffer = req.body as Buffer;
    const nomeOriginal =
      (typeof req.query.nome === "string" && req.query.nome) ||
      (typeof req.query.filename === "string" && req.query.filename) ||
      `contrato-${Date.now()}.pdf`;

    const resultado = await this.service.importarArquivo(buffer, nomeOriginal);
    sendSuccess(res, resultado, 201);
  }

  async listar(req: Request, res: Response): Promise<void> {
    const contratos = await this.service.findAll();
    sendSuccess(res, contratos);
  }

  async obter(req: Request, res: Response): Promise<void> {
    const contrato = await this.service.findById(Number(req.params.id));
    sendSuccess(res, contrato);
  }

  async atualizar(req: Request, res: Response): Promise<void> {
    const input: AtualizarContratoInput = AtualizarContratoSchema.parse(req.body);
    const contrato = await this.service.atualizar(Number(req.params.id), input);
    sendSuccess(res, contrato);
  }

  async delete(req: Request, res: Response): Promise<void> {
    await this.service.delete(Number(req.params.id));
    sendSuccess(res, { id: Number(req.params.id), deleted: true });
  }
  async download(req: Request, res: Response): Promise<void> {
    res.status(501).json({
      success: false,
      error: { code: "NOT_IMPLEMENTED", message: "Download ainda não implementado" },
    });
  }
}
