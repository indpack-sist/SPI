// Prueba de regresión del único caso de factura de exportación de INDPACK.
// No usa BD, certificado ni red: valida el UBL previo a firma contra el molde E001-1997.
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';
import { PDFParse } from 'pdf-parse';
import { construirInvoiceXML } from '../services/sunat/ubl.service.js';
import { generarComprobanteSunatPDF } from '../utils/pdfGenerators/comprobanteSunatPDF.js';

const entrada = {
  serie: 'FE01',
  numero: 1,
  ov: {
    moneda: 'USD',
    es_exportacion: 1,
    tipo_impuesto: 'IGV',
    tipo_operacion_sunat: '0101',
    tipo_venta: 'Credito',
    orden_compra_cliente: 'OC-EXPORT-001',
    observaciones: 'CONTENEDOR: MRSU4280077 PRECINTO NAVIERA: ML-PE0153521'
  },
  detalle: [
    { cantidad: 91, precio_unitario: 46.43, codigo: 'RBT50G008', nombre: 'ROLLO BURBUPACK 1.50 X 100 MTS', codigo_unidad_sunat: 'NIU' },
    { cantidad: 60, precio_unitario: 15, codigo: 'RBTEX06', nombre: 'ROLLO BURBUPACK TRANSPARENTE 0.50 X 100 MTS (50)', codigo_unidad_sunat: 'NIU' },
    { cantidad: 60, precio_unitario: 23.62, codigo: 'RBTEX01', nombre: 'ROLLO BURBUPACK TRANSPARENTE 1.20 X 61 MTS', codigo_unidad_sunat: 'NIU' }
  ],
  cliente: {
    tipo_documento: 'RUC',
    ruc: '99999999999',
    razon_social: 'INTERNATIONAL SUPPLY 507 S.A.',
    direccion_despacho: 'PANAMA'
  },
  empresa: {
    ruc: '20550932297',
    razon_social: 'INDPACK S.A.C.',
    nombre_comercial: 'INDPACK',
    ubigeo: '150142',
    codigo_establecimiento: '0000',
    urbanizacion: '-',
    provincia: 'LIMA',
    departamento: 'LIMA',
    distrito: 'VILLA EL SALVADOR',
    direccion: 'AV. EL SOL MZA. LL-1 LOTE 4'
  },
  fecha: { emision: '2026-09-10', hora: '10:00:00', vencimiento: '2026-10-10' },
  guias: [{ tipo_documento: '09', serie: 'EG07', numero: '273' }]
};

const { xml, totales } = construirInvoiceXML(entrada);
new XMLParser({ ignoreAttributes: false }).parse(xml);

assert.equal(totales.subtotal, 6542.33);
assert.equal(totales.igv, 0);
assert.equal(totales.total, 6542.33);
assert.match(xml, /<cbc:InvoiceTypeCode listID="0200">01<\/cbc:InvoiceTypeCode>/);
assert.match(xml, /schemeID="-"[^>]*>-<\/cbc:ID>/);
assert.match(xml, /<cbc:TaxExemptionReasonCode>40<\/cbc:TaxExemptionReasonCode>/);
assert.match(xml, /<cbc:ID>9995<\/cbc:ID><cbc:Name>EXP<\/cbc:Name><cbc:TaxTypeCode>FRE<\/cbc:TaxTypeCode>/);
assert.match(xml, /<cbc:ID>EG07-273<\/cbc:ID>/);
assert.match(xml, /<cbc:Note><!\[CDATA\[CONTENEDOR: MRSU4280077 PRECINTO NAVIERA: ML-PE0153521\]\]><\/cbc:Note>/);
assert.match(xml, /<cac:OrderReference><cbc:ID><!\[CDATA\[OC-EXPORT-001\]\]><\/cbc:ID><\/cac:OrderReference>/);
assert.match(xml, /<cbc:CountrySubentityCode><!\[CDATA\[150142\]\]><\/cbc:CountrySubentityCode>/);
assert.match(xml, /<cbc:District><!\[CDATA\[VILLA EL SALVADOR\]\]><\/cbc:District>/);
assert.match(xml, /<cbc:Line><!\[CDATA\[AV\. EL SOL MZA\. LL-1 LOTE 4\]\]><\/cbc:Line>/);
assert.doesNotMatch(xml, /<!\[CDATA\[PANAMA\]\]>/);

const pdf = await generarComprobanteSunatPDF({
  comprobante: {
    codigo_tipo_sunat: '01',
    serie: 'FE01',
    numero: 1,
    fecha_emision: '10/09/2026',
    fecha_vencimiento: '10/10/2026',
    moneda: 'USD',
    tipo_venta: 'Credito',
    dias_credito: 30,
    observaciones: 'CONTENEDOR: MRSU4280077 PRECINTO NAVIERA: ML-PE0153521',
    orden_compra: 'OC-EXPORT-001',
    subtotal: totales.subtotal,
    igv: totales.igv,
    total: totales.total,
    afectacion: '40',
    guias: 'EG07-273',
    guias_detalle: [{ tipo_documento: '09', serie: 'EG07', numero: '273' }],
    sunat_estado: 'ACEPTADO',
    estado: 'Emitida'
  },
  emisor: entrada.empresa,
  cliente: {
    razon_social: entrada.cliente.razon_social,
    tipo_documento: 'SIN DOCUMENTO',
    ruc: '-',
    direccion_despacho: 'AV. EL SOL MZA. LL-1 LOTE 4 VILLA EL SALVADOR - LIMA - LIMA'
  },
  detalle: entrada.detalle,
  qrBuffer: null
});

assert.ok(Buffer.isBuffer(pdf));
assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
assert.ok(pdf.length > 1000);
const textoPdf = (await new PDFParse({ data: pdf }).getText()).text;
for (const textoEsperado of [
  'INTERNATIONAL SUPPLY 507 S.A.',
  'Dirección del Cliente',
  'DÓLAR AMERICANO',
  'CRÉDITO A 30 DÍAS',
  '10/10/2026',
  'OC-EXPORT-001',
  'CONTENEDOR: MRSU4280077',
  'RBT50G008',
  'ICBPER',
  'GUÍA DE REMISIÓN REMITENTE',
  'EG07 273',
  'Información del crédito',
  '6,542.33'
]) {
  assert.ok(textoPdf.includes(textoEsperado), `El PDF no contiene: ${textoEsperado}`);
}
assert.ok(!textoPdf.includes('Valor de Venta de Operaciones Gratuitas'), 'El PDF de exportación no debe mostrar operaciones gratuitas');
assert.ok(!textoPdf.includes('IGV'), 'El PDF de exportación no debe mostrar la fila IGV');

console.log('OK factura exportación: XML y PDF con 0200, afectación 40, crédito, guía, OC, observación y Otro local 150142.');
