import express from 'express';
import {
  getAllOrdenesVenta,
  getOrdenVentaById,
  createOrdenVenta,
  actualizarEstadoOrdenVenta,
  actualizarPrioridadOrdenVenta,
  actualizarProgresoOrdenVenta,
  getEstadisticasOrdenesVenta,
  descargarPDFOrdenVenta
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

// ============================================
// RUTAS ESTÁTICAS (sin parámetros)
// ============================================
router.get('/estadisticas', getEstadisticasOrdenesVenta);

// ============================================
// RUTAS DE ÓRDENES DE VENTA (base)
// ============================================
router.get('/', getAllOrdenesVenta);
router.post('/', createOrdenVenta);

// ============================================
// RUTAS CON :id (ORDEN IMPORTANTE)
// ============================================
// ✅ RUTAS ESPECÍFICAS PRIMERO (antes del GET /:id)
router.get('/:id/pdf', descargarPDFOrdenVenta);
router.put('/:id/estado', actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', actualizarPrioridadOrdenVenta);
router.put('/:id/progreso', actualizarProgresoOrdenVenta);

// ✅ RUTAS GENERICAS AL FINAL
router.get('/:id', getOrdenVentaById);

export default router;