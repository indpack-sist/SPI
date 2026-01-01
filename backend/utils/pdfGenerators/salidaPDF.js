// backend/utils/pdfGenerators/salidaPDF.js

const COLORES = {
  primario: '#1e88e5',
  negro: '#000000',
  blanco: '#FFFFFF',
  grisOscuro: '#666666',
  grisClaro: '#CCCCCC',
  gris: '#999999'
};

function formatearFechaLima(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  
  // Convertir a zona horaria de Lima (UTC-5)
  const limaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  
  return limaDate.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatearHoraLima(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  
  // Convertir a zona horaria de Lima (UTC-5)
  const limaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  
  return limaDate.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function agregarEncabezado(doc, titulo) {
  doc.rect(50, 30, 495, 70).stroke(COLORES.negro);
  
  // Logo placeholder (izquierda)
  doc.rect(60, 40, 100, 50).fillAndStroke(COLORES.primario, COLORES.primario);
  doc.fontSize(16).fillColor(COLORES.blanco).font('Helvetica-Bold');
  doc.text('IndPack', 70, 55);
  
  // Información empresa
  doc.fontSize(7).fillColor(COLORES.negro).font('Helvetica');
  doc.text('INDPACK S.A.C.', 180, 45);
  doc.text('RUC: 20550932297', 180, 55);
  doc.text('AV. EL SOL LT. 4 B MZ. LL-1', 180, 65);
  doc.text('Villa el Salvador, Lima - Perú', 180, 75);
  
  // Título documento (derecha)
  doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORES.negro);
  doc.text(titulo, 380, 50, { width: 150, align: 'center' });
  
  return 110;
}

function agregarPiePagina(doc, texto) {
  doc.fontSize(7).font('Helvetica').fillColor(COLORES.gris);
  doc.text(texto, 50, 770, { align: 'center', width: 495 });
  
  const fechaHora = `Impreso: ${formatearFechaLima(new Date())} - ${formatearHoraLima(new Date())}`;
  doc.text(fechaHora, 50, 780, { align: 'right', width: 495 });
}

export async function generarPDFSalida(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      // ====================================
      // ENCABEZADO
      // ====================================
      
      let y = agregarEncabezado(doc, 'COMPROBANTE INTERNO\nSALIDA DE INVENTARIO');
      y += 10;
      
      // ====================================
      // INFORMACIÓN GENERAL
      // ====================================
      
      doc.rect(50, y, 495, 140).stroke(COLORES.negro);
      y += 10;
      
      doc.fontSize(9).fillColor(COLORES.negro);
      
      // Columna izquierda
      doc.font('Helvetica').text('N° Documento:', 60, y);
      doc.font('Helvetica-Bold').text(datos.codigo || datos.id_salida || 'N/A', 160, y);
      
      doc.font('Helvetica').text('Tipo Inventario:', 60, y + 15);
      doc.font('Helvetica-Bold').text(datos.tipo_inventario || 'N/A', 160, y + 15, { width: 140 });
      
      doc.font('Helvetica').text('Tipo Movimiento:', 60, y + 30);
      doc.font('Helvetica-Bold').text(datos.tipo_movimiento || 'N/A', 160, y + 30, { width: 140 });
      
      const destino = datos.tipo_movimiento === 'Venta' 
        ? datos.cliente 
        : datos.departamento || datos.tipo_movimiento;
      doc.font('Helvetica').text('Destino:', 60, y + 45);
      doc.font('Helvetica-Bold').text((destino || 'N/A'), 160, y + 45, { width: 140, lineGap: 2 });
      
      doc.font('Helvetica').text('Vehículo:', 60, y + 75);
      doc.font('Helvetica-Bold').text((datos.vehiculo || 'N/A'), 160, y + 75, { width: 140, lineGap: 2 });
      
      doc.font('Helvetica').text('Registrado por:', 60, y + 90);
      doc.font('Helvetica-Bold').text((datos.registrado_por || 'N/A'), 160, y + 90, { width: 140, lineGap: 2 });
      
      // Columna derecha
      doc.font('Helvetica').text('Fecha:', 320, y);
      doc.font('Helvetica-Bold').text(formatearFechaLima(datos.fecha_movimiento), 420, y);
      
      doc.font('Helvetica').text('Hora:', 320, y + 15);
      doc.font('Helvetica-Bold').text(formatearHoraLima(datos.fecha_movimiento), 420, y + 15);
      
      doc.font('Helvetica').text('Estado:', 320, y + 30);
      const estadoColor = datos.estado === 'Completada' ? '#28a745' : COLORES.negro;
      doc.font('Helvetica-Bold').fillColor(estadoColor);
      doc.text(datos.estado || 'N/A', 420, y + 30);
      doc.fillColor(COLORES.negro);
      
      y += 155;
      
      // ====================================
      // TABLA DE PRODUCTOS (SIN PRECIOS)
      // ====================================
      
      const detalles = datos.detalles || [];
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text(`Productos Despachados (${detalles.length} items)`, 50, y);
      y += 20;
      
      // Encabezado tabla
      doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
      doc.text('Código', 60, y + 6);
      doc.text('Descripción del Producto', 140, y + 6);
      doc.text('Cantidad', 420, y + 6, { width: 60, align: 'center' });
      doc.text('Unidad', 485, y + 6, { width: 50, align: 'center' });
      y += 20;
      
      // Filas de productos
      doc.font('Helvetica').fillColor(COLORES.negro);
      detalles.forEach((det, idx) => {
        // Verificar nueva página
        if (y > 700) {
          doc.addPage();
          y = agregarEncabezado(doc, 'COMPROBANTE INTERNO\nSALIDA (cont.)');
          y += 30;
          
          // Repetir encabezado
          doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
          doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
          doc.text('Código', 60, y + 6);
          doc.text('Descripción del Producto', 140, y + 6);
          doc.text('Cantidad', 420, y + 6, { width: 60, align: 'center' });
          doc.text('Unidad', 485, y + 6, { width: 50, align: 'center' });
          y += 20;
          doc.fillColor(COLORES.negro);
        }
        
        // Fondo alternado
        if (idx % 2 === 0) {
          doc.rect(50, y, 495, 18).fill('#F5F5F5');
        }
        
        doc.fontSize(8).fillColor(COLORES.negro);
        doc.font('Helvetica').text((det.codigo_producto || '').substring(0, 15), 60, y + 5);
        doc.text((det.producto || '').substring(0, 50), 140, y + 5, { width: 270 });
        doc.font('Helvetica-Bold').text(parseFloat(det.cantidad || 0).toFixed(2), 420, y + 5, { width: 60, align: 'center' });
        doc.font('Helvetica').text(det.unidad_medida || '', 485, y + 5, { width: 50, align: 'center' });
        
        y += 18;
        doc.moveTo(50, y).lineTo(545, y).stroke(COLORES.grisClaro);
      });
      
      // ====================================
      // RESUMEN
      // ====================================
      
      y += 15;
      
      doc.rect(370, y, 175, 30).fill('#E3F2FD').stroke(COLORES.primario);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text('TOTAL PRODUCTOS:', 380, y + 10);
      doc.fontSize(12);
      doc.text(`${detalles.length}`, 490, y + 9, { align: 'right', width: 45 });
      
      y += 45;
      
      // ====================================
      // OBSERVACIONES
      // ====================================
      
      if (datos.observaciones) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('Observaciones:', 50, y);
        y += 15;
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 50, y, { width: 495, align: 'justify' });
        y += Math.ceil(doc.heightOfString(datos.observaciones, { width: 495 })) + 20;
      }
      
      // ====================================
      // FIRMAS
      // ====================================
      
      const firmaY = Math.max(y + 15, 680);
      
      // Líneas de firma
      doc.moveTo(80, firmaY).lineTo(230, firmaY).stroke(COLORES.negro);
      doc.moveTo(320, firmaY).lineTo(470, firmaY).stroke(COLORES.negro);
      
      // Títulos
      doc.fontSize(8).fillColor(COLORES.grisOscuro).font('Helvetica-Bold');
      doc.text('CONTEO VERIFICADO POR', 80, firmaY + 5, { width: 150, align: 'center' });
      doc.text('AUTORIZADO POR', 320, firmaY + 5, { width: 150, align: 'center' });
      
      // Subtítulos
      doc.fontSize(7).fillColor(COLORES.gris).font('Helvetica');
      doc.text('(Contador de Productos)', 80, firmaY + 18, { width: 150, align: 'center' });
      doc.text('(Supervisor/Jefe de Área)', 320, firmaY + 18, { width: 150, align: 'center' });
      
      // ====================================
      // PIE DE PÁGINA
      // ====================================
      
      agregarPiePagina(doc, 'Documento interno de control - Solo para uso administrativo - INDPACK S.A.C.');
      
      doc.end();
    } catch (error) {
      console.error('Error al generar PDF de salida:', error);
      reject(error);
    }
  });
}