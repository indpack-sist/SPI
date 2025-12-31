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

router.get('/estadisticas', getEstadisticasGuiasRemision);

router.get('/', getAllGuiasRemision);
router.post('/', createGuiaRemision);

router.get('/:id/pdf', descargarPDFGuiaRemision);
router.post('/:id/despachar', despacharGuiaRemision); // 🔥 GENERA SALIDAS AUTOMÁTICAS
router.post('/:id/entregar', marcarEntregadaGuiaRemision);
router.put('/:id/estado', actualizarEstadoGuiaRemision);

router.get('/:id', getGuiaRemisionById);

export default router;