// =====================================================
// backend/routes/guiasTransportista.routes.js
// =====================================================

import express from 'express';
import {
  getAllGuiasTransportista,
  getGuiaTransportistaById,
  createGuiaTransportista,
  actualizarEstado,
  getTransportistasFrecuentes,
  getConductoresFrecuentes,
  getVehiculosFrecuentes,
  getEstadisticas,
  getPDFGuiaTransportista // <--- Ahora lo importamos correctamente
} from '../controllers/guiasTransportista.controller.js';

const router = express.Router();

// Estadísticas
router.get('/estadisticas', getEstadisticas);

// Catálogos de frecuentes
router.get('/transportistas-frecuentes', getTransportistasFrecuentes);
router.get('/conductores-frecuentes', getConductoresFrecuentes);
router.get('/vehiculos-frecuentes', getVehiculosFrecuentes);

// CRUD básico
router.get('/', getAllGuiasTransportista);
router.get('/:id', getGuiaTransportistaById);
router.post('/', createGuiaTransportista);

// Actualizar estado
router.patch('/:id/estado', actualizarEstado);

// Generar PDF (Línea corregida)
router.get('/:id/pdf', getPDFGuiaTransportista);

export default router;