// backend/routes/sunat.routes.js
// Rutas del módulo SUNAT (montado en /api/sunat desde server.js).
// FASE 4: /ping público (verificación de deploy) y /health protegido por permiso 'facturacion'.
// Los endpoints de emisión/notas/bajas/GRE se añaden en las Fases 6+.
import { Router } from 'express';
import { verificarToken, verificarPermiso } from '../middleware/auth.js';
import * as c from '../controllers/sunat.controller.js';

const router = Router();

// Emite 'sunat:cambio' por Socket.IO tras una mutación SUNAT exitosa (respuesta 2xx/3xx), para que
// el Monitor SUNAT se refresque en vivo sin botón. Centralizado aquí para no tocar cada handler;
// usa res 'finish' y se salta en respuestas de error. (El job de reintentos emite por su cuenta.)
function emitirCambioSunat(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      try { req.app.get('socketio')?.emit('sunat:cambio', { origen: 'accion', ruta: req.path }); }
      catch { /* noop */ }
    }
  });
  next();
}

// Público: no expone datos sensibles, solo el modo (BETA/PROD).
router.get('/ping', c.ping);

// Protegido: requiere token + permiso 'facturacion' (Administrador / Administrativo).
router.get('/health', verificarToken, verificarPermiso('facturacion'), c.health);

// Vista previa de emisión (solo lectura): totales/desglose con el MISMO cálculo del UBL builder.
router.post('/comprobantes/preview', verificarToken, verificarPermiso('facturacion'), c.previewComprobante);

// Vista previa de una Nota (07/08) — preliminar estilo SUNAT (solo lectura, no numera ni envía).
router.post('/comprobantes/notas/preview', verificarToken, verificarPermiso('facturacion'), c.previewNota);

// Emisión de comprobantes (Fase 6: solo Factura 01).
router.post('/comprobantes/emitir', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.emitirComprobante);

// Notas de Crédito (07) y Débito (08) sobre una factura aceptada (Fase 7).
router.post('/comprobantes/notas/emitir', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.emitirNota);

// Comunicación de Baja (RA) sobre factura/nota aceptada, ≤7 días (Fase 8).
router.post('/comprobantes/baja', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.darDeBajaFactura);

// Consulta/reconciliación de estado (BD + getStatusCdr en PROD) — Fase 9.
router.get('/comprobantes/:id/estado', verificarToken, verificarPermiso('facturacion'), c.verificarEstado);

// GRE Remitente (09) por API REST — Fase 10.
router.post('/guias/:id/emitir', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.emitirGuiaRemision);
router.get('/guias/:id/estado', verificarToken, verificarPermiso('facturacion'), c.verificarEstadoGuia);
// Fase 12: dejar sin efecto una GRE aceptada (traslado no iniciado; Admin puede forzar).
router.post('/guias/:id/sin-efecto', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.dejarSinEfectoGuia);
// Fase 12: reemplazar una GRE aceptada por una nueva corregida (emite la nueva vía SUNAT).
router.post('/guias/:id/reemplazar', verificarToken, verificarPermiso('facturacion'), emitirCambioSunat, c.reemplazarGuia);
// Diagnóstico aislado del token OAuth GRE (Fase 10).
router.get('/gre/token/test', verificarToken, verificarPermiso('facturacion'), c.probarTokenGre);

// Representación impresa (PDF) con QR y hash — Fase 13.
// El PDF también lo pueden descargar los perfiles de venta en solo lectura (facturacionConsulta).
router.get('/comprobantes/:id/pdf', verificarToken, verificarPermiso('facturacion', 'facturacionConsulta'), c.generarPdfComprobante);
router.get('/guias/:id/pdf', verificarToken, verificarPermiso('facturacion', 'facturacionConsulta'), c.generarPdfGuia);

// Fase 15: cola de reintentos / monitor. /jobs/tick se protege por TOKEN INTERNO (header
// x-jobs-token) dentro del handler, para un scheduler externo → sin verificarToken aquí.
router.post('/jobs/tick', c.jobTick);
// Monitor SUNAT (solo lectura) para el panel de Reportes.
router.get('/monitor', verificarToken, verificarPermiso('facturacion'), c.monitorSunat);

export default router;
