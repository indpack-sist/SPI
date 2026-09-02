import express from 'express';
import {
  getAllGuiasRemision,
  getGuiaRemisionById,
  createGuiaRemision,
  despacharGuiaRemision,
  actualizarEstadoGuiaRemision,
  marcarEntregadaGuiaRemision,
  getEstadisticasGuiasRemision,
  descargarPDFGuiaRemision,
  getTransportistas,
  createTransportista,
  getDestinatariosComex,
  createDestinatarioComex
} from '../controllers/guiasRemision.controller.js';

const router = express.Router();

router.get('/estadisticas', getEstadisticasGuiasRemision);

// Maestro de transportistas (terceros, modalidad pública). Declarado antes de '/:id'
// para que '/transportistas' no sea capturado por la ruta paramétrica.
router.get('/transportistas', getTransportistas);
router.post('/transportistas', createTransportista);

// Catálogo de destinatarios comex (exportación). Antes de '/:id' por el mismo motivo.
router.get('/destinatarios-comex', getDestinatariosComex);
router.post('/destinatarios-comex', createDestinatarioComex);

router.get('/', getAllGuiasRemision);
router.post('/', createGuiaRemision);

router.get('/:id/pdf', descargarPDFGuiaRemision);
router.post('/:id/despachar', despacharGuiaRemision);
router.post('/:id/entregar', marcarEntregadaGuiaRemision);
router.put('/:id/estado', actualizarEstadoGuiaRemision);

router.get('/:id', getGuiaRemisionById);

export default router;