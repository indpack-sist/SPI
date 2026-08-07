import PDFDocument from 'pdfkit';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.',
  direccion: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA',
  distrito: 'Villa el Salvador',
  departamento: 'Lima',
  pais: 'Perú',
  telefono: '01- 312 7858',
  email: 'informes@indpackperu.com'
};

const fmtCant = (num) => {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
};

async function cargarLogoAsync() {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logoPath = path.join(__dirname, '../../assets/logohorizontal.jpg');
    return fs.readFileSync(logoPath);
  } catch (e) {
    return null;
  }
}

// Definición de columnas (A4 landscape, área útil x: 30 -> 812)
const COLS = {
  fecha:      { x: 35,  w: 58,  label: 'F. EMISIÓN' },
  material:   { x: 95,  w: 175, label: 'MATERIAL' },
  movimiento: { x: 272, w: 62,  label: 'MOVIMIENTO' },
  tipoDoc:    { x: 336, w: 60,  label: 'TIPO DOC' },
  documento:  { x: 398, w: 95,  label: 'DOCUMENTO' },
  proveedor:  { x: 495, w: 175, label: 'PROVEEDOR' },
  cantidad:   { x: 672, w: 135, label: 'CANTIDAD' }
};

export async function generarControlMateriaPrimaPDF(movimientos, filtros) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const logoBuffer = await cargarLogoAsync();

      const rangoTexto = `${formatearFecha(filtros.fecha_inicio)} - ${formatearFecha(filtros.fecha_fin)}`;

      // ====== ENCABEZADO ======
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 30, 30, { width: 180, height: 50, fit: [180, 50] });
        } catch (e) {
          doc.rect(30, 30, 180, 50).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 40, 45);
        }
      } else {
        doc.rect(30, 30, 180, 50).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 40, 45);
      }

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 30, 88);
      doc.fontSize(8).font('Helvetica');
      doc.text(EMPRESA.direccion, 30, 101, { width: 300 });
      doc.text(`${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 30, 113);
      doc.text(`Tel: ${EMPRESA.telefono}  |  Email: ${EMPRESA.email}`, 30, 125);

      doc.roundedRect(580, 30, 230, 60, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 585, 38, { align: 'center', width: 220 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('CONTROL DE MATERIA PRIMA', 585, 53, { align: 'center', width: 220 });
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text(rangoTexto, 585, 71, { align: 'center', width: 220 });

      // Recuadro info
      doc.roundedRect(30, 145, 782, 40, 3).stroke('#000000');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Reporte:', 40, 155);
      doc.font('Helvetica').text('Ingresos por Compras de Materia Prima e Insumos', 100, 155);
      doc.font('Helvetica-Bold').text('Período:', 40, 168);
      doc.font('Helvetica').text(rangoTexto, 100, 168);
      doc.font('Helvetica-Bold').text('Registros:', 450, 155);
      doc.font('Helvetica').text(`${movimientos.length} movimientos`, 510, 155);
      doc.font('Helvetica-Bold').text('Emitido:', 450, 168);
      doc.font('Helvetica').text(new Date().toLocaleDateString('es-PE'), 510, 168);

      let yPos = 200;

      const dibujarCabeceraTabla = (y) => {
        doc.rect(30, y, 782, 20).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text(COLS.fecha.label, COLS.fecha.x, y + 6, { width: COLS.fecha.w });
        doc.text(COLS.material.label, COLS.material.x, y + 6, { width: COLS.material.w });
        doc.text(COLS.movimiento.label, COLS.movimiento.x, y + 6, { width: COLS.movimiento.w });
        doc.text(COLS.tipoDoc.label, COLS.tipoDoc.x, y + 6, { width: COLS.tipoDoc.w });
        doc.text(COLS.documento.label, COLS.documento.x, y + 6, { width: COLS.documento.w });
        doc.text(COLS.proveedor.label, COLS.proveedor.x, y + 6, { width: COLS.proveedor.w });
        doc.text(COLS.cantidad.label, COLS.cantidad.x, y + 6, { width: COLS.cantidad.w, align: 'right' });
      };

      dibujarCabeceraTabla(yPos);
      yPos += 20;

      const LIMITE_Y = 555;

      if (movimientos.length === 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666');
        doc.text('No se registraron ingresos de materia prima en el período seleccionado.', 30, yPos + 10, {
          align: 'center', width: 782
        });
      }

      movimientos.forEach((mov, idx) => {
        const material = mov.material || '-';
        const proveedor = mov.proveedor || '-';

        // Calcular altura de fila según el texto más alto
        doc.fontSize(8).font('Helvetica');
        const hMaterial = doc.heightOfString(material, { width: COLS.material.w - 5, lineGap: 1 });
        const hProveedor = doc.heightOfString(proveedor, { width: COLS.proveedor.w - 5, lineGap: 1 });
        const alturaFila = Math.max(18, hMaterial + 6, hProveedor + 6);

        if (yPos + alturaFila > LIMITE_Y) {
          doc.addPage();
          yPos = 40;
          dibujarCabeceraTabla(yPos);
          yPos += 20;
        }

        if (idx % 2 === 0) {
          doc.rect(30, yPos, 782, alturaFila).fillOpacity(0.08).fill('#3B82F6').fillOpacity(1);
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text(formatearFecha(mov.fecha_movimiento), COLS.fecha.x, yPos + 4, { width: COLS.fecha.w });
        doc.text(material, COLS.material.x, yPos + 4, { width: COLS.material.w - 5, lineGap: 1 });

        // Movimiento: Compra (verde) / otro tipo de entrada (azul)
        const esCompra = String(mov.tipo_entrada || '').toLowerCase() === 'compra';
        doc.fillColor(esCompra ? '#15803D' : '#1D4ED8').font('Helvetica-Bold');
        doc.text(esCompra ? 'Compra' : (mov.tipo_entrada || 'Entrada'), COLS.movimiento.x, yPos + 4, { width: COLS.movimiento.w });
        doc.fillColor('#000000').font('Helvetica');

        doc.text(mov.tipo_documento || '-', COLS.tipoDoc.x, yPos + 4, { width: COLS.tipoDoc.w, ellipsis: true });
        doc.text(mov.documento_soporte || '-', COLS.documento.x, yPos + 4, { width: COLS.documento.w, ellipsis: true });
        doc.text(proveedor, COLS.proveedor.x, yPos + 4, { width: COLS.proveedor.w - 5, lineGap: 1 });

        const cantTexto = `${fmtCant(mov.cantidad)}${mov.unidad_medida ? ' ' + mov.unidad_medida : ''}`;
        doc.text(cantTexto, COLS.cantidad.x, yPos + 4, { width: COLS.cantidad.w, align: 'right' });

        yPos += alturaFila;
      });

      // ====== RESUMEN POR MATERIAL ======
      if (movimientos.length > 0) {
        const totalesPorMaterial = {};
        movimientos.forEach(m => {
          const key = `${m.material || '-'}|${m.unidad_medida || ''}`;
          totalesPorMaterial[key] = (totalesPorMaterial[key] || 0) + parseFloat(m.cantidad || 0);
        });

        const filasResumen = Object.entries(totalesPorMaterial)
          .map(([key, total]) => {
            const [nombre, unidad] = key.split('|');
            return { nombre, unidad, total };
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        if (yPos + 40 > LIMITE_Y) {
          doc.addPage();
          yPos = 40;
        } else {
          yPos += 15;
        }

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1D4ED8');
        doc.text('RESUMEN POR MATERIAL', 30, yPos);
        yPos += 16;

        doc.rect(30, yPos, 500, 18).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('MATERIAL', 35, yPos + 5, { width: 350 });
        doc.text('TOTAL INGRESADO', 385, yPos + 5, { width: 140, align: 'right' });
        yPos += 18;

        filasResumen.forEach((f, idx) => {
          if (yPos + 16 > LIMITE_Y) {
            doc.addPage();
            yPos = 40;
          }
          if (idx % 2 === 0) {
            doc.rect(30, yPos, 500, 16).fillOpacity(0.08).fill('#3B82F6').fillOpacity(1);
          }
          doc.fontSize(8).font('Helvetica').fillColor('#000000');
          doc.text(f.nombre, 35, yPos + 4, { width: 350, ellipsis: true });
          doc.font('Helvetica-Bold').text(
            `${fmtCant(f.total)}${f.unidad ? ' ' + f.unidad : ''}`,
            385, yPos + 4, { width: 140, align: 'right' }
          );
          yPos += 16;
        });
      }

      // Pie de página
      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Reporte generado por sistema - INDPACK S.A.C.', 30, 565, { align: 'center', width: 782 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
