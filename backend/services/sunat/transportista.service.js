import { pool } from '../../config/database.js';
import { rucValido } from './util.service.js';

export async function upsertTransportista(ruc, razon_social, numero_mtc) {
  const rucLimpio = String(ruc || '').trim();
  if (!rucValido(rucLimpio) || !razon_social || !String(razon_social).trim()) return null;
  const razon = String(razon_social).trim();
  const mtc = numero_mtc ? String(numero_mtc).trim() : null;

  const [rows] = await pool.query('SELECT id_transportista FROM transportistas WHERE ruc = ?', [rucLimpio]);
  if (rows.length > 0) {
    const idT = rows[0].id_transportista;
    await pool.query(
      'UPDATE transportistas SET razon_social = ?, numero_mtc = COALESCE(?, numero_mtc), activo = 1 WHERE id_transportista = ?',
      [razon, mtc, idT]);
    return idT;
  }
  const [ins] = await pool.query(
    'INSERT INTO transportistas (ruc, razon_social, numero_mtc) VALUES (?, ?, ?)',
    [rucLimpio, razon, mtc]);
  return ins.insertId || null;
}
