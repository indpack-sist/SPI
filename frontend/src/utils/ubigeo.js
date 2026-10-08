import ubigeos from '../data/ubigeos.json';

const norm = (s) =>
  String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

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

const buscarTriple = (distrito, provincia, departamento) => {
  const encontrados = ubicaciones.filter((u) =>
    coincide(distrito, u.distNombres)
    && coincide(provincia, u.provNombres)
    && coincide(departamento, u.depNombres));
  return encontrados.length === 1 ? encontrados[0] : null;
};

export function resolverUbigeoDesdeDireccion(direccion) {
  const texto = norm(direccion);
  if (!texto) return null;

  const segmentos = String(direccion || '')
    .split(/\s+-\s+|[,;|/\n]+/)
    .map((s) => norm(s))
    .filter(Boolean);

  if (segmentos.length >= 3) {
    const [a, b, c] = segmentos.slice(-3);
    const estandar = buscarTriple(a, b, c);
    const formatoSunat = buscarTriple(c, a, b);
    const triples = [...new Map(
      [estandar, formatoSunat].filter(Boolean).map((u) => [u.codigo, u])
    ).values()];
    if (triples.length === 1) return comoResultado(triples[0]);
    if (triples.length > 1) return null;
  }

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
