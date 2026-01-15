import express from 'express';
import {
  getAllCompras,
  getCompraById,
  createCompra,
  updateCompra,
  cancelarCompra,
  getCuotasCompra,
  getCuotaById,
  pagarCuota,
  getAlertasCompras,
  getEstadisticasCompras,
  getResumenPagosCompra,
  getHistorialPagosCompra,
  descargarPDFCompra,
  getComprasPorCuenta
} from '../controllers/compras.controller.js';

const router = express.Router();

// Rutas de estadísticas y reportes (antes de las rutas con :id)
router.get('/alertas', getAlertasCompras);
router.get('/estadisticas', getEstadisticasCompras);
router.get('/por-cuenta', getComprasPorCuenta);

// Rutas generales
router.get('/', getAllCompras);
router.post('/', createCompra);

// Rutas específicas por ID de compra
router.get('/:id', getCompraById);
router.put('/:id', updateCompra);
router.delete('/:id/cancelar', cancelarCompra);

// PDF de compra
router.get('/:id/pdf', descargarPDFCompra);

// Resumen de pagos
router.get('/:id/resumen-pagos', getResumenPagosCompra);

// Historial de movimientos/pagos
router.get('/:id/historial-pagos', getHistorialPagosCompra);

// Gestión de cuotas
router.get('/:id/cuotas', getCuotasCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);

export default router;