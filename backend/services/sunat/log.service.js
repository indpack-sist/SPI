import { pool } from '../../config/database.js';

export async function registrarSunatLog(e, conn = pool) {
  try {
    await conn.query(
      'INSERT INTO sunat_log (origen, referencia_id, evento, exito, http_status, detalle, duracion_ms) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        e.origen,
        e.referenciaId ?? null,
        e.evento,
        e.exito ? 1 : 0,
        e.httpStatus ?? null,
        e.detalle != null ? String(e.detalle).slice(0, 4000) : null,
        e.duracionMs ?? null
      ]
    );
  } catch (err) {
    console.error('[SUNAT] No se pudo escribir sunat_log:', err.message);
  }
}
