// utils/ubigeo.js — Resolución inversa: de una dirección de texto al código UBIGEO (6 díg. INEI).
// Acepta tanto "DISTRITO, PROVINCIA, DEPARTAMENTO" como el formato habitual de SUNAT
// "PROVINCIA - DEPARTAMENTO - DISTRITO" y direcciones cuyo distrito aparece al final.
import ubigeos from '../data/ubigeos.json';

// Normaliza para comparar: sin tildes, mayúsculas, espacios colapsados.
const norm = (s) =>
  String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

// Alias: "PROV. CONST. DEL CALLAO" también matchea "CALLAO".
const alias = (n) => n.replace(/^PROV\. CONST\. DEL /, '');
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const variantesNombre = (nombre) => {
  const n = norm(nombre);
  return [...new Set([n, alias(n)])];
};
const patronesNombre = (nombres) => nombres
  .filter(Boolean)
  .map((n) => new RegExp(`(^|[^A-Z0-9])${escaparRegex(n)}([^A-Z0-9]|$)`));
const patronesFinal = (nombres) => nombres
  .filter(Boolean)
  .map((n) => new RegExp(`${escaparRegex(n)}$`));

// Índice plano (se construye una sola vez al cargar el módulo).
const ubicaciones = [];
const totalPorDistrito = new Map();

for (const [prov, dists] of Object.entries(ubigeos.distritos)) {
  const dep = prov.slice(0, 2);
  const provincia = ubigeos.provincias[dep]?.find((p) => p.codigo === prov);
  const departamento = ubigeos.departamentos.find((d) => d.codigo === dep);
  for (const x of dists) {
    const n = norm(x.nombre);
    const depNombres = variantesNombre(departamento?.nombre);
    const provNombres = variantesNombre(provincia?.nombre);
    const distNombres = variantesNombre(x.nombre);
    ubicaciones.push({
      codigo: x.codigo,
      departamento: departamento?.nombre,
      provincia: provincia?.nombre,
      distrito: x.nombre,
      depNombres,
      provNombres,
      distNombres,
      depPatrones: patronesNombre(depNombres),
      provPatrones: patronesNombre(provNombres),
      distPatrones: patronesNombre(distNombres),
      distPatronesFinal: patronesFinal(distNombres),
    });
    totalPorDistrito.set(n, (totalPorDistrito.get(n) || 0) + 1);
  }
}

const coincide = (segmento, nombres) => nombres.includes(segmento);
const comoResultado = (ubicacion) => ({
  codigo: ubicacion.codigo,
  departamento: ubicacion.departamento,
  provincia: ubicacion.provincia,
  distrito: ubicacion.distrito,
});

// Resuelve un triple cuyos componentes ya están separados. La búsqueda simultánea de los tres
// niveles evita confundir, por ejemplo, el departamento LIMA con el distrito LIMA.
const buscarTriple = (distrito, provincia, departamento) => {
  const encontrados = ubicaciones.filter((u) =>
    coincide(distrito, u.distNombres)
    && coincide(provincia, u.provNombres)
    && coincide(departamento, u.depNombres));
  return encontrados.length === 1 ? encontrados[0] : null;
};

/**
 * Deriva el UBIGEO desde una dirección de texto.
 * @param {string} direccion  p. ej. "... , SAN ANTONIO, HUAROCHIRI, LIMA"
 * @returns {{codigo, departamento, provincia, distrito}|null}  null si no hay match confiable.
 */
export function resolverUbigeoDesdeDireccion(direccion) {
  const texto = norm(direccion);
  if (!texto) return null;

  // Un guion dentro de una manzana/lote (p. ej. "LL-1") no es separador geográfico; solo se
  // separan guiones rodeados de espacios, además de comas, punto y coma, slash y saltos de línea.
  const segmentos = String(direccion || '')
    .split(/\s+-\s+|[,;|/\n]+/)
    .map((s) => norm(s))
    .filter(Boolean);

  // Las dos disposiciones que llegan actualmente desde las OV y desde SUNAT. Resolverlas antes
  // de la búsqueda libre evita falsos positivos cuando provincia y departamento se llaman igual.
  if (segmentos.length >= 3) {
    const [a, b, c] = segmentos.slice(-3);
    const estandar = buscarTriple(a, b, c);       // distrito, provincia, departamento
    const formatoSunat = buscarTriple(c, a, b);   // provincia - departamento - distrito
    const triples = [...new Map(
      [estandar, formatoSunat].filter(Boolean).map((u) => [u.codigo, u])
    ).values()];
    if (triples.length === 1) return comoResultado(triples[0]);
    if (triples.length > 1) return null;
  }

  // Sin separadores solo se completa si el texto contiene un único nombre de distrito posible.
  // Una dirección como "... ATE LIMA LIMA" contiene varios nombres geográficos y debe quedar para
  // selección manual: elegir el último término podría confundir departamento con distrito.
  const distritosPresentes = new Set(
    ubicaciones
      .filter((u) => u.distPatrones.some((r) => r.test(texto)))
      .map((u) => norm(u.distrito))
  );
  if (segmentos.length === 1 && distritosPresentes.size !== 1) return null;

  const candidatos = ubicaciones.map((u) => {
    const distritoExacto = u.distNombres.some((n) => segmentos.includes(n));
    const provinciaExacta = u.provNombres.some((n) => segmentos.includes(n));
    const departamentoExacto = u.depNombres.some((n) => segmentos.includes(n));
    const distritoEnTexto = u.distPatrones.some((r) => r.test(texto));
    const distritoAlFinal = u.distPatronesFinal.some((r) => r.test(texto));
    const provinciaEnTexto = u.provPatrones.some((r) => r.test(texto));
    const departamentoEnTexto = u.depPatrones.some((r) => r.test(texto));
    const distritoUnico = totalPorDistrito.get(norm(u.distrito)) === 1;

    // El distrito debe aparecer como segmento, al final de la dirección o acompañado por sus
    // padres geográficos. Si el nombre se repite en Perú, provincia/departamento lo desambiguan.
    const identificable = distritoEnTexto && (
      distritoExacto
      || distritoAlFinal
      || (provinciaEnTexto && departamentoEnTexto)
    );
    if (!identificable || (!distritoUnico && !provinciaEnTexto && !departamentoEnTexto)) return null;

    const puntaje = (distritoExacto ? 12 : 0)
      + (distritoAlFinal ? 8 : 0)
      + (distritoUnico ? 4 : 0)
      + (provinciaExacta ? 5 : provinciaEnTexto ? 2 : 0)
      + (departamentoExacto ? 5 : departamentoEnTexto ? 2 : 0);
    return { ...u, puntaje };
  }).filter(Boolean).sort((a, b) => b.puntaje - a.puntaje);

  if (candidatos.length === 0) return null;
  if (candidatos[1] && candidatos[1].puntaje === candidatos[0].puntaje) return null;

  const mejor = candidatos[0];
  return comoResultado(mejor);
}
