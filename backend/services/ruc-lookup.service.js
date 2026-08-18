import axios from 'axios';

// ============================================================
// Búsqueda de RUC por NOMBRE en directorios públicos (100% gratis, SIN APISPeru).
// El scraping de la web propia solo obtiene el RUC si la empresa lo publica;
// esto cubre el resto deduciéndolo del nombre en páginas que indexan datos
// públicos de SUNAT (ruc.pe, universidadperu.com). Esas páginas ya traen la
// razón social y el estado (ACTIVO/HABIDO), así que NO hace falta confirmar
// contra SUNAT: todo se saca de la misma página.
//
// Triple candado anti-error: (1) checksum RUC módulo 11, (2) el nombre oficial
// de la página debe parecerse al del prospecto, (3) solo deep-links por nombre
// (páginas de una sola empresa) para no confundir RUCs.
//
// Opt-in por env RUC_LOOKUP_NOMBRE=1 (solo consume red, nada de cuota de APIs).
// ============================================================

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = 12000;
const DIACRITICOS = /[̀-ͯ]/g;

/** Valida el dígito verificador del RUC (módulo 11). Filtra basura de la web. */
export function rucChecksumValido(ruc) {
  if (!/^\d{11}$/.test(ruc)) return false;
  if (!/^(10|15|16|17|20)/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) suma += Number(ruc[i]) * pesos[i];
  let resto = 11 - (suma % 11);
  if (resto === 10) resto = 0;
  else if (resto === 11) resto = 1;
  return resto === Number(ruc[10]);
}

/** Normaliza un nombre para comparar: sin tildes, sin sufijo societario, minúsculas. */
function normNombre(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICOS, '')
    .replace(/\b(s\.?\s?a\.?\s?c\.?|s\.?\s?a\.?\s?a\.?|s\.?\s?a\.?|e\.?\s?i\.?\s?r\.?\s?l\.?|s\.?\s?r\.?\s?l\.?|sociedad anonima cerrada|sociedad anonima|sac|saa|eirl|srl)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similitud por solapamiento de tokens (0..1). Descarta RUCs de otra empresa. */
export function similitudNombre(a, b) {
  const ta = new Set(normNombre(a).split(' ').filter(Boolean));
  const tb = new Set(normNombre(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

// Throttle global: ruc.pe limita las peticiones rápidas (timeouts / posible
// bloqueo de IP). Espaciamos todas las llamadas al menos MIN_GAP_MS entre sí,
// así un barrido con muchos prospectos es "educado" y no se gana un baneo.
const MIN_GAP_MS = Number(process.env.RUC_LOOKUP_GAP_MS) || 1500;
let ultimaPeticion = 0;
async function esperarTurno() {
  const espera = ultimaPeticion + MIN_GAP_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaPeticion = Date.now();
}

async function fetchText(url) {
  await esperarTurno();
  try {
    const r = await axios.get(url, {
      timeout: TIMEOUT,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof r.data === 'string' ? r.data : '';
  } catch {
    return '';
  }
}

const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');

/** Extrae RUCs candidatos (11 dígitos con checksum válido) presentes en un HTML. */
export function rucsEnHtml(html) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/\b((?:10|15|16|17|20)\d{9})\b/g)) {
    if (rucChecksumValido(m[1])) out.add(m[1]);
  }
  return [...out];
}

// Limpia el nombre de empresa quitando adornos de ruc.pe: el prefijo "RUC ",
// la marca "RUC.PE", RUCs sueltos y separadores. Ej: "RUC INDPACK SAC - RUC.PE"
// -> "INDPACK SAC".
function limpiarNombreEmpresa(s) {
  return String(s || '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\bruc\.?\s*pe\b/gi, ' ')         // marca del sitio "RUC.PE"
    .replace(/\b\d{11}\b/g, ' ')               // RUCs sueltos en el texto
    .replace(/^[\s\-|»·:]*ruc\b[\s:]*/i, ' ')  // prefijo "RUC " de ruc.pe
    .replace(/[\s\-|»·:]+$/g, '')              // colas de separadores
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nombres candidatos de la empresa desde el HTML (título/og:title/h1, sin adornos). */
function nombresEnHtml(html) {
  const cands = [];
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) cands.push(og[1]);
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (t) cands.push(t[1]);
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) cands.push(h1[1]);
  return cands.map(limpiarNombreEmpresa).filter(Boolean);
}

/** Vigencia SUNAT leída de la propia página (gratis): estado y condición. */
function vigenciaEnHtml(html) {
  const txt = stripTags(html).toUpperCase();
  let es_activo;
  if (/\bACTIVO\b/.test(txt)) es_activo = true;
  else if (/\b(BAJA|SUSPENSI[OÓ]N)\b/.test(txt)) es_activo = false;
  let es_habido;
  if (/\bNO\s+HABIDO\b/.test(txt)) es_habido = false;
  else if (/\bHABIDO\b/.test(txt)) es_habido = true;
  return { es_activo, es_habido };
}

/** Evalúa una ficha de empresa: RUC + nombre + vigencia, si el nombre calza. */
function evaluarFicha(html, nombre, umbral) {
  const rucs = rucsEnHtml(html);
  if (!rucs.length) return null;
  const nombres = nombresEnHtml(html);
  const sim = nombres.reduce((mx, n) => Math.max(mx, similitudNombre(nombre, n)), 0);
  if (sim < umbral) return null;
  return { ruc: rucs[0], datos: { razon_social: nombres[0] || null, ...vigenciaEnHtml(html) }, sim };
}

// Slugs de ruc.pe que NO son fichas de empresa (evita seguirlos desde el buscador).
const SLUG_NO_EMPRESA = /^(wp-|category|tag|author|page|feed|comments|privacidad|contacto|acerca|terminos|nosotros|blog)$|^$/i;

/**
 * Busca el RUC de una empresa por su nombre en ruc.pe. Todo se obtiene de la
 * propia página (RUC, razón social, vigencia): SIN APISPeru.
 *
 * Estrategia: buscador de ruc.pe (?s=nombre) → elige el resultado cuyo título
 * más se parece al buscado → abre esa ficha y saca RUC + vigencia. Solo 2
 * peticiones (buscar + ficha): rápido y sin martillar el sitio. Devuelve
 * { ruc, datos, sim } solo si el nombre calza (evita asignar el RUC de otra
 * empresa); null si no hay match claro.
 *
 * @param {string} nombre  razón social del prospecto
 * @param {object} [opts]  { umbral = 0.5 }
 * @returns {Promise<{ruc:string, datos:object, sim:number}|null>}
 */
export async function buscarRucPorNombre(nombre, opts = {}) {
  const umbral = opts.umbral ?? 0.5;
  if (!nombre || nombre.trim().length < 3) return null;

  const html = await fetchText(`https://ruc.pe/?s=${encodeURIComponent(nombre)}`);
  if (!html) return null;

  // Enlaces a fichas de empresa (URL absoluta de ruc.pe) con su título. Se elige
  // el de mayor parecido de nombre; el resto (banca lateral, otras empresas) se
  // descarta por baja similitud.
  const vistos = new Set();
  const cands = [];
  for (const m of html.matchAll(/<a[^>]+href=["'](https?:\/\/ruc\.pe\/([a-z0-9][a-z0-9-]*)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, url, slug, inner] = m;
    if (SLUG_NO_EMPRESA.test(slug) || vistos.has(slug)) continue;
    vistos.add(slug);
    const texto = limpiarNombreEmpresa(stripTags(inner));
    if (texto) cands.push({ url, sim: similitudNombre(nombre, texto) });
  }
  cands.sort((a, b) => b.sim - a.sim);
  const mejor = cands[0];
  if (!mejor || mejor.sim < umbral) return null;

  // Abre la ficha del mejor candidato para obtener el RUC + vigencia.
  return evaluarFicha(await fetchText(mejor.url), nombre, umbral);
}
