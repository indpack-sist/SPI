#!/usr/bin/env node
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
