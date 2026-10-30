import ExcelJS from 'exceljs';
import { normalizarCabecera } from '../../services/sunat/sire-ventas.parser.js';

const NUMERICAS = new Set([
  'Valor Facturado Exportación', 'BI Gravada', 'Dscto BI', 'IGV / IPM', 'Dscto IGV / IPM',
  'Mto Exonerado', 'Mto Inafecto', 'ISC', 'BI Grav IVAP', 'IVAP', 'ICBPER', 'Otros Tributos',
  'Total CP', 'Valor FOB Embarcado', 'Valor OP Gratuitas'
].map(normalizarCabecera));

const FECHAS = new Set(['Fecha de emisión', 'Fecha Vcto/Pago', 'Fecha Emisión Doc Modificado'].map(normalizarCabecera));
const TIPO_CAMBIO = normalizarCabecera('Tipo Cambio');

const fecha = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
};

function escribirCelda(cell, nombre, raw) {
  if (!raw) return;
  if (nombre === TIPO_CAMBIO || NUMERICAS.has(nombre)) {
    const n = parseFloat(raw);
    cell.value = Number.isFinite(n) ? n : raw;
    cell.numFmt = nombre === TIPO_CAMBIO ? '0.000' : '0.00';
    return;
  }
  const f = FECHAS.has(nombre) ? fecha(raw) : null;
  if (f) { cell.value = f; cell.numFmt = 'dd/mm/yyyy'; return; }
  cell.value = raw;
}

export async function generarVentasSireXLSX(cabeceras, filas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Propuesta RVIE', { views: [{ state: 'frozen', ySplit: 1 }] });
  const nombres = cabeceras.map(normalizarCabecera);

  ws.columns = cabeceras.map((c) => ({ width: Math.min(Math.max(c.length + 2, 12), 40) }));
  const cabecera = ws.getRow(1);
  cabeceras.forEach((c, i) => { cabecera.getCell(i + 1).value = c; });
  cabecera.font = { bold: true };

  filas.forEach((cols, f) => {
    const row = ws.getRow(f + 2);
    nombres.forEach((nombre, i) => {
      escribirCelda(row.getCell(i + 1), nombre, String(cols[i] ?? '').trim());
    });
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cabeceras.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
