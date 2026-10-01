import { Router } from "express";
import { setorRouter } from "../modules/setor/setor.route";
import { usuarioRouter } from "../modules/usuario/usuario.route";
import { licitacaoRouter } from "../modules/licitacao/licitacao.route";
import { pedidoRouter } from "../modules/pedido/pedido.route";
import { estoqueRouter } from "../modules/estoque/estoque.route";
import { avaliacaoRouter } from "../modules/avaliacao/avaliacao.route";
import { termoRenovacaoRouter } from "../modules/renovacao/renovacao.route";

export const router = Router();

router.use("/setores", setorRouter);
router.use("/usuarios", usuarioRouter);
router.use("/licitacoes", licitacaoRouter);
router.use("/pedidos", pedidoRouter);
router.use("/estoque", estoqueRouter);
router.use("/avaliacoes", avaliacaoRouter);
router.use("/renovacoes", termoRenovacaoRouter);


