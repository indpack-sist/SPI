import express from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

router.get('/resumen', dashboardController.obtenerResumenGeneral);
router.get('/inventario-valorizado', dashboardController.obtenerInventarioValorizado);
router.get('/productos-costo', dashboardController.obtenerProductosConCosto);
router.get('/estadisticas-movimientos', dashboardController.obtenerEstadisticasMovimientos);
router.get('/top-productos', dashboardController.obtenerTopProductos);
router.get('/tipo-cambio', dashboardController.obtenerTipoCambioActual);
router.get('/tipo-cambio/actualizar', dashboardController.actualizarTipoCambioManual);

export default router;