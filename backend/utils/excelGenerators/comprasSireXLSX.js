import ExcelJS from 'exceljs';
import { EXPORT_COLUMNS } from '../../services/sunat/sire-compras.parser.js';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.'
};

const BORDE_FINO = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } }
};

const periodoLegible = (periodo) => {
  const anio = String(periodo).slice(0, 4);
  const mes = String(periodo).slice(4, 6);
  const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[Number(mes)] || mes} ${anio}`;
};

const toNumero = (v) => {
  const n = parseFloat(String(v ?? '').trim());
  return Number.isFinite(n) ? n : null;
};

export async function generarComprasSireXLSX(filas, periodo) {
  const wb = new ExcelJS.Workbook();
  wb.creator = EMPRESA.razon_social;
  wb.created = new Date();

  const totalCols = EXPORT_COLUMNS.length;
  const lastColLetter = columnaLetra(totalCols);

  const ws = wb.addWorksheet('Compras SIRE', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  });

  ws.columns = EXPORT_COLUMNS.map((c) => ({
    width: Math.min(Math.max(c.label.length + 2, c.type === 'number' ? 12 : 14), 40)
  }));

  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.getCell('A1').value = `${EMPRESA.razon_social}   -   R.U.C. ${EMPRESA.ruc}`;
  ws.getCell('A1').font = { bold: true, size: 12 };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell('A2').value = 'REGISTRO DE COMPRAS - PROPUESTA SIRE (RCE)';
  ws.getCell('A2').font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  ws.mergeCells(`A3:${lastColLetter}3`);
  ws.getCell('A3').value = `Período: ${periodoLegible(periodo)}`;
  ws.getCell('A3').font = { size: 10 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`A4:${lastColLetter}4`);
  ws.getCell('A4').value = `Comprobantes: ${filas.length}    |    Emitido: ${new Date().toLocaleDateString('es-PE')}`;
  ws.getCell('A4').font = { size: 10 };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRowIdx = 6;
  const headerRow = ws.getRow(headerRowIdx);
  EXPORT_COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDE_FINO;
  });
  headerRow.height = 26;

  let rowIdx = headerRowIdx + 1;
  filas.forEach((cols) => {
    const row = ws.getRow(rowIdx);
    EXPORT_COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const raw = (cols[c.idx] ?? '').toString().trim();
      if (c.type === 'number') {
        cell.value = toNumero(raw);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'top' };
      } else {
        cell.value = raw;
        cell.alignment = { horizontal: 'left', vertical: 'top' };
      }
      cell.font = { size: 9 };
      cell.border = BORDE_FINO;
    });
    rowIdx++;
  });

  if (filas.length === 0) {
    ws.mergeCells(`A${rowIdx}:${lastColLetter}${rowIdx}`);
    const cell = ws.getCell(`A${rowIdx}`);
    cell.value = 'SUNAT no reporta compras en el período seleccionado (o el mes en curso aún se consolida).';
    cell.font = { italic: true, color: { argb: 'FF666666' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = BORDE_FINO;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function columnaLetra(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
