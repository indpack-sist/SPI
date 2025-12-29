import express from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

// ============================================
// RUTAS DEL DASHBOARD
// ============================================

/**
 * GET /dashboard/resumen
 * Obtener resumen general del dashboard
 * - Total productos, empleados, proveedores, clientes
 * - Órdenes de producción activas
 * - Productos con stock bajo
 * - Valoración por tipo de inventario (PEN y USD)
 * - Tipo de cambio (desde cache, NO consume API)
 */
router.get('/resumen', dashboardController.obtenerResumenGeneral);

/**
 * GET /dashboard/inventario-valorizado
 * Obtener inventario valorizado por tipo
 * Query params: moneda (PEN/USD)
 */
router.get('/inventario-valorizado', dashboardController.obtenerInventarioValorizado);

/**
 * GET /dashboard/productos-costo
 * Obtener productos con su costo unitario promedio
 */
router.get('/productos-costo', dashboardController.obtenerProductosConCosto);

/**
 * GET /dashboard/estadisticas-movimientos
 * Obtener estadísticas de movimientos de inventario
 * - Movimientos por mes
 * - Resumen por tipo de movimiento
 */
router.get('/estadisticas-movimientos', dashboardController.obtenerEstadisticasMovimientos);

/**
 * GET /dashboard/top-productos
 * Obtener top productos más vendidos/usados
 */
router.get('/top-productos', dashboardController.obtenerTopProductos);

/**
 * GET /dashboard/actualizar-tipo-cambio
 * ⚠️ CONSUME 1 TOKEN DE API EXTERNA
 * Actualizar tipo de cambio manualmente desde API
 * Query params: 
 *   - currency (default: USD)
 *   - date (opcional, formato: YYYY-MM-DD)
 */
router.get('/tipo-cambio/actualizar', actualizarTipoCambioManual);

export default router;