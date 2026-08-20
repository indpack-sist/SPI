// controllers/sunat.controller.js
// Orquestación del módulo SUNAT. En la FASE 4 solo expone ping (público) y health (protegido
// por permiso 'facturacion'). Los casos de uso reales (emitirComprobante, emitirNota,
// darDeBajaFactura, GRE...) se añaden en las Fases 6+.
import { sunatConfig } from '../config/sunat.js';

// GET /api/sunat/ping  -> verificación de despliegue (sin auth)
export async function ping(req, res) {
  res.json({ mode: sunatConfig.mode });
}

// GET /api/sunat/health -> verifica que el permiso 'facturacion' está operativo
export async function health(req, res) {
  res.json({
    ok: true,
    mode: sunatConfig.mode,
    rol: req.user?.rol || null
  });
}
