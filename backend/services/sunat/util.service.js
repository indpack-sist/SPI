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
