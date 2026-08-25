import axios from 'axios';
import { buscarBasico, detallar, placesDisponible } from './scraper-places.service.js';
import { similitudNombre } from './ruc-lookup.service.js';

// ============================================================
// Descubrimiento de la WEB de una empresa por su nombre (razón social).
// Cierra el eslabón que faltaba: un prospecto que solo tiene datos legales
// (ingresado por RUC/SUNAT) no trae web, y sin web no se pueden raspar
// teléfonos/correos. Aquí la buscamos combinando fuentes EN CASCADA y nos
// quedamos con la mejor:
//   1) Google Places  → web oficial + teléfono (fiable, consume cuota).
//   2) Búsqueda web gratis (DuckDuckGo HTML) → dominio oficial por nombre
//      (respaldo, sin API key; menos preciso, puede fallar).
//
// Best-effort: si ninguna fuente resuelve, devuelve null y el flujo sigue.
// ============================================================

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = 12000;

// Similitud mínima nombre-empresa ↔ nombre-resultado para aceptar una web
// como "de esa empresa" (evita agarrar el dominio de otra compañía).
const UMBRAL_SIM = 0.34;

// Dominios que NO son la web propia de una empresa: directorios, redes,
// buscadores, agregadores. Nunca se toman como "web oficial".
const DOMINIO_NO_OFICIAL = /(^|\.)(facebook|instagram|linkedin|twitter|x|tiktok|youtube|wa\.me|whatsapp|google|goo\.gl|maps|bing|duckduckgo|yahoo|wikipedia|mercadolibre|olx|paginasamarillas|paginasblancas|guiatelefonica|ruc\.pe|universidadperu|datosperu|peruinforma|deperu|clave-?unica|gob\.pe|sunat|infobae|blogspot|wordpress\.com|wixsite|amazonaws|indeed|computrabajo|bumeran|glassdoor)\./i;

// Throttle global para la búsqueda gratis: DuckDuckGo limita ráfagas.
const MIN_GAP_MS = Number(process.env.WEB_LOOKUP_GAP_MS) || 1200;
let ultimaPeticion = 0;
async function esperarTurno() {
  const espera = ultimaPeticion + MIN_GAP_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaPeticion = Date.now();
}

/** Devuelve el host base (protocolo//host) de una URL, o null si es inválida. */
function baseDeUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    return `${p.protocol}//${p.host}`;
  } catch {
    return null;
  }
}

/** Host sin www ni protocolo (para comparar/filtrar). */
function hostDe(url) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).host.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

// -----------------------------------------------------------------
// Fuente 1: Google Places (web oficial + teléfono)
// -----------------------------------------------------------------
async function porPlaces(nombre, zona) {
  if (!placesDisponible()) return null;
  const res = await buscarBasico(nombre, { zona: zona || 'Perú', limite: 3 });
  if (!res.ok || !res.resultados.length) return null;

  // Elige el resultado cuyo nombre más se parece al buscado.
  const mejor = res.resultados
    .map((r) => ({ r, sim: similitudNombre(nombre, r.razon_social) }))
    .sort((a, b) => b.sim - a.sim)[0];
  if (!mejor || mejor.sim < UMBRAL_SIM || !mejor.r.place_id) return null;

  const det = await detallar(mejor.r.place_id);
  const web = baseDeUrl(det?.web);
  if (!web && !det?.telefono) return null;
  // Si Places dio web pero es una red/directorio, no la tomamos como oficial
  // (pero conservamos el teléfono si lo hubo).
  if (web && DOMINIO_NO_OFICIAL.test(hostDe(web) + '.')) {
    return det?.telefono ? { web: null, telefono: det.telefono, fuente: 'google_places', place_id: mejor.r.place_id } : null;
  }
  return { web, telefono: det?.telefono || null, fuente: 'google_places', place_id: mejor.r.place_id };
}

// -----------------------------------------------------------------
// Fuente 2: Búsqueda web gratis (DuckDuckGo HTML)
// -----------------------------------------------------------------
async function porBusquedaGratis(nombre) {
  await esperarTurno();
  let html = '';
  try {
    const r = await axios.post(
      'https://html.duckduckgo.com/html/',
      new URLSearchParams({ q: `${nombre} Perú` }).toString(),
      {
        timeout: TIMEOUT,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' },
        responseType: 'text',
        validateStatus: (s) => s >= 200 && s < 400,
      }
    );
    html = typeof r.data === 'string' ? r.data : '';
  } catch {
    return null;
  }
  if (!html) return null;

  // Los resultados de DDG HTML llevan la URL real en el parámetro uddg=<url>.
  const candidatos = [];
  const vistos = new Set();
  for (const m of html.matchAll(/[?&]uddg=([^&"']+)/g)) {
    let url;
    try { url = decodeURIComponent(m[1]); } catch { continue; }
    const base = baseDeUrl(url);
    if (!base) continue;
    const host = hostDe(base);
    if (!host || vistos.has(host)) continue;
    vistos.add(host);
    if (DOMINIO_NO_OFICIAL.test(host + '.')) continue;
    candidatos.push(base);
    if (candidatos.length >= 5) break;
  }
  if (!candidatos.length) return null;

  // Preferimos un dominio cuyo nombre se parezca a la empresa (ej. razón
  // social "ALFA PACK SAC" ↔ dominio "alfapack.com"). Si ninguno calza,
  // tomamos el primer resultado plausible (suele ser la web oficial).
  const conSim = candidatos
    .map((base) => ({ base, sim: similitudNombre(nombre, hostDe(base).replace(/\.[a-z.]+$/i, '').replace(/[-_]/g, ' ')) }))
    .sort((a, b) => b.sim - a.sim);
  const elegido = conSim[0].sim >= UMBRAL_SIM ? conSim[0].base : candidatos[0];
  return { web: elegido, telefono: null, fuente: 'busqueda_web' };
}

/**
 * Encuentra la web (y, si Places la da, el teléfono) de una empresa por su
 * nombre, probando las fuentes en cascada. Devuelve la primera web utilizable;
 * si Places solo dio teléfono, lo conserva aunque la web venga de otra fuente.
 *
 * @param {string} nombre  razón social / nombre de la empresa
 * @param {object} [opts]  { zona }
 * @returns {Promise<{web:(string|null), telefono:(string|null), fuente:string, place_id?:string}|null>}
 */
export async function descubrirWeb(nombre, opts = {}) {
  if (!nombre || nombre.trim().length < 3) return null;

  let telefonoPlaces = null;
  let placeId = null;

  // 1) Google Places (mejor dato: web + teléfono).
  try {
    const p = await porPlaces(nombre, opts.zona);
    if (p && p.web) return p;
    telefonoPlaces = p?.telefono || null; // sin web pero con teléfono: lo guardamos
    placeId = p?.place_id || null;
  } catch { /* best-effort */ }

  // 2) Búsqueda web gratis (respaldo sin API).
  try {
    const b = await porBusquedaGratis(nombre);
    if (b && b.web) {
      return { web: b.web, telefono: telefonoPlaces, fuente: b.fuente, place_id: placeId || undefined };
    }
  } catch { /* best-effort */ }

  // Sin web, pero al menos con teléfono de Places (mejor que nada).
  if (telefonoPlaces) return { web: null, telefono: telefonoPlaces, fuente: 'google_places', place_id: placeId || undefined };
  return null;
}
