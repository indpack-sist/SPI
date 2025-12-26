// =====================================================
// backend/routes/guiasTransportista.routes.js
// =====================================================

import express from 'express';
import { getPDFGuiaTransportista } from '../controllers/guiasTransportista.controller.js';


import {
  getAllGuiasTransportista,
  getGuiaTransportistaById,
  createGuiaTransportista,
  actualizarEstado,
  getTransportistasFrecuentes,
  getConductoresFrecuentes,
  getVehiculosFrecuentes,
  getEstadisticas
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
router.get('/:id/pdf', getPDFCotizacion);
router.get('/:id/pdf', getPDFGuiaTransportista);

export default router;