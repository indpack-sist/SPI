import express from 'express';
import {
  getAllOrdenesCompra,
  getOrdenCompraById,
  createOrdenCompra,
  actualizarEstadoOrdenCompra,
  recibirOrdenCompra,
  getProductosPorProveedor,
  getEstadisticasOrdenesCompra,
  descargarPDFOrdenCompra
} from '../controllers/ordenesCompra.controller.js';

const router = express.Router();

// ============================================
// RUTAS ESTÁTICAS (sin parámetros)
// ============================================
router.get('/estadisticas', getEstadisticasOrdenesCompra);

// ============================================
// RUTAS DE ÓRDENES DE COMPRA (base)
// ============================================
router.get('/', getAllOrdenesCompra);
router.post('/', createOrdenCompra);

// ============================================
// RUTAS CON :id (ORDEN IMPORTANTE)
// ============================================
// ✅ RUTAS ESPECÍFICAS PRIMERO (antes del GET /:id)
router.get('/:id/pdf', descargarPDFOrdenCompra);
router.put('/:id/estado', actualizarEstadoOrdenCompra);
router.post('/:id/recibir', recibirOrdenCompra); // 🔥 GENERA ENTRADAS Y ACTUALIZA CUP

// ✅ RUTAS DE PROVEEDOR
router.get('/proveedor/:id/productos', getProductosPorProveedor);

// ✅ RUTAS GENERICAS AL FINAL
router.get('/:id', getOrdenCompraById);

export default router;