import { executeQuery } from '../config/database.js';

// Las observaciones de un despacho se congelan con el correlativo INTERNO de la guía
// (p. ej. "Despacho Guía T001-00000005 - Orden ...") en el momento en que se registra la
// salida. Ese número interno NO se reusa cuando SUNAT rechaza una emisión: la reemisión
// toma el siguiente correlativo SUNAT, así que el interno (T001-5) y el comprobante SUNAT
// (TE01-6) quedan desfasados. El detalle de OV en el frontend ya resuelve el interno al
// comprobante SUNAT en vivo; este helper hace lo mismo en el backend para que los PDF de
// salida muestren el comprobante SUNAT vigente en lugar del interno.
//
// No modifica el valor almacenado: solo sustituye para presentación. El vínculo de
// "anular despacho" (que parsea el nº interno del texto) se conserva intacto.
export async function resolverGuiaSunatEnObservacion(observaciones) {
  if (!observaciones) return observaciones;
  const texto = String(observaciones);

  // Mismo patrón que usa el frontend: nº interno de guía T###-#### (4+ dígitos).
  const tokens = [...new Set(texto.match(/T\d{3}-\d{4,}/g) || [])];
  if (tokens.length === 0) return texto;

  const placeholders = tokens.map(() => '?').join(',');
  const res = await executeQuery(
    `SELECT numero_guia, serie_sunat, numero_sunat
       FROM guias_remision
      WHERE numero_guia IN (${placeholders})`,
    tokens
  );

  if (!res.success || res.data.length === 0) return texto;

  const mapa = new Map();
  for (const g of res.data) {
    if (g.serie_sunat && g.numero_sunat) {
      mapa.set(g.numero_guia, `${g.serie_sunat}-${g.numero_sunat}`);
    }
  }

  return texto.replace(/T\d{3}-\d{4,}/g, (m) => mapa.get(m) || m);
}
