import axios from 'axios';
import { similitudNombre } from './ruc-lookup.service.js';

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = Number(process.env.WEB_LOOKUP_TIMEOUT_MS) || 8000;
const DIACRITICOS = /[̀-ͯ]/g;

const DOMINIO_NO_OFICIAL =/(^|\.)(facebook|instagram|linkedin|twitter|x|tiktok|youtube|wa\.me|whatsapp|google|goo\.gl|maps|bing|duckduckgo|brave|mojeek|yahoo|wikipedia|mercadolibre|olx|paginasamarillas|paginasblancas|guiatelefonica|ruc\.pe|universidadperu|datosperu|peruinforma|deperu|clave-?unica|gob\.pe|sunat|infobae|blogspot|wordpress\.com|wixsite|amazonaws|indeed|computrabajo|bumeran|glassdoor|slideshare|scribd|issuu|pinterest|tripadvisor)\./i;

const GENERICOS = new Set([
  'peru', 'peruana', 'peruano', 'lima', 'callao', 'sac', 'sa', 'srl', 'eirl', 'ltda',
  'sociedad', 'anonima', 'cerrada', 'group', 'grupo', 'international', 'internacional',
  'corporation', 'corp', 'company', 'cia', 'holding', 'import', 'export', 'importaciones',
  'exportaciones', 'comercial', 'industrial', 'industria', 'industrias', 'servicios',
  'inversiones', 'negocios', 'distribuidora', 'distribuciones', 'empresa', 'del', 'de',
  'la', 'el', 'los', 'las', 'and', 'representaciones', 'soluciones',
]);

const MIN_GAP_MS = Number(process.env.WEB_LOOKUP_GAP_MS) || 1200;
const throttles = new Map();
function esperarTurno(motor = 'default') {
  const t = throttles.get(motor) || { cadena: Promise.resolve(), ultima: 0 };
  throttles.set(motor, t);
  const turno = t.cadena.then(async () => {
    const espera = t.ultima + MIN_GAP_MS - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    t.ultima = Date.now();
  });
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
  for (const m of html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi)) {
    let u = m[1].replace(/&amp;/g, '&');
    const rd = u.match(/[?&]uddg=([^&]+)/);
    if (rd) { try { u = decodeURIComponent(rd[1]); } catch { /* skip */ } }
    if (/^https?:\/\//i.test(u)) urls.push(u);
  }
  return urls;
}

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';

async function buscarSerper(q) {
  if (!SERPER_API_KEY) return [];
  try {
    const r = await axios.post(
      'https://google.serper.dev/search',
      { q, gl: 'pe', hl: 'es', num: 10 },
      {
        timeout: TIMEOUT,
        headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
        validateStatus: (s) => s < 500,
      }
    );
    if (r.status >= 400) {
      console.error(`Serper HTTP ${r.status}: ${r.data?.message || 'sin detalle'}`);
      return [];
    }
    const d = r.data || {};
    const urls = [];
    if (d.knowledgeGraph?.website) urls.push(d.knowledgeGraph.website);
    for (const o of d.organic || []) if (o.link) urls.push(o.link);
    return urls;
  } catch (e) {
    console.error('Serper fallo de red:', e.message);
    return [];
  }
}

const MOTORES = SERPER_API_KEY ? [buscarSerper] : [buscarDuckDuckGo];
let rrMotor = 0;
function tomarMotores() {
  const inicio = rrMotor++ % MOTORES.length;
  return MOTORES.slice(inicio).concat(MOTORES.slice(0, inicio));
}

async function candidatosDeConsulta(q, vistos) {
  const motores = tomarMotores();
  let urls = [];
  try { urls = await motores[0](q); } catch { /* noop */ }
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
  return { bases, crudos: urls.length };
}

const RUTAS_RUC = ['', '/contacto', '/contactenos', '/nosotros'];

async function paginaTieneRuc(url, ruc) {
  const html = await fetchHtml(url);
  if (!html) return false;
  return html.replace(/[.\-\s]/g, '').includes(ruc);
}

async function dominioPublicaRuc(base, ruc) {
  if (await paginaTieneRuc(base + RUTAS_RUC[0], ruc)) return true;
  const resto = await Promise.all(RUTAS_RUC.slice(1).map((r) => paginaTieneRuc(base + r, ruc)));
  return resto.some(Boolean);
}

export async function descubrirWeb(nombre, opts = {}) {
  const ruc = String(opts.ruc || '').replace(/\D/g, '');
  if ((!nombre || nombre.trim().length < 3) && !/^\d{11}$/.test(ruc)) {
    return { web: null, motivo: 'sin_datos_consulta' };
  }

  const tieneRuc = /^\d{11}$/.test(ruc);

  const consultas = [];
  if (nombre) {
    consultas.push(`"${nombre}" RUC`);
    consultas.push(`${nombre} ${opts.zona || 'Perú'}`);
  }
  if (tieneRuc) consultas.push(`"${ruc}"`);

  const toks = tokensSignificativos(nombre);
  const vistos = new Set();
  const rucChequeados = new Set();
  let fallbackNombre = null;
  let huboResultados = false;
  let totalCandidatos = 0;

  for (const q of consultas) {
    const { bases: candidatos, crudos } = await candidatosDeConsulta(q, vistos);
    if (crudos > 0) huboResultados = true;
    totalCandidatos += candidatos.length;
    if (!candidatos.length) continue;

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

    if (!fallbackNombre && toks.length) {
      for (const base of candidatos) {
        const host = hostCompacto(base);
        const distintivo = toks.find((t) => t.length >= 4 && host.includes(t));
        if (distintivo && host.length <= distintivo.length + 12) { fallbackNombre = base; break; }
      }
    }

    if (!tieneRuc && fallbackNombre) {
      return { web: fallbackNombre, fuente: 'busqueda_nombre', verificado_por: 'dominio_nombre' };
    }
  }

  if (fallbackNombre) {
    return { web: fallbackNombre, fuente: 'busqueda_nombre', verificado_por: 'dominio_nombre' };
  }

  let motivo;
  if (!huboResultados) motivo = 'busquedas_vacias';
  else if (totalCandidatos === 0) motivo = 'solo_directorios';
  else motivo = tieneRuc ? 'sin_ruc_en_paginas' : 'sin_dominio_nombre';
  return { web: null, motivo, candidatos: totalCandidatos };
}
