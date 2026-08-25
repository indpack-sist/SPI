import axios from 'axios';

// ============================================================
// Lectura de datos públicos en una RED social de la empresa (best-effort).
// Recibe UN enlace de red (el scraper de la web ya los encontró) y trata de
// extraer contacto público (correo / teléfono) de esa página.
//
// AISLADO A PROPÓSITO: Facebook/Instagram cambian su HTML seguido y bloquean
// bots; todo va envuelto en try/catch y nunca lanza. Si la red no da nada,
// devuelve null y el resto del enriquecimiento sigue igual. No hay login ni
// cookies: solo lo que la página expone públicamente.
// ============================================================

const UA = 'Mozilla/5.0 (compatible; INDPACK-Prospector/1.0; +https://indpack.pe)';
const TIMEOUT = 10000;

const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Mismo criterio estricto que el scraper de web: móvil 9######### o fijo con
// código de área, para no capturar cifras sueltas (IDs, fechas) como teléfono.
const RE_TEL = /(?:\+?51[\s.\-]?)?(?:9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3}|\(0\d{1,2}\)[\s.\-]?\d{6,7}|0\d{1,2}[\s.\-]\d{6,7})/g;
// Descarta correos de la propia plataforma / CDN (no son de la empresa).
const EMAIL_BASURA = /(sentry|wixpress|example\.com|ejemplo\.|@2x|\.png|\.jpg|\.gif|\.svg|domain\.com|email\.com|tuempresa|tucorreo|correo@|facebook\.com|fbcdn|cdninstagram|instagram\.com|sentry\.io|whatsapp\.com|linkedin\.com)/i;

/** Normaliza y valida un teléfono peruano; null si no es plausible. */
function limpiarTelefono(t) {
  let d = String(t).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('9')) return d;
  if ((d.length === 8 || d.length === 9) && d[0] === '0' && d[1] !== '0') return d;
  return null;
}

async function fetchPublicHtml(url) {
  try {
    const res = await axios.get(url, {
      timeout: TIMEOUT,
      maxRedirects: 3,
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es-PE,es;q=0.9' },
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof res.data === 'string' ? res.data : '';
  } catch {
    return '';
  }
}

// WhatsApp: el número ya está en la propia URL (wa.me/51999… o ?phone=51999…),
// no hay que raspar nada.
function telefonoDeWhatsapp(url) {
  const m = String(url).match(/(?:wa\.me\/|[?&]phone=)(\+?\d{6,15})/i);
  return m ? limpiarTelefono(m[1]) : null;
}

// Variantes a intentar según la red. Facebook móvil (mbasic) expone más texto
// plano y su /about suele listar correo/teléfono públicos.
function variantesUrl(url) {
  const u = String(url);
  const out = [u];
  if (/facebook\.com|fb\.com/i.test(u)) {
    const liviano = u.replace(/https?:\/\/(www\.|m\.)?(facebook|fb)\.com/i, 'https://mbasic.facebook.com');
    out.push(liviano);
    if (!/\/about\/?(\?|$)/i.test(u)) out.push(liviano.replace(/\/?(\?.*)?$/, '/about'));
  }
  return [...new Set(out)];
}

/**
 * Intenta sacar contacto público (correos / teléfonos) de UNA red social.
 * @param {string} url  enlace a la página de la empresa en la red
 * @returns {Promise<{emails:string[], telefonos:string[], fuente:string}|null>}
 */
export async function scrapeSocial(url) {
  if (!url) return null;

  // WhatsApp: número en la URL, sin raspar.
  if (/wa\.me|whatsapp\.com/i.test(url)) {
    const tel = telefonoDeWhatsapp(url);
    return tel ? { emails: [], telefonos: [tel], fuente: url } : null;
  }

  const emails = new Set();
  const telefonos = new Set();

  for (const variante of variantesUrl(url)) {
    const html = await fetchPublicHtml(variante);
    if (!html) continue;

    for (const m of html.matchAll(RE_EMAIL)) {
      const e = m[0].toLowerCase();
      if (EMAIL_BASURA.test(e) || e.length >= 80) continue;
      emails.add(e);
    }
    for (const m of html.matchAll(RE_TEL)) {
      const t = limpiarTelefono(m[0]);
      if (t) telefonos.add(t);
    }
    // Con la primera variante que dio algo, no probamos las demás.
    if (emails.size || telefonos.size) break;
  }

  if (!emails.size && !telefonos.size) return null;
  return {
    emails: [...emails].slice(0, 4),
    telefonos: [...telefonos].slice(0, 4),
    fuente: url,
  };
}
