import express from 'express';
import {
  getAllGuiasTransportista,
  getGuiaTransportistaById,
  createGuiaTransportista,
  actualizarEstadoGuiaTransportista,
  getTransportistasFrecuentes,
  getConductoresFrecuentes,
  getVehiculosFrecuentes,
  getEstadisticasGuiasTransportista,
  descargarPDFGuiaTransportista
} from '../controllers/guiasTransportista.controller.js';

const router = express.Router();

// ============================================
// RUTAS ESTÁTICAS (sin parámetros)
// ============================================
router.get('/estadisticas', getEstadisticasGuiasTransportista);
router.get('/transportistas-frecuentes', getTransportistasFrecuentes);
router.get('/conductores-frecuentes', getConductoresFrecuentes);
router.get('/vehiculos-frecuentes', getVehiculosFrecuentes);

// ============================================
// RUTAS DE GUÍAS DE TRANSPORTISTA (base)
// ============================================
router.get('/', getAllGuiasTransportista);
router.post('/', createGuiaTransportista);

// ============================================
// RUTAS CON :id (ORDEN IMPORTANTE)
// ============================================
// ✅ RUTAS ESPECÍFICAS PRIMERO (antes del GET /:id)
router.get('/:id/pdf', descargarPDFGuiaTransportista);
router.put('/:id/estado', actualizarEstadoGuiaTransportista);

// ✅ RUTAS GENERICAS AL FINAL
router.get('/:id', getGuiaTransportistaById);

export default router;