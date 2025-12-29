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

router.get('/estadisticas', getEstadisticasOrdenesCompra);
router.get('/', getAllOrdenesCompra);
router.post('/', createOrdenCompra);
router.get('/:id/pdf', descargarPDFOrdenCompra);
router.put('/:id/estado', actualizarEstadoOrdenCompra);
router.post('/:id/recibir', recibirOrdenCompra); // 🔥 GENERA ENTRADAS Y ACTUALIZA CUP

router.get('/proveedor/:id/productos', getProductosPorProveedor);

router.get('/:id', getOrdenCompraById);

export default router;