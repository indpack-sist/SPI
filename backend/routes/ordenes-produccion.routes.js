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
  anularOrden,
  generarPDFOrdenController,
  getProductosMerma,
  getMermasOrden,
  registrarParcial,
  getRegistrosParcialesOrden,
  getAnalisisConsumoOrden,
  descargarHojaRutaController,
  completarAsignacionOP,
  editarOrdenCompleta
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
router.put('/:id/completar-asignacion', completarAsignacionOP);

router.post('/:id/iniciar', iniciarProduccion);
router.post('/:id/pausar', pausarProduccion);
router.post('/:id/reanudar', reanudarProduccion);

router.post('/:id/registrar-parcial', registrarParcial);

router.post('/:id/finalizar', finalizarProduccion);

router.post('/:id/cancelar', cancelarOrden);
router.post('/:id/anular', anularOrden);

router.get('/:id/hoja-ruta', descargarHojaRutaController);
router.put('/ordenes/:id/editar-completa', editarOrdenCompleta);

export default router;