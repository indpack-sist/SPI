import { executeQuery } from '../config/database.js';

export async function resolverGuiaSunatEnObservacion(observaciones) {
  if (!observaciones) return observaciones;
  const texto = String(observaciones);

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
