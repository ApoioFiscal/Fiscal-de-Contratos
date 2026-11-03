import { Router } from 'express';
import { SolicitacaoController } from './solicitacao.controller';
import { SolicitacaoService } from './solicitacao.service';
import { SolicitacaoRepository } from './solicitacao.repository';
import { validateBody, validateParams } from '../../common/middleware';
import { CreateSolicitacaoSchema, UpdateSolicitacaoSchema, IdParamSchema } from '../../common/schemas';

const router = Router();
const repository = new SolicitacaoRepository();
const service = new SolicitacaoService(repository);
const controller = new SolicitacaoController(service);

router.post('/', validateBody(CreateSolicitacaoSchema), controller.create);
router.get('/', controller.findAll);
router.get('/:id', validateParams(IdParamSchema), controller.findById);
router.put('/:id', validateParams(IdParamSchema), validateBody(UpdateSolicitacaoSchema), controller.update);
router.patch('/:id', validateParams(IdParamSchema), validateBody(UpdateSolicitacaoSchema), controller.update);
router.delete('/:id', validateParams(IdParamSchema), controller.delete);

export default router;
