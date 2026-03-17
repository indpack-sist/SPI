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
  editarOrdenCompleta,
  verificarCalidad
} from '../controllers/ordenes-produccion.controller.js';

const router = express.Router();
import { verificarToken, verificarPermiso } from '../middleware/auth.js';

router.use(verificarToken);

router.get('/', verificarPermiso('ordenesProduccion'), getAllOrdenes);
router.post('/', verificarPermiso('ordenesProduccion'), createOrden);

router.get('/auxiliar/productos-merma', verificarPermiso('ordenesProduccion'), getProductosMerma);

router.get('/:id', verificarPermiso('ordenesProduccion'), getOrdenById);
router.put('/:id', verificarPermiso('ordenesProduccion'), updateOrden);

router.get('/:id/consumo-materiales', verificarPermiso('ordenesProduccion'), getConsumoMaterialesOrden);
router.get('/:id/mermas', verificarPermiso('ordenesProduccion'), getMermasOrden);
router.get('/:id/pdf', verificarPermiso('ordenesProduccion'), generarPDFOrdenController);

router.get('/:id/registros-parciales', verificarPermiso('ordenesProduccion'), getRegistrosParcialesOrden);
router.get('/:id/analisis-consumo', verificarPermiso('ordenesProduccion'), getAnalisisConsumoOrden);

router.put('/:id/asignar-receta-supervisor', verificarPermiso('ordenesProduccion'), asignarRecetaYSupervisor);
router.put('/:id/completar-asignacion', verificarPermiso('ordenesProduccion'), completarAsignacionOP);

router.post('/:id/iniciar', verificarPermiso('ordenesProduccion'), iniciarProduccion);
router.post('/:id/pausar', verificarPermiso('ordenesProduccion'), pausarProduccion);
router.post('/:id/reanudar', verificarPermiso('ordenesProduccion'), reanudarProduccion);

router.post('/:id/registrar-parcial', verificarPermiso('ordenesProduccion'), registrarParcial);

router.post('/:id/finalizar', verificarPermiso('ordenesProduccion'), finalizarProduccion);

router.post('/:id/verificar-calidad', verificarPermiso('ordenesProduccion'), verificarCalidad);

router.post('/:id/cancelar', verificarPermiso('ordenesProduccion'), cancelarOrden);
router.post('/:id/anular', verificarPermiso('ordenesProduccion'), anularOrden);

router.get('/:id/hoja-ruta', verificarPermiso('ordenesProduccion'), descargarHojaRutaController);
router.put('/:id/editar-completa', verificarPermiso('ordenesProduccion'), editarOrdenCompleta);

export default router;