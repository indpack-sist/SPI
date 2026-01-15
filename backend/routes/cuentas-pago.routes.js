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
  transferirEntreCuentas,
  getEstadisticasCuentas
} from '../controllers/cuentas-pago.controller.js';

const router = express.Router();

// Rutas de estadísticas y reportes (antes de las rutas con :id)
router.get('/estadisticas', getEstadisticasCuentas);

// Transferencias (debe ir antes de las rutas con :id)
router.post('/transferencias', transferirEntreCuentas);

// Rutas generales
router.get('/', getAllCuentasPago);
router.post('/', createCuentaPago);

// Rutas específicas por ID
router.get('/:id', getCuentaPagoById);
router.put('/:id', updateCuentaPago);
router.delete('/:id', deleteCuentaPago);

// Movimientos de cuenta
router.post('/:id/movimientos', registrarMovimiento);
router.get('/:id/movimientos', getMovimientosCuenta);

// Resumen de cuenta
router.get('/:id/resumen', getResumenCuenta);

export default router;