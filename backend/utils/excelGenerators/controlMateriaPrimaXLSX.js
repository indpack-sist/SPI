import ExcelJS from 'exceljs';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.'
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
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

// Definición de columnas del detalle
const COLUMNAS = [
  { key: 'fecha',      header: 'F. EMISIÓN',  min: 12, max: 14, wrap: false, align: 'center' },
  { key: 'material',   header: 'MATERIAL',    min: 20, max: 45, wrap: true,  align: 'left' },
  { key: 'movimiento', header: 'MOVIMIENTO',  min: 12, max: 16, wrap: false, align: 'center' },
  { key: 'tipoDoc',    header: 'TIPO DOC',    min: 10, max: 16, wrap: false, align: 'center' },
  { key: 'documento',  header: 'DOCUMENTO',   min: 12, max: 32, wrap: true,  align: 'left' },
  { key: 'proveedor',  header: 'PROVEEDOR',   min: 20, max: 40, wrap: true,  align: 'left' },
  { key: 'cantidad',   header: 'CANTIDAD',    min: 12, max: 16, wrap: false, align: 'right' },
  { key: 'unidad',     header: 'UNIDAD',      min: 10, max: 14, wrap: false, align: 'center' }
];

// Calcula ancho de columna según el contenido (sin recortes), acotado por min/max
function calcularAncho(valores, header, min, max) {
  let maxLen = header.length;
  for (const v of valores) {
    const len = String(v ?? '').length;
    if (len > maxLen) maxLen = len;
  }
  // +2 de holgura. Si el max se alcanza, el texto hará wrap (columnas con wrap).
  return Math.min(Math.max(min, maxLen + 2), max);
}

export async function generarControlMateriaPrimaXLSX(movimientos, filtros) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INDPACK S.A.C.';
  wb.created = new Date();

  const rangoTexto = `${formatearFecha(filtros.fecha_inicio)} - ${formatearFecha(filtros.fecha_fin)}`;
  const totalCols = COLUMNAS.length;
  const lastColLetter = String.fromCharCode(64 + totalCols); // 8 -> 'H'

  // Normalizar filas
  const filas = movimientos.map(m => {
    const esCompra = String(m.tipo_entrada || '').toLowerCase() === 'compra';
    return {
      fecha: formatearFecha(m.fecha_movimiento),
      material: m.material || '-',
      movimiento: esCompra ? 'Compra' : (m.tipo_entrada || 'Entrada'),
      tipoDoc: m.tipo_documento || '-',
      documento: m.documento_soporte || '-',
      proveedor: m.proveedor || '-',
      cantidad: parseFloat(m.cantidad || 0),
      unidad: m.unidad_medida || ''
    };
  });

  // ============ HOJA ÚNICA ============
  const ws = wb.addWorksheet('Control Materia Prima', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  });

  // Anchos por columna (según contenido)
  ws.columns = COLUMNAS.map(c => ({
    key: c.key,
    width: calcularAncho(filas.map(f => c.key === 'cantidad' ? f.cantidad.toFixed(2) : f[c.key]), c.header, c.min, c.max)
  }));

  // --- Encabezado del reporte ---
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.getCell('A1').value = `${EMPRESA.razon_social}   -   R.U.C. ${EMPRESA.ruc}`;
  ws.getCell('A1').font = { bold: true, size: 12 };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells(`A2:${lastColLetter}2`);
  ws.getCell('A2').value = 'CONTROL DE MATERIA PRIMA E INSUMOS';
  ws.getCell('A2').font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  ws.mergeCells(`A3:${lastColLetter}3`);
  ws.getCell('A3').value = `Período: ${rangoTexto}    |    Ingresos de Materia Prima e Insumos (Compras y Entradas)`;
  ws.getCell('A3').font = { size: 10 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`A4:${lastColLetter}4`);
  ws.getCell('A4').value = `Registros: ${filas.length}    |    Emitido: ${new Date().toLocaleDateString('es-PE')}`;
  ws.getCell('A4').font = { size: 10 };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  // Fila 5 vacía (separador)

  // --- Cabecera de tabla (fila 6) ---
  const headerRowIdx = 6;
  const headerRow = ws.getRow(headerRowIdx);
  COLUMNAS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDE_FINO;
  });
  headerRow.height = 18;

  // --- Filas de datos ---
  let rowIdx = headerRowIdx + 1;
  filas.forEach((f) => {
    const row = ws.getRow(rowIdx);
    COLUMNAS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = f[c.key];
      cell.font = { size: 9 };
      cell.alignment = { horizontal: c.align, vertical: 'top', wrapText: c.wrap };
      cell.border = BORDE_FINO;

      if (c.key === 'cantidad') {
        cell.numFmt = '#,##0.00';
      }
      if (c.key === 'movimiento') {
        cell.font = { size: 9, bold: true, color: { argb: f.movimiento === 'Compra' ? 'FF15803D' : 'FF1D4ED8' } };
      }
    });
    rowIdx++;
  });

  if (filas.length === 0) {
    ws.mergeCells(`A${rowIdx}:${lastColLetter}${rowIdx}`);
    const cell = ws.getCell(`A${rowIdx}`);
    cell.value = 'No se registraron ingresos de materia prima en el período seleccionado.';
    cell.font = { italic: true, color: { argb: 'FF666666' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = BORDE_FINO;
    rowIdx++;
  }

  // ============ RESUMEN POR MATERIAL (debajo, misma hoja) ============
  const totalesPorMaterial = {};
  filas.forEach(f => {
    const key = `${f.material}|${f.unidad}`;
    totalesPorMaterial[key] = (totalesPorMaterial[key] || 0) + f.cantidad;
  });
  const resumen = Object.entries(totalesPorMaterial)
    .map(([key, total]) => {
      const [material, unidad] = key.split('|');
      return { material, unidad, total };
    })
    .sort((a, b) => a.material.localeCompare(b.material));

  if (resumen.length > 0) {
    rowIdx += 1; // fila vacía separadora

    // Título del resumen (ocupa las columnas A..C)
    ws.mergeCells(`A${rowIdx}:C${rowIdx}`);
    const tituloCell = ws.getCell(`A${rowIdx}`);
    tituloCell.value = 'RESUMEN POR MATERIAL';
    tituloCell.font = { bold: true, size: 12, color: { argb: 'FF1D4ED8' } };
    tituloCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(rowIdx).height = 20;
    rowIdx++;

    // Cabecera del resumen (columnas 1..3: Material, Total, Unidad)
    const cabResumen = ['MATERIAL', 'TOTAL INGRESADO', 'UNIDAD'];
    const alineaciones = ['left', 'right', 'center'];
    const rowCab = ws.getRow(rowIdx);
    cabResumen.forEach((h, i) => {
      const cell = rowCab.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } };
      cell.alignment = { horizontal: alineaciones[i], vertical: 'middle', wrapText: true };
      cell.border = BORDE_FINO;
    });
    rowCab.height = 18;
    rowIdx++;

    resumen.forEach((r) => {
      const row = ws.getRow(rowIdx);
      const c1 = row.getCell(1);
      c1.value = r.material; c1.font = { size: 9 };
      c1.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }; c1.border = BORDE_FINO;
      const c2 = row.getCell(2);
      c2.value = r.total; c2.numFmt = '#,##0.00'; c2.font = { size: 9, bold: true };
      c2.alignment = { horizontal: 'right', vertical: 'top' }; c2.border = BORDE_FINO;
      const c3 = row.getCell(3);
      c3.value = r.unidad; c3.font = { size: 9 };
      c3.alignment = { horizontal: 'center', vertical: 'top' }; c3.border = BORDE_FINO;
      rowIdx++;
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
