// services/sunat/log.service.js
// Trazabilidad: toda operación contra SUNAT debe escribir una fila en sunat_log.
// No lanza si el log falla (nunca romper el flujo de negocio por un error de auditoría).
import { pool } from '../../config/database.js';

/**
 * @param {Object}  e
 * @param {('FACTURA'|'BOLETA'|'NOTA'|'BAJA'|'RESUMEN'|'GRE_REMITENTE'|'GRE_TRANSPORTISTA'|'CONSULTA'|'TOKEN')} e.origen
 * @param {number} [e.referenciaId]  id del registro origen
 * @param {string}  e.evento         'sendBill', 'getStatus', 'token', 'envioGRE'...
 * @param {boolean} e.exito
 * @param {number} [e.httpStatus]
 * @param {string} [e.detalle]       faultcode/mensaje o resumen de respuesta
 * @param {number} [e.duracionMs]
 * @param {Object} [conn]            conexión de transacción; por defecto el pool
 */
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
