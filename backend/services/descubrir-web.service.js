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
// Timeout de las llamadas a BUSCADORES y del sondeo de RUC. Más corto que antes
// (12 s) porque un sitio que no responde rápido rara vez es el que buscamos y,
// en el caso de "sin web", cada segundo de espera se multiplica por miles.
const TIMEOUT = Number(process.env.WEB_LOOKUP_TIMEOUT_MS) || 8000;
const DIACRITICOS = /[̀-ͯ]/g;

// Dominios que NO son la web propia de una empresa: directorios, redes,
// buscadores, agregadores. Nunca se toman como "web oficial".
const DOMINIO_NO_OFICIAL = /(^|\.)(facebook|instagram|linkedin|twitter|x|tiktok|youtube|wa\.me|whatsapp|google|goo\.gl|maps|bing|duckduckgo|brave|mojeek|yahoo|wikipedia|mercadolibre|olx|paginasamarillas|paginasblancas|guiatelefonica|ruc\.pe|universidadperu|datosperu|peruinforma|deperu|clave-?unica|gob\.pe|sunat|infobae|blogspot|wordpress\.com|wixsite|amazonaws|indeed|computrabajo|bumeran|glassdoor|slideshare|scribd|issuu|pinterest|tripadvisor)\./i;

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
// Cada uno respeta su PROPIO throttle (esperarTurno con su id). El descubrimiento
// reparte las consultas entre los del pool en round-robin.
//
// Estado real (probado 2026-09): SOLO DuckDuckGo sirve resultados usables.
//   - Bing: sirve una página SEÑUELO al detectar scraper (resultados basura no
//     relacionados) → excluido, metía ruido y suprimía el fallback a DDG.
//   - Brave (HTTP 429) y Mojeek (HTTP 403): bloquean a los scrapers.
// Si algún día DDG deja de devolver resultados (markup nuevo o IP bloqueada),
// el error de los jobs saldrá como 'busquedas_vacias' (ver descubrirWeb).
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
  // Markup actual de html.duckduckgo.com: <a class="result__a" href="URL_REAL">
  // con la URL DIRECTA (ya no el redirect /l/?uddg=<enc> de antes). Se soporta la
  // variante vieja por si algún resultado aún la trae.
  const urls = [];
  for (const m of html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi)) {
    let u = m[1].replace(/&amp;/g, '&');
    const rd = u.match(/[?&]uddg=([^&]+)/);
    if (rd) { try { u = decodeURIComponent(rd[1]); } catch { /* skip */ } }
    if (/^https?:\/\//i.test(u)) urls.push(u);
  }
  return urls;
}

// Pool de buscadores. Hoy solo DDG; la estructura de pool se conserva para poder
// sumar otro motor (o una API) sin reescribir el descubrimiento.
const MOTORES = [buscarDuckDuckGo];
let rrMotor = 0;
function tomarMotores() {
  // Devuelve los motores empezando por el siguiente en la rotación: el primero es
  // el "principal" de esta consulta; los demás quedan como respaldo si viene poco.
  const inicio = rrMotor++ % MOTORES.length;
  return MOTORES.slice(inicio).concat(MOTORES.slice(0, inicio));
}

/**
 * Candidatos de UNA consulta: dedup por host (contra los ya vistos en consultas
 * anteriores), filtra directorios/redes. Devuelve hasta 6 dominios propios.
 * Se procesa consulta a consulta (no todas de golpe) para permitir salir apenas
 * una verifique — así el caso común resuelve con UNA sola búsqueda.
 * Reparte la consulta en round-robin entre los buscadores del pool; solo recurre
 * a un segundo motor si el principal devolvió muy pocos resultados.
 */
async function candidatosDeConsulta(q, vistos) {
  const motores = tomarMotores();
  let urls = [];
  try { urls = await motores[0](q); } catch { /* noop */ }
  // Respaldo: si el motor principal trajo poco, prueba con el siguiente del pool.
  if (urls.length < 3 && motores[1]) {
    try { urls = urls.concat(await motores[1](q)); } catch { /* noop */ }
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
  // `crudos` = cuántas URLs devolvió el buscador ANTES de filtrar directorios: sirve
  // para distinguir "el buscador no devolvió nada" (IP bloqueada) de "devolvió solo
  // directorios/redes" (sí respondió, pero no había web propia).
  return { bases, crudos: urls.length };
}

// Rutas donde una empresa suele publicar su RUC (pie, contacto, nosotros).
const RUTAS_RUC = ['', '/contacto', '/contactenos', '/nosotros'];

/** ¿Esta página publica el RUC (con o sin separadores/etiqueta)? */
async function paginaTieneRuc(url, ruc) {
  const html = await fetchHtml(url);
  if (!html) return false;
  return html.replace(/[.\-\s]/g, '').includes(ruc);
}

/** ¿La web (home + contacto/nosotros) del dominio publica el RUC dado? */
async function dominioPublicaRuc(base, ruc) {
  // La home concentra el RUC (pie de página): se prueba sola primero y, si acierta,
  // no se descarga nada más. Si no, se sondean las páginas de contacto EN PARALELO
  // (acorta el peor caso "sin RUC" de 4 fetches en serie a 1 + 1 tanda paralela).
  if (await paginaTieneRuc(base + RUTAS_RUC[0], ruc)) return true;
  const resto = await Promise.all(RUTAS_RUC.slice(1).map((r) => paginaTieneRuc(base + r, ruc)));
  return resto.some(Boolean);
}

/**
 * Encuentra la web oficial de una empresa, anclando en el RUC.
 * @param {string} nombre  razón social
 * @param {object} [opts]  { ruc, zona }
 * @returns {Promise<{web:(string|null), fuente?:string, verificado_por?:string, motivo?:string, candidatos?:number}>}
 *   Siempre devuelve un objeto. `web` es la URL si se verificó, o null si no; en
 *   ese caso `motivo` explica por qué (para diagnosticar el 100 % de fallos):
 *     - 'busquedas_vacias'   → ningún buscador devolvió resultados (posible IP bloqueada)
 *     - 'solo_directorios'   → hubo resultados pero solo directorios/redes, ninguna web propia
 *     - 'sin_ruc_en_paginas' → se hallaron webs pero ninguna publica el RUC del prospecto
 *     - 'sin_dominio_nombre' → sin RUC, ninguna web coincide con el nombre
 */
export async function descubrirWeb(nombre, opts = {}) {
  const ruc = String(opts.ruc || '').replace(/\D/g, '');
  if ((!nombre || nombre.trim().length < 3) && !/^\d{11}$/.test(ruc)) {
    return { web: null, motivo: 'sin_datos_consulta' };
  }

  const tieneRuc = /^\d{11}$/.test(ruc);

  // Consultas priorizadas. Van por NOMBRE primero: en la práctica la búsqueda por
  // el número de RUC devuelve casi solo directorios (datosperu, universidadperu…),
  // que se filtran, malgastando una consulta; el nombre es el que hace aflorar el
  // sitio propio de la empresa. La búsqueda por RUC queda de respaldo. Se procesan
  // una a una con salida temprana: hallado el sitio, se verifica con RUC-en-página
  // (o token del nombre en el dominio) y se retorna, normalmente tras 1 búsqueda.
  const consultas = [];
  if (nombre) {
    consultas.push(`"${nombre}" RUC`);
    consultas.push(`${nombre} ${opts.zona || 'Perú'}`);
  }
  if (tieneRuc) consultas.push(`"${ruc}"`);

  const toks = tokensSignificativos(nombre);
  const vistos = new Set();          // hosts ya vistos en resultados de búsqueda
  const rucChequeados = new Set();   // hosts ya sondeados por RUC (no re-fetchear)
  let fallbackNombre = null;         // primer match por token de nombre (respaldo)
  let huboResultados = false;        // algún buscador devolvió al menos 1 URL cruda
  let totalCandidatos = 0;           // webs propias (tras filtrar directorios)

  for (const q of consultas) {
    const { bases: candidatos, crudos } = await candidatosDeConsulta(q, vistos);
    if (crudos > 0) huboResultados = true;
    totalCandidatos += candidatos.length;
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

  // Nada verificable → no se arriesga un falso positivo. Se reporta el PORQUÉ para
  // poder diagnosticar el patrón de fallos sin adivinar.
  let motivo;
  if (!huboResultados) motivo = 'busquedas_vacias';
  else if (totalCandidatos === 0) motivo = 'solo_directorios';
  else motivo = tieneRuc ? 'sin_ruc_en_paginas' : 'sin_dominio_nombre';
  return { web: null, motivo, candidatos: totalCandidatos };
}
