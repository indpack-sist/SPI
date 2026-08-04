/**
 * Generación atómica de correlativos por serie.
 * Usa SELECT ... FOR UPDATE dentro de transacción para que dos emisiones
 * simultáneas nunca tomen el mismo número (SUNAT rechaza duplicados/huecos).
 */
import { pool } from '../../config/database.js';

export async function siguienteCorrelativo(tipoDocumento, serie) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT ultimo_numero FROM series_correlativos WHERE tipo_documento=? AND serie=? FOR UPDATE',
      [tipoDocumento, serie]
    );

    let numero;
    if (rows.length === 0) {
      numero = 1;
      await conn.query(
        'INSERT INTO series_correlativos (tipo_documento, serie, ultimo_numero) VALUES (?,?,?)',
        [tipoDocumento, serie, numero]
      );
    } else {
      numero = rows[0].ultimo_numero + 1;
      await conn.query(
        'UPDATE series_correlativos SET ultimo_numero=? WHERE tipo_documento=? AND serie=?',
        [numero, tipoDocumento, serie]
      );
    }

    await conn.commit();
    return numero;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
