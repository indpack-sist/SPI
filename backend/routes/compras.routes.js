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

router.get('/:id/pagos/resumen', getResumenPagosCompra);
router.get('/:id/pagos/historial', getHistorialPagosCompra);
router.post('/:id/pagos', registrarPagoCompra);

router.get('/:id/cuotas', getCuotasCompra);
router.get('/:id/cuotas/:idCuota', getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', pagarCuota);

router.get('/:id', getCompraById);
router.put('/:id', updateCompra);
router.patch('/:id/cancelar', cancelarCompra);

export default router;