import 'dotenv/config';
import { executeQuery } from '../config/database.js';
import { consultarPorRuc } from '../services/padron-ruc.service.js';

// Diagnóstico de la Fase 2 (CIIU): cuántos candidatos hay y si consultarPorRuc
// realmente trae el CIIU desde ruc.pe. Solo lectura, no modifica nada.

const WHERE = `sector='Agroexportación' AND estado_workflow='Nuevo'
  AND (flag_duplicado IS NULL OR flag_duplicado<>'Ya_cliente')
  AND id_cliente_match IS NULL AND (ciiu IS NULL OR ciiu='')
  AND origen IN ('padron','sunat')`;

const c = await executeQuery(`SELECT COUNT(*) AS n FROM prospectos WHERE ${WHERE}`);
console.log('candidatos Fase 2 (sin ciiu):', c.data?.[0]?.n);

// ¿Cuántos agro Nuevo no-cliente hay en total y cuántos YA tienen ciiu?
const tot = await executeQuery(
  `SELECT COUNT(*) AS total,
          SUM(ciiu IS NOT NULL AND ciiu<>'') AS con_ciiu,
          SUM(origen='padron') AS de_padron,
          SUM(origen='sunat') AS de_sunat
     FROM prospectos
    WHERE sector='Agroexportación' AND estado_workflow='Nuevo'
      AND (flag_duplicado IS NULL OR flag_duplicado<>'Ya_cliente')
      AND id_cliente_match IS NULL`
);
console.log('resumen agro Nuevo no-cliente:', tot.data?.[0]);

const muestra = await executeQuery(`SELECT id_prospecto, documento, origen, razon_social FROM prospectos WHERE ${WHERE} LIMIT 3`);
console.log('muestra:', muestra.data);

for (const p of (muestra.data || [])) {
  try {
    const v = await consultarPorRuc(p.documento);
    console.log(`RUC ${p.documento} (${p.razon_social}):`, v?.valido ? `OK ciiu=${JSON.stringify(v.datos.ciiu)}` : `INVALIDO (${v?.error || 'sin datos'})`);
  } catch (e) {
    console.log(`RUC ${p.documento}: ERROR ${e.message}`);
  }
}
process.exit(0);
