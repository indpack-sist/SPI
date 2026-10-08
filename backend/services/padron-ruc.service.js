import axios from 'axios';
import { rucChecksumValido, similitudNombre } from './ruc-lookup.service.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const TIMEOUT = Number(process.env.PADRON_TIMEOUT_MS) || 15000;
const DIACRITICOS = /[̀-ͯ]/g;

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

function limpio(s) {
  return norm(s).replace(/\s*[|»·]\s*.*$/, '').trim() || null;
}

const SIG_LABEL ='(?:Estado|Condici[oó]n|Direcci[oó]n|Domicilio|Departamento|Provincia|Distrito|Ubigeo'
  + '|Tipo(?:\\s+de)?(?:\\s+Contribuyente|\\s+Documento)?|Actividad(?:es)?(?:\\s+Econ[oó]mica[s]?)?'
  + '|Fecha(?:\\s+\\w+){0,3}|Sistema(?:\\s+\\w+){0,3}|Comprobantes?(?:\\s+\\w+){0,3}|Padr[oó]n(?:\\s+\\w+){0,2}'
  + '|Representante[s]?(?:\\s+Legal(?:es)?)?|Nombre\\s+Comercial|Raz[oó]n\\s+Social|CIIU|Emisi[oó]n\\s+Electr[oó]nica)\\s*[:：]';

function valorTrasEtiqueta(texto, etiqueta, maxLen = 90) {
  const re = new RegExp('(?:' + etiqueta.source + ')\\s*[:：]?\\s*([^\\n]{2,' + maxLen + '}?)(?=\\s{2,}|\\s+' + SIG_LABEL + '|$)', 'i');
  const m = texto.match(re);
  return m && m[1] ? m[1].trim() : null;
}

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

function ciiuDeTexto(txt) {
  const out = [];
  const vistos = new Set();
  const reCiiu = new RegExp('\\b(?:CIIU|C\\.?I\\.?I\\.?U\\.?)\\s*[:：]?\\s*(\\d{4,6})\\s*[-–]?\\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .,&/()\\-]{3,80}?)(?=\\s+' + SIG_LABEL + '|\\s{2,}|$)', 'gi');
  for (const m of txt.matchAll(reCiiu)) {
    const cod = m[1];
    if (vistos.has(cod)) continue;
    vistos.add(cod);
    out.push({ codigo: cod, descripcion: norm(m[2]).replace(/\s+[A-Z]$/, '') });
  }
  if (!out.length) {
    const act = valorTrasEtiqueta(txt, /Actividad(?:es)?\s+Econ[oó]mica[s]?(?:\s+Principal)?/, 90);
    if (act) out.push({ codigo: null, descripcion: act });
  }
  return out;
}

function representantesDeTexto(txt) {
  const out = [];
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

export function parsearFicha(html, ruc) {
  const txt = norm(html);
  if (!txt.includes(ruc)) return null;
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

const SLUG_NO_EMPRESA = /^(wp-|category|tag|author|page|feed|comments|privacidad|contacto|acerca|terminos|nosotros|blog|consulta|consulta-ruc|consulta-multiple|bcp|interbank|bbva|banco-|scotiabank)/i;

const VIA = 'AV\\.?|AVENIDA|CAL\\.?|CALLE|JR\\.?|JIRON|MZA?\\.?|URB\\.?|NRO|CAR\\.?|PJ\\.?|PSJE|PASAJE|LOTE|LT\\.?|PARQUE|PROLONGACION|CARRETERA';

export function parsearResultadosRucPe(html, ruc) {
  const txt = norm(html);
  const re = new RegExp(ruc + '\\s+([A-ZÁÉÍÓÚÑ0-9&.\\-\\s]{5,90}?)\\s+(' + VIA + ')\\b', 'i');
  const m = txt.match(re);
  if (!m) return null;
  const razon = norm(m[1]).replace(/\s{2,}/g, ' ');
  const iDir = txt.indexOf(m[2], txt.indexOf(razon));
  const direccion = iDir >= 0 ? norm(txt.slice(iDir, iDir + 120)) : null;
  return razon.length >= 5 ? { razon_social: razon, direccion, ...vigenciaDeTexto(txt) } : null;
}

async function porRucPe(ruc) {
  const busq = await fetchText(`https://ruc.pe/?s=${ruc}`);
  if (!busq) return null;

  let fichaUrl = null;
  for (const m of busq.matchAll(/<a[^>]+href=["'](https?:\/\/ruc\.pe\/([a-z0-9][a-z0-9-]*)\/?)["']/gi)) {
    if (SLUG_NO_EMPRESA.test(m[2])) continue;
    fichaUrl = m[1];
    break;
  }

  const deResultados = parsearResultadosRucPe(busq, ruc);

  let deFicha = null;
  if (fichaUrl) {
    const ficha = await fetchText(fichaUrl);
    if (ficha) deFicha = parsearFicha(ficha, ruc);
  }

  const datos = fusionar(deFicha || {}, deResultados || {});
  return datos.razon_social ? { datos, url: fichaUrl || `https://ruc.pe/?s=${ruc}` } : null;
}

async function porUniversidadPeru(ruc) {
  const url = `https://www.universidadperu.com/empresas/buscar.php?ruc=${ruc}`;
  const html = await fetchText(url);
  if (html) {
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

export async function consultarPorRuc(ruc) {
  const doc = String(ruc || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(doc) || !rucChecksumValido(doc)) {
    return { valido: false, error: 'RUC inválido (11 dígitos o dígito verificador incorrecto)' };
  }

  const fuentes = [];
  let datos = { ruc: doc };

  try {
    const r = await porRucPe(doc);
    if (r?.datos) { datos = fusionar(datos, r.datos); fuentes.push({ fuente: 'ruc.pe', url: r.url }); }
  } catch { /* best-effort */ }

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
