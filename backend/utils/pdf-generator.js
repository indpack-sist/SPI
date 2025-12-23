import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.',
  web: 'https://www.indpackperu.com',
  direccion: 'Av. el Sol Mza. Ll-1 Lote. 4 B Coo. las Vertientes de Tablada',
  distrito: 'Villa el Salvador',
  departamento: 'Lima, Perú',
  actividad: 'Fab. de Plásticos y de Caucho'
};

const COLORES = {
  negro: '#000000',
  grisOscuro: '#333333',
  grisMedio: '#666666',
  grisClaro: '#999999',
  blanco: '#FFFFFF'
};

function agregarLogoDeFondo(doc) {
  const possibleLogoPaths = [
    path.join(__dirname, '..', '..', 'frontend', 'public', 'images', 'indpack.png'),
    path.join(__dirname, '..', '..', 'frontend', 'images', 'indpack.png'),
    path.join(__dirname, '..', 'frontend', 'public', 'images', 'indpack.png'),
    path.join(__dirname, '..', 'frontend', 'images', 'indpack.png'),
    path.join(process.cwd(), 'frontend', 'public', 'images', 'indpack.png'),
    path.join(process.cwd(), 'frontend', 'images', 'indpack.png')
  ];
  
  let logoLoaded = false;
  for (const logoPath of possibleLogoPaths) {
    if (fs.existsSync(logoPath)) {
      try {
        doc.save();
        
        doc.opacity(0.08); 
        
        const logoSize = 350;
        
        const pageWidth = 595; 
        const pageHeight = 842; 
        
        const centerX = (pageWidth - logoSize) / 2 + 100;
        const centerY = (pageHeight - logoSize) / 2 + 10;
        
        doc.translate(centerX + logoSize/2, centerY + logoSize/2);
        doc.rotate(-45, { origin: [0, 0] });
        doc.translate(-(logoSize/2), -(logoSize/2));
        
        doc.image(logoPath, 0, 0, { 
          width: logoSize,
          height: logoSize,
          fit: [logoSize, logoSize]
        });
        
        doc.restore();
        
        logoLoaded = true;
        break;
      } catch (err) {
        console.log(`No se pudo cargar logo de fondo desde: ${logoPath}`);
      }
    }
  }
  
  if (!logoLoaded) {
    console.log('Logo de fondo no encontrado');
  }
}

function formatearFecha(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return 'N/A';
  
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatearMoneda(valor, moneda = 'PEN') {
  const simbolos = { 'PEN': 'S/', 'USD': '$', 'EUR': '€' };
  return `${simbolos[moneda] || 'S/'} ${parseFloat(valor || 0).toFixed(2)}`;
}

function textoMultilinea(doc, label, texto, x, y, maxWidth = 190) {
  doc.font('Helvetica').text(label, x, y);
  doc.font('Helvetica-Bold').text(texto || 'N/A', x + 100, y, { 
    width: maxWidth,
    lineGap: 2
  });
}

function agregarEncabezado(doc, titulo) {
  agregarLogoDeFondo(doc);

  doc.rect(50, 50, 495, 90).stroke(COLORES.negro);
  
  doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORES.negro);
  doc.text('INDPACK S.A.C.', 60, 60);
  
  doc.fontSize(8).font('Helvetica').fillColor(COLORES.grisOscuro);
  doc.text(`RUC: ${EMPRESA.ruc}`, 60, 77);
  doc.text(EMPRESA.actividad, 60, 88);
  doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito} - ${EMPRESA.departamento}`, 60, 99, { width: 300, lineGap: 2 });
  doc.text(EMPRESA.web, 60, 121);
  
  doc.moveTo(370, 60).lineTo(370, 130).stroke(COLORES.grisMedio);
  
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORES.negro);
  doc.text(titulo, 380, 70, { width: 155, align: 'center' });
  
  doc.moveTo(50, 145).lineTo(545, 145).lineWidth(1.5).stroke(COLORES.negro);
  
  doc.fillColor(COLORES.negro);
  return 160;
}

function agregarPiePagina(doc, textoPie) {
  const pageCount = doc.bufferedPageRange().count;
  
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    
    agregarLogoDeFondo(doc);
    
    doc.moveTo(50, 760).lineTo(545, 760).lineWidth(0.5).stroke(COLORES.grisMedio);
    
    doc.fontSize(7).fillColor(COLORES.grisMedio);
    doc.text(textoPie, 50, 768, { width: 495, align: 'center' });
    doc.text(`Página ${i + 1} de ${pageCount}`, 50, 780, { width: 495, align: 'center' });
  }
}

export async function generarPDFEntrada(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      let y = agregarEncabezado(doc, 'COMPROBANTE DE\nENTRADA');
      y += 10;
      
      doc.rect(50, y, 495, 100).stroke(COLORES.negro);
      y += 10;
      
      doc.fontSize(9).fillColor(COLORES.negro);
      
      doc.font('Helvetica').text('Documento N°:', 60, y);
      doc.font('Helvetica-Bold').text(datos.id_entrada || 'N/A', 160, y);
      
      doc.font('Helvetica').text('Tipo Inventario:', 60, y + 15);
      doc.font('Helvetica-Bold').text(datos.tipo_inventario || 'N/A', 160, y + 15, { width: 140 });
      
      doc.font('Helvetica').text('Proveedor:', 60, y + 30);
      doc.font('Helvetica-Bold').text((datos.proveedor || 'N/A'), 160, y + 30, { width: 140, lineGap: 2 });
      
      doc.font('Helvetica').text('Doc. Soporte:', 60, y + 60);
      doc.font('Helvetica-Bold').text(datos.documento_soporte || 'N/A', 160, y + 60, { width: 140 });
      
      doc.font('Helvetica').text('Fecha:', 320, y);
      doc.font('Helvetica-Bold').text(formatearFecha(datos.fecha_movimiento), 400, y);
      
      doc.font('Helvetica').text('Estado:', 320, y + 15);
      doc.font('Helvetica-Bold').text(datos.estado || 'N/A', 400, y + 15);
      
      doc.font('Helvetica').text('Registrado por:', 320, y + 30);
      doc.font('Helvetica-Bold').text((datos.registrado_por || 'N/A'), 400, y + 30, { width: 135, lineGap: 2 });
      
      y += 115;
      
      const detalles = datos.detalles || [];
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text(`Detalle de Entrada (${detalles.length} productos)`, 50, y);
      y += 20;
      
      doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
      
      doc.text('Código', 60, y + 6);
      doc.text('Producto', 140, y + 6);
      doc.text('Cantidad', 350, y + 6);
      doc.text('Costo Unit.', 420, y + 6);
      doc.text('Subtotal', 490, y + 6, { align: 'right' });
      
      y += 20;
      
      doc.font('Helvetica').fillColor(COLORES.negro);
      
      detalles.forEach((det, idx) => {
        if (y > 700) {
          doc.addPage();
          y = agregarEncabezado(doc, 'COMPROBANTE DE\nENTRADA (cont.)');
          y += 30;
        }
        
        if (idx % 2 === 0) {
          doc.rect(50, y, 495, 18).fill('#F5F5F5');
        }
        
        const subtotal = (det.cantidad || 0) * (det.costo_unitario || 0);
        
        doc.fontSize(8).fillColor(COLORES.negro);
        doc.text((det.codigo_producto || '').substring(0, 15), 60, y + 5);
        doc.text((det.producto || '').substring(0, 40), 140, y + 5);
        doc.text(`${parseFloat(det.cantidad || 0).toFixed(2)} ${det.unidad_medida || ''}`, 350, y + 5);
        doc.text(formatearMoneda(det.costo_unitario || 0, datos.moneda), 420, y + 5);
        doc.font('Helvetica-Bold').text(formatearMoneda(subtotal, datos.moneda), 490, y + 5, { align: 'right' });
        doc.font('Helvetica');
        
        y += 18;
        doc.moveTo(50, y).lineTo(545, y).stroke(COLORES.grisClaro);
      });
      
      y += 15;
      
      const totalCosto = datos.total_costo || detalles.reduce((sum, d) => 
        sum + ((d.costo_unitario || 0) * (d.cantidad || 0)), 0
      );
      
      doc.rect(370, y, 175, 30).stroke(COLORES.negro);
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text('COSTO TOTAL:', 380, y + 10);
      
      doc.fontSize(12);
      doc.text(formatearMoneda(totalCosto, datos.moneda), 465, y + 9, { align: 'right', width: 70 });
      
      y += 45;
      
      if (datos.observaciones) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('Observaciones:', 50, y);
        y += 15;
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 50, y, { width: 495, align: 'justify' });
        y += 35;
      }
      
      const firmaY = Math.max(y + 15, 690);
      
      doc.moveTo(80, firmaY).lineTo(230, firmaY).stroke(COLORES.negro);
      doc.fontSize(8).fillColor(COLORES.grisOscuro);
      doc.text('Registrado por', 80, firmaY + 5, { width: 150, align: 'center' });
      
      doc.moveTo(320, firmaY).lineTo(470, firmaY).stroke(COLORES.negro);
      doc.text('Autorizado por', 320, firmaY + 5, { width: 150, align: 'center' });
      
      agregarPiePagina(doc, 'Comprobante de registro de entrada de inventario - INDPACK S.A.C.');
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generarPDFSalida(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      let y = agregarEncabezado(doc, 'COMPROBANTE DE\nSALIDA');
      y += 10;
      
      doc.rect(50, y, 495, 120).stroke(COLORES.negro);
      y += 10;
      
      doc.fontSize(9).fillColor(COLORES.negro);
      
      // Columna izquierda
      doc.font('Helvetica').text('Documento N°:', 60, y);
      doc.font('Helvetica-Bold').text(datos.id_salida || 'N/A', 160, y);
      
      doc.font('Helvetica').text('Tipo Inventario:', 60, y + 15);
      doc.font('Helvetica-Bold').text(datos.tipo_inventario || 'N/A', 160, y + 15, { width: 140 });
      
      doc.font('Helvetica').text('Tipo Movimiento:', 60, y + 30);
      doc.font('Helvetica-Bold').text(datos.tipo_movimiento || 'N/A', 160, y + 30, { width: 140 });
      
      const destino = datos.tipo_movimiento === 'Venta' ? datos.cliente : datos.departamento || datos.tipo_movimiento;
      doc.font('Helvetica').text('Cliente/Destino:', 60, y + 45);
      doc.font('Helvetica-Bold').text((destino || 'N/A'), 160, y + 45, { width: 140, lineGap: 2 });
      
      doc.font('Helvetica').text('Vehículo:', 60, y + 75);
      doc.font('Helvetica-Bold').text((datos.vehiculo || 'N/A'), 160, y + 75, { width: 140, lineGap: 2 });
      
      // Columna derecha
      doc.font('Helvetica').text('Fecha:', 320, y);
      doc.font('Helvetica-Bold').text(formatearFecha(datos.fecha_movimiento), 400, y);
      
      doc.font('Helvetica').text('Estado:', 320, y + 15);
      doc.font('Helvetica-Bold').text(datos.estado || 'N/A', 400, y + 15);
      
      doc.font('Helvetica').text('Registrado por:', 320, y + 30);
      doc.font('Helvetica-Bold').text((datos.registrado_por || 'N/A'), 400, y + 30, { width: 135, lineGap: 2 });
      
      doc.font('Helvetica').text('Moneda:', 320, y + 45);
      doc.font('Helvetica-Bold').text(datos.moneda === 'PEN' ? 'Soles' : datos.moneda, 400, y + 45);
      
      y += 135;
      
      const detalles = datos.detalles || [];
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text(`Detalle de Salida (${detalles.length} productos)`, 50, y);
      y += 20;
      
      doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
      
      doc.text('Código', 60, y + 6);
      doc.text('Producto', 140, y + 6);
      doc.text('Cantidad', 340, y + 6);
      doc.text('Precio Unit.', 410, y + 6);
      doc.text('Subtotal', 490, y + 6, { align: 'right' });
      
      y += 20;
      
      doc.font('Helvetica').fillColor(COLORES.negro);
      
      detalles.forEach((det, idx) => {
        if (y > 700) {
          doc.addPage();
          y = agregarEncabezado(doc, 'COMPROBANTE DE\nSALIDA (cont.)');
          y += 30;
        }
        
        if (idx % 2 === 0) {
          doc.rect(50, y, 495, 18).fill('#F5F5F5');
        }
        
        const precio = det.precio_unitario || det.costo_unitario || 0;
        const subtotal = (det.cantidad || 0) * precio;
        
        doc.fontSize(8).fillColor(COLORES.negro);
        doc.text((det.codigo_producto || '').substring(0, 15), 60, y + 5);
        doc.text((det.producto || '').substring(0, 38), 140, y + 5);
        doc.text(`${parseFloat(det.cantidad || 0).toFixed(2)} ${det.unidad_medida || ''}`, 340, y + 5);
        doc.text(formatearMoneda(precio, datos.moneda), 410, y + 5);
        doc.font('Helvetica-Bold').text(formatearMoneda(subtotal, datos.moneda), 490, y + 5, { align: 'right' });
        doc.font('Helvetica');
        
        y += 18;
        doc.moveTo(50, y).lineTo(545, y).stroke(COLORES.grisClaro);
      });
      
      y += 15;
      
      const totalPrecio = detalles.reduce((sum, d) => 
        sum + ((d.precio_unitario || d.costo_unitario || 0) * (d.cantidad || 0)), 0
      );
      
      doc.rect(370, y, 175, 30).stroke(COLORES.negro);
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text('TOTAL:', 380, y + 10);
      
      doc.fontSize(12);
      doc.text(formatearMoneda(totalPrecio, datos.moneda), 465, y + 9, { align: 'right', width: 70 });
      
      y += 45;
      
      if (datos.observaciones) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('Observaciones:', 50, y);
        y += 15;
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 50, y, { width: 495, align: 'justify' });
        y += 35;
      }
      
      const firmaY = Math.max(y + 15, 690);
      
      doc.moveTo(80, firmaY).lineTo(230, firmaY).stroke(COLORES.negro);
      doc.fontSize(8).fillColor(COLORES.grisOscuro);
      doc.text('Autorizado por', 80, firmaY + 5, { width: 150, align: 'center' });
      
      doc.moveTo(320, firmaY).lineTo(470, firmaY).stroke(COLORES.negro);
      doc.text('Recibido por', 320, firmaY + 5, { width: 150, align: 'center' });
      
      agregarPiePagina(doc, 'Comprobante de registro de salida de inventario - INDPACK S.A.C.');
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function generarPDFTransferencia(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      let y = agregarEncabezado(doc, 'COMPROBANTE DE\nTRANSFERENCIA');
      y += 10;
      
      doc.rect(50, y, 495, 100).stroke(COLORES.negro);
      y += 10;
      
      doc.fontSize(9).fillColor(COLORES.negro);
      
      doc.font('Helvetica').text('Documento N°:', 60, y);
      doc.font('Helvetica-Bold').text(datos.id_transferencia_cabecera || 'N/A', 165, y);
      
      doc.font('Helvetica').text('Inventario Origen:', 60, y + 15);
      doc.font('Helvetica-Bold').text(datos.tipo_inventario_origen || 'N/A', 165, y + 15, { width: 130 });
      
      doc.font('Helvetica').text('Inventario Destino:', 60, y + 30);
      doc.font('Helvetica-Bold').text(datos.tipo_inventario_destino || 'N/A', 165, y + 30, { width: 130 });
      
      doc.font('Helvetica').text('Registrado por:', 60, y + 60);
      doc.font('Helvetica-Bold').text((datos.registrado_por || 'N/A'), 165, y + 60, { width: 130, lineGap: 2 });
      
      doc.font('Helvetica').text('Fecha:', 320, y);
      doc.font('Helvetica-Bold').text(formatearFecha(datos.fecha_transferencia), 400, y);
      
      doc.font('Helvetica').text('Estado:', 320, y + 15);
      doc.font('Helvetica-Bold').text(datos.estado || 'N/A', 400, y + 15);
      
      y += 115;
      
      const detalles = datos.detalles || [];
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text(`Detalle de Transferencia (${detalles.length} productos)`, 50, y);
      y += 20;
      
      doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
      
      doc.text('Cód. Origen', 60, y + 6);
      doc.text('Producto', 140, y + 6);
      doc.text('Cód. Destino', 320, y + 6);
      doc.text('Cantidad', 410, y + 6);
      doc.text('Costo', 490, y + 6, { align: 'right' });
      
      y += 20;
      
      doc.font('Helvetica').fillColor(COLORES.negro);
      
      detalles.forEach((det, idx) => {
        if (y > 700) {
          doc.addPage();
          y = agregarEncabezado(doc, 'COMPROBANTE DE\nTRANSFERENCIA (cont.)');
          y += 30;
        }
        
        if (idx % 2 === 0) {
          doc.rect(50, y, 495, 18).fill('#F5F5F5');
        }
        
        const subtotal = (det.cantidad || 0) * (det.costo_unitario || 0);
        
        doc.fontSize(8).fillColor(COLORES.negro);
        doc.text((det.codigo_origen || det.codigo_producto || '').substring(0, 15), 60, y + 5);
        doc.text((det.producto_nombre || det.producto || '').substring(0, 35), 140, y + 5);
        doc.text((det.codigo_destino || 'Auto').substring(0, 15), 320, y + 5);
        doc.text(`${parseFloat(det.cantidad || 0).toFixed(2)} ${det.unidad_medida || ''}`, 410, y + 5);
        doc.font('Helvetica-Bold').text(formatearMoneda(subtotal), 490, y + 5, { align: 'right' });
        doc.font('Helvetica');
        
        y += 18;
        doc.moveTo(50, y).lineTo(545, y).stroke(COLORES.grisClaro);
      });
      
      y += 15;
      
      const totalCosto = detalles.reduce((sum, d) => 
        sum + ((d.cantidad || 0) * (d.costo_unitario || 0)), 0
      );
      
      doc.rect(370, y, 175, 30).stroke(COLORES.negro);
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text('COSTO TOTAL:', 380, y + 10);
      
      doc.fontSize(12);
      doc.text(formatearMoneda(totalCosto), 465, y + 9, { align: 'right', width: 70 });
      
      y += 45;
      
      if (datos.observaciones) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('Observaciones:', 50, y);
        y += 15;
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 50, y, { width: 495 });
        y += 35;
      }
      
      const firmaY = Math.max(y + 15, 690);
      
      doc.moveTo(80, firmaY).lineTo(230, firmaY).stroke(COLORES.negro);
      doc.fontSize(8).fillColor(COLORES.grisOscuro);
      doc.text('Entrega', 80, firmaY + 5, { width: 150, align: 'center' });
      
      doc.moveTo(320, firmaY).lineTo(470, firmaY).stroke(COLORES.negro);
      doc.text('Recibe', 320, firmaY + 5, { width: 150, align: 'center' });
      
      agregarPiePagina(doc, 'Comprobante de transferencia entre inventarios - INDPACK S.A.C.');
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
export async function generarPDFOrdenProduccion(datos, consumoMateriales = []) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      
      let y = agregarEncabezado(doc, 'ORDEN DE\nPRODUCCIÓN');
      y += 10;
      
      doc.rect(50, y, 495, 120).stroke(COLORES.negro);
      y += 10;
      
      doc.fontSize(9).fillColor(COLORES.negro);
      
      doc.font('Helvetica').text('Orden N°:', 60, y);
      doc.font('Helvetica-Bold').text(datos.numero_orden || 'N/A', 160, y);
      
      doc.font('Helvetica').text('Producto:', 60, y + 15);
      doc.font('Helvetica-Bold').text((datos.producto || 'N/A'), 160, y + 15, { width: 140, lineGap: 2 });
      
      doc.font('Helvetica').text('Código:', 60, y + 45);
      doc.font('Helvetica-Bold').text(datos.codigo_producto || 'N/A', 160, y + 45);
      
      doc.font('Helvetica').text('Supervisor:', 60, y + 60);
      doc.font('Helvetica-Bold').text((datos.supervisor || 'N/A'), 160, y + 60, { width: 140, lineGap: 2 });
      
      doc.font('Helvetica').text('Cant. Planificada:', 60, y + 90);
      doc.font('Helvetica-Bold').text(`${datos.cantidad_planificada || 0} ${datos.unidad_medida || ''}`, 160, y + 90);
      
      doc.font('Helvetica').text('Fecha:', 320, y);
      doc.font('Helvetica-Bold').text(formatearFecha(datos.fecha_creacion), 400, y);
      
      doc.font('Helvetica').text('Estado:', 320, y + 15);
      doc.font('Helvetica-Bold').text(datos.estado || 'N/A', 400, y + 15);
      
      if (datos.cantidad_producida > 0) {
        doc.font('Helvetica').text('Cant. Producida:', 320, y + 30);
        doc.font('Helvetica-Bold').text(`${datos.cantidad_producida} ${datos.unidad_medida || ''}`, 400, y + 30);
      }
      
      y += 135;
      
      if (consumoMateriales.length > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('Materiales Consumidos', 50, y);
        y += 20;
        
        doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
        
        doc.text('Insumo', 60, y + 6);
        doc.text('Cantidad', 350, y + 6);
        doc.text('Costo Unit.', 420, y + 6);
        doc.text('Subtotal', 490, y + 6, { align: 'right' });
        
        y += 20;
        
        doc.font('Helvetica').fillColor(COLORES.negro);
        
        consumoMateriales.forEach((mat, idx) => {
          if (y > 700) {
            doc.addPage();
            y = agregarEncabezado(doc, 'ORDEN DE\nPRODUCCIÓN (cont.)');
            y += 30;
          }
          
          if (idx % 2 === 0) {
            doc.rect(50, y, 495, 18).fill('#F5F5F5');
          }
          
          doc.fontSize(8).fillColor(COLORES.negro);
          doc.text((mat.insumo || '').substring(0, 50), 60, y + 5);
          doc.text(`${mat.cantidad_requerida} ${mat.unidad_medida || ''}`, 350, y + 5);
          doc.text(formatearMoneda(mat.costo_unitario), 420, y + 5);
          doc.font('Helvetica-Bold').text(formatearMoneda(mat.costo_total), 490, y + 5, { align: 'right' });
          doc.font('Helvetica');
          
          y += 18;
          doc.moveTo(50, y).lineTo(545, y).stroke(COLORES.grisClaro);
        });
        
        y += 15;
        
        doc.rect(370, y, 175, 30).stroke(COLORES.negro);
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('COSTO MATERIALES:', 380, y + 10);
        
        doc.fontSize(12);
        doc.text(formatearMoneda(datos.costo_materiales), 465, y + 9, { align: 'right', width: 70 });
        
        y += 45;
      }
      
      if (datos.observaciones) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('Observaciones:', 50, y);
        y += 15;
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 50, y, { width: 495 });
      }
      
      agregarPiePagina(doc, 'Orden de producción - INDPACK S.A.C.');
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}