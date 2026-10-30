import assert from 'node:assert';
import ExcelJS from 'exceljs';
import {
  CABECERAS_VENTAS, parseVentasPropuesta, normalizarVentas, filtrarVentasPorClaves, conciliarVentas, claveVenta
} from '../services/sunat/sire-ventas.parser.js';
import { generarVentasSireXLSX } from '../utils/excelGenerators/ventasSireXLSX.js';
import { resumirVentas, coincideFiltros, filaDesdeSire, periodoDeRango, rangoMesActual, esRangoMesActual, hoyLima } from '../../frontend/src/utils/sireVentas.js';

const fila = (doc, fecha, tipo, ruc, cliente, bi, dsctoBi, igv, dsctoIgv, total, moneda, tc, mod = '|||') => {
  const [serie, numero] = doc.split('-');
  return `20550932297|INDPACK S.A.C.|202610|CAR${doc}|${fecha}||${tipo}|${serie}|${numero}||6|${ruc}|${cliente}|0|${bi}|${dsctoBi}|${igv}|${dsctoIgv}|0|0|0|0|0|0|0|${total}|${moneda}|${tc}|${mod}||${tipo === '07' ? 1 : ''}|1|0|0|${tipo === '01' ? 101 : ''}||`;
};

const texto = [
  CABECERAS_VENTAS.join('|'),
  fila('FE01-89', '01/10/2026', '01', '20336183791', 'EL PEDREGAL S.A', 24684.53, 0, 4443.22, 0, 29127.75, 'USD', 3.437),
  fila('FE01-90', '02/10/2026', '01', '20613420186', 'GOMURPACK E.I.R.L.', 645, 0, 116.1, 0, 761.1, 'PEN', 1),
  fila('E001-79', '10/10/2026', '07', '10076103084', 'ULLOA ALVAREZ RAUL ANGEL', 0, -2320.17, 0, -417.63, -2737.8, 'USD', 3.365, '13/08/2026|01|E001|2040'),
  fila('FC01-10', '13/10/2026', '07', '20537321190', 'DIMERC PERU S.A.C.', -6080, 0, -1094.4, 0, -7174.4, 'PEN', 1, '13/10/2026|01|FE01|106'),
  fila('FE01-106', '13/10/2026', '01', '20537321190', 'DIMERC PERU S.A.C.', 6080, 0, 1094.4, 0, 7174.4, 'PEN', 1),
].join('\r\n');

const propuesta = parseVentasPropuesta(texto);
assert.strictEqual(propuesta.filas.length, 5, 'omite la cabecera');
assert.deepStrictEqual(propuesta.cabeceras, CABECERAS_VENTAS, 'conserva las cabeceras de SUNAT');
assert.strictEqual(parseVentasPropuesta(texto.split('\r\n').slice(1).join('\n')).filas.length, 5, 'acepta archivo sin cabecera');
assert.deepStrictEqual(parseVentasPropuesta('').filas, [], 'texto vacio');

const reordenado = parseVentasPropuesta(['Ruc|Tipo CP/Doc.|Serie del CDP|Nro CP o Doc. Nro Inicial (Rango)|Total CP|Moneda|Tipo Cambio', '20550932297|01|FE01|7|100.50|PEN|1'].join('\n'));
assert.strictEqual(normalizarVentas(reordenado)[0].total, 100.5, 'ubica columnas por nombre de cabecera');

const ventas = normalizarVentas(propuesta);
const nota = ventas.find((f) => f.documento === 'E001-79');
assert.strictEqual(nota.baseImponible, -2320.17, 'suma Dscto BI');
assert.strictEqual(nota.igv, -417.63, 'suma Dscto IGV');
assert.strictEqual(nota.ref, 'E001-2040', 'documento modificado');
assert.strictEqual(nota.fecha, '2026-10-10', 'fecha ISO');
assert.strictEqual(claveVenta('1', 'fe01', '0089'), '01-FE01-89', 'clave normalizada');

const { soles, porMoneda } = resumirVentas(ventas);
assert.strictEqual(soles.neto, 27151.05, 'neto en soles');
assert.strictEqual(soles.n_facturas, 3, 'facturas');
assert.strictEqual(soles.n_notas_credito, 2, 'notas de credito');
assert.strictEqual(soles.notas_credito, 9912.2, 'notas de credito en positivo');
const usd = porMoneda.find((m) => m.moneda === 'USD');
assert.strictEqual(usd.facturas, 8474.76, 'factura en USD');
assert.strictEqual(usd.notas_credito, 813.61, 'nota en USD con su propio TC');
assert.strictEqual(usd.neto, 7661.15, 'neto USD');

const doc = (id, tipo, serie, numero, total, moneda, cuenta = true, estado = 'ACEPTADO') => ({
  id_factura: id, clave: claveVenta(tipo, serie, numero), documento: `${serie}-${numero}`, total, moneda, cuenta, en_periodo: true, estado
});
const docs = [
  doc(1, '01', 'FE01', 89, 8474.76, 'USD'),
  doc(2, '01', 'FE01', 90, 800, 'PEN'),
  doc(3, '07', 'FC01', 10, 7174.4, 'PEN'),
  doc(4, '01', 'FE01', 106, 7174.4, 'PEN'),
  doc(5, '01', 'FE01', 999, 50, 'PEN'),
];
const c = conciliarVentas(ventas, docs);
assert.deepStrictEqual(c.solo_sunat.map((f) => f.documento), ['E001-79'], 'nota externa');
assert.deepStrictEqual(c.solo_spi.map((d) => d.documento), ['FE01-999'], 'solo en sistema');
assert.deepStrictEqual(c.diferencias.map((f) => f.documento), ['FE01-90'], 'monto distinto');
assert.strictEqual(c.filas.find((f) => f.documento === 'FE01-89').diferencia, null, 'USD calza con el TC de SIRE');
const rechazado = conciliarVentas(ventas, [doc(9, '01', 'FE01', 90, 761.1, 'PEN', false, 'RECHAZADO')]);
assert.match(rechazado.diferencias[0].diferencia, /RECHAZADO/, 'vigente en SUNAT, no vigente en sistema');

assert.strictEqual(periodoDeRango('2026-10-01', '2026-10-31'), '202610', 'periodo');
assert.strictEqual(periodoDeRango('2026-09-01', '2026-10-31'), '', 'rango multi mes');
assert.deepStrictEqual(rangoMesActual('2026-10-30'), { desde: '2026-10-01', hasta: '2026-10-30' }, 'rango al 30 de octubre');
assert.deepStrictEqual(rangoMesActual('2026-11-05'), { desde: '2026-11-01', hasta: '2026-11-05' }, 'rango al 5 de noviembre');
assert.strictEqual(esRangoMesActual('2026-11-01', '2026-11-05', '2026-11-05'), true, 'rango por defecto');
assert.strictEqual(esRangoMesActual('2026-11-02', '2026-11-05', '2026-11-05'), false, 'rango editado');
assert.match(hoyLima(), /^\d{4}-\d{2}-\d{2}$/, 'hoy en formato ISO');
assert.strictEqual(coincideFiltros(nota, { tipo: 'NOTA_CREDITO', q: 'ulloa' }), true, 'filtro tipo y texto');
assert.strictEqual(coincideFiltros(nota, { tipo: 'FACTURA' }), false, 'filtro tipo');
assert.strictEqual(coincideFiltros(nota, { desde: '2026-10-11' }), false, 'filtro fecha');
assert.strictEqual(coincideFiltros(nota, { desde: '2026-10-11' }, { mesCompleto: true }), true, 'mes completo ignora fecha');
const fila0 = filaDesdeSire(c.filas.find((f) => f.documento === 'E001-79'));
assert.strictEqual(fila0.total, 813.61, 'total en moneda del documento');
assert.strictEqual(fila0.estado_final, 'SOLO_SUNAT', 'estado');
assert.strictEqual(fila0.clase, 'NOTA_CREDITO', 'clase');

const filtradas = filtrarVentasPorClaves(propuesta, ['07-E001-79', '01-FE01-90']);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(await generarVentasSireXLSX(propuesta.cabeceras, filtradas));
const ws = wb.worksheets[0];
assert.strictEqual(ws.rowCount, 3, 'cabecera mas filas filtradas');
assert.deepStrictEqual(ws.getRow(1).values.slice(1), CABECERAS_VENTAS, 'cabeceras identicas en fila 1');
const col = (nombre) => CABECERAS_VENTAS.indexOf(nombre) + 1;
assert.strictEqual(ws.getRow(2).getCell(col('Total CP')).value, 761.1, 'total numerico');
assert.strictEqual(ws.getRow(3).getCell(col('Dscto BI')).value, -2320.17, 'descuento numerico');
assert.strictEqual(ws.getRow(3).getCell(col('Tipo Cambio')).value, 3.365, 'tipo de cambio');
assert.strictEqual(ws.getRow(3).getCell(col('Nro Doc Identidad')).value, '10076103084', 'documento como texto');
assert.strictEqual(ws.getRow(3).getCell(col('Fecha de emisión')).value.toISOString().slice(0, 10), '2026-10-10', 'fecha real');

console.log('OK SIRE ventas');
