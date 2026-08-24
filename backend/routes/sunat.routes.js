// backend/routes/sunat.routes.js
// Rutas del módulo SUNAT (montado en /api/sunat desde server.js).
// FASE 4: /ping público (verificación de deploy) y /health protegido por permiso 'facturacion'.
// Los endpoints de emisión/notas/bajas/GRE se añaden en las Fases 6+.
import { Router } from 'express';
import { verificarToken, verificarPermiso } from '../middleware/auth.js';
import * as c from '../controllers/sunat.controller.js';

const router = Router();

// Público: no expone datos sensibles, solo el modo (BETA/PROD).
router.get('/ping', c.ping);

// Protegido: requiere token + permiso 'facturacion' (Administrador / Administrativo).
router.get('/health', verificarToken, verificarPermiso('facturacion'), c.health);

// Emisión de comprobantes (Fase 6: solo Factura 01).
router.post('/comprobantes/emitir', verificarToken, verificarPermiso('facturacion'), c.emitirComprobante);

// Notas de Crédito (07) y Débito (08) sobre una factura aceptada (Fase 7).
router.post('/comprobantes/notas/emitir', verificarToken, verificarPermiso('facturacion'), c.emitirNota);

// Comunicación de Baja (RA) sobre factura/nota aceptada, ≤7 días (Fase 8).
router.post('/comprobantes/baja', verificarToken, verificarPermiso('facturacion'), c.darDeBajaFactura);

// Consulta/reconciliación de estado (BD + getStatusCdr en PROD) — Fase 9.
router.get('/comprobantes/:id/estado', verificarToken, verificarPermiso('facturacion'), c.verificarEstado);

// GRE Remitente (09) por API REST — Fase 10.
router.post('/guias/:id/emitir', verificarToken, verificarPermiso('facturacion'), c.emitirGuiaRemision);
router.get('/guias/:id/estado', verificarToken, verificarPermiso('facturacion'), c.verificarEstadoGuia);
// Fase 12: dejar sin efecto una GRE aceptada (traslado no iniciado; Admin puede forzar).
router.post('/guias/:id/sin-efecto', verificarToken, verificarPermiso('facturacion'), c.dejarSinEfectoGuia);
// Fase 12: reemplazar una GRE aceptada por una nueva corregida (emite la nueva vía SUNAT).
router.post('/guias/:id/reemplazar', verificarToken, verificarPermiso('facturacion'), c.reemplazarGuia);
// Diagnóstico aislado del token OAuth GRE (Fase 10).
router.get('/gre/token/test', verificarToken, verificarPermiso('facturacion'), c.probarTokenGre);

// Representación impresa (PDF) con QR y hash — Fase 13.
router.get('/comprobantes/:id/pdf', verificarToken, verificarPermiso('facturacion'), c.generarPdfComprobante);
router.get('/guias/:id/pdf', verificarToken, verificarPermiso('facturacion'), c.generarPdfGuia);

export default router;
