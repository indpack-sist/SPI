import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getAllOrdenesVenta,
  getOrdenVentaById,
  createOrdenVenta,
  updateOrdenVenta,
  crearOrdenProduccionDesdeVenta,
  actualizarEstadoOrdenVenta,
  actualizarPrioridadOrdenVenta,
  getEstadisticasOrdenesVenta,
  descargarPDFOrdenVenta,
  registrarPagoOrden,
  getPagosOrden,
  anularPagoOrden,
  getResumenPagosOrden,
  registrarDespacho,
  getSalidasOrden,
  anularDespacho,
  anularOrdenVenta,
  reservarStockOrden
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);
router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, createOrdenVenta);

router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);
router.post('/:id/crear-orden-produccion', verificarToken, crearOrdenProduccionDesdeVenta);
router.post('/:id/reservar', verificarToken, reservarStockOrden);

router.put('/:id/estado', verificarToken, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, actualizarPrioridadOrdenVenta);

router.delete('/:id/anular', verificarToken, anularOrdenVenta);

router.post('/:id/despacho', verificarToken, registrarDespacho);
router.get('/:id/salidas', verificarToken, getSalidasOrden);
router.delete('/:id/salidas/:idSalida', verificarToken, anularDespacho);

router.get('/:id/pagos/resumen', verificarToken, getResumenPagosOrden);
router.get('/:id/pagos', verificarToken, getPagosOrden);
router.post('/:id/pagos', verificarToken, registrarPagoOrden);
router.delete('/:id/pagos/:idPago', verificarToken, anularPagoOrden);

router.put('/:id', verificarToken, updateOrdenVenta);
router.get('/:id', verificarToken, getOrdenVentaById);

export default router;