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
// Teléfonos peruanos plausibles: móvil 9######### (con +51 opcional) o fijo con
// código de área entre paréntesis o con 0 inicial. Estricto A PROPÓSITO para NO
// capturar cifras sueltas de la web (fechas, precios, IDs, códigos) como teléfono.
const RE_TEL = /(?:\+?51[\s.\-]?)?(?:9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}|\(0\d{1,2}\)[\s.\-]?\d{6,7}|0\d{1,2}[\s.\-]\d{6,7})/g;

// Áreas/roles a los que suele pertenecer un teléfono o correo. Se detectan
// por la etiqueta que rodea al número en la web (ej. "Ventas: 999...") o por
// el usuario del correo (ej. ventas@empresa.com). El orden fija la prioridad.
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

// Quita etiquetas HTML/entidades para leer el texto que rodea a un contacto.
function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

// Detecta el área a partir del texto que rodea al contacto (ventana previa).
function detectarArea(contexto) {
  const t = stripTags(contexto);
  for (const a of AREAS) if (a.re.test(t)) return a.area;
  return null;
}

// Área inferida del usuario del correo (ventas@, informes@, cobranzas@…).
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

// Descarta correos basura frecuentes en plantillas/CDN.
const EMAIL_BASURA = /(sentry|wixpress|example\.com|ejemplo\.|@2x|\.png|\.jpg|\.gif|\.svg|domain\.com|email\.com|tuempresa|tucorreo|correo@)/i;

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
  let d = String(t).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('51')) d = d.slice(2); // quita prefijo país +51
  // Móvil peruano: 9 dígitos empezando en 9 (el preferido como principal).
  if (d.length === 9 && d.startsWith('9')) return d;
  // Fijo con código de área: 0 + código válido (no "00") → 8-9 dígitos.
  // Rechazamos secuencias sueltas de 6-8 dígitos: son la fuente de la basura.
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

  // Mapas valor -> área (primera etiqueta encontrada gana). Priorizamos
  // correos: son gratis de raspar y el canal preferido para prospectar.
  const emails = new Map();
  const telefonos = new Map();
  const redes = {};
  let logo = null;
  let ruc = null;
  let paginasLeidas = 0;

  for (const ruta of RUTAS_CONTACTO) {
    if (paginasLeidas >= 3) break; // como mucho 3 páginas por sitio
    const html = await fetchHtml(base + ruta);
    if (!html) continue;
    paginasLeidas++;

    // Emails (incluye los de enlaces mailto:). El área se infiere del texto
    // alrededor y, si no, del usuario del correo (ventas@, informes@…).
    for (const m of html.matchAll(RE_EMAIL)) {
      const e = m[0].toLowerCase();
      if (EMAIL_BASURA.test(e) || e.length >= 80) continue;
      const ctx = html.slice(Math.max(0, m.index - 80), m.index);
      const area = detectarArea(ctx) || areaDeEmail(e);
      if (!emails.has(e) || (area && !emails.get(e))) emails.set(e, area || null);
    }
    // Teléfonos: el área se infiere del texto que rodea al número.
    for (const m of html.matchAll(RE_TEL)) {
      const t = limpiarTelefono(m[0]);
      if (!t) continue;
      const ctx = html.slice(Math.max(0, m.index - 80), m.index + m[0].length + 20);
      const area = detectarArea(ctx);
      if (!telefonos.has(t) || (area && !telefonos.get(t))) telefonos.set(t, area || null);
    }
    // Redes (solo la primera aparición de cada una).
    for (const [red, re] of Object.entries(REDES)) {
      if (!redes[red]) {
        const found = html.match(re);
        if (found) redes[red] = found[0].replace(/["'<>)]+$/, '');
      }
    }

    // RUC: muchas empresas PE lo publican en el pie ("RUC: 20XXXXXXXXX").
    // Buscamos la etiqueta "RUC" y tomamos los 11 dígitos que le siguen.
    if (!ruc) {
      const m = html.match(/R\.?\s?U\.?\s?C\.?\s*[:.\-N°#]*\s*([0-9\s.\-]{11,20})/i);
      if (m) {
        const d = m[1].replace(/\D/g, '').slice(0, 11);
        if (/^(10|15|16|17|20)\d{9}$/.test(d)) ruc = d;
      }
    }

    // Logo / imagen representativa: og:image de la home.
    if (!logo) {
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (og && og[1]) {
        try { logo = new URL(og[1], base).href; } catch { logo = og[1]; }
      }
    }
  }

  // Contactos con su área (correos primero: canal prioritario).
  const contactos = [
    ...[...emails].slice(0, 8).map(([valor, area]) => ({ tipo: 'Email', valor, area })),
    ...[...telefonos].slice(0, 6).map(([valor, area]) => ({ tipo: 'Telefono', valor, area })),
  ];

  return {
    ok: paginasLeidas > 0,
    base,
    emails: [...emails.keys()].slice(0, 8),
    telefonos: [...telefonos.keys()].slice(0, 6),
    contactos,
    redes,
    logo,
    ruc,
    paginas_leidas: paginasLeidas,
  };
}
