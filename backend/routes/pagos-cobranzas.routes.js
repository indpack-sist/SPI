import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getResumenPagosCobranzas,
  getAllPagosCobranzas,
  getCuentasPorCobrar,
  descargarReporteDeudas
} from '../controllers/pagos-cobranzas.controller.js';

const router = express.Router();

router.get('/resumen', verificarToken, getResumenPagosCobranzas);
router.get('/cuentas-por-cobrar', verificarToken, getCuentasPorCobrar);
router.get('/reporte-deudas', verificarToken, descargarReporteDeudas);
router.get('/', verificarToken, getAllPagosCobranzas);

export default router;