import { Router } from 'express';
import { ContratadoController } from './contratado.controller';
import { ContratadoService } from './contratado.service';
import { ContratadoRepository } from './contratado.repository';
import { validateBody, validateParams } from '../../common/middleware';
import { CreateContratadoSchema, UpdateContratadoSchema, IdParamSchema } from '../../common/schemas';

const router = Router();
const repository = new ContratadoRepository();
const service = new ContratadoService(repository);
const controller = new ContratadoController(service);

router.post('/', validateBody(CreateContratadoSchema), controller.create);
router.get('/', controller.findAll);
router.get('/:id', validateParams(IdParamSchema), controller.findById);
router.put('/:id', validateParams(IdParamSchema), validateBody(UpdateContratadoSchema), controller.update);
router.patch('/:id', validateParams(IdParamSchema), validateBody(UpdateContratadoSchema), controller.update);
router.delete('/:id', validateParams(IdParamSchema), controller.delete);

export default router;
