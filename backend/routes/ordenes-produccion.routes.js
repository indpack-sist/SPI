import express from 'express';
import {
  getAllOrdenes,
  getOrdenById,
  getConsumoMaterialesOrden,
  createOrden,
  updateOrden,
  asignarRecetaYSupervisor,
  iniciarProduccion,
  pausarProduccion,
  reanudarProduccion,
  finalizarProduccion,
  cancelarOrden,
  generarPDFOrdenController,
  getProductosMerma,
  getMermasOrden,
  registrarParcial, 
  getRegistrosParcialesOrden,
  getAnalisisConsumoOrden,
  descargarHojaRutaController
} from '../controllers/ordenes-produccion.controller.js';

const router = express.Router();

router.get('/', getAllOrdenes);
router.post('/', createOrden);

router.get('/auxiliar/productos-merma', getProductosMerma);

router.get('/:id', getOrdenById);
router.put('/:id', updateOrden);

router.get('/:id/consumo-materiales', getConsumoMaterialesOrden);
router.get('/:id/mermas', getMermasOrden);
router.get('/:id/pdf', generarPDFOrdenController);

router.get('/:id/registros-parciales', getRegistrosParcialesOrden);
router.get('/:id/analisis-consumo', getAnalisisConsumoOrden);

router.put('/:id/asignar-receta-supervisor', asignarRecetaYSupervisor);

router.post('/:id/iniciar', iniciarProduccion);
router.post('/:id/pausar', pausarProduccion);
router.post('/:id/reanudar', reanudarProduccion);

// Aquí se usa la nueva función que soporta Kilos y Unidades
router.post('/:id/registrar-parcial', registrarParcial);

router.post('/:id/finalizar', finalizarProduccion);

router.post('/:id/cancelar', cancelarOrden);
router.get('/:id/hoja-ruta', descargarHojaRutaController);

export default router;