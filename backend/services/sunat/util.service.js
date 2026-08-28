// services/sunat/util.service.js — utilidades compartidas del módulo SUNAT (controller + servicios).
import { promises as fs } from 'fs';

/** Promesa que resuelve tras ms milisegundos (usada en los polls de tickets). */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Copia local de depuración en sunat-output/ (gitignored). No crítico: nunca lanza. */
export async function copiaLocal(nombre, contenido) {
  try {
    await fs.mkdir('sunat-output', { recursive: true });
    await fs.writeFile(`sunat-output/${nombre}`, contenido);
  } catch { /* depuración, no crítico */ }
}

/** Las columnas xml_url/cdr_url guardan {url:...} (JSON u objeto según el driver). Devuelve el string. */
export function extraerUrl(v) {
  if (!v) return null;
  if (typeof v === 'object') return v.url || null;
  try { return JSON.parse(v).url || null; } catch { return v; }
}

/**
 * Placa para SUNAT: alfanumérica en MAYÚSCULAS, sin guion ni espacios. Así la registra el MTC y
 * así la refleja la representación impresa de SUNAT (p. ej. "AVZ-890" → "AVZ890"); el guion puede
 * provocar rechazo en la GRE REST. Devuelve null si queda vacía. Se aplica solo al valor enviado,
 * no al dato de flota.
 */
export function normalizarPlaca(placa) {
  const s = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s || null;
}

/**
 * Observación por defecto de un comprobante (factura/GRE): concatena el texto libre con la orden
 * de compra del cliente (si la OV la tiene) en un solo campo. SUNAT lo refleja como "Observaciones"
 * y viaja en cbc:Note. Formato "<texto libre> | OC: <oc>" (igual etiqueta que la representación de
 * SUNAT). Máx 250. Es solo el valor SUGERIDO: en la factura el usuario puede editarlo antes de emitir.
 */
export function componerObservacion(observaciones, ordenCompra) {
  const partes = [];
  const obs = String(observaciones || '').replace(/[\r\n]+/g, ' ').trim();
  if (obs) partes.push(obs);
  const oc = String(ordenCompra || '').trim();
  // Solo se agrega "OC: <oc>" si la OC NO está ya mencionada en el texto libre (evita el duplicado
  // "OC - 123 | OC: OC - 123" cuando el usuario ya escribió la OC en las observaciones). Además la
  // OC viaja aparte en cac:OrderReference del XML, así que esto es solo la sugerencia del panel.
  if (oc && !obs.toLowerCase().includes(oc.toLowerCase())) partes.push(`OC: ${oc}`);
  return partes.join(' | ').slice(0, 250);
}

// Alias histórico usado por la GRE; misma composición.
export const componerObservacionGuia = componerObservacion;
