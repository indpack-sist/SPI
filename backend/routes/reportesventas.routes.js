import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { getReporteVentas } from '../controllers/reportesventas.controller.js';

const router = express.Router();

// ==========================================
// Rutas de Reportes
// ==========================================

// Endpoint: /api/reportes/ventas
// Parámetros query: ?fechaInicio=Y-m-d&fechaFin=Y-m-d&idCliente=123
router.get('/ventas', verificarToken, getReporteVentas);

export default router;