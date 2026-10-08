import { pool } from '../../config/database.js';

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

export async function obtenerCorrelativoAtomico(tipoDocumento, serie) {
  const conn = await pool.getConnection();
  try {
    return await obtenerCorrelativo(conn, tipoDocumento, serie);
  } finally {
    conn.release();
  }
}

export async function obtenerCorrelativoDiario(conn, tipo, fecha) {
  await conn.query(
    'INSERT INTO sunat_correlativos_diarios (tipo, fecha, ultimo) VALUES (?, ?, LAST_INSERT_ID(1)) ' +
    'ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)',
    [tipo, fecha]
  );
  const [[row]] = await conn.query('SELECT LAST_INSERT_ID() AS numero');
  return Number(row.numero);
}
