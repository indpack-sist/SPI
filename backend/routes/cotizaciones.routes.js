import express from 'express';
import {
  getAllCotizaciones,
  getCotizacionById,
  createCotizacion,
  updateCotizacion,
  duplicarCotizacion,
  actualizarEstadoCotizacion,
  actualizarPrioridadCotizacion,
  getEstadisticasCotizaciones,
  descargarPDFCotizacion,
  agregarDireccionClienteDesdeCotizacion,
  getNavegacionCotizacion
} from '../controllers/cotizaciones.controller.js';

const router = express.Router();

router.get('/estadisticas', getEstadisticasCotizaciones);
router.post('/direccion-cliente', agregarDireccionClienteDesdeCotizacion);

router.get('/', getAllCotizaciones);
router.post('/', createCotizacion);

router.get('/:id/pdf', descargarPDFCotizacion);
router.get('/:id/navegacion', getNavegacionCotizacion);
router.post('/:id/duplicar', duplicarCotizacion);
router.put('/:id/estado', actualizarEstadoCotizacion);
router.put('/:id/prioridad', actualizarPrioridadCotizacion);

router.get('/:id', getCotizacionById);
router.put('/:id', updateCotizacion);

export default router;