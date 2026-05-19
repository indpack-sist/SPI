import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { getReporteVentas, getReporteProductoDespachos, getReporteDeudasClientes } from '../controllers/reportesventas.controller.js';

const router = express.Router();

// ==========================================
// Rutas de Reportes
// ==========================================

// Endpoint: /api/reportes/ventas
// Parámetros query: ?fechaInicio=Y-m-d&fechaFin=Y-m-d&idCliente=123
router.get('/ventas', verificarToken, getReporteVentas);

// Endpoint: /api/reportes/producto-despachos
// Parámetros query: ?idProducto=123&fechaInicio=Y-m-d&fechaFin=Y-m-d
router.get('/producto-despachos', verificarToken, getReporteProductoDespachos);

// Endpoint: /api/reportes/deudas-clientes
// Parámetros query: ?idCliente=123&soloVencidas=true|false
router.get('/deudas-clientes', verificarToken, getReporteDeudasClientes);

export default router;