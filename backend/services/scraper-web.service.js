import axios from 'axios';
import { rucChecksumValido } from './ruc-lookup.service.js';

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = 12000;

const RUTAS_CONTACTO = ['', '/contacto', '/contacto.html', '/contactenos', '/nosotros', '/contact'];

const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const RE_TEL = /(?:\+?51[\s.\-]?)?(?:9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}|\(0\d{1,2}\)[\s.\-]?\d{6,7}|0\d{1,2}[\s.\-]\d{6,7})/g;

const AREAS = [
  { re: /(venta|comercial|asesor|vendedor|cotiza|pedido)/i, area: 'Ventas' },
  { re: /(informe|informaci[oó]n|consulta|contacto|contact)/i, area: 'Informes' },
  { re: /(soporte|ayuda|t[eé]cnic|help|mesa de ayuda)/i, area: 'Soporte técnico' },
  { re: /(gerenc|direcci[oó]n general|gerente|ceo)/i, area: 'Gerencia' },
  { re: /(administ|contab|finanz|tesorer|caja)/i, area: 'Administración' },
  { re: /(cobranz|cr[eé]dito|facturaci[oó]n|pagos)/i, area: 'Cobranzas / Facturación' },
  { re: /(compra|abastec|log[ií]stic|almac[eé]n)/i, area: 'Compras / Logística' },
  { re: /(recursos humanos|rr\.?\s?hh|talento|selecci[oó]n|reclutamiento)/i, area: 'RR.HH.' },
  { re: /(marketing|publicidad|prensa)/i, area: 'Marketing' },
  { re: /(reclam|posventa|post.?venta|atenci[oó]n al cliente|servicio al cliente)/i, area: 'Atención al cliente' },
];

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

function detectarArea(contexto) {
  const t = stripTags(contexto);
  for (const a of AREAS) if (a.re.test(t)) return a.area;
  return null;
}

function areaDeEmail(email) {
  const local = String(email).split('@')[0] || '';
  for (const a of AREAS) if (a.re.test(local)) return a.area;
  return null;
}

const REDES = {
  facebook: /https?:\/\/(?:www\.)?(?:facebook|fb)\.com\/[^\s"'<>)]+/i,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/i,
  linkedin: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s"'<>)]+/i,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>)]+/i,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>)]+/i,
  whatsapp: /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^\s"'<>)]+/i,
};

const EMAIL_BASURA =/(sentry|wixpress|example\.com|ejemplo\.|@2x|\.png|\.jpg|\.gif|\.svg|domain\.com|email\.com|tuempresa|tucorreo|correo@)/i;

function normalizarUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function esTelefonoPlaceholder(d) {
  const s = String(d || '');
  if (!s) return true;
  if (/^(.)\1+$/.test(s)) return true;
  if (/^(\d{3})\1\1$/.test(s)) return true;
  if ('0123456789'.includes(s)) return true;
  if ('9876543210'.includes(s)) return true;
  const RELLENOS = new Set(['987654321', '912345678', '900000000', '999000000', '999888777', '900123456']);
  if (RELLENOS.has(s)) return true;
  return false;
}

function limpiarTelefono(t) {
  let d = String(t).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
  if (esTelefonoPlaceholder(d)) return null;
  if (d.length === 9 && d.startsWith('9')) return d;
  if ((d.length === 8 || d.length === 9) && d[0] === '0' && d[1] !== '0') return d;
  return null;
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: TIMEOUT,
      maxRedirects: 3,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof res.data === 'string' ? res.data : '';
  } catch {
    return '';
  }
}

export async function scrapeWebsite(website) {
  const base = normalizarUrl(website);
  if (!base) return { ok: false, error: 'URL inválida', emails: [], telefonos: [], redes: {} };

  const emails = new Map();
  const telefonos = new Map();
  const redes = {};
  let logo = null;
  let titulo = null;
  let ruc = null;
  const rucsSet = new Set();
  let paginasLeidas = 0;

  for (const ruta of RUTAS_CONTACTO) {
    if (paginasLeidas >= 3) break;
    const paginaUrl = base + ruta;
    const html = await fetchHtml(paginaUrl);
    if (!html) continue;
    paginasLeidas++;

    for (const m of html.matchAll(RE_EMAIL)) {
      const e = m[0].toLowerCase();
      if (EMAIL_BASURA.test(e) || e.length >= 80) continue;
      const ctx = html.slice(Math.max(0, m.index - 80), m.index);
      const area = detectarArea(ctx) || areaDeEmail(e);
      const prev = emails.get(e);
      if (!prev) emails.set(e, { area: area || null, url: paginaUrl });
      else if (area && !prev.area) prev.area = area;
    }
    for (const m of html.matchAll(RE_TEL)) {
      const t = limpiarTelefono(m[0]);
      if (!t) continue;
      const ctx = html.slice(Math.max(0, m.index - 80), m.index + m[0].length + 20);
      const area = detectarArea(ctx);
      const prev = telefonos.get(t);
      if (!prev) telefonos.set(t, { area: area || null, url: paginaUrl });
      else if (area && !prev.area) prev.area = area;
    }
    for (const [red, re] of Object.entries(REDES)) {
      if (!redes[red]) {
        const found = html.match(re);
        if (found) redes[red] = found[0].replace(/["'<>)]+$/, '');
      }
    }

    if (!ruc) {
      const m = html.match(/R\.?\s?U\.?\s?C\.?\s*[:.\-N°#]*\s*([0-9\s.\-]{11,20})/i);
      if (m) {
        const d = m[1].replace(/\D/g, '').slice(0, 11);
        if (/^(10|15|16|17|20)\d{9}$/.test(d)) ruc = d;
      }
    }

    const sinSep = html.replace(/[.\-\s]/g, '');
    for (const mm of sinSep.matchAll(/\b((?:10|15|16|17|20)\d{9})\b/g)) {
      if (rucChecksumValido(mm[1])) rucsSet.add(mm[1]);
    }

    if (!logo) {
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (og && og[1]) {
        try { logo = new URL(og[1], base).href; } catch { logo = og[1]; }
      }
    }

    if (!titulo) {
      const ogt = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      if (ogt && ogt[1]) titulo = ogt[1].trim();
      else {
        const t = html.match(/<title[^>]*>([^<]{2,160})<\/title>/i);
        if (t && t[1]) titulo = t[1].trim();
      }
    }
  }

  const contactos = [
    ...[...emails].slice(0, 8).map(([valor, m]) => ({ tipo: 'Email', valor, area: m.area, fuente_url: m.url })),
    ...[...telefonos].slice(0, 6).map(([valor, m]) => ({ tipo: 'Telefono', valor, area: m.area, fuente_url: m.url })),
  ];

  return {
    ok: paginasLeidas > 0,
    base,
    emails: [...emails.keys()].slice(0, 8),
    telefonos: [...telefonos.keys()].slice(0, 6),
    contactos,
    redes,
    logo,
    titulo,
    ruc,
    rucs: [...rucsSet],
    paginas_leidas: paginasLeidas,
  };
}
