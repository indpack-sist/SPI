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

router.get('/estadisticas', getEstadisticasGuiasTransportista);
router.get('/transportistas-frecuentes', getTransportistasFrecuentes);
router.get('/conductores-frecuentes', getConductoresFrecuentes);
router.get('/vehiculos-frecuentes', getVehiculosFrecuentes);
router.get('/', getAllGuiasTransportista);
router.post('/', createGuiaTransportista);

router.get('/:id/pdf', descargarPDFGuiaTransportista);
router.put('/:id/estado', actualizarEstadoGuiaTransportista);

router.get('/:id', getGuiaTransportistaById);

export default router;