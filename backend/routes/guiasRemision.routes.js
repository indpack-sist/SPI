// =====================================================
// backend/routes/guiasRemision.routes.js
// =====================================================

import express from 'express';
import {
  getAllGuiasRemision,
  getGuiaRemisionById,
  createGuiaRemision,
  actualizarEstado,
  getProductosDisponiblesOrden,
  getEstadisticas
} from '../controllers/guiasRemision.controller.js';

const router = express.Router();

// Estadísticas
router.get('/estadisticas', getEstadisticas);

// Productos disponibles de una orden
router.get('/orden/:id_orden_venta/productos-disponibles', getProductosDisponiblesOrden);

// CRUD básico
router.get('/', getAllGuiasRemision);
router.get('/:id', getGuiaRemisionById);
router.post('/', createGuiaRemision);

// Actualizar estado
router.patch('/:id/estado', actualizarEstado);

export default router;