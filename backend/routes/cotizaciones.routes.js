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


router.get('/estadisticas', getEstadisticasCotizaciones);

router.get('/', getAllCotizaciones);
router.post('/', createCotizacion);

router.get('/:id/pdf', descargarPDFCotizacion);
router.put('/:id/estado', actualizarEstadoCotizacion);
router.put('/:id/prioridad', actualizarPrioridadCotizacion);

router.get('/:id', getCotizacionById);

export default router;