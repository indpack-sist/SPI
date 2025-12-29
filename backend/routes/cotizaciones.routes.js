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

router.get('/:id/pdf', descargarPDFCotizacion);
router.put('/:id/estado', actualizarEstadoCotizacion);
router.put('/:id/prioridad', actualizarPrioridadCotizacion);

router.get('/:id', getCotizacionById);

export default router;