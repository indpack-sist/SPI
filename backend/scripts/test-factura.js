/**
 * Smoke test local: construye una factura, la firma y valida.
 * NO envía a SUNAT. Solo verifica que el UBL esté bien formado y la firma cuadre.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { construirFacturaXml } from '../services/sunat/ubl/factura.builder.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { cargarCertificado } from '../services/sunat/cert.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'sunat-output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Emisor de PRUEBAS (obligatorio en Beta). En Producción vendrá de empresa_config.
const emisor = {
  ruc: '20000000001',
  razonSocial: 'EMPRESA DE PRUEBA SEE',
  nombreComercial: 'EMPRESA DE PRUEBA SEE',
  ubigeo: '150101',
  direccion: 'AV. PRUEBA 123',
  distrito: 'LIMA',
  provincia: 'LIMA',
  departamento: 'LIMA',
};

const datos = {
  serie: 'F001',
  correlativo: 1,
  fechaEmision: new Date(),
  tipoOperacion: '0101', // venta interna gravada
  moneda: 'PEN',
  emisor,
  cliente: { tipoDoc: '6', numDoc: '20123456789', razonSocial: 'CLIENTE DE PRUEBA SAC', direccion: 'AV. CLIENTE 456' },
  lineas: [
    { cantidad: 2, unidad: 'NIU', descripcion: 'PRODUCTO A', codigoProducto: 'P001', valorUnitario: 100 },
    { cantidad: 5, unidad: 'KGM', descripcion: 'PRODUCTO B', codigoProducto: 'P002', valorUnitario: 15.5 },
  ],
};

const { xml, nombreArchivo, totales } = construirFacturaXml(datos);
console.log('Archivo :', nombreArchivo);
console.log('Totales :', JSON.stringify(totales));

// Verificar bien formado
const parsed = new DOMParser().parseFromString(xml, 'text/xml');
if (parsed.getElementsByTagName('parsererror').length) throw new Error('XML mal formado');

// Firmar
const { xmlFirmado, digestValue } = firmarXml(xml);
console.log('Digest  :', digestValue);

// Verificar firma
const doc = new DOMParser().parseFromString(xmlFirmado, 'text/xml');
const { certificatePem } = cargarCertificado();
const v = new SignedXml({ publicCert: certificatePem });
v.loadSignature(doc.getElementsByTagName('ds:Signature')[0]);
const ok = v.checkSignature(xmlFirmado);
console.log('Firma válida:', ok ? 'SÍ ✅' : 'NO ❌');

// Chequeo de cuadre: gravado*0.18 == igv, y total == gravado+igv
const cuadraIGV = Math.abs(totales.gravado * 0.18 - totales.igv) < 0.02;
const cuadraTotal = Math.abs(totales.gravado + totales.exportacion + totales.igv - totales.total) < 0.01;
console.log('Cuadre IGV:', cuadraIGV ? 'OK ✅' : 'ERROR ❌', '| Cuadre total:', cuadraTotal ? 'OK ✅' : 'ERROR ❌');

fs.writeFileSync(path.join(OUT, nombreArchivo + '.xml'), xmlFirmado, 'utf8');
console.log('XML firmado escrito en sunat-output/' + nombreArchivo + '.xml');
