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
  getMermasOrden,
  registrarProduccionParcial,
  finalizarProduccionConConsumoReal,
  getRegistrosParcialesOrden,
  getAnalisisConsumoOrden
} from '../controllers/ordenes-produccion.controller.js';

const router = express.Router();
router.get('/', getAllOrdenes);
router.post('/', createOrden);

router.get('/auxiliar/productos-merma', getProductosMerma);

router.get('/:id', getOrdenById);
router.get('/:id/consumo-materiales', getConsumoMaterialesOrden);
router.get('/:id/mermas', getMermasOrden);
router.get('/:id/pdf', generarPDFOrdenController);

router.get('/:id/registros-parciales', getRegistrosParcialesOrden);
router.get('/:id/analisis-consumo', getAnalisisConsumoOrden);

router.post('/:id/iniciar', iniciarProduccion);
router.post('/:id/pausar', pausarProduccion);
router.post('/:id/reanudar', reanudarProduccion);

router.post('/:id/registrar-parcial', registrarProduccionParcial);
router.post('/:id/finalizar-con-consumo-real', finalizarProduccionConConsumoReal);

router.post('/:id/finalizar', finalizarProduccion);

router.post('/:id/cancelar', cancelarOrden);

export default router;