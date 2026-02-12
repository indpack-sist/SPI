import express from 'express';
import {
  getAllCuentasPago,
  getCuentaPagoById,
  createCuentaPago,
  updateCuentaPago,
  deleteCuentaPago,
  registrarMovimiento,
  getMovimientosCuenta,
  getResumenCuenta,
  getEstadisticasCuentas
} from '../controllers/cuentas-pago.controller.js';

const router = express.Router();

router.get('/estadisticas', getEstadisticasCuentas);

router.get('/', getAllCuentasPago);
router.post('/', createCuentaPago);

router.get('/:id', getCuentaPagoById);
router.put('/:id', updateCuentaPago);
router.delete('/:id', deleteCuentaPago);

router.post('/:id/movimientos', registrarMovimiento);
router.get('/:id/movimientos', getMovimientosCuenta);

router.get('/:id/resumen', getResumenCuenta);

export default router;