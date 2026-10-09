import assert from 'node:assert';
import { parseComprasPropuesta, filaATabla, EXPORT_COLUMNS } from '../services/sunat/sire-compras.parser.js';

const header = 'RUC|Apellidos y Nombres o Razón social|Periodo|CAR SUNAT|Fecha de emisión|Fecha Vcto/Pago|Tipo CP/Doc.|Serie del CDP|Año|Nro CP o Doc. Nro Inicial (Rango)|Nro Final (Rango)|Tipo Doc Identidad|Nro Doc Identidad|Apellidos Nombres/ Razón  Social|BI Gravado DG|IGV / IPM DG|BI Gravado DGNG|IGV / IPM DGNG|BI Gravado DNG|IGV / IPM DNG|Valor Adq. NG|ISC|ICBPER|Otros Trib/ Cargos|Total CP|Moneda|Tipo de Cambio|Fecha Emisión Doc Modificado|Tipo CP Modificado|Serie CP Modificado|COD. DAM O DSI|Nro CP Modificado|Clasif de Bss y Sss|ID Proyecto Operadores|PorcPart|IMB|CAR Orig/ Ind E o I|Detracción|Tipo de Nota|Est. Comp.';
const r1 = '20550932297|INDPACK S.A.C.|202609|2061033441601E0010000000001|04/09/2026||01|E001||1||6|20610334416|INVERSIONES GRN E.I.R.L.|3955.70|712.03|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|4667.73|PEN|1.000|||||||||0.00||||1|0';
const r2 = '20550932297|INDPACK S.A.C.|202609|2060340449201E0010000001051|15/09/2026||01|E001||1051||6|20603404492|ALTERNATIVA CASSU E.I.R.L.|5751.10|1035.20|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|6786.30|USD|3.383|||||||||0.00||||1|0';

const filas = parseComprasPropuesta([header, r1, r2].join('\n'));
assert.strictEqual(filas.length, 2, 'debe omitir la cabecera y dejar 2 filas');

const t1 = filaATabla(filas[0]);
assert.strictEqual(t1.rucProveedor, '20610334416', 'ruc proveedor');
assert.strictEqual(t1.razonSocial, 'INVERSIONES GRN E.I.R.L.', 'razon social');
assert.strictEqual(t1.tipoCP, '01', 'tipo CP');
assert.strictEqual(t1.documento, 'E001-1', 'documento');
assert.strictEqual(t1.total, 4667.73, 'total');
assert.strictEqual(t1.moneda, 'PEN', 'moneda');
assert.strictEqual(t1.tipoCambio, 1, 'tipo cambio');

const t2 = filaATabla(filas[1]);
assert.strictEqual(t2.documento, 'E001-1051', 'documento 2');
assert.strictEqual(t2.moneda, 'USD', 'moneda 2');
assert.strictEqual(t2.tipoCambio, 3.383, 'tipo cambio 2');

assert.strictEqual(EXPORT_COLUMNS.length, 26, 'deben ser 26 columnas de export');
assert.strictEqual(EXPORT_COLUMNS[0].label, 'Fecha de emisión');
assert.strictEqual(EXPORT_COLUMNS[18].label, 'Total CP');
assert.strictEqual(filas[0][EXPORT_COLUMNS[18].idx], '4667.73', 'Total CP por indice de export');
assert.strictEqual(EXPORT_COLUMNS[25].label, 'Detracción');
assert.strictEqual(EXPORT_COLUMNS[25].idx, 37, 'Detracción en indice 37');

console.log('OK parser propuesta RCE: 12/12');
