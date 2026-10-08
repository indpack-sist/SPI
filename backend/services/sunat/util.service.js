import { promises as fs } from 'fs';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function copiaLocal(nombre, contenido) {
  try {
    await fs.mkdir('sunat-output', { recursive: true });
    await fs.writeFile(`sunat-output/${nombre}`, contenido);
  } catch {}
}

export function extraerUrl(v) {
  if (!v) return null;
  const desdeValor = (valor) => {
    if (!valor) return null;
    if (Array.isArray(valor)) return desdeValor(valor[0]);
    if (typeof valor === 'object') return valor.url || null;
    return typeof valor === 'string' ? valor : null;
  };
  if (typeof v === 'object') return desdeValor(v);
  try { return desdeValor(JSON.parse(v)); } catch { return v; }
}

export function normalizarPlaca(placa) {
  const s = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s || null;
}

export function placaValida(placa) {
  const s = normalizarPlaca(placa);
  return !!s && /^[A-Z0-9]{6,8}$/.test(s);
}

export function dniValido(dni) {
  return /^\d{8}$/.test(String(dni || '').trim());
}

export function rucValido(ruc) {
  return /^\d{11}$/.test(String(ruc || '').trim());
}

export function ubigeoValido(ubigeo) {
  return /^\d{6}$/.test(String(ubigeo || '').trim());
}

export function codigoBienValido(codigoBien) {
  const v = String(codigoBien ?? '').trim();
  if (!v) return true;
  return /^\d{13}$/.test(v);
}

export function componerObservacion(observaciones, ordenCompra) {
  const partes = [];
  const obs = String(observaciones || '').replace(/[\r\n]+/g, ' ').trim();
  if (obs) partes.push(obs);
  const oc = String(ordenCompra || '').trim();
  if (oc && !obs.toLowerCase().includes(oc.toLowerCase())) partes.push(`OC: ${oc}`);
  return partes.join(' | ').slice(0, 250);
}

export const componerObservacionGuia = componerObservacion;

export function armarDireccionEmpresa(cfg = {}) {
  const valorReal = (v) => v && String(v).trim() && String(v).trim() !== '-';
  const partes = [cfg.direccion, cfg.urbanizacion].filter(valorReal).join(' ');
  const ubicacion = [cfg.departamento, cfg.provincia, cfg.distrito].filter(valorReal).join(' - ');
  return [partes, ubicacion].filter(Boolean).join(' ').trim();
}
