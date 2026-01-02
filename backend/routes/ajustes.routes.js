import express from 'express';
import {
  realizarConteoFisico,
  getAjustesPorProducto,
  getTodosLosAjustes,
  getHistorialAjustes,
  getDetalleAjuste,
  getEstadisticasAjustes,
  aprobarAjuste,
  getMotivosAjuste
} from '../controllers/ajustes.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = express.Router();

// =====================================================
// RUTAS PÚBLICAS (requieren solo autenticación)
// =====================================================

/**
 * @route   GET /api/productos/ajustes/motivos
 * @desc    Obtener lista de motivos de ajuste disponibles
 * @access  Private
 */
router.get('/motivos', verificarToken, getMotivosAjuste);

/**
 * @route   GET /api/productos/ajustes/estadisticas
 * @desc    Obtener estadísticas generales de ajustes
 * @query   fecha_inicio, fecha_fin (opcional)
 * @access  Private
 */
router.get('/estadisticas', verificarToken, getEstadisticasAjustes);

/**
 * @route   GET /api/productos/ajustes/historial
 * @desc    Obtener historial completo de ajustes (inmutable)
 * @query   id_producto (opcional), limit (default: 50)
 * @access  Private
 */
router.get('/historial', verificarToken, getHistorialAjustes);

/**
 * @route   GET /api/productos/ajustes
 * @desc    Obtener todos los ajustes con filtros
 * @query   fecha_inicio, fecha_fin, tipo_ajuste, id_usuario, limit, offset
 * @access  Private
 */
router.get('/', verificarToken, getTodosLosAjustes);

/**
 * @route   POST /api/productos/ajustes
 * @desc    Realizar conteo físico y ajustar inventario
 * @body    { id_producto, stock_fisico, motivo, observaciones }
 * @access  Private
 */
router.post('/', verificarToken, realizarConteoFisico);

/**
 * @route   GET /api/productos/ajustes/:id
 * @desc    Obtener detalle de un ajuste específico
 * @params  id (id_ajuste)
 * @access  Private
 */
router.get('/:id', verificarToken, getDetalleAjuste);

/**
 * @route   PUT /api/productos/ajustes/:id/aprobar
 * @desc    Aprobar un ajuste (para supervisores)
 * @params  id (id_ajuste)
 * @access  Private (requiere rol supervisor)
 */
router.put('/:id/aprobar', verificarToken, aprobarAjuste);

/**
 * @route   GET /api/productos/:idProducto/ajustes
 * @desc    Obtener ajustes de un producto específico
 * @params  idProducto
 * @query   limit (default: 20)
 * @access  Private
 */
router.get('/producto/:idProducto', verificarToken, getAjustesPorProducto);

export default router;