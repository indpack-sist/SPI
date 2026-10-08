import express from 'express';
import { verificarToken } from '../middleware/auth.js';
import { getReporteVentas, getReporteProductoDespachos, getReporteDeudasClientes } from '../controllers/reportesventas.controller.js';

const router = express.Router();

router.get('/ventas', verificarToken, getReporteVentas);

router.get('/producto-despachos', verificarToken, getReporteProductoDespachos);

router.get('/deudas-clientes', verificarToken, getReporteDeudasClientes);

export default router;