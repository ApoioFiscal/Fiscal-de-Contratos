import { Router } from "express";
import { setorRouter } from "../modules/setor/setor.route";
import { usuarioRouter } from "../modules/usuario/usuario.route";
import { licitacaoRouter } from "../modules/licitacao/licitacao.route";
import { pedidoRouter } from "../modules/pedido/pedido.route";
import { estoqueRouter } from "../modules/estoque/estoque.route";
import { avaliacaoRouter } from "../modules/avaliacao/avaliacao.route";
import { termoRenovacaoRouter } from "../modules/renovacao/renovacao.route";
import contratanteRouter from "../modules/contratante/contratante.route";
import contratadoRouter from "../modules/contratado/contratado.route";
import solicitacaoRouter from "../modules/solicitacao/solicitacao.route";

export const router = Router();

router.use("/setores", setorRouter);
router.use("/usuarios", usuarioRouter);
router.use("/licitacoes", licitacaoRouter);
router.use("/pedidos", pedidoRouter);
router.use("/estoque", estoqueRouter);
router.use("/avaliacoes", avaliacaoRouter);
router.use("/renovacoes", termoRenovacaoRouter);
router.use("/contratantes", contratanteRouter);
router.use("/contratados", contratadoRouter);
router.use("/solicitacoes", solicitacaoRouter);



