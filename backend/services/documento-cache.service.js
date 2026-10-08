import { executeQuery } from '../config/database.js';
import { validarRUC as apiValidarRUC, validarDNI as apiValidarDNI } from './api-validation.service.js';

const TTL_DIAS = 60;

function soloDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

async function leerCache(documento) {
  try {
    const r = await executeQuery(
      'SELECT valido, datos FROM documento_cache WHERE documento = ? AND fecha_actualizacion > (NOW() - INTERVAL ? DAY) LIMIT 1',
      [documento, TTL_DIAS]
    );
    if (r.success && r.data.length > 0) {
      const row = r.data[0];
      const datos = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos;
      return { valido: !!row.valido, datos };
    }
  } catch {}
  return null;
}

async function guardarCache(documento, tipo, datos) {
  try {
    await executeQuery(
      `INSERT INTO documento_cache (documento, tipo, valido, datos)
       VALUES (?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), valido = 1, datos = VALUES(datos), fecha_actualizacion = CURRENT_TIMESTAMP`,
      [documento, tipo, JSON.stringify(datos || null)]
    );
  } catch {}
}

export async function validarRUC(ruc) {
  const doc = soloDigitos(ruc);
  if (!/^\d{11}$/.test(doc)) return apiValidarRUC(ruc);

  const hit = await leerCache(doc);
  if (hit && hit.valido && hit.datos) {
    return { valido: true, datos: hit.datos, cache: true };
  }

  const res = await apiValidarRUC(ruc);
  if (res.valido && res.datos && !res.error_servicio) {
    await guardarCache(doc, 'RUC', res.datos);
  }
  return res;
}

export async function validarDNI(dni) {
  const doc = soloDigitos(dni);
  if (!/^\d{8}$/.test(doc)) return apiValidarDNI(dni);

  const hit = await leerCache(doc);
  if (hit && hit.valido && hit.datos) {
    return { valido: true, datos: hit.datos, cache: true };
  }

  const res = await apiValidarDNI(dni);
  if (res.valido && res.datos && !res.error_servicio) {
    await guardarCache(doc, 'DNI', res.datos);
  }
  return res;
}
