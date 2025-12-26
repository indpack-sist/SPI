// =====================================================
// backend/routes/ordenesCompra.routes.js
// =====================================================

import express from 'express';
import {
  getAllOrdenesCompra,
  getOrdenCompraById,
  createOrdenCompra,
  actualizarEstado,
  recibirOrden,
  getEstadisticas,
  getProductosPorProveedor
} from '../controllers/ordenesCompra.controller.js';

const router = express.Router();

// Estadísticas
router.get('/estadisticas', getEstadisticas);

// Productos por proveedor
router.get('/proveedor/:id_proveedor/productos', getProductosPorProveedor);

// CRUD básico
router.get('/', getAllOrdenesCompra);
router.get('/:id', getOrdenCompraById);
router.post('/', createOrdenCompra);

// Actualizar estado
router.patch('/:id/estado', actualizarEstado);

// Recibir orden (genera entrada de inventario)
router.post('/:id/recibir', recibirOrden);

export default router;