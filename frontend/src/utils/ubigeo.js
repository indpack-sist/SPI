// utils/ubigeo.js — Resolución inversa: de una dirección de texto al código UBIGEO (6 díg. INEI).
// Las direcciones tipo SUNAT/RENIEC terminan en "..., DISTRITO, PROVINCIA, DEPARTAMENTO".
// Tomamos los últimos 3 segmentos separados por coma y los buscamos anidados en el catálogo
// (el triple completo desambigua nombres repetidos como "SAN ANTONIO", "SANTA ROSA", "LIMA").
import ubigeos from '../data/ubigeos.json';

// Normaliza para comparar: sin tildes, mayúsculas, espacios colapsados.
const norm = (s) =>
  String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

// Alias: "PROV. CONST. DEL CALLAO" también matchea "CALLAO".
const alias = (n) => n.replace(/^PROV\. CONST\. DEL /, '');

// Índices inversos (una vez): nombre normalizado → código.
const depByName = new Map();      // "LIMA" -> "15"
const provByDep = new Map();      // "15" -> Map("HUAROCHIRI" -> "1507")
const distByProv = new Map();     // "1507" -> Map("SAN ANTONIO" -> "150716")

for (const d of ubigeos.departamentos) {
  const n = norm(d.nombre);
  depByName.set(n, d.codigo);
  if (alias(n) !== n) depByName.set(alias(n), d.codigo);
}
for (const [dep, provs] of Object.entries(ubigeos.provincias)) {
  const m = new Map();
  for (const p of provs) { const n = norm(p.nombre); m.set(n, p.codigo); if (alias(n) !== n) m.set(alias(n), p.codigo); }
  provByDep.set(dep, m);
}
for (const [prov, dists] of Object.entries(ubigeos.distritos)) {
  const m = new Map();
  for (const x of dists) { const n = norm(x.nombre); m.set(n, x.codigo); if (alias(n) !== n) m.set(alias(n), x.codigo); }
  distByProv.set(prov, m);
}

/**
 * Deriva el UBIGEO desde una dirección de texto.
 * @param {string} direccion  p. ej. "... , SAN ANTONIO, HUAROCHIRI, LIMA"
 * @returns {{codigo, departamento, provincia, distrito}|null}  null si no hay match confiable.
 */
export function resolverUbigeoDesdeDireccion(direccion) {
  const partes = String(direccion || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (partes.length < 3) return null;

  const distTxt = partes[partes.length - 3];
  const provTxt = partes[partes.length - 2];
  const depTxt = partes[partes.length - 1];

  const depCod = depByName.get(norm(depTxt));
  if (!depCod) return null;
  const provCod = provByDep.get(depCod)?.get(norm(provTxt));
  if (!provCod) return null;
  const distCod = distByProv.get(provCod)?.get(norm(distTxt));
  if (!distCod) return null;

  return {
    codigo: distCod,
    departamento: ubigeos.departamentos.find((d) => d.codigo === depCod)?.nombre,
    provincia: ubigeos.provincias[depCod]?.find((p) => p.codigo === provCod)?.nombre,
    distrito: ubigeos.distritos[provCod]?.find((x) => x.codigo === distCod)?.nombre,
  };
}
