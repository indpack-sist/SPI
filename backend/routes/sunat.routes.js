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

export default router;
