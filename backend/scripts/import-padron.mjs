#!/usr/bin/env node
// ============================================================
// CLI: importa el Padrón Reducido RUC de SUNAT a la tabla padron_empresas,
// filtrado a empresas objetivo (personas jurídicas ACTIVAS de un sector
// comprador de empaque). Reemplaza el "Descubrir todo" de Google Places.
//
// Se corre A MANO (no en el proceso web): el padrón pesa ~1.5 GB sin comprimir,
// por eso se procesa por streaming. Requiere las mismas env de BD que el server.
//
// Uso:
//   node scripts/import-padron.mjs --file=./padron_reducido_ruc.zip
//   node scripts/import-padron.mjs --file=./padron_reducido_ruc.txt
//   node scripts/import-padron.mjs --url=https://.../padron_reducido_ruc.zip
//   node scripts/import-padron.mjs --file=... --departamentos="LIMA,AREQUIPA"
//
// El .zip se descarga de SUNAT (Consultas → "Descarga del Padrón Reducido").
// ============================================================
import 'dotenv/config';
import { importarPadron } from '../services/padron-import.service.js';

function arg(nombre) {
  const pref = `--${nombre}=`;
  const found = process.argv.find((a) => a.startsWith(pref));
  return found ? found.slice(pref.length) : undefined;
}

const file = arg('file');
const url = arg('url');
const deps = arg('departamentos');
const departamentos = deps
  ? new Set(deps.split(',').map((d) => d.trim().toUpperCase()).filter(Boolean))
  : undefined;

if (!file && !url) {
  console.error('Falta --file=<ruta .zip/.txt> o --url=<url del padrón reducido>.');
  process.exit(1);
}

console.log('Importando padrón reducido…', file ? `archivo: ${file}` : `url: ${url}`,
  departamentos ? `· solo ${[...departamentos].join(', ')}` : '· todos los departamentos');

const t0 = Date.now();
try {
  const stats = await importarPadron({
    file,
    url,
    departamentos,
    onProgress: (s) => process.stdout.write(`\r  leídas ${s.leidas.toLocaleString()} · objetivos ${s.objetivos.toLocaleString()} · insertadas ${s.insertadas.toLocaleString()}   `),
  });
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ Padrón importado en ${seg}s: ${stats.leidas.toLocaleString()} leídas · ${stats.objetivos.toLocaleString()} objetivos · ${stats.insertadas.toLocaleString()} insertadas/actualizadas.`);
  process.exit(0);
} catch (e) {
  console.error('\n✗ Error importando el padrón:', e.message);
  process.exit(1);
}
