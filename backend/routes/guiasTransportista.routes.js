import express from 'express';
import { verificarToken } from '../middleware/auth.js';
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

router.get('/estadisticas', verificarToken, getEstadisticasGuiasTransportista);
router.get('/transportistas-frecuentes', verificarToken, getTransportistasFrecuentes);
router.get('/conductores-frecuentes', verificarToken, getConductoresFrecuentes);
router.get('/vehiculos-frecuentes', verificarToken, getVehiculosFrecuentes);
router.get('/', verificarToken, getAllGuiasTransportista);
router.post('/', verificarToken, createGuiaTransportista);
router.get('/:id/pdf', verificarToken, descargarPDFGuiaTransportista);
router.put('/:id/estado', verificarToken, actualizarEstadoGuiaTransportista);
router.get('/:id', verificarToken, getGuiaTransportistaById);

export default router;