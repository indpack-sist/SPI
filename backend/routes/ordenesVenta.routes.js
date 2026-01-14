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
  registrarDespacho,   // <--- NUEVO
  getSalidasOrden      // <--- NUEVO
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);
router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, createOrdenVenta);

// Rutas de PDF y Pagos
router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);
router.get('/:id/pagos/resumen', verificarToken, getResumenPagosOrden);
router.get('/:id/pagos', verificarToken, getPagosOrden);
router.post('/:id/pagos', verificarToken, registrarPagoOrden);
router.delete('/:id/pagos/:idPago', verificarToken, anularPagoOrden);

// Rutas de Despachos (NUEVAS)
router.post('/:id/despacho', verificarToken, registrarDespacho);
router.get('/:id/salidas', verificarToken, getSalidasOrden);

// Rutas de Producción y Actualización
router.post('/:id/crear-orden-produccion', verificarToken, crearOrdenProduccionDesdeVenta);
router.put('/:id/estado', verificarToken, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, actualizarPrioridadOrdenVenta);
router.put('/:id', verificarToken, updateOrdenVenta);

router.get('/:id', verificarToken, getOrdenVentaById);

export default router;