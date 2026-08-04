/**
 * Envía una factura de prueba a SUNAT Beta y muestra el CDR.
 * Correr con salida a internet:  node scripts/enviar-factura-beta.js
 *
 * Emisor y credenciales de PRUEBA (homologación SUNAT). NO usa datos reales:
 * es el smoke test end-to-end contra Beta. La emisión real (con datos de tu BD)
 * vendrá en el controlador de la siguiente fase.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { construirFacturaXml } from '../services/sunat/ubl/factura.builder.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { enviarFactura } from '../services/sunat/cpe.client.js';
import { AMBIENTE } from '../services/sunat/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'sunat-output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Correlativo variable para poder reenviar sin choque de "ya registrado"
const correlativo = Math.floor(Date.now() / 1000) % 100000;

const datos = {
  serie: 'F001',
  correlativo,
  fechaEmision: new Date(),
  tipoOperacion: '0101',
  moneda: 'PEN',
  emisor: {
    ruc: '20000000001',
    razonSocial: 'EMPRESA DE PRUEBA SEE',
    nombreComercial: 'EMPRESA DE PRUEBA SEE',
    ubigeo: '150101',
    direccion: 'AV. PRUEBA 123',
    distrito: 'LIMA',
    provincia: 'LIMA',
    departamento: 'LIMA',
  },
  cliente: { tipoDoc: '6', numDoc: '20123456789', razonSocial: 'CLIENTE DE PRUEBA SAC', direccion: 'AV. CLIENTE 456' },
  lineas: [
    { cantidad: 2, unidad: 'NIU', descripcion: 'PRODUCTO A', codigoProducto: 'P001', valorUnitario: 100 },
    { cantidad: 5, unidad: 'KGM', descripcion: 'PRODUCTO B', codigoProducto: 'P002', valorUnitario: 15.5 },
  ],
};

async function main() {
  console.log(`Ambiente: ${AMBIENTE} | Emitiendo ${datos.serie}-${correlativo} ...`);

  const { xml, nombreArchivo, totales } = construirFacturaXml(datos);
  console.log('Totales:', JSON.stringify(totales));

  const { xmlFirmado } = firmarXml(xml);
  fs.writeFileSync(path.join(OUT, nombreArchivo + '.xml'), xmlFirmado, 'utf8');

  console.log('Enviando a SUNAT...');
  const cdr = await enviarFactura(nombreArchivo, xmlFirmado);

  fs.writeFileSync(path.join(OUT, 'R-' + nombreArchivo + '.xml'), cdr.cdrXml, 'utf8');

  console.log('\n========== RESULTADO ==========');
  console.log('Estado       :', cdr.estado);
  console.log('ResponseCode :', cdr.responseCode);
  console.log('Descripción  :', cdr.description);
  if (cdr.observaciones?.length) console.log('Observaciones:', cdr.observaciones);
  console.log('CDR guardado en sunat-output/R-' + nombreArchivo + '.xml');
}

main().catch((e) => {
  console.error('\n❌ ERROR:', e.message);
  process.exit(1);
});
