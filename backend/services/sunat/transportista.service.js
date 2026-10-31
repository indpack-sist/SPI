import { pool } from '../../config/database.js';
import { rucValido } from './util.service.js';

export async function historialConductor(dni) {
  const [rows] = await pool.query(
    `SELECT nombre, licencia FROM (
       SELECT transporte_conductor AS nombre, transporte_licencia AS licencia, id_guia, sunat_estado
         FROM guias_remision
        WHERE transporte_dni = ? AND estado <> 'Anulada' AND transporte_licencia <> ''
       UNION ALL
       SELECT transporte_conductor2, transporte_licencia2, id_guia, sunat_estado
         FROM guias_remision
        WHERE transporte_dni2 = ? AND estado <> 'Anulada' AND transporte_licencia2 <> ''
     ) h
     ORDER BY (sunat_estado = 'ACEPTADO') DESC, id_guia DESC
     LIMIT 1`,
    [dni, dni]);
  return rows[0] || null;
}

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
