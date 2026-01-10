import express from 'express';
import {
  getAllCuentasPago,
  getCuentaPagoById,
  createCuentaPago,
  updateCuentaPago,
  deleteCuentaPago
} from '../controllers/cuentas-pago.controller.js';

const router = express.Router();

router.get('/', getAllCuentasPago);
router.get('/:id', getCuentaPagoById);
router.post('/', createCuentaPago);
router.put('/:id', updateCuentaPago);
router.delete('/:id', deleteCuentaPago);

export default router;