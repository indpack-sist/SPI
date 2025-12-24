// =====================================================
// backend/routes/ordenesVenta.routes.js
// =====================================================

import express from 'express';
import {
  getAllOrdenesVenta,
  getOrdenVentaById,
  createOrdenVenta,
  convertirDesdeCotizacion,
  actualizarEstado,
  actualizarPrioridad,
  actualizarProgreso,
  getEstadisticas
} from '../controllers/ordenesVenta.controller.js';

const router = express.Router();

// Estadísticas
router.get('/estadisticas', getEstadisticas);

// Convertir desde cotización
router.post('/convertir-cotizacion/:id_cotizacion', convertirDesdeCotizacion);

// CRUD básico
router.get('/', getAllOrdenesVenta);
router.get('/:id', getOrdenVentaById);
router.post('/', createOrdenVenta);

// Actualizaciones
router.patch('/:id/estado', actualizarEstado);
router.patch('/:id/prioridad', actualizarPrioridad);
router.patch('/:id/progreso', actualizarProgreso);

export default router;