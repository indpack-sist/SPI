import axios from 'axios';

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = 12000;
const DIACRITICOS = /[̀-ͯ]/g;

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

function normNombre(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICOS, '')
    .replace(/\b(s\.?\s?a\.?\s?c\.?|s\.?\s?a\.?\s?a\.?|s\.?\s?a\.?|e\.?\s?i\.?\s?r\.?\s?l\.?|s\.?\s?r\.?\s?l\.?|sociedad anonima cerrada|sociedad anonima|sac|saa|eirl|srl)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function similitudNombre(a, b) {
  const ta = new Set(normNombre(a).split(' ').filter(Boolean));
  const tb = new Set(normNombre(b).split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

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

export function rucsEnHtml(html) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/\b((?:10|15|16|17|20)\d{9})\b/g)) {
    if (rucChecksumValido(m[1])) out.add(m[1]);
  }
  return [...out];
}

function limpiarNombreEmpresa(s) {
  return String(s || '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\bruc\.?\s*pe\b/gi, ' ')
    .replace(/\b\d{11}\b/g, ' ')
    .replace(/^[\s\-|»·:]*ruc\b[\s:]*/i, ' ')
    .replace(/[\s\-|»·:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function evaluarFicha(html, nombre, umbral) {
  const rucs = rucsEnHtml(html);
  if (!rucs.length) return null;
  const nombres = nombresEnHtml(html);
  const sim = nombres.reduce((mx, n) => Math.max(mx, similitudNombre(nombre, n)), 0);
  if (sim < umbral) return null;
  return { ruc: rucs[0], datos: { razon_social: nombres[0] || null, ...vigenciaEnHtml(html) }, sim };
}

const SLUG_NO_EMPRESA = /^(wp-|category|tag|author|page|feed|comments|privacidad|contacto|acerca|terminos|nosotros|blog)$|^$/i;

export async function buscarRucPorNombre(nombre, opts = {}) {
  const umbral = opts.umbral ?? 0.5;
  if (!nombre || nombre.trim().length < 3) return null;

  const html = await fetchText(`https://ruc.pe/?s=${encodeURIComponent(nombre)}`);
  if (!html) return null;

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

  return evaluarFicha(await fetchText(mejor.url), nombre, umbral);
}
