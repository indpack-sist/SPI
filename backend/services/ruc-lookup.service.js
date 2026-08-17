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

/** Slug conservando el sufijo (ruc.pe suele usar "indpack-sac"). */
function slugConSufijo(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICOS, '')
    .replace(/[._]/g, '')          // "s.a.c" -> "sac"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Slug sin el sufijo societario (universidadperu suele usar "indpack"). */
function slugSinSufijo(nombre) {
  return normNombre(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function fetchText(url) {
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

/** Nombres candidatos de la empresa desde el HTML (título/og:title/h1, sin adornos). */
function nombresEnHtml(html) {
  const cands = [];
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) cands.push(og[1]);
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (t) cands.push(t[1]);
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) cands.push(h1[1]);
  // Corta el boilerplate: "- RUC 20...", " | ruc.pe", números largos, etc.
  return cands
    .map((s) => String(s).replace(/&[a-z]+;/gi, ' ').split(/\s[-|»·:]\s|\bRUC\b|\d{6,}/i)[0].trim())
    .filter(Boolean);
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

/**
 * Busca el RUC de una empresa por su nombre en directorios públicos. Todo se
 * obtiene de la propia página (RUC, razón social, vigencia): SIN APISPeru.
 * Devuelve { ruc, datos, sim } solo si el nombre de la página se parece lo
 * suficiente al buscado (evita asignar el RUC de otra empresa).
 *
 * @param {string} nombre  razón social del prospecto
 * @param {object} [opts]  { umbral = 0.5 }
 * @returns {Promise<{ruc:string, datos:object, sim:number}|null>}
 */
export async function buscarRucPorNombre(nombre, opts = {}) {
  const umbral = opts.umbral ?? 0.5;
  const conSuf = slugConSufijo(nombre);
  const sinSuf = slugSinSufijo(nombre);
  if (!conSuf && !sinSuf) return null;

  // Deep-links por nombre (páginas de una sola empresa): regex de RUCs + nombre
  // de la página. Resiliente a cambios de HTML (no depende de selectores CSS).
  const urls = [
    conSuf && `https://ruc.pe/${conSuf}`,
    sinSuf && `https://www.universidadperu.com/empresas/${sinSuf}`,
    conSuf && `https://www.universidadperu.com/empresas/${conSuf}`,
    sinSuf && sinSuf !== conSuf && `https://ruc.pe/${sinSuf}`,
  ].filter(Boolean);

  for (const u of urls) {
    const html = await fetchText(u);
    const rucs = rucsEnHtml(html);
    if (!rucs.length) continue;

    const nombres = nombresEnHtml(html);
    const sim = nombres.reduce((mx, n) => Math.max(mx, similitudNombre(nombre, n)), 0);
    if (sim >= umbral) {
      return {
        ruc: rucs[0],
        datos: { razon_social: nombres[0] || null, ...vigenciaEnHtml(html) },
        sim,
      };
    }
  }
  return null;
}
