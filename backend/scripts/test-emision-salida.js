/**
 * Emite a SUNAT Beta una factura a partir de un DESPACHO REAL de la BD.
 * Uso:  node scripts/test-emision-salida.js <id_salida>
 *
 * Usa un correlativo temporal (no consume la serie F002 real). Emisor = pruebas;
 * cliente y líneas = datos reales de tu BD.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { emitirDesdeSalida } from '../services/sunat/emision.service.js';
import { pool } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'sunat-output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const idSalida = Number(process.argv[2]);
if (!idSalida) {
  console.error('Falta el id_salida. Uso: node scripts/test-emision-salida.js <id_salida>');
  process.exit(1);
}

const correlativoOverride = Math.floor(Date.now() / 1000) % 100000;

async function main() {
  console.log(`Emitiendo despacho id_salida=${idSalida} a Beta (correlativo temporal ${correlativoOverride})...`);
  const r = await emitirDesdeSalida(idSalida, { correlativoOverride });

  fs.writeFileSync(path.join(OUT, r.nombreArchivo + '.xml'), r.xmlFirmado, 'utf8');
  fs.writeFileSync(path.join(OUT, 'R-' + r.nombreArchivo + '.xml'), r.cdr.cdrXml, 'utf8');

  console.log('\nTotales calculados:', JSON.stringify(r.totales));
  console.log('========== CDR SUNAT ==========');
  console.log('Estado       :', r.cdr.estado);
  console.log('ResponseCode :', r.cdr.responseCode);
  console.log('Descripción  :', r.cdr.description);
  if (r.cdr.observaciones?.length) console.log('Observaciones:', r.cdr.observaciones);
}

main()
  .catch((e) => {
    console.error('\n❌ ERROR message:', JSON.stringify(e.message));
    console.error('❌ ERROR name   :', e.name);
    if (e.code) console.error('❌ ERROR code   :', e.code);
    if (e.response?.status) console.error('❌ HTTP status  :', e.response.status);
    if (e.response?.data) console.error('❌ HTTP body    :', String(e.response.data).slice(0, 800));
    console.error('❌ STACK        :', e.stack);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
