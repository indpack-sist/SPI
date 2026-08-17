import { executeQuery } from '../config/database.js';
import { validarRUC as apiValidarRUC, validarDNI as apiValidarDNI } from './api-validation.service.js';

// ============================================================
// Caché de consultas RUC/DNI (SUNAT/RENIEC vía APISPeru).
// Drop-in de api-validation.service: misma firma y misma forma de
// respuesta, pero sirve desde la BD si el documento ya se consultó
// hace poco, ahorrando cupo del plan gratuito. Beneficia tanto a
// Prospección como a la validación de Clientes.
//
// Si la tabla documento_cache no existe todavía, todo cae con
// gracia a la consulta directa (no rompe nada).
// ============================================================

const TTL_DIAS = 60; // frescura del dato antes de re-consultar

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
  } catch { /* tabla ausente / error: se ignora y se consulta directo */ }
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
  } catch { /* noop */ }
}

/** Igual que api-validation.validarRUC pero con caché. */
export async function validarRUC(ruc) {
  const doc = soloDigitos(ruc);
  if (!/^\d{11}$/.test(doc)) return apiValidarRUC(ruc); // que la API devuelva el error de formato

  const hit = await leerCache(doc);
  if (hit && hit.valido && hit.datos) {
    return { valido: true, datos: hit.datos, cache: true };
  }

  const res = await apiValidarRUC(ruc);
  // Solo cacheamos respuestas confiables (no timeouts / caídas del servicio).
  if (res.valido && res.datos && !res.error_servicio) {
    await guardarCache(doc, 'RUC', res.datos);
  }
  return res;
}

/** Igual que api-validation.validarDNI pero con caché. */
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
