import { Router } from "express";
import { setorRouter } from "../modules/setor/setor.route";
import { usuarioRouter } from "../modules/usuario/usuario.route";
import { contratoRouter } from "../modules/contrato/contrato.route";
import { pedidoRouter } from "../modules/pedido/pedido.route";
import { estoqueRouter } from "../modules/estoque/estoque.route";
import { avaliacaoRouter } from "../modules/avaliacao/avaliacao.route";
import { termoRenovacaoRouter } from "../modules/renovacao/renovacao.route";

export const router = Router();

router.use("/setores", setorRouter);
router.use("/usuarios", usuarioRouter);
router.use("/contratos", contratoRouter);
router.use("/pedidos", pedidoRouter);
router.use("/estoque", estoqueRouter);
router.use("/avaliacoes", avaliacaoRouter);
router.use("/renovacoes", termoRenovacaoRouter);
