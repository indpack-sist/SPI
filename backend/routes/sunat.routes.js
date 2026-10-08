import { Router } from 'express';
import { verificarToken, verificarPermiso } from '../middleware/auth.js';
import * as c from '../controllers/sunat.controller.js';
import * as traza from '../controllers/trazabilidad-see.controller.js';

const router = Router();

function emitirCambioSunat(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      try { req.app.get('socketio')?.emit('sunat:cambio', { origen: 'accion', ruta: req.path }); }
      catch {}
    }
  });
  next();
}

router.get('/ping', c.ping);

router.get('/health', verificarToken, verificarPermiso('facturacion'), c.health);

router.post('/comprobantes/preview', verificarToken, verificarPermiso('facturacion'), c.previewComprobante);

router.post('/comprobantes/notas/preview', verificarToken, verificarPermiso('facturacion'), c.previewNota);

router.post('/comprobantes/emitir', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.emitirComprobante);

router.post('/comprobantes/notas/emitir', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.emitirNota);

router.post('/comprobantes/baja', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.darDeBajaFactura);

router.get('/comprobantes/:id/estado', verificarToken, verificarPermiso('facturacion'), c.verificarEstado);

router.get('/guias/:id/validar', verificarToken, verificarPermiso('facturacion'), c.validarGuia);
router.post('/guias/:id/emitir', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.emitirGuiaRemision);
router.get('/guias/:id/estado', verificarToken, verificarPermiso('facturacion'), c.verificarEstadoGuia);
router.post('/guias/:id/baja/confirmar', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.dejarSinEfectoGuia);
router.post('/guias/:id/sin-efecto', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.dejarSinEfectoGuia);
router.post('/guias/:id/reemplazar', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.reemplazarGuia);
router.get('/gre/token/test', verificarToken, verificarPermiso('facturacion'), c.probarTokenGre);

router.get('/comprobantes/:id/pdf', verificarToken, verificarPermiso('facturacion', 'facturacionConsulta'), c.generarPdfComprobante);
router.get('/guias/:id/archivos/:tipo', verificarToken, verificarPermiso('facturacion', 'facturacionConsulta'), c.descargarArchivoGuia);
router.get('/guias/:id/pdf', verificarToken, verificarPermiso('facturacion', 'facturacionConsulta'), c.generarPdfGuia);

router.post('/jobs/tick', c.jobTick);
router.get('/monitor', verificarToken, verificarPermiso('facturacion'), c.monitorSunat);

router.get('/trazabilidad/comprobantes', verificarToken, verificarPermiso('facturacion'), traza.listarComprobantes);
router.get('/trazabilidad/guias', verificarToken, verificarPermiso('facturacion'), traza.listarGuias);

export default router;
