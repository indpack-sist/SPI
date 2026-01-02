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
  descargarPDFOrdenVenta
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

router.get('/estadisticas', verificarToken, getEstadisticasOrdenesVenta);
router.get('/', verificarToken, getAllOrdenesVenta);
router.post('/', verificarToken, createOrdenVenta);

router.get('/:id/pdf', verificarToken, descargarPDFOrdenVenta);
router.put('/:id/estado', verificarToken, actualizarEstadoOrdenVenta);
router.put('/:id/prioridad', verificarToken, actualizarPrioridadOrdenVenta);
router.put('/:id/progreso', verificarToken, actualizarProgresoOrdenVenta);

router.get('/:id', verificarToken, getOrdenVentaById);
//prueba
export default router;