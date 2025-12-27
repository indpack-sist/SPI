import express from 'express';
import {
  getAllGuiasRemision,
  getGuiaRemisionById,
  createGuiaRemision,
  despacharGuiaRemision,
  actualizarEstadoGuiaRemision,
  marcarEntregadaGuiaRemision,
  getEstadisticasGuiasRemision,
  descargarPDFGuiaRemision
} from '../controllers/guiasRemision.controller.js';

const router = express.Router();

// ============================================
// RUTAS ESTÁTICAS (sin parámetros)
// ============================================
router.get('/estadisticas', getEstadisticasGuiasRemision);

// ============================================
// RUTAS DE GUÍAS DE REMISIÓN (base)
// ============================================
router.get('/', getAllGuiasRemision);
router.post('/', createGuiaRemision);

// ============================================
// RUTAS CON :id (ORDEN IMPORTANTE)
// ============================================
// ✅ RUTAS ESPECÍFICAS PRIMERO (antes del GET /:id)
router.get('/:id/pdf', descargarPDFGuiaRemision);
router.post('/:id/despachar', despacharGuiaRemision); // 🔥 GENERA SALIDAS AUTOMÁTICAS
router.post('/:id/entregar', marcarEntregadaGuiaRemision);
router.put('/:id/estado', actualizarEstadoGuiaRemision);

// ✅ RUTAS GENERICAS AL FINAL
router.get('/:id', getGuiaRemisionById);

export default router;