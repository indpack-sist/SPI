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
  registrarPagoCompra,
  getAlertasCompras,
  getEstadisticasCompras,
  getResumenPagosCompra,
  getHistorialPagosCompra,
  descargarPDFCompra,
  getComprasPorCuenta
} from '../controllers/compras.controller.js';

const router = express.Router();

router.get('/alertas', getAlertasCompras);
router.get('/estadisticas', getEstadisticasCompras);
router.get('/por-cuenta', getComprasPorCuenta);

router.get('/', getAllCompras);
router.post('/', createCompra);

router.get('/:id/pdf', descargarPDFCompra);
router.get('/:id/resumen-pagos', getResumenPagosCompra);
router.get('/:id/historial-pagos', getHistorialPagosCompra);
router.get('/:id/cuotas', getCuotasCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);
router.post('/:id/pagar', registrarPagoCompra);

router.get('/:id', getCompraById);
router.put('/:id', updateCompra);
router.delete('/:id/cancelar', cancelarCompra);

export default router;