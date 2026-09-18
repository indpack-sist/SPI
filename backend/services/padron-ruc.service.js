import axios from 'axios';
import { rucChecksumValido, similitudNombre } from './ruc-lookup.service.js';

// ============================================================
// Consulta de un RUC en FUENTES PÚBLICAS GRATUITAS, SIN APISPeru.
// Reemplaza a api-validation.service para el módulo de Prospección: en vez de
// pegarle a un API con cuota, raspa datos que ya son públicos de SUNAT y sus
// espejos, SIEMPRE anclando la búsqueda al NÚMERO DE RUC (no al nombre), así el
// dato no puede ser de otra empresa.
//
// Cascada (best-effort, se fusiona lo que cada una aporte):
//   1) ruc.pe            → razón social, estado, condición, dirección, CIIU.
//   2) universidadperu   → + representantes legales (decisores).
//   3) datosperu.org     → respaldo de todo lo anterior.
// Todo se obtiene de la ficha de ESE RUC (una empresa por página), por lo que
// el dato queda verificado contra el número consultado.
//
// Devuelve la misma FORMA que api-validation.validarRUC para ser drop-in:
//   { valido, datos:{ ruc, razon_social, ..., es_activo, es_habido,
//       ciiu, representantes, fuentes }, error? }
// ============================================================

// UA de navegador real: algunos directorios rechazan agentes "bot" explícitos.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT = Number(process.env.PADRON_TIMEOUT_MS) || 15000;
const DIACRITICOS = /[̀-ͯ]/g;

// Throttle global por host: estos directorios cortan ráfagas. Espaciamos cada
// petición para que un lote de RUCs sea "educado" y no se gane un baneo de IP.
const MIN_GAP_MS = Number(process.env.PADRON_LOOKUP_GAP_MS) || 1200;
let ultimaPeticion = 0;
async function esperarTurno() {
  const espera = ultimaPeticion + MIN_GAP_MS - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultimaPeticion = Date.now();
}

async function fetchText(url, opts = {}) {
  await esperarTurno();
  try {
    const r = await axios.get(url, {
      timeout: TIMEOUT,
      maxRedirects: 4,
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es-PE,es;q=0.9', ...(opts.headers || {}) },
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return typeof r.data === 'string' ? r.data : '';
  } catch {
    return '';
  }
}

const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&[a-z]+;/gi, ' ');
const norm = (s) => stripTags(s).replace(/\s+/g, ' ').trim();

/** Normaliza un valor de texto largo (dirección, razón social) del HTML. */
function limpio(s) {
  return norm(s).replace(/\s*[|»·]\s*.*$/, '').trim() || null;
}

/**
 * Extrae el valor que sigue a una etiqueta ("Estado:", "Condición") en el
 * texto plano de la ficha. Resiliente al layout: trabaja sobre texto sin tags.
 * @param {string} texto  HTML ya convertido a texto plano
 * @param {RegExp} etiqueta  patrón de la etiqueta SIN el separador
 * @param {number} [maxLen]  longitud máxima a capturar tras la etiqueta
 */
// Etiquetas conocidas de la ficha SUNAT: sirven de FRONTERA para saber dónde
// termina el valor de un campo (el valor va hasta la próxima etiqueta). Se
// listan explícitas para no depender de mayúsculas/minúsculas (las razones
// sociales van TODO EN MAYÚSCULAS y romperían un corte basado en el caso).
const SIG_LABEL = '(?:Estado|Condici[oó]n|Direcci[oó]n|Domicilio|Departamento|Provincia|Distrito|Ubigeo'
  + '|Tipo(?:\\s+de)?(?:\\s+Contribuyente|\\s+Documento)?|Actividad(?:es)?(?:\\s+Econ[oó]mica[s]?)?'
  + '|Fecha(?:\\s+\\w+){0,3}|Sistema(?:\\s+\\w+){0,3}|Comprobantes?(?:\\s+\\w+){0,3}|Padr[oó]n(?:\\s+\\w+){0,2}'
  + '|Representante[s]?(?:\\s+Legal(?:es)?)?|Nombre\\s+Comercial|Raz[oó]n\\s+Social|CIIU|Emisi[oó]n\\s+Electr[oó]nica)\\s*[:：]';

function valorTrasEtiqueta(texto, etiqueta, maxLen = 90) {
  // La etiqueta se envuelve en un grupo NO capturante: si trae alternancia
  // interna (p.ej. "Razón Social|Contribuyente"), el `|` de nivel superior no
  // debe partir el patrón ni "robarse" el grupo de captura del valor.
  const re = new RegExp('(?:' + etiqueta.source + ')\\s*[:：]?\\s*([^\\n]{2,' + maxLen + '}?)(?=\\s{2,}|\\s+' + SIG_LABEL + '|$)', 'i');
  const m = texto.match(re);
  return m && m[1] ? m[1].trim() : null;
}

/** Vigencia SUNAT desde el texto: ACTIVO/BAJA y HABIDO/NO HABIDO. */
function vigenciaDeTexto(txt) {
  const t = txt.toUpperCase();
  let es_activo;
  if (/ESTADO\s*[:：]?\s*ACTIVO/.test(t) || /\bACTIVO\b/.test(t)) es_activo = true;
  if (/\b(BAJA DE OFICIO|BAJA DEFINITIVA|BAJA PROVISIONAL|SUSPENSI[OÓ]N TEMPORAL|BAJA)\b/.test(t)) es_activo = false;
  let es_habido;
  if (/\bNO\s+HABIDO\b/.test(t)) es_habido = false;
  else if (/\bHABIDO\b/.test(t)) es_habido = true;
  return { es_activo, es_habido };
}

/** Código y descripción CIIU desde el texto ("CIIU 51909 - VTA. MAYORISTA..."). */
function ciiuDeTexto(txt) {
  const out = [];
  const vistos = new Set();
  // "CIIU 46691 - VENTA MAYORISTA…": código de 4-6 dígitos + descripción en
  // MAYÚSCULAS. La descripción corta ante la siguiente etiqueta (Representante…),
  // doble espacio o fin; se poda una inicial suelta que se haya colado.
  const reCiiu = new RegExp('\\b(?:CIIU|C\\.?I\\.?I\\.?U\\.?)\\s*[:：]?\\s*(\\d{4,6})\\s*[-–]?\\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,&/()\\-]{3,80}?)(?=\\s+' + SIG_LABEL + '|\\s{2,}|$)', 'gi');
  for (const m of txt.matchAll(reCiiu)) {
    const cod = m[1];
    if (vistos.has(cod)) continue;
    vistos.add(cod);
    out.push({ codigo: cod, descripcion: norm(m[2]).replace(/\s+[A-Z]$/, '') });
  }
  // Respaldo: "Actividad Económica: <texto>" sin código explícito.
  if (!out.length) {
    const act = valorTrasEtiqueta(txt, /Actividad(?:es)?\s+Econ[oó]mica[s]?(?:\s+Principal)?/, 90);
    if (act) out.push({ codigo: null, descripcion: act });
  }
  return out;
}

/** Nombres de representantes legales desde el bloque de la ficha. */
function representantesDeTexto(txt) {
  const out = [];
  // Bloque típico: "Representante(s) Legal(es) ... DNI 12345678 APELLIDO NOMBRE GERENTE GENERAL"
  const bloque = txt.match(/Representante[s]?\s+Legal(?:es)?([\s\S]{0,600})/i);
  const zona = bloque ? bloque[1] : '';
  for (const m of zona.matchAll(/\b(DNI|C\.?E\.?|CARNET[^\d]{0,12}|PASAPORTE)\s*[:：]?\s*([0-9A-Z]{6,12})\s+([A-ZÁÉÍÓÚÑ ,.]{6,70}?)(?=\s{2,}|DNI|C\.?E\.?|$)/g)) {
    const doc = m[2].trim();
    const nombre = norm(m[3]).replace(/\s{2,}/g, ' ');
    if (nombre.length >= 6) out.push({ documento: doc, nombre });
    if (out.length >= 6) break;
  }
  return out;
}

/** Parsea una ficha de directorio (texto plano) hacia el objeto de datos. */
export function parsearFicha(html, ruc) {
  const txt = norm(html);
  if (!txt.includes(ruc)) return null; // la ficha DEBE mencionar el RUC pedido
  const razon = valorTrasEtiqueta(txt, /Raz[oó]n\s+Social|Nombre\s*\/?\s*Raz[oó]n\s+Social|Contribuyente/, 90);
  const nombreCom = valorTrasEtiqueta(txt, /Nombre\s+Comercial/, 90);
  const direccion = valorTrasEtiqueta(txt, /Direcci[oó]n(?:\s+del\s+Domicilio\s+Fiscal)?/, 120);
  const departamento = valorTrasEtiqueta(txt, /Departamento/, 40);
  const provincia = valorTrasEtiqueta(txt, /Provincia/, 40);
  const distrito = valorTrasEtiqueta(txt, /Distrito/, 40);
  const tipo = valorTrasEtiqueta(txt, /Tipo\s+Contribuyente|Tipo\s+de\s+Contribuyente/, 60);
  return {
    razon_social: razon ? limpio(razon) : null,
    nombre_comercial: nombreCom && !/^-+$/.test(nombreCom) ? limpio(nombreCom) : null,
    direccion: direccion ? limpio(direccion) : null,
    departamento: departamento ? limpio(departamento) : null,
    provincia: provincia ? limpio(provincia) : null,
    distrito: distrito ? limpio(distrito) : null,
    tipo_contribuyente: tipo ? limpio(tipo) : null,
    ciiu: ciiuDeTexto(txt),
    representantes: representantesDeTexto(txt),
    ...vigenciaDeTexto(txt),
  };
}

// Slugs de ruc.pe que NO son fichas de empresa (nav, buscadores, blog).
const SLUG_NO_EMPRESA = /^(wp-|category|tag|author|page|feed|comments|privacidad|contacto|acerca|terminos|nosotros|blog|consulta|consulta-ruc|consulta-multiple|bcp|interbank|bbva|banco-|scotiabank)/i;

// Prefijos de vía usados para cortar el nombre de la empresa en la página de
// resultados de ruc.pe (el bloque es "<RUC> <RAZÓN SOCIAL> <DIRECCIÓN>").
const VIA = 'AV\\.?|AVENIDA|CAL\\.?|CALLE|JR\\.?|JIRON|MZA?\\.?|URB\\.?|NRO|CAR\\.?|PJ\\.?|PSJE|PASAJE|LOTE|LT\\.?|PARQUE|PROLONGACION|CARRETERA';

/** Extrae razón social + dirección desde la PÁGINA DE RESULTADOS de ruc.pe. */
export function parsearResultadosRucPe(html, ruc) {
  const txt = norm(html);
  const re = new RegExp(ruc + '\\s+([A-ZÁÉÍÓÚÑ0-9&.\\-\\s]{5,90}?)\\s+(' + VIA + ')\\b', 'i');
  const m = txt.match(re);
  if (!m) return null;
  const razon = norm(m[1]).replace(/\s{2,}/g, ' ');
  // La dirección arranca en el prefijo de vía capturado.
  const iDir = txt.indexOf(m[2], txt.indexOf(razon));
  const direccion = iDir >= 0 ? norm(txt.slice(iDir, iDir + 120)) : null;
  return razon.length >= 5 ? { razon_social: razon, direccion, ...vigenciaDeTexto(txt) } : null;
}

// -----------------------------------------------------------------
// Fuente: ruc.pe — busca por el NÚMERO de RUC y abre su ficha.
// -----------------------------------------------------------------
async function porRucPe(ruc) {
  const busq = await fetchText(`https://ruc.pe/?s=${ruc}`);
  if (!busq) return null;

  // Enlace a la ficha de la empresa: el primer <a> a ruc.pe/<slug>/ que NO sea
  // de navegación (consulta, consulta-multiple…) ni de un banco destacado.
  let fichaUrl = null;
  for (const m of busq.matchAll(/<a[^>]+href=["'](https?:\/\/ruc\.pe\/([a-z0-9][a-z0-9-]*)\/?)["']/gi)) {
    if (SLUG_NO_EMPRESA.test(m[2])) continue;
    fichaUrl = m[1];
    break;
  }

  // Datos base desde la propia página de resultados (rápida y siempre presente).
  const deResultados = parsearResultadosRucPe(busq, ruc);

  // Ficha (más completa: estado/condición/CIIU). Best-effort: si tarda o falla,
  // nos quedamos con lo de la página de resultados.
  let deFicha = null;
  if (fichaUrl) {
    const ficha = await fetchText(fichaUrl);
    if (ficha) deFicha = parsearFicha(ficha, ruc);
  }

  // La ficha manda (más campos); los resultados rellenan lo que falte.
  const datos = fusionar(deFicha || {}, deResultados || {});
  return datos.razon_social ? { datos, url: fichaUrl || `https://ruc.pe/?s=${ruc}` } : null;
}

// -----------------------------------------------------------------
// Fuente: universidadperu.com — ficha por RUC (trae representantes).
// -----------------------------------------------------------------
async function porUniversidadPeru(ruc) {
  // Su patrón de ficha es /empresas/<slug>-<ruc>/, pero buscamos vía Google-free:
  // la home de la empresa se resuelve por RUC en su propio buscador interno.
  const url = `https://www.universidadperu.com/empresas/buscar.php?ruc=${ruc}`;
  const html = await fetchText(url);
  if (html) {
    // El buscador redirige/enlaza a la ficha; si ya trae los datos, parseamos.
    const directo = parsearFicha(html, ruc);
    if (directo && directo.razon_social) return { datos: directo, url };
    const link = html.match(/<a[^>]+href=["'](https?:\/\/www\.universidadperu\.com\/empresas\/[^"']+)["']/i);
    if (link) {
      const ficha = await fetchText(link[1]);
      const datos = parsearFicha(ficha, ruc);
      if (datos) return { datos, url: link[1] };
    }
  }
  return null;
}

// -----------------------------------------------------------------
// Fuente: datosperu.org — respaldo (ficha por RUC).
// -----------------------------------------------------------------
async function porDatosPeru(ruc) {
  const url = `https://www.datosperu.org/buscar.php?buscar=${ruc}`;
  const html = await fetchText(url);
  if (!html) return null;
  const directo = parsearFicha(html, ruc);
  if (directo && directo.razon_social) return { datos: directo, url };
  const link = html.match(/<a[^>]+href=["'](https?:\/\/www\.datosperu\.org\/[^"']+)["']/i);
  if (link) {
    const ficha = await fetchText(link[1]);
    const datos = parsearFicha(ficha, ruc);
    if (datos) return { datos, url: link[1] };
  }
  return null;
}

/** Fusiona el campo A sobre B solo si A está vacío (no pisa lo ya hallado). */
function fusionar(base, extra) {
  if (!extra) return base;
  const out = { ...base };
  for (const k of ['razon_social', 'nombre_comercial', 'direccion', 'departamento', 'provincia', 'distrito', 'tipo_contribuyente']) {
    if (!out[k] && extra[k]) out[k] = extra[k];
  }
  if (out.es_activo === undefined && extra.es_activo !== undefined) out.es_activo = extra.es_activo;
  if (out.es_habido === undefined && extra.es_habido !== undefined) out.es_habido = extra.es_habido;
  if ((!out.ciiu || !out.ciiu.length) && extra.ciiu?.length) out.ciiu = extra.ciiu;
  if ((!out.representantes || !out.representantes.length) && extra.representantes?.length) out.representantes = extra.representantes;
  return out;
}

/**
 * Consulta un RUC en las fuentes públicas y devuelve los datos fusionados.
 * Drop-in de api-validation.validarRUC (misma forma de respuesta).
 *
 * @param {string} ruc  11 dígitos
 * @returns {Promise<{valido:boolean, datos?:object, error?:string, fuentes?:string[]}>}
 */
export async function consultarPorRuc(ruc) {
  const doc = String(ruc || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(doc) || !rucChecksumValido(doc)) {
    return { valido: false, error: 'RUC inválido (11 dígitos o dígito verificador incorrecto)' };
  }

  const fuentes = [];
  let datos = { ruc: doc };

  // Fuente principal: ruc.pe (responde bien a peticiones simples).
  try {
    const r = await porRucPe(doc);
    if (r?.datos) { datos = fusionar(datos, r.datos); fuentes.push({ fuente: 'ruc.pe', url: r.url }); }
  } catch { /* best-effort */ }

  // Fuentes de respaldo (universidadperu / datosperu). Suelen estar tras
  // Cloudflare y devolver 403 a un axios simple, así que por defecto solo se
  // intentan cuando ruc.pe NO dio razón social. Poniendo PADRON_FUENTES_EXTRA=1
  // se fuerzan siempre para intentar traer CIIU + representantes (ingesta más
  // lenta). Si Cloudflare las bloquea, fallan en silencio y el flujo sigue.
  const faltaEsencial = !datos.razon_social;
  const faltaDetalle = !datos.ciiu?.length || !datos.representantes?.length;
  if (faltaEsencial || (faltaDetalle && process.env.PADRON_FUENTES_EXTRA === '1')) {
    for (const [nombre, fn] of [['universidadperu', porUniversidadPeru], ['datosperu', porDatosPeru]]) {
      try {
        const r = await fn(doc);
        if (r?.datos) { datos = fusionar(datos, r.datos); fuentes.push({ fuente: nombre, url: r.url }); }
      } catch { /* best-effort */ }
      if (datos.razon_social && datos.ciiu?.length && datos.representantes?.length) break;
    }
  }

  if (!datos.razon_social) {
    return { valido: false, error: 'No se encontró el RUC en las fuentes públicas (SUNAT/directorios).', fuentes };
  }

  // Sector afín derivado del CIIU (mucho más fiable que el nombre).
  return {
    valido: true,
    datos: {
      ruc: doc,
      razon_social: datos.razon_social,
      nombre_comercial: datos.nombre_comercial || null,
      tipo_contribuyente: datos.tipo_contribuyente || null,
      direccion: datos.direccion || null,
      departamento: datos.departamento || null,
      provincia: datos.provincia || null,
      distrito: datos.distrito || null,
      ciiu: datos.ciiu || [],
      representantes: datos.representantes || [],
      es_activo: datos.es_activo,
      es_habido: datos.es_habido,
      fuentes,
    },
    fuentes,
  };
}

export { similitudNombre };
