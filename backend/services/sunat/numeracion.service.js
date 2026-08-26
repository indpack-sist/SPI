// services/sunat/numeracion.service.js
// Correlativos atómicos. DEBEN llamarse con una conexión ya dentro de una transacción
// (ver withTransaction en config/database.js) para evitar duplicados bajo concurrencia.

import { pool } from '../../config/database.js';

/**
 * Siguiente correlativo de una serie de comprobante (FE01, FC01, FD01, TE01, VE01).
 * Patrón atómico UPDATE ... LAST_INSERT_ID(ultimo_numero + 1).
 * @returns {Promise<number>} el número asignado (la primera emisión toma el 1).
 */
export async function obtenerCorrelativo(conn, tipoDocumento, serie) {
  const [upd] = await conn.query(
    'UPDATE series_correlativos SET ultimo_numero = LAST_INSERT_ID(ultimo_numero + 1) ' +
    'WHERE tipo_documento = ? AND serie = ?',
    [tipoDocumento, serie]
  );
  if (!upd.affectedRows) {
    throw new Error(`Serie no registrada en series_correlativos: tipo=${tipoDocumento} serie=${serie}`);
  }
  const [[row]] = await conn.query('SELECT LAST_INSERT_ID() AS numero');
  return Number(row.numero);
}

/**
 * Variante autónoma de obtenerCorrelativo para llamadores que NO están dentro de una
 * transacción (p. ej. createGuiaRemision, que usa executeQuery). Toma su PROPIA conexión
 * del pool y ejecuta UPDATE + SELECT LAST_INSERT_ID() en la MISMA sesión: el UPDATE toma
 * el row-lock y LAST_INSERT_ID() es por-sesión, así que es atómico sin envolver todo en TX.
 * @returns {Promise<number>} el número asignado (la primera emisión toma el 1).
 */
export async function obtenerCorrelativoAtomico(tipoDocumento, serie) {
  const conn = await pool.getConnection();
  try {
    return await obtenerCorrelativo(conn, tipoDocumento, serie);
  } finally {
    conn.release();
  }
}

/**
 * Correlativo diario para Comunicaciones de Baja (RA), reiniciado por fecha.
 * @param {string} fecha 'YYYY-MM-DD' (fecha de la comunicación).
 * @returns {Promise<number>} correlativo del día (arranca en 1).
 */
export async function obtenerCorrelativoDiario(conn, tipo, fecha) {
  await conn.query(
    'INSERT INTO sunat_correlativos_diarios (tipo, fecha, ultimo) VALUES (?, ?, LAST_INSERT_ID(1)) ' +
    'ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)',
    [tipo, fecha]
  );
  const [[row]] = await conn.query('SELECT LAST_INSERT_ID() AS numero');
  return Number(row.numero);
}
