import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ============================================================
// Traducción de UBIGEO INEI (6 dígitos: DD PP DD) → nombres de
// departamento / provincia / distrito. Se usa al importar el Padrón Reducido de
// SUNAT (que trae el código, no los nombres) para poder descubrir por zona.
//
// Fuente: frontend/src/data/ubigeos.json (el mismo dataset del selector de GRE).
// Si el archivo no está disponible (deploy solo-backend), cae a un mapa embebido
// de los 25 departamentos por sus 2 primeros dígitos: al menos el departamento
// siempre se resuelve.
// ============================================================

// Departamentos por código de 2 dígitos (respaldo y para normalizar nombres).
const DEPARTAMENTOS = {
  '01': 'AMAZONAS', '02': 'ANCASH', '03': 'APURIMAC', '04': 'AREQUIPA', '05': 'AYACUCHO',
  '06': 'CAJAMARCA', '07': 'PROV. CONST. DEL CALLAO', '08': 'CUSCO', '09': 'HUANCAVELICA',
  '10': 'HUANUCO', '11': 'ICA', '12': 'JUNIN', '13': 'LA LIBERTAD', '14': 'LAMBAYEQUE',
  '15': 'LIMA', '16': 'LORETO', '17': 'MADRE DE DIOS', '18': 'MOQUEGUA', '19': 'PASCO',
  '20': 'PIURA', '21': 'PUNO', '22': 'SAN MARTIN', '23': 'TACNA', '24': 'TUMBES', '25': 'UCAYALI',
};

// Índices código→nombre para provincia (4 díg.) y distrito (6 díg.), construidos
// una sola vez desde el JSON (lazy). Vacíos si el JSON no se pudo leer.
let idxProvincia = null;
let idxDistrito = null;

function cargarIndices() {
  if (idxProvincia && idxDistrito) return;
  idxProvincia = new Map();
  idxDistrito = new Map();
  try {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    // backend/services → repo root → frontend/src/data/ubigeos.json
    const ruta = path.resolve(aqui, '..', '..', 'frontend', 'src', 'data', 'ubigeos.json');
    const data = JSON.parse(readFileSync(ruta, 'utf8'));
    for (const [, provs] of Object.entries(data.provincias || {})) {
      for (const p of provs) idxProvincia.set(p.codigo, p.nombre);
    }
    for (const [, dists] of Object.entries(data.distritos || {})) {
      for (const d of dists) idxDistrito.set(d.codigo, d.nombre);
    }
  } catch {
    // Sin JSON: solo quedará el departamento (por los 2 primeros dígitos).
  }
}

/**
 * Resuelve un UBIGEO de 6 dígitos a nombres. Campos faltantes = null.
 * @param {string} cod  ubigeo INEI (6 dígitos)
 * @returns {{departamento:(string|null), provincia:(string|null), distrito:(string|null)}}
 */
export function resolverUbigeo(cod) {
  const c = String(cod || '').replace(/\D/g, '');
  if (c.length < 2) return { departamento: null, provincia: null, distrito: null };
  cargarIndices();
  const dep = DEPARTAMENTOS[c.slice(0, 2)] || null;
  const prov = c.length >= 4 ? (idxProvincia.get(c.slice(0, 4)) || null) : null;
  const dist = c.length >= 6 ? (idxDistrito.get(c.slice(0, 6)) || null) : null;
  return { departamento: dep, provincia: prov, distrito: dist };
}

/** Lista de los 25 departamentos (código + nombre) para poblar filtros. */
export function listaDepartamentos() {
  return Object.entries(DEPARTAMENTOS).map(([codigo, nombre]) => ({ codigo, nombre }));
}
