import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getAllCompras,
  getCompraById,
  createCompra,
  updateCompra,
  cancelarCompra,
  establecerCronograma,
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

router.get('/alertas', verificarToken, getAlertasCompras);
router.get('/estadisticas', verificarToken, getEstadisticasCompras);
router.get('/por-cuenta', verificarToken, getComprasPorCuenta);

router.get('/', verificarToken, getAllCompras);
router.post('/', verificarToken, createCompra);

router.get('/:id/pdf', verificarToken, descargarPDFCompra);

router.get('/:id/pagos/resumen', verificarToken, getResumenPagosCompra);
router.get('/:id/pagos/historial', verificarToken, getHistorialPagosCompra);
router.post('/:id/pagos', verificarToken, registrarPagoCompra);

router.post('/:id/cronograma', verificarToken, establecerCronograma);

router.get('/:id/cuotas', verificarToken, getCuotasCompra);
router.get('/:id/cuotas/:idCuota', verificarToken, getCuotaById);
router.post('/:id/cuotas/:idCuota/pagar', verificarToken, pagarCuota);

router.get('/:id', verificarToken, getCompraById);
router.put('/:id', verificarToken, updateCompra);
router.patch('/:id/cancelar', verificarToken, cancelarCompra);

export default router;