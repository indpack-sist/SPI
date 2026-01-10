import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getAllOrdenesVenta,
  getOrdenVentaById,
  createOrdenVenta,
  actualizarEstadoOrdenVenta,
  actualizarPrioridadOrdenVenta,
  actualizarProgresoOrdenVenta,
  getEstadisticasOrdenesVenta,
  descargarPDFOrdenVenta,
  convertirCotizacionAOrden,
  registrarPagoOrden,
  getPagosOrden,
  anularPagoOrden,
  getResumenPagosOrden
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);
router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, createOrdenVenta);
router.post('/cotizacion/:id/convertir', verificarToken, convertirCotizacionAOrden);
router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);
router.get('/:id/pagos/resumen', verificarToken, getResumenPagosOrden);
router.get('/:id/pagos', verificarToken, getPagosOrden);
router.post('/:id/pagos', verificarToken, registrarPagoOrden);
router.delete('/:id/pagos/:idPago', verificarToken, anularPagoOrden);
router.put('/:id/estado', verificarToken, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, actualizarPrioridadOrdenVenta);
router.put('/:id/progreso', verificarToken, actualizarProgresoOrdenVenta);
router.get('/:id', verificarToken, getOrdenVentaById);

export default router;