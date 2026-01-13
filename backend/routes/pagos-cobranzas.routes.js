import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import {
  getResumenPagosCobranzas,
  getAllPagosCobranzas,
  getCuentasPorCobrar
} from '../controllers/pagos-cobranzas.controller.js';

const router = express.Router();

// 1. Obtener resumen financiero (totales PEN/USD)
// Endpoint: /api/pagos-cobranzas/resumen
router.get('/resumen', verificarToken, getResumenPagosCobranzas);

// 2. Obtener listado de cuentas por cobrar (facturas pendientes)
// Endpoint: /api/pagos-cobranzas/cuentas-por-cobrar
router.get('/cuentas-por-cobrar', verificarToken, getCuentasPorCobrar);

// 3. Obtener historial completo unificado (pagos y cobranzas)
// Endpoint: /api/pagos-cobranzas/
router.get('/', verificarToken, getAllPagosCobranzas);

export default router;