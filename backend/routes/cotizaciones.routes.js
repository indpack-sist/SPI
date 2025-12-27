import express from 'express';
import {
  getAllCotizaciones,
  getCotizacionById,
  createCotizacion,
  actualizarEstadoCotizacion,
  actualizarPrioridadCotizacion,
  getEstadisticasCotizaciones,
  descargarPDFCotizacion
} from '../controllers/cotizaciones.controller.js';

const router = express.Router();

// ============================================
// RUTAS ESTÁTICAS (sin parámetros)
// ============================================
router.get('/estadisticas', getEstadisticasCotizaciones);

// ============================================
// RUTAS DE COTIZACIONES (base)
// ============================================
router.get('/', getAllCotizaciones);
router.post('/', createCotizacion);

// ============================================
// RUTAS CON :id (ORDEN IMPORTANTE)
// ============================================
// ✅ RUTAS ESPECÍFICAS PRIMERO (antes del GET /:id)
router.get('/:id/pdf', descargarPDFCotizacion);
router.put('/:id/estado', actualizarEstadoCotizacion);
router.put('/:id/prioridad', actualizarPrioridadCotizacion);

// ✅ RUTAS GENERICAS AL FINAL
router.get('/:id', getCotizacionById);

export default router;