import { Router } from 'express';
import { ContratanteController } from './contratante.controller';
import { ContratanteService } from './contratante.service';
import { ContratanteRepository } from './contratante.repository';
import { validateBody, validateParams } from '../../common/middleware';
import { CreateContratanteSchema, UpdateContratanteSchema, IdParamSchema } from '../../common/schemas';

const router = Router();
const repository = new ContratanteRepository();
const service = new ContratanteService(repository);
const controller = new ContratanteController(service);

router.post('/', validateBody(CreateContratanteSchema), controller.create);
router.get('/', controller.findAll);
router.get('/:id', validateParams(IdParamSchema), controller.findById);
router.put('/:id', validateParams(IdParamSchema), validateBody(UpdateContratanteSchema), controller.update);
router.patch('/:id', validateParams(IdParamSchema), validateBody(UpdateContratanteSchema), controller.update);
router.delete('/:id', validateParams(IdParamSchema), controller.delete);

export default router;
