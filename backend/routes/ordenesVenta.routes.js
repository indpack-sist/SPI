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
router.get('/estadisticas', getEstadisticasOrdenesVenta);
router.get('/', getAllOrdenesVenta);
router.post('/', createOrdenVenta);

router.get('/:id/pdf', descargarPDFOrdenVenta);
router.put('/:id/estado', actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', actualizarPrioridadOrdenVenta);
router.put('/:id/progreso', actualizarProgresoOrdenVenta);

router.get('/:id', getOrdenVentaById);

export default router;