import express from 'express';
import {
  getAllOrdenesCompra,
  getOrdenCompraById,
  createOrdenCompra,
  updateOrdenCompra,
  cancelarOrdenCompra,
  descargarPDFOrdenCompra,
  getCuotasOrdenCompra,
  getCuotaById,
  pagarCuota,
  getResumenPagosOrden,
  getHistorialPagosOrden,
  getAlertasCompras,
  getEstadisticasOrdenesCompra
} from '../controllers/ordenesCompra.controller.js';

const router = express.Router();

// Rutas de estadísticas y alertas (deben ir primero)
router.get('/estadisticas', getEstadisticasOrdenesCompra);
router.get('/alertas', getAlertasCompras);

// Rutas generales
router.get('/', getAllOrdenesCompra);
router.post('/', createOrdenCompra);

// Rutas específicas por ID
router.get('/:id', getOrdenCompraById);
router.put('/:id', updateOrdenCompra);
router.post('/:id/cancelar', cancelarOrdenCompra);

// PDF
router.get('/:id/pdf', descargarPDFOrdenCompra);

// Gestión de pagos y resumen
router.get('/:id/pagos/resumen', getResumenPagosOrden);
router.get('/:id/pagos/historial', getHistorialPagosOrden);

// Gestión de cuotas
router.get('/:id/cuotas', getCuotasOrdenCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);

export default router;