import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getResumenPagosCobranzas,
  getAllPagosCobranzas,
  getCuentasPorCobrar
} from '../controllers/pagos-cobranzas.controller.js';

const router = express.Router();

router.get('/resumen', verificarToken, getResumenPagosCobranzas);
router.get('/cuentas-por-cobrar', verificarToken, getCuentasPorCobrar);
router.get('/', verificarToken, getAllPagosCobranzas);

export default router;