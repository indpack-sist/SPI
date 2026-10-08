import express from 'express';
import {
  getAllGuiasRemision,
  getGuiaRemisionById,
  createGuiaRemision,
  createGuiaCompra,
  getEmpresaRemitente,
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

router.get('/transportistas', getTransportistas);
router.post('/transportistas', createTransportista);

router.get('/destinatarios-comex', getDestinatariosComex);
router.post('/destinatarios-comex', createDestinatarioComex);

router.get('/empresa-remitente', getEmpresaRemitente);

router.get('/', getAllGuiasRemision);
router.post('/', createGuiaRemision);
router.post('/compra', createGuiaCompra);

router.get('/:id/pdf', descargarPDFGuiaRemision);
router.post('/:id/despachar', despacharGuiaRemision);
router.post('/:id/entregar', marcarEntregadaGuiaRemision);
router.put('/:id/estado', actualizarEstadoGuiaRemision);

router.get('/:id', getGuiaRemisionById);

export default router;