import assert from 'node:assert/strict';
import { calcularComprobante } from '../services/sunat/ubl.service.js';
import { construirNotaXML } from '../services/sunat/ubl-nota.service.js';
import { prepararDetalleDisminucion } from '../services/sunat/nota-disminucion.service.js';

const ov = { moneda: 'USD', tipo_impuesto: 'IGV', es_exportacion: 0, tipo_operacion_sunat: '0101' };
const detalle = [{
  id_detalle: 10, id_producto: 1, codigo: 'LAP-01', nombre: 'LÁPIZ',
  codigo_unidad_sunat: 'NIU', cantidad: 6, precio_unitario: 32.8
}];

const lineas = prepararDetalleDisminucion({
  ov, detalle, modo: 'item',
  items: [{ id_detalle_ref: 10, cantidad: 6, disminucion_valor: 2.8 }]
});
const calc = calcularComprobante({ ov, detalle: lineas });
assert.deepEqual(
  { subtotal: calc.subtotal, igv: calc.igv, total: calc.total, unitario: calc.lineas[0].valorUnitario },
  { subtotal: 16.8, igv: 3.02, total: 19.82, unitario: 2.8 }
);

const { xml, totales } = construirNotaXML({
  tipo: '07', serie: 'FC01', numero: 1, motivoCodigo: '09',
  docAfectado: { comprobante: 'E001-1977', tipo: '01' }, ov, detalle: lineas,
  cliente: { razon_social: 'SOLPACK S.A.C.', ruc: '20507939580', tipo_documento: 'RUC', direccion_despacho: 'LIMA' },
  empresa: { ruc: '20550932297', razon_social: 'INDPACK S.A.C.', nombre_comercial: 'INDPACK',
    ubigeo: '150142', codigo_establecimiento: '0000', urbanizacion: '-', provincia: 'LIMA',
    departamento: 'LIMA', distrito: 'VILLA EL SALVADOR', direccion: 'AV. EL SOL' },
  fecha: { emision: '2026-09-10', hora: '10:00:00' }, sustento: 'ERROR EN PRECIO'
});
assert.deepEqual(totales, { subtotal: 16.8, igv: 3.02, total: 19.82 });
assert.match(xml, /<cbc:ResponseCode>09<\/cbc:ResponseCode>/);
assert.match(xml, /<cbc:ReferenceID>E001-1977<\/cbc:ReferenceID>/);
assert.match(xml, /<cbc:CreditedQuantity unitCode="NIU">6<\/cbc:CreditedQuantity>/);
assert.match(xml, /<cac:Price><cbc:PriceAmount currencyID="USD">2\.800000<\/cbc:PriceAmount><\/cac:Price>/);
assert.match(xml, /<cbc:PayableAmount currencyID="USD">19\.82<\/cbc:PayableAmount>/);

assert.throws(() => prepararDetalleDisminucion({
  ov, detalle, modo: 'item',
  items: [{ id_detalle_ref: 10, cantidad: 6, disminucion_valor: 33 }]
}), /no puede superar su valor original/);

const global = prepararDetalleDisminucion({ ov, detalle, modo: 'global', montoGlobal: 10 });
assert.equal(calcularComprobante({ ov, detalle: global }).subtotal, 10);

console.log('OK NC 09: ítem/global, topes, totales y UBL validados');
