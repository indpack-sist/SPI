import ExcelJS from 'exceljs';

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

// Etiquetas legibles del estado del workflow (deben coincidir con el frontend).
const ESTADO_LABEL = {
  Nuevo: 'Nuevo',
  En_gestion: 'En gestión',
  Contactado: 'Contactado',
  Convertido: 'Convertido',
  Descartado: 'Descartado'
};

const DUP_LABEL = {
  Ya_cliente: 'Ya cliente',
  Posible_duplicado: 'Posible duplicado'
};

// Columnas del reporte, en el mismo orden que tenía el export del navegador.
const COLUMNAS = [
  { key: 'score',       header: 'SCORE',            width: 8,  align: 'center', num: true },
  { key: 'razon',       header: 'RAZÓN SOCIAL',     width: 40, align: 'left',  wrap: true },
  { key: 'documento',   header: 'DOCUMENTO',        width: 14, align: 'left' },
  { key: 'segmento',    header: 'SEGMENTO',         width: 11, align: 'center' },
  { key: 'sector',      header: 'SECTOR',           width: 22, align: 'left',  wrap: true },
  { key: 'estado',      header: 'ESTADO',           width: 13, align: 'center' },
  { key: 'duplicado',   header: 'DUPLICADO',        width: 16, align: 'center' },
  { key: 'departamento', header: 'DEPARTAMENTO',    width: 15, align: 'left' },
  { key: 'provincia',   header: 'PROVINCIA',        width: 16, align: 'left' },
  { key: 'distrito',    header: 'DISTRITO',         width: 16, align: 'left' },
  { key: 'telefonos',   header: 'TELÉFONOS',        width: 22, align: 'left',  wrap: true },
  { key: 'emails',      header: 'EMAILS',           width: 26, align: 'left',  wrap: true },
  { key: 'web',         header: 'WEB',              width: 26, align: 'left' },
  { key: 'asignado',    header: 'ASIGNADO',         width: 20, align: 'left' },
  { key: 'origen',      header: 'ORIGEN',           width: 12, align: 'center' },
  { key: 'fecha',       header: 'FECHA CAPTURA',    width: 17, align: 'center' },
  { key: 'por_que',     header: 'POR QUÉ CONTACTAR', width: 60, align: 'left', wrap: true }
];

// score_detalle llega como objeto (columna JSON) o como texto; saca el motivo.
function porQueContactar(scoreDetalle) {
  if (!scoreDetalle) return '';
  let obj = scoreDetalle;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return ''; }
  }
  return obj?.por_que_contactar || '';
}

/**
 * Genera el Excel de prospectos. Recibe las filas ya consultadas (con los
 * mismos campos que devuelve el listado) y una descripción de los filtros
 * aplicados para el encabezado.
 *
 * @param {{ filas?: Array, filtros?: object }} arg
 * @returns {Promise<Buffer>}
 */
export async function generarProspectosXLSX({ filas = [], filtros = {} } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'INDPACK S.A.C.';
  wb.created = new Date();

  const totalCols = COLUMNAS.length;
  // Soporta más de 26 columnas por si crece; aquí son 17 (A..Q).
  const colLetter = (n) => {
    let s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const lastCol = colLetter(totalCols);

  const datos = filas.map((f) => ({
    score: Number(f.score) || 0,
    razon: f.razon_social || '',
    documento: f.documento || '',
    segmento: f.segmento || '',
    sector: f.sector || '',
    estado: ESTADO_LABEL[f.estado_workflow] || f.estado_workflow || '',
    duplicado: DUP_LABEL[f.flag_duplicado] || '',
    departamento: f.departamento || '',
    provincia: f.provincia || '',
    distrito: f.distrito || '',
    telefonos: f.telefonos || '',
    emails: f.emails || '',
    web: f.web || '',
    asignado: f.empleado_asignado || '',
    origen: f.origen || '',
    fecha: f.fecha_captura ? String(f.fecha_captura).replace('T', ' ').slice(0, 16) : '',
    por_que: porQueContactar(f.score_detalle)
  }));

  const ws = wb.addWorksheet('Prospectos', {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
    }
  });

  ws.columns = COLUMNAS.map((c) => ({ key: c.key, width: c.width }));

  // --- Encabezado del reporte ---
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell('A1').value = `${EMPRESA.razon_social}   -   R.U.C. ${EMPRESA.ruc}`;
  ws.getCell('A1').font = { bold: true, size: 12 };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell('A2').value = 'REPORTE DE PROSPECTOS';
  ws.getCell('A2').font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  ws.mergeCells(`A3:${lastCol}3`);
  ws.getCell('A3').value = filtros.descripcion || 'Todos los prospectos';
  ws.getCell('A3').font = { size: 10 };
  ws.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`A4:${lastCol}4`);
  ws.getCell('A4').value = `Registros: ${datos.length.toLocaleString('es-PE')}    |    Emitido: ${new Date().toLocaleString('es-PE')}`;
  ws.getCell('A4').font = { size: 10 };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  // Fila 5 separadora.

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
  datos.forEach((f) => {
    const row = ws.getRow(rowIdx);
    COLUMNAS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.value = f[c.key];
      cell.font = { size: 9 };
      cell.alignment = { horizontal: c.align, vertical: 'top', wrapText: !!c.wrap };
      cell.border = BORDE_FINO;
      if (c.num) cell.numFmt = '0';
    });
    rowIdx++;
  });

  if (datos.length === 0) {
    ws.mergeCells(`A${rowIdx}:${lastCol}${rowIdx}`);
    const cell = ws.getCell(`A${rowIdx}`);
    cell.value = 'No se encontraron prospectos con los filtros seleccionados.';
    cell.font = { italic: true, color: { argb: 'FF666666' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = BORDE_FINO;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
