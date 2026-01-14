import express from 'express';
import {
  getAllOrdenesCompra,
  getOrdenCompraById,
  createOrdenCompra,
  updateOrdenCompra,
  actualizarEstadoOrdenCompra,
  actualizarPrioridadOrdenCompra,
  getEstadisticasOrdenesCompra,
  descargarPDFOrdenCompra,
  registrarPagoOrdenCompra,
  getPagosOrdenCompra,
  anularPagoOrdenCompra,
  getResumenPagosOrdenCompra
} from '../controllers/ordenesCompra.controller.js';

const router = express.Router();

router.get('/estadisticas', getEstadisticasOrdenesCompra);

router.get('/', getAllOrdenesCompra);
router.post('/', createOrdenCompra);

router.get('/:id', getOrdenCompraById);
router.put('/:id', updateOrdenCompra);

router.put('/:id/estado', actualizarEstadoOrdenCompra);
router.put('/:id/prioridad', actualizarPrioridadOrdenCompra);

router.get('/:id/pdf', descargarPDFOrdenCompra);

router.get('/:id/pagos', getPagosOrdenCompra);
router.post('/:id/pagos', registrarPagoOrdenCompra);
router.get('/:id/pagos/resumen', getResumenPagosOrdenCompra);
router.delete('/:id/pagos/:idPago', anularPagoOrdenCompra);

export default router;