import ExcelJS from 'exceljs';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.'
};

// Borde fino negro en las 4 caras
const BORDE_FINO = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } }
};

// Definición de columnas del Kardex. Las numéricas usan formato de número y se
// alinean a la derecha; el producto y la categoría hacen wrap para no recortar.
const COLUMNAS = [
  { key: 'categoria',       header: 'CATEGORÍA',      min: 16, max: 30, wrap: true,  align: 'left',   num: false },
  { key: 'codigo',          header: 'CÓDIGO',         min: 12, max: 20, wrap: false, align: 'left',   num: false },
  { key: 'producto',        header: 'PRODUCTO',       min: 24, max: 50, wrap: true,  align: 'left',   num: false },
  { key: 'unidad',          header: 'UNIDAD',         min: 10, max: 14, wrap: false, align: 'center', num: false },
  { key: 'balance_inicial', header: 'BALANCE INICIAL', min: 14, max: 18, wrap: false, align: 'right', num: true },
  { key: 'entrada',         header: 'ENTRADA',        min: 12, max: 16, wrap: false, align: 'right',  num: true },
  { key: 'salida',          header: 'SALIDA',         min: 12, max: 16, wrap: false, align: 'right',  num: true },
  { key: 'stock',           header: 'STOCK',          min: 12, max: 16, wrap: false, align: 'right',  num: true },
  { key: 'stock_terminado', header: 'STOCK TERMINADO', min: 14, max: 18, wrap: false, align: 'right', num: true }
];

// Calcula ancho de columna según el contenido (sin recortes), acotado por min/max.
function calcularAncho(valores, header, min, max) {
  let maxLen = header.length;
  for (const v of valores) {
    const len = String(v ?? '').length;
    if (len > maxLen) maxLen = len;
  }
  // +2 de holgura. Si se alcanza el max, el texto hará wrap (columnas con wrap).
  return Math.min(Math.max(min, maxLen + 2), max);
}

// Genera el Kardex en Excel con el mismo contenido que el PDF.
// Espera { filas, filtros } tal como los construye construirDatosKardex().
export async function generarKardexXLSX({ filas = [], filtros = {} } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INDPACK S.A.C.';
  wb.created = new Date();

  const totalCols = COLUMNAS.length;
  const lastColLetter = String.fromCharCode(64 + totalCols); // 9 -> 'I'

  // Normalizar filas a números para las columnas numéricas.
  const datos = filas.map(f => ({
    categoria: f.categoria || '-',
    codigo: f.codigo || '-',
    producto: f.producto || '-',
    unidad: f.unidad || '',
    balance_inicial: parseFloat(f.balance_inicial || 0),
    entrada: parseFloat(f.entrada || 0),
    salida: parseFloat(f.salida || 0),
    stock: parseFloat(f.stock || 0),
    stock_terminado: parseFloat(f.stock_terminado || 0)
  }));

  const ws = wb.addWorksheet('Kardex', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  });

  // Anchos por columna (según contenido, con las numéricas formateadas).
  ws.columns = COLUMNAS.map(c => ({
    key: c.key,
    width: calcularAncho(
      datos.map(f => c.num ? f[c.key].toFixed(2) : f[c.key]),
      c.header, c.min, c.max
    )
  }));

  // --- Encabezado del reporte ---
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.getCell('A1').value = `${EMPRESA.razon_social}   -   R.U.C. ${EMPRESA.ruc}`;
  ws.getCell('A1').font = { bold: true, size: 12 };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell('A2').value = 'REPORTE KARDEX';
  ws.getCell('A2').font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  ws.mergeCells(`A3:${lastColLetter}3`);
  ws.getCell('A3').value =
    `Desde: ${filtros.desde || 'Inicio'}    |    Hasta: ${filtros.hasta || 'Hoy'}    |    Tipo de inventario: ${filtros.tipo_inventario || 'Todos'}`;
  ws.getCell('A3').font = { size: 10 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`A4:${lastColLetter}4`);
  ws.getCell('A4').value = `Productos: ${datos.length}    |    Emitido: ${new Date().toLocaleDateString('es-PE')}`;
  ws.getCell('A4').font = { size: 10 };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  // Fila 5 vacía (separador)

  // --- Cabecera de tabla (fila 6) ---
  const headerRowIdx = 6;
  const headerRow = ws.getRow(headerRowIdx);
  COLUMNAS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDE_FINO;
  });
  headerRow.height = 26;

  // --- Filas de datos ---
  let rowIdx = headerRowIdx + 1;
  const totales = { balance_inicial: 0, entrada: 0, salida: 0, stock: 0, stock_terminado: 0 };

  datos.forEach((f) => {
    const row = ws.getRow(rowIdx);
    COLUMNAS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = f[c.key];
      cell.font = { size: 9 };
      cell.alignment = { horizontal: c.align, vertical: 'top', wrapText: c.wrap };
      cell.border = BORDE_FINO;
      if (c.num) cell.numFmt = '#,##0.00';
      if (c.key === 'stock' || c.key === 'stock_terminado') {
        cell.font = { size: 9, bold: true };
      }
    });
    totales.balance_inicial += f.balance_inicial;
    totales.entrada += f.entrada;
    totales.salida += f.salida;
    totales.stock += f.stock;
    totales.stock_terminado += f.stock_terminado;
    rowIdx++;
  });

  if (datos.length === 0) {
    ws.mergeCells(`A${rowIdx}:${lastColLetter}${rowIdx}`);
    const cell = ws.getCell(`A${rowIdx}`);
    cell.value = 'No se encontraron productos con movimientos o stock en el rango seleccionado.';
    cell.font = { italic: true, color: { argb: 'FF666666' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = BORDE_FINO;
    rowIdx++;
  } else {
    // --- Fila de totales ---
    const row = ws.getRow(rowIdx);
    COLUMNAS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { size: 9, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };
      cell.alignment = { horizontal: c.align, vertical: 'middle' };
      cell.border = BORDE_FINO;
      if (c.key === 'categoria') {
        cell.value = `TOTALES (${datos.length} productos)`;
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (c.num) {
        cell.value = totales[c.key];
        cell.numFmt = '#,##0.00';
      }
    });
    row.height = 18;
    rowIdx++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
