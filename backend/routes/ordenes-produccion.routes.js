import express from 'express';

import {
  getAllOrdenes,
  getOrdenById,
  getConsumoMaterialesOrden,
  createOrden,
  iniciarProduccion,
  pausarProduccion,
  reanudarProduccion,
  finalizarProduccion,
  cancelarOrden,
  generarPDFOrdenController,
  getProductosMerma, 
  getMermasOrden      
} from '../controllers/ordenes-produccion.controller.js';

const router = express.Router();
router.get('/', getAllOrdenes);
router.get('/:id', getOrdenById);
router.get('/:id/consumo-materiales', getConsumoMaterialesOrden);
router.get('/:id/pdf', generarPDFOrdenController);
router.get('/:id/mermas', getMermasOrden);
router.post('/', createOrden);
router.post('/:id/iniciar', iniciarProduccion);
router.post('/:id/pausar', pausarProduccion);
router.post('/:id/reanudar', reanudarProduccion);
router.post('/:id/finalizar', finalizarProduccion);
router.post('/:id/cancelar', cancelarOrden);

router.get('/auxiliar/productos-merma', getProductosMerma);

export default router;