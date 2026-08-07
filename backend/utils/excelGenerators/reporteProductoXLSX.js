import ExcelJS from 'exceljs';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.'
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return '-';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}/${m}/${y}`;
};

// Borde fino negro en las 4 caras
const BORDE_FINO = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } }
};

// Aplica borde fino a un rango de celdas A..C de una fila.
function bordearFila(ws, rowIdx, nCols) {
  for (let i = 1; i <= nCols; i++) {
    ws.getCell(rowIdx, i).border = BORDE_FINO;
  }
}

// Genera el reporte por producto (producción vs despacho) en Excel, con el mismo
// contenido que el PDF. Espera el objeto `datos` que arma construirDatosReporteProducto().
export async function generarReporteProductoXLSX(datos = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INDPACK S.A.C.';
  wb.created = new Date();

  const producto = datos.producto || {};
  const filtros = datos.filtros || {};
  const ordenes = datos.ordenes || [];
  const unidad = producto.unidad || '';

  const existenciaAnterior = parseFloat(datos.existencia_anterior || 0);
  const producido = parseFloat(datos.producido || 0);
  const despachado = parseFloat(datos.despachado || 0);
  const saldo = existenciaAnterior + producido - despachado;

  const NCOLS = 3; // FECHA | N° ORDEN | PRODUCIDO
  const lastCol = 'C';

  const ws = wb.addWorksheet('Reporte Producto', {
    pageSetup: {
      orientation: 'portrait',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    }
  });

  // Anchos: la primera columna suficiente para fechas/etiquetas, la del medio ancha
  // para el nombre del producto y N° de orden, la tercera para cantidades.
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 20;

  let r = 1;

  // --- Encabezado del reporte ---
  ws.mergeCells(`A${r}:${lastCol}${r}`);
  ws.getCell(`A${r}`).value = `${EMPRESA.razon_social}   -   R.U.C. ${EMPRESA.ruc}`;
  ws.getCell(`A${r}`).font = { bold: true, size: 12 };
  ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 20;
  r++;

  ws.mergeCells(`A${r}:${lastCol}${r}`);
  ws.getCell(`A${r}`).value = 'REPORTE POR PRODUCTO — Producción y Despacho';
  ws.getCell(`A${r}`).font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(r).height = 22;
  r++;

  r++; // fila vacía separadora

  // --- Datos del producto (etiqueta | valor) ---
  const infoFilas = [
    ['Producto:', `${producto.codigo || ''} - ${producto.nombre || ''}`],
    ['Unidad:', unidad || 'N/A'],
    ['Stock actual:', `${formatearNum(producto.stock_actual)} ${unidad}`.trim()],
    ['Período:', `${filtros.desde || 'Inicio'}  a  ${filtros.hasta || 'Hoy'}`],
    ['Fecha de impresión:', new Date().toLocaleString('es-PE')]
  ];
  infoFilas.forEach(([etiqueta, valor]) => {
    ws.getCell(r, 1).value = etiqueta;
    ws.getCell(r, 1).font = { bold: true, size: 10 };
    ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getCell(r, 1).border = BORDE_FINO;

    ws.mergeCells(r, 2, r, 3);
    ws.getCell(r, 2).value = valor;
    ws.getCell(r, 2).font = { size: 10 };
    ws.getCell(r, 2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    ws.getCell(r, 2).border = BORDE_FINO;
    ws.getCell(r, 3).border = BORDE_FINO;
    r++;
  });

  r++; // fila vacía separadora

  // --- Resumen (Existencia anterior / Producido / Despachado / Saldo final) ---
  ws.mergeCells(`A${r}:${lastCol}${r}`);
  ws.getCell(`A${r}`).value = 'RESUMEN';
  ws.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: 'FF1D4ED8' } };
  ws.getCell(`A${r}`).alignment = { horizontal: 'left', vertical: 'middle' };
  r++;

  // Cabecera del resumen
  const cabResumen = ['CONCEPTO', 'CANTIDAD', 'UNIDAD'];
  const alinResumen = ['left', 'right', 'center'];
  cabResumen.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    cell.alignment = { horizontal: alinResumen[i], vertical: 'middle' };
    cell.border = BORDE_FINO;
  });
  ws.getRow(r).height = 18;
  r++;

  const filasResumen = [
    ['Existencia anterior', existenciaAnterior, 'FF8E44AD'],
    ['Total producido', producido, 'FF1E88E5'],
    ['Total despachado', despachado, 'FF2E7D32'],
    ['Saldo final', saldo, 'FF616161']
  ];
  filasResumen.forEach(([concepto, valor, color]) => {
    const c1 = ws.getCell(r, 1);
    c1.value = concepto; c1.font = { size: 10, bold: true, color: { argb: color } };
    c1.alignment = { horizontal: 'left', vertical: 'middle' }; c1.border = BORDE_FINO;

    const c2 = ws.getCell(r, 2);
    c2.value = valor; c2.numFmt = '#,##0.00';
    c2.font = { size: 10, bold: true }; c2.alignment = { horizontal: 'right', vertical: 'middle' };
    c2.border = BORDE_FINO;

    const c3 = ws.getCell(r, 3);
    c3.value = unidad; c3.font = { size: 9 };
    c3.alignment = { horizontal: 'center', vertical: 'middle' }; c3.border = BORDE_FINO;
    r++;
  });

  r++; // fila vacía separadora

  // --- Detalle de producción (órdenes finalizadas) ---
  ws.mergeCells(`A${r}:${lastCol}${r}`);
  ws.getCell(`A${r}`).value = 'DETALLE DE PRODUCCIÓN (órdenes finalizadas)';
  ws.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: 'FF1D4ED8' } };
  ws.getCell(`A${r}`).alignment = { horizontal: 'left', vertical: 'middle' };
  r++;

  const cabDetalle = ['FECHA', 'N° ORDEN', 'PRODUCIDO'];
  const alinDetalle = ['left', 'left', 'right'];
  cabDetalle.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
    cell.alignment = { horizontal: alinDetalle[i], vertical: 'middle' };
    cell.border = BORDE_FINO;
  });
  ws.getRow(r).height = 18;
  r++;

  if (ordenes.length === 0) {
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = 'No hay órdenes de producción finalizadas en el rango seleccionado.';
    cell.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    bordearFila(ws, r, NCOLS);
    r++;
  } else {
    ordenes.forEach((o) => {
      const c1 = ws.getCell(r, 1);
      c1.value = formatearFecha(o.fecha); c1.font = { size: 9 };
      c1.alignment = { horizontal: 'left', vertical: 'top' }; c1.border = BORDE_FINO;

      const c2 = ws.getCell(r, 2);
      c2.value = o.numero_orden || '-'; c2.font = { size: 9 };
      c2.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }; c2.border = BORDE_FINO;

      const c3 = ws.getCell(r, 3);
      c3.value = parseFloat(o.cantidad || 0); c3.numFmt = '#,##0.00';
      c3.font = { size: 9 }; c3.alignment = { horizontal: 'right', vertical: 'top' }; c3.border = BORDE_FINO;
      r++;
    });
  }

  // Total producido
  ws.mergeCells(r, 1, r, 2);
  const tot1 = ws.getCell(r, 1);
  tot1.value = 'TOTAL PRODUCIDO';
  tot1.font = { bold: true, size: 10 };
  tot1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };
  tot1.alignment = { horizontal: 'left', vertical: 'middle' };
  tot1.border = BORDE_FINO;
  ws.getCell(r, 2).border = BORDE_FINO;
  ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };

  const tot3 = ws.getCell(r, 3);
  tot3.value = producido; tot3.numFmt = '#,##0.00';
  tot3.font = { bold: true, size: 10 };
  tot3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };
  tot3.alignment = { horizontal: 'right', vertical: 'middle' };
  tot3.border = BORDE_FINO;
  ws.getRow(r).height = 18;
  r += 2;

  // Nota informativa
  ws.mergeCells(`A${r}:${lastCol}${r}`);
  ws.getCell(`A${r}`).value =
    'El total despachado corresponde a las salidas por venta del producto en el periodo. Documento informativo emitido por INDPACK S.A.C.';
  ws.getCell(`A${r}`).font = { italic: true, size: 8, color: { argb: 'FF888888' } };
  ws.getCell(`A${r}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Formato de número con separador de miles y 2 decimales (para textos, p. ej. stock).
function formatearNum(valor) {
  const n = parseFloat(valor || 0);
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
