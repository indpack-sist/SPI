import axios from 'axios';

// ============================================================
// Scraper de sitio web corporativo (dependency-free).
// Extrae correos, teléfonos y enlaces de redes sociales del sitio
// PROPIO de la empresa (dato público, bajo riesgo legal). No sigue
// dominios externos ni raspa redes sociales directamente.
// ============================================================

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = 12000;

// Rutas típicas donde vive el contacto, además de la home.
const RUTAS_CONTACTO = ['', '/contacto', '/contacto.html', '/contactenos', '/nosotros', '/contact'];

const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Móvil peruano (9########) y fijos con código; tolera separadores y prefijo +51.
const RE_TEL = /(?:\+?51[\s.-]?)?(?:\(0?1\)[\s.-]?)?(?:9\d{2}|\d{1,2})[\s.-]?\d{3}[\s.-]?\d{2,4}/g;

const REDES = {
  facebook: /https?:\/\/(?:www\.)?(?:facebook|fb)\.com\/[^\s"'<>)]+/i,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/i,
  linkedin: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s"'<>)]+/i,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>)]+/i,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>)]+/i,
  whatsapp: /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^\s"'<>)]+/i,
};

// Descarta correos basura frecuentes en plantillas/CDN.
const EMAIL_BASURA = /(sentry|wixpress|example\.com|@2x|\.png|\.jpg|\.gif|\.svg|domain\.com|email\.com|tuempresa)/i;

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

function limpiarTelefono(t) {
  const d = String(t).replace(/\D/g, '');
  // Nos quedamos con teléfonos plausibles en Perú (9 dígitos móvil, 6-8 fijo, o con 51).
  if (d.length === 9 && d.startsWith('9')) return d;
  if (d.length === 11 && d.startsWith('51')) return d.slice(2);
  if (d.length >= 6 && d.length <= 8) return d;
  return null;
}

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: TIMEOUT,
      maxRedirects: 3,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      responseType: 'text',
      // Muchos sitios PE tienen certificados intermedios flojos.
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof res.data === 'string' ? res.data : '';
  } catch {
    return '';
  }
}

/**
 * Scrapea el sitio de una empresa y devuelve contactos públicos.
 * @param {string} website  dominio o URL de la empresa
 * @returns {Promise<{ok:boolean, base:(string|null), emails:string[],
 *   telefonos:string[], redes:Object, error?:string}>}
 */
export async function scrapeWebsite(website) {
  const base = normalizarUrl(website);
  if (!base) return { ok: false, error: 'URL inválida', emails: [], telefonos: [], redes: {} };

  const emails = new Set();
  const telefonos = new Set();
  const redes = {};
  let paginasLeidas = 0;

  for (const ruta of RUTAS_CONTACTO) {
    if (paginasLeidas >= 3) break; // como mucho 3 páginas por sitio
    const html = await fetchHtml(base + ruta);
    if (!html) continue;
    paginasLeidas++;

    // Emails (incluye los de enlaces mailto:).
    for (const m of html.matchAll(RE_EMAIL)) {
      const e = m[0].toLowerCase();
      if (!EMAIL_BASURA.test(e) && e.length < 80) emails.add(e);
    }
    // Teléfonos.
    for (const m of html.matchAll(RE_TEL)) {
      const t = limpiarTelefono(m[0]);
      if (t) telefonos.add(t);
    }
    // Redes (solo la primera aparición de cada una).
    for (const [red, re] of Object.entries(REDES)) {
      if (!redes[red]) {
        const found = html.match(re);
        if (found) redes[red] = found[0].replace(/["'<>)]+$/, '');
      }
    }
  }

  return {
    ok: paginasLeidas > 0,
    base,
    emails: [...emails].slice(0, 8),
    telefonos: [...telefonos].slice(0, 6),
    redes,
    paginas_leidas: paginasLeidas,
  };
}
