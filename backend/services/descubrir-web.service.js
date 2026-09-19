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

// Throttle anti-baneo POR BUSCADOR: cada motor (DuckDuckGo, Bing) limita ráfagas
// por su cuenta, así que cada uno tiene su PROPIA cadena de turnos y respeta el
// gap de forma independiente. Antes compartían una sola cadena y se serializaban
// entre sí sin necesidad (una consulta a Bing esperaba a la de DDG aunque son
// hosts distintos), lo que reducía el throughput a la mitad sin ganar seguridad.
// Cadena de promesas (no lectura de timestamp) para ser correcto con varios
// obreros pidiendo turno en paralelo: cada llamada se encola tras la anterior.
const MIN_GAP_MS = Number(process.env.WEB_LOOKUP_GAP_MS) || 1200;
const throttles = new Map(); // motor -> { cadena, ultima }
function esperarTurno(motor = 'default') {
  const t = throttles.get(motor) || { cadena: Promise.resolve(), ultima: 0 };
  throttles.set(motor, t);
  const turno = t.cadena.then(async () => {
    const espera = t.ultima + MIN_GAP_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    t.ultima = Date.now();
  });
  // La cadena avanza aunque un turno falle (no debe romper el throttle).
  t.cadena = turno.catch(() => {});
  return turno;
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
  await esperarTurno('ddg');
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
  await esperarTurno('bing');
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

/**
 * Candidatos de UNA consulta: dedup por host (contra los ya vistos en consultas
 * anteriores), filtra directorios/redes. Devuelve hasta 6 dominios propios.
 * Se procesa consulta a consulta (no todas de golpe) para permitir salir apenas
 * una verifique — así el caso común resuelve con UNA sola búsqueda.
 */
async function candidatosDeConsulta(q, vistos) {
  let urls = [];
  try { urls = await buscarDuckDuckGo(q); } catch { /* noop */ }
  if (urls.length < 3) {
    try { urls = urls.concat(await buscarBing(q)); } catch { /* noop */ }
  }
  const bases = [];
  for (const url of urls) {
    const base = baseDeUrl(url);
    if (!base) continue;
    const host = hostDe(base);
    if (!host || vistos.has(host)) continue;
    vistos.add(host);
    if (DOMINIO_NO_OFICIAL.test(host + '.')) continue;
    bases.push(base);
    if (bases.length >= 6) break;
  }
  return bases;
}

// Rutas donde una empresa suele publicar su RUC (pie, contacto, nosotros).
const RUTAS_RUC = ['', '/contacto', '/contactenos', '/nosotros'];

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

  const tieneRuc = /^\d{11}$/.test(ruc);

  // Consultas priorizadas: primero por RUC (máxima precisión), luego por nombre
  // exacto entre comillas. La zona ayuda a desambiguar homónimos. Se PROCESAN una
  // a una con salida temprana; en la mayoría de los casos la primera (por RUC)
  // ya resuelve, evitando las 3-4 búsquedas que antes se lanzaban siempre.
  const consultas = [];
  if (tieneRuc) consultas.push(`"${ruc}"`);
  if (nombre) {
    consultas.push(`"${nombre}" RUC`);
    consultas.push(`${nombre} ${opts.zona || 'Perú'}`);
  }

  const toks = tokensSignificativos(nombre);
  const vistos = new Set();          // hosts ya vistos en resultados de búsqueda
  const rucChequeados = new Set();   // hosts ya sondeados por RUC (no re-fetchear)
  let fallbackNombre = null;         // primer match por token de nombre (respaldo)

  for (const q of consultas) {
    const candidatos = await candidatosDeConsulta(q, vistos);
    if (!candidatos.length) continue;

    // 1) Candado fuerte: primer dominio que PUBLIQUE el RUC → retorno inmediato.
    if (tieneRuc) {
      for (const base of candidatos.slice(0, 4)) {
        const host = hostDe(base);
        if (rucChequeados.has(host)) continue;
        rucChequeados.add(host);
        try {
          if (await dominioPublicaRuc(base, ruc)) {
            return { web: base, fuente: 'busqueda_ruc', verificado_por: 'ruc_en_pagina' };
          }
        } catch { /* best-effort */ }
      }
    }

    // 2) Guarda el primer match por token de nombre como respaldo. El token
    // distintivo debe estar contenido en el dominio y este no ser mucho más
    // largo (evita coincidencias accidentales).
    if (!fallbackNombre && toks.length) {
      for (const base of candidatos) {
        const host = hostCompacto(base);
        const distintivo = toks.find((t) => t.length >= 4 && host.includes(t));
        if (distintivo && host.length <= distintivo.length + 12) { fallbackNombre = base; break; }
      }
    }

    // Sin RUC que verificar, el match por nombre es lo mejor posible → retorna ya.
    if (!tieneRuc && fallbackNombre) {
      return { web: fallbackNombre, fuente: 'busqueda_nombre', verificado_por: 'dominio_nombre' };
    }
  }

  // Agotadas las consultas sin publicar el RUC: se acepta el match por nombre
  // como último recurso (misma precisión que antes, cero falsos positivos).
  if (fallbackNombre) {
    return { web: fallbackNombre, fuente: 'busqueda_nombre', verificado_por: 'dominio_nombre' };
  }
  return null; // nada verificable → no se arriesga un falso positivo
}
