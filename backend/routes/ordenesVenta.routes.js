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
  anularDespacho,      // <--- NUEVO
  anularOrdenVenta     // <--- NUEVO
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

// Estadísticas
router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);

// Listado y creación
router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, createOrdenVenta);

// Rutas de PDF
router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);

// Rutas de Pagos
router.get('/:id/pagos/resumen', verificarToken, getResumenPagosOrden);
router.get('/:id/pagos', verificarToken, getPagosOrden);
router.post('/:id/pagos', verificarToken, registrarPagoOrden);
router.delete('/:id/pagos/:idPago', verificarToken, anularPagoOrden);

// Rutas de Despachos
router.post('/:id/despacho', verificarToken, registrarDespacho);
router.get('/:id/salidas', verificarToken, getSalidasOrden);
router.delete('/:id/salidas/:idSalida', verificarToken, anularDespacho);  // <--- NUEVO

// Rutas de Producción
router.post('/:id/crear-orden-produccion', verificarToken, crearOrdenProduccionDesdeVenta);

// Rutas de Actualización
router.put('/:id/estado', verificarToken, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, actualizarPrioridadOrdenVenta);
router.put('/:id', verificarToken, updateOrdenVenta);

// Anular orden completa
router.delete('/:id/anular', verificarToken, anularOrdenVenta);  // <--- NUEVO

// Detalle de orden (debe ir al final para evitar conflictos)
router.get('/:id', verificarToken, getOrdenVentaById);

export default router;