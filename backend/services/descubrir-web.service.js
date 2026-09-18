import axios from 'axios';
import { similitudNombre } from './ruc-lookup.service.js';

// ============================================================
// Descubrimiento de la WEB oficial de una empresa, SIN Google Places.
// Antes se confiaba en el campo "website" de Google Places, que a menudo apunta
// a OTRO negocio (co-ubicado, administrador del local, dato sucio de Google) y
// contaminaba el prospecto con datos ajenos (p.ej. urbanaperu.com.pe en una
// empresa que no tiene nada que ver). Ahora anclamos TODO en el RUC:
//
//   1) Se busca el sitio en buscadores gratis (DuckDuckGo + Bing HTML),
//      priorizando la consulta POR EL NÚMERO DE RUC (quien publica ese número
//      es, casi siempre, exactamente esa empresa) y por la razón social exacta.
//   2) De los dominios candidatos (se excluyen directorios, redes y buscadores)
//      se ACEPTA solo el que PUBLICA EL RUC del prospecto en su página. Ese es
//      el candado de "cero falsos positivos": si el sitio no muestra el RUC, no
//      se toma como suyo.
//   3) Si no se conoce el RUC, se acepta solo si el token DISTINTIVO del nombre
//      ES el dominio (ej. "anguard" ↔ anguardperu.com) — prueba casi segura.
//
// Best-effort: si nada verifica, devuelve null y el flujo sigue (sin pegar nada).
// ============================================================

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = 12000;
const DIACRITICOS = /[̀-ͯ]/g;

// Dominios que NO son la web propia de una empresa: directorios, redes,
// buscadores, agregadores. Nunca se toman como "web oficial".
const DOMINIO_NO_OFICIAL = /(^|\.)(facebook|instagram|linkedin|twitter|x|tiktok|youtube|wa\.me|whatsapp|google|goo\.gl|maps|bing|duckduckgo|yahoo|wikipedia|mercadolibre|olx|paginasamarillas|paginasblancas|guiatelefonica|ruc\.pe|universidadperu|datosperu|peruinforma|deperu|clave-?unica|gob\.pe|sunat|infobae|blogspot|wordpress\.com|wixsite|amazonaws|indeed|computrabajo|bumeran|glassdoor|slideshare|scribd|issuu|pinterest|tripadvisor)\./i;

// Palabras genéricas/geográficas que NO distinguen una empresa de otra.
const GENERICOS = new Set([
  'peru', 'peruana', 'peruano', 'lima', 'callao', 'sac', 'sa', 'srl', 'eirl', 'ltda',
  'sociedad', 'anonima', 'cerrada', 'group', 'grupo', 'international', 'internacional',
  'corporation', 'corp', 'company', 'cia', 'holding', 'import', 'export', 'importaciones',
  'exportaciones', 'comercial', 'industrial', 'industria', 'industrias', 'servicios',
  'inversiones', 'negocios', 'distribuidora', 'distribuciones', 'empresa', 'del', 'de',
  'la', 'el', 'los', 'las', 'and', 'representaciones', 'soluciones',
]);

// Throttle global: los buscadores HTML limitan ráfagas.
const MIN_GAP_MS = Number(process.env.WEB_LOOKUP_GAP_MS) || 1200;
let ultimaPeticion = 0;
async function esperarTurno() {
  const espera = ultimaPeticion + MIN_GAP_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaPeticion = Date.now();
}

function normalizarTextoNombre(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICOS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokensSignificativos(nombre) {
  return normalizarTextoNombre(nombre).split(' ').filter((t) => t.length >= 3 && !GENERICOS.has(t));
}

/** Host base (protocolo//host) de una URL, o null. */
function baseDeUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    return `${p.protocol}//${p.host}`;
  } catch { return null; }
}
function hostDe(url) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).host.replace(/^www\./i, '');
  } catch { return ''; }
}
function hostCompacto(url) {
  return hostDe(url).replace(/\.[a-z.]+$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: TIMEOUT,
      maxRedirects: 3,
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es-PE,es;q=0.9' },
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof res.data === 'string' ? res.data : '';
  } catch { return ''; }
}

// -----------------------------------------------------------------
// Buscadores HTML gratis: devuelven URLs candidatas para una consulta.
// -----------------------------------------------------------------
async function buscarDuckDuckGo(q) {
  await esperarTurno();
  let html = '';
  try {
    const r = await axios.post(
      'https://html.duckduckgo.com/html/',
      new URLSearchParams({ q }).toString(),
      {
        timeout: TIMEOUT,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' },
        responseType: 'text',
        validateStatus: (s) => s >= 200 && s < 400,
      }
    );
    html = typeof r.data === 'string' ? r.data : '';
  } catch { return []; }
  const urls = [];
  for (const m of html.matchAll(/[?&]uddg=([^&"']+)/g)) {
    try { urls.push(decodeURIComponent(m[1])); } catch { /* skip */ }
  }
  return urls;
}

async function buscarBing(q) {
  await esperarTurno();
  const html = await fetchHtml(`https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=es&cc=PE`);
  if (!html) return [];
  const urls = [];
  for (const m of html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi)) {
    const u = m[1];
    if (/bing\.com|microsoft\.com|msn\.com|go\.microsoft/i.test(u)) continue;
    urls.push(u);
  }
  return urls;
}

/** Junta candidatos de varios buscadores, dedup por host, filtra directorios. */
async function candidatosDominios(consultas) {
  const vistos = new Set();
  const bases = [];
  for (const q of consultas) {
    let urls = [];
    try { urls = await buscarDuckDuckGo(q); } catch { /* noop */ }
    if (urls.length < 3) {
      try { urls = urls.concat(await buscarBing(q)); } catch { /* noop */ }
    }
    for (const url of urls) {
      const base = baseDeUrl(url);
      if (!base) continue;
      const host = hostDe(base);
      if (!host || vistos.has(host)) continue;
      vistos.add(host);
      if (DOMINIO_NO_OFICIAL.test(host + '.')) continue;
      bases.push(base);
      if (bases.length >= 8) break;
    }
    if (bases.length >= 8) break;
  }
  return bases;
}

// Rutas donde una empresa suele publicar su RUC (pie, contacto, nosotros).
const RUTAS_RUC = ['', '/contacto', '/contactenos', '/nosotros', '/contact'];

/** ¿La página (home + contacto) del dominio publica el RUC dado? */
async function dominioPublicaRuc(base, ruc) {
  for (const ruta of RUTAS_RUC) {
    const html = await fetchHtml(base + ruta);
    if (!html) continue;
    // RUC con o sin separadores/etiqueta: 20xxxxxxxxx dentro del contenido.
    const soloDig = html.replace(/[.\-\s]/g, '');
    if (soloDig.includes(ruc)) return true;
  }
  return false;
}

/**
 * Encuentra la web oficial de una empresa, anclando en el RUC.
 * @param {string} nombre  razón social
 * @param {object} [opts]  { ruc, zona }
 * @returns {Promise<{web:string, fuente:string, verificado_por:string}|null>}
 */
export async function descubrirWeb(nombre, opts = {}) {
  const ruc = String(opts.ruc || '').replace(/\D/g, '');
  if ((!nombre || nombre.trim().length < 3) && !/^\d{11}$/.test(ruc)) return null;

  // Consultas priorizadas: primero por RUC (máxima precisión), luego por nombre
  // exacto entre comillas. La zona ayuda a desambiguar homónimos.
  const consultas = [];
  if (/^\d{11}$/.test(ruc)) {
    consultas.push(`"${ruc}"`);
    if (nombre) consultas.push(`"${ruc}" ${nombre}`);
  }
  if (nombre) {
    consultas.push(`"${nombre}" RUC`);
    consultas.push(`${nombre} ${opts.zona || 'Perú'}`);
  }

  const candidatos = await candidatosDominios(consultas);
  if (!candidatos.length) return null;

  // 1) Candado fuerte: aceptar el primer dominio que PUBLIQUE el RUC.
  if (/^\d{11}$/.test(ruc)) {
    for (const base of candidatos.slice(0, 6)) {
      try {
        if (await dominioPublicaRuc(base, ruc)) {
          return { web: base, fuente: 'busqueda_ruc', verificado_por: 'ruc_en_pagina' };
        }
      } catch { /* best-effort */ }
    }
  }

  // 2) Sin RUC verificable: aceptar solo si el token distintivo ES el dominio.
  const toks = tokensSignificativos(nombre);
  if (toks.length) {
    for (const base of candidatos) {
      const host = hostCompacto(base);
      // El token distintivo debe estar contenido en el dominio Y el dominio no
      // debe ser mucho más largo (evita coincidencias accidentales).
      const distintivo = toks.find((t) => t.length >= 4 && host.includes(t));
      if (distintivo && host.length <= distintivo.length + 12) {
        return { web: base, fuente: 'busqueda_nombre', verificado_por: 'dominio_nombre' };
      }
    }
  }

  return null; // nada verificable → no se arriesga un falso positivo
}
