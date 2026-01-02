import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { numeroALetras } from './numeroALetras.js';

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
      const totalCosto = datos.total_costo || detalles.reduce((sum, d) => sum + ((d.costo_unitario || 0) * (d.cantidad || 0)), 0);
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
      // Configuramos márgenes y buffer
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // --- DEFINICIÓN DE LA FUNCIÓN DE ENCABEZADO DENTRO DEL SCOPE ---
      // Esto asegura que tenga acceso al doc y gestione la posición Y correctamente
      const agregarEncabezado = (docInstance, titulo) => {
        const startY = 40;
        const centerX = 297; // Mitad de A4 (595.28 / 2)
        
        // 1. LOGO (Centrado superior)
        // Reemplaza 'ruta/logo.png' por tu ruta real o base64
        const rutaLogo = 'public/logo.png'; // <--- AJUSTAR RUTA AQUÍ
        const logoWidth = 60; 
        
        // Intentamos pintar el logo centrado
        try {
          // Calculamos X para que el logo quede centrado
          const logoX = centerX - (logoWidth / 2);
          docInstance.image(rutaLogo, logoX, startY, { width: logoWidth });
        } catch (e) {
          // Fallback si no hay logo: un espacio o texto
          console.warn("Logo no encontrado, saltando renderizado de imagen.");
        }

        let currentY = startY + 50; // Bajamos después del logo

        // 2. DATOS DE LA EMPRESA
        const anchoTexto = 400; // Ancho máximo para que el texto envuelva bien
        const textoX = centerX - (anchoTexto / 2); // X para centrar el bloque de texto

        // Nombre de la empresa
        docInstance.font('Helvetica-Bold').fontSize(14).fillColor(COLORES.negro);
        docInstance.text('INDPACK S.A.C.', textoX, currentY, { align: 'center', width: anchoTexto });
        currentY += 18;

        // RUC
        docInstance.font('Helvetica-Bold').fontSize(10);
        docInstance.text('RUC: 20550932297', textoX, currentY, { align: 'center', width: anchoTexto });
        currentY += 12;

        // Actividad
        docInstance.font('Helvetica').fontSize(9);
        docInstance.text('Fab. de Plásticos y de Caucho', textoX, currentY, { align: 'center', width: anchoTexto });
        currentY += 12;

        // Dirección (Aquí está la corrección principal)
        const direccion = 'Av. el Sol Mza. Ll-1 Lote. 4 B Coo. las Vertientes de Tablada Villa el Salvador - Lima, Perú';
        
        // Calculamos la altura real que ocupará la dirección
        const alturaDireccion = docInstance.heightOfString(direccion, { width: anchoTexto, align: 'center' });
        
        docInstance.text(direccion, textoX, currentY, { 
          align: 'center', 
          width: anchoTexto,
          lineGap: 2 
        });
        
        // Sumamos la altura calculada para que lo siguiente no se superponga
        currentY += alturaDireccion + 5;

        // Web
        docInstance.fillColor(COLORES.azulLink).fontSize(9);
        docInstance.text('https://www.indpackperu.com', textoX, currentY, { 
          align: 'center', 
          width: anchoTexto,
          link: 'https://www.indpackperu.com',
          underline: true
        });
        currentY += 15;

        // 3. TÍTULO DEL DOCUMENTO
        docInstance.moveDown(1); // Espacio separador
        currentY = docInstance.y; // Actualizamos Y real
        
        docInstance.font('Helvetica-Bold').fontSize(16).fillColor(COLORES.negro);
        docInstance.text(titulo, 50, currentY, { 
          align: 'center', 
          width: 495,
          characterSpacing: 1
        });

        // Retornamos la posición final + un margen
        return docInstance.y + 15;
      };

      // --- INICIO DE GENERACIÓN DEL CONTENIDO ---

      let y = agregarEncabezado(doc, 'CONSTANCIA DE\nSALIDA');
      
      // Bloque de Información General
      doc.rect(50, y, 495, 120).stroke(COLORES.negro);
      const topRect = y + 10;
      
      doc.fontSize(9).fillColor(COLORES.negro);
      
      // Columna Izquierda
      doc.font('Helvetica').text('Documento N°:', 60, topRect);
      doc.font('Helvetica-Bold').text(datos.id_salida || 'N/A', 160, topRect);
      
      doc.font('Helvetica').text('Tipo Inventario:', 60, topRect + 15);
      doc.font('Helvetica-Bold').text(datos.tipo_inventario || 'N/A', 160, topRect + 15, { width: 140 });
      
      doc.font('Helvetica').text('Tipo Movimiento:', 60, topRect + 30);
      doc.font('Helvetica-Bold').text(datos.tipo_movimiento || 'N/A', 160, topRect + 30, { width: 140 });
      
      const destino = datos.tipo_movimiento === 'Venta' ? datos.cliente : datos.departamento || datos.tipo_movimiento;
      doc.font('Helvetica').text('Cliente/Destino:', 60, topRect + 45);
      doc.font('Helvetica-Bold').text((destino || 'N/A'), 160, topRect + 45, { width: 140, lineGap: 2 });
      
      doc.font('Helvetica').text('Vehículo:', 60, topRect + 75);
      doc.font('Helvetica-Bold').text((datos.vehiculo || 'N/A'), 160, topRect + 75, { width: 140, lineGap: 2 });
      
      // Columna Derecha
      doc.font('Helvetica').text('Fecha:', 320, topRect);
      doc.font('Helvetica-Bold').text(formatearFecha(datos.fecha_movimiento), 400, topRect);
      
      doc.font('Helvetica').text('Estado:', 320, topRect + 15);
      doc.font('Helvetica-Bold').text(datos.estado || 'N/A', 400, topRect + 15);
      
      doc.font('Helvetica').text('Registrado por:', 320, topRect + 30);
      doc.font('Helvetica-Bold').text((datos.registrado_por || 'N/A'), 400, topRect + 30, { width: 135, lineGap: 2 });
      
      doc.font('Helvetica').text('Moneda:', 320, topRect + 45);
      doc.font('Helvetica-Bold').text(datos.moneda === 'PEN' ? 'Soles' : datos.moneda, 400, topRect + 45);
      
      // Actualizar Y después del cuadro
      y += 135;
      
      // Tabla de Detalles
      const detalles = datos.detalles || [];
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text(`Detalle de Salida (${detalles.length} productos)`, 50, y);
      y += 20;
      
      // Cabecera de Tabla
      doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
      doc.text('Código', 60, y + 6);
      doc.text('Producto', 140, y + 6);
      doc.text('Cantidad', 340, y + 6);
      doc.text('Precio Unit.', 410, y + 6);
      doc.text('Subtotal', 490, y + 6, { align: 'right' });
      y += 20;
      
      // Filas
      doc.font('Helvetica').fillColor(COLORES.negro);
      
      detalles.forEach((det, idx) => {
        // Salto de página
        if (y > 720) {
          doc.addPage();
          y = agregarEncabezado(doc, 'CONSTANCIA DE\nSALIDA (cont.)');
          
          // Repetir cabecera de tabla en nueva página
          doc.rect(50, y, 495, 20).fill(COLORES.grisOscuro);
          doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORES.blanco);
          doc.text('Código', 60, y + 6);
          doc.text('Producto', 140, y + 6);
          doc.text('Cantidad', 340, y + 6);
          doc.text('Precio Unit.', 410, y + 6);
          doc.text('Subtotal', 490, y + 6, { align: 'right' });
          y += 20;
          doc.font('Helvetica').fillColor(COLORES.negro);
        }

        // Fila cebra
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
      
      // Totales
      y += 15;
      // Verificar espacio para totales y firmas
      if (y > 650) {
         doc.addPage();
         y = 50; // Margen superior simple si es solo totales
      }

      const totalPrecio = detalles.reduce((sum, d) => sum + ((d.precio_unitario || d.costo_unitario || 0) * (d.cantidad || 0)), 0);
      doc.rect(370, y, 175, 30).stroke(COLORES.negro);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORES.negro);
      doc.text('TOTAL:', 380, y + 10);
      doc.fontSize(12);
      doc.text(formatearMoneda(totalPrecio, datos.moneda), 465, y + 9, { align: 'right', width: 70 });
      y += 45;
      
      // Observaciones
      if (datos.observaciones) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORES.negro);
        doc.text('Observaciones:', 50, y);
        y += 15;
        doc.fontSize(8).font('Helvetica');
        // Usamos heightOfString para observaciones largas también
        const obsHeight = doc.heightOfString(datos.observaciones, { width: 495 });
        doc.text(datos.observaciones, 50, y, { width: 495, align: 'justify' });
        y += obsHeight + 20;
      } else {
        y += 20;
      }
      
      // Firmas (Pie de página relativo)
      const firmaY = Math.max(y + 30, 690); // Asegura que las firmas vayan al fondo si hay espacio, o debajo del contenido
      
      // Verificamos si firma cabe en la pagina
      if (firmaY > 750) {
          doc.addPage();
          // firmaY en nueva página
      }

      doc.moveTo(80, firmaY).lineTo(230, firmaY).stroke(COLORES.negro);
      doc.fontSize(8).fillColor(COLORES.grisOscuro);
      doc.text('Autorizado por', 80, firmaY + 5, { width: 150, align: 'center' });
      
      doc.moveTo(320, firmaY).lineTo(470, firmaY).stroke(COLORES.negro);
      doc.text('Recibido por', 320, firmaY + 5, { width: 150, align: 'center' });
      
      // Pie de página fijo en todas las páginas (opcional, aquí solo al final)
      doc.text('Comprobante de registro de salida de inventario - INDPACK S.A.C.', 50, 780, { align: 'center', width: 495 });
      
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
      const totalCosto = detalles.reduce((sum, d) => sum + ((d.cantidad || 0) * (d.costo_unitario || 0)), 0);
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
export async function generarPDFCotizacion(cotizacion, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.pipe(stream);
  
  doc.fontSize(20).text('INDPACK', 50, 50, { align: 'left' });
  doc.fontSize(10).text('Industrias del Empaque', 50, 75);
  doc.fontSize(16).text('COTIZACIÓN', 400, 50, { align: 'right' });
  doc.fontSize(12).text(cotizacion.numero_cotizacion, 400, 70, { align: 'right' });
  doc.moveTo(50, 100).lineTo(550, 100).stroke();
  doc.moveDown(2);
  
  doc.fontSize(11).text('CLIENTE:', 50, 120);
  doc.fontSize(10);
  doc.text(cotizacion.cliente, 50, 135);
  doc.text(`RUC: ${cotizacion.ruc_cliente}`, 50, 150);
  doc.text(`Dirección: ${cotizacion.direccion_cliente || '-'}`, 50, 165);
  
  doc.fontSize(11).text('DATOS DE LA COTIZACIÓN:', 320, 120);
  doc.fontSize(10);
  doc.text(`Fecha: ${formatearFecha(cotizacion.fecha_emision)}`, 320, 135);
  doc.text(`Válida hasta: ${formatearFecha(cotizacion.fecha_vencimiento)}`, 320, 150);
  doc.text(`Moneda: ${cotizacion.moneda}`, 320, 165);
  doc.text(`Comercial: ${cotizacion.comercial || '-'}`, 320, 180);
  
  const tableTop = 220;
  const headers = ['Item', 'Código', 'Descripción', 'Cant.', 'P.U.', 'Desc.', 'Total'];
  const colWidths = [30, 70, 180, 50, 60, 40, 70];
  
  doc.fontSize(9).fillColor('#000000');
  let x = 50;
  headers.forEach((header, i) => {
    doc.rect(x, tableTop, colWidths[i], 20).fillAndStroke('#e0e0e0', '#000000');
    doc.fillColor('#000000').text(header, x + 5, tableTop + 5, { 
      width: colWidths[i] - 10,
      align: i >= 3 ? 'right' : 'left'
    });
    x += colWidths[i];
  });
  
  let y = tableTop + 20;
  cotizacion.detalle.forEach((item, index) => {
    x = 50;
    const rowHeight = 25;
    
    if (index % 2 === 0) {
      doc.rect(50, y, 500, rowHeight).fillAndStroke('#f9f9f9', '#cccccc');
    } else {
      doc.rect(50, y, 500, rowHeight).stroke('#cccccc');
    }
    
    doc.fillColor('#000000');
    doc.text((index + 1).toString(), x + 5, y + 7, { width: colWidths[0] - 10, align: 'center' });
    x += colWidths[0];
    doc.text(item.codigo_producto || '-', x + 5, y + 7, { width: colWidths[1] - 10 });
    x += colWidths[1];
    doc.text(item.producto, x + 5, y + 7, { width: colWidths[2] - 10 });
    x += colWidths[2];
    doc.text(parseFloat(item.cantidad).toFixed(2), x + 5, y + 7, { width: colWidths[3] - 10, align: 'right' });
    x += colWidths[3];
    doc.text(parseFloat(item.precio_unitario).toFixed(2), x + 5, y + 7, { width: colWidths[4] - 10, align: 'right' });
    x += colWidths[4];
    const descuento = item.descuento_porcentaje || 0;
    doc.text(`${parseFloat(descuento).toFixed(0)}%`, x + 5, y + 7, { width: colWidths[5] - 10, align: 'right' });
    x += colWidths[5];
    doc.text(parseFloat(item.valor_venta).toFixed(2), x + 5, y + 7, { width: colWidths[6] - 10, align: 'right' });
    y += rowHeight;
  });
  
  y += 10;
  const monedaSimbolo = cotizacion.moneda === 'USD' ? '$' : 'S/';
  
  doc.fontSize(10);
  doc.text('Subtotal:', 400, y);
  doc.text(`${monedaSimbolo} ${parseFloat(cotizacion.subtotal).toFixed(2)}`, 480, y, { align: 'right' });
  y += 20;
  doc.text(`IGV (18%):`, 400, y);
  doc.text(`${monedaSimbolo} ${parseFloat(cotizacion.igv).toFixed(2)}`, 480, y, { align: 'right' });
  y += 20;
  doc.fontSize(12).fillColor('#000000');
  doc.rect(400, y - 5, 150, 25).fillAndStroke('#e0e0e0', '#000000');
  doc.fillColor('#000000').text('TOTAL:', 405, y);
  doc.text(`${monedaSimbolo} ${parseFloat(cotizacion.total).toFixed(2)}`, 480, y, { align: 'right' });
  y += 35;
  doc.fontSize(9);
  const totalEnLetras = numeroALetras(parseFloat(cotizacion.total), cotizacion.moneda);
  doc.text(`SON: ${totalEnLetras}`, 50, y, { width: 500, align: 'left' });
  
  if (cotizacion.observaciones || cotizacion.plazo_pago || cotizacion.forma_pago) {
    y += 30;
    doc.fontSize(11).text('CONDICIONES COMERCIALES:', 50, y);
    doc.fontSize(9);
    y += 20;
    
    if (cotizacion.plazo_pago) {
      doc.text(`• Plazo de pago: ${cotizacion.plazo_pago}`, 50, y);
      y += 15;
    }
    
    if (cotizacion.forma_pago) {
      doc.text(`• Forma de pago: ${cotizacion.forma_pago}`, 50, y);
      y += 15;
    }
    
    if (cotizacion.observaciones) {
      doc.text(`• Observaciones: ${cotizacion.observaciones}`, 50, y, { width: 500 });
    }
  }
  
  const pageHeight = doc.page.height;
  doc.fontSize(8).fillColor('#666666');
  doc.text('Esta cotización tiene una validez limitada según la fecha indicada', 50, pageHeight - 80, {
    width: 500,
    align: 'center'
  });
  doc.text('Gracias por su preferencia', 50, pageHeight - 60, {
    width: 500,
    align: 'center'
  });
  
  doc.end();
}
export async function generarPDFOrdenVenta(orden, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.pipe(stream);
  
  doc.fontSize(20).text('INDPACK', 50, 50, { align: 'left' });
  doc.fontSize(10).text('Industrias del Empaque', 50, 75);
  doc.fontSize(16).text('ORDEN DE VENTA', 400, 50, { align: 'right' });
  doc.fontSize(12).text(orden.numero_orden, 400, 70, { align: 'right' });
  doc.fontSize(10);
  doc.text(`Estado: ${orden.estado}`, 400, 85, { align: 'right' });
  doc.text(`Prioridad: ${orden.prioridad}`, 400, 100, { align: 'right' });
  doc.moveTo(50, 120).lineTo(550, 120).stroke();
  doc.moveDown(2);
  
  doc.fontSize(11).text('CLIENTE:', 50, 140);
  doc.fontSize(10);
  doc.text(orden.cliente, 50, 155);
  doc.text(`RUC: ${orden.ruc_cliente}`, 50, 170);
  doc.text(`Dirección: ${orden.direccion_entrega || orden.direccion_cliente}`, 50, 185);
  
  doc.fontSize(11).text('DATOS DE LA ORDEN:', 320, 140);
  doc.fontSize(10);
  doc.text(`Fecha Emisión: ${formatearFecha(orden.fecha_emision)}`, 320, 155);
  if (orden.fecha_entrega_estimada) {
    doc.text(`Fecha Entrega: ${formatearFecha(orden.fecha_entrega_estimada)}`, 320, 170);
  }
  doc.text(`Moneda: ${orden.moneda}`, 320, 185);
  if (orden.orden_compra_cliente) {
    doc.text(`O/C Cliente: ${orden.orden_compra_cliente}`, 320, 200);
  }
  
  const tableTop = 240;
  const headers = ['Item', 'Código', 'Descripción', 'Cant.', 'P.U.', 'Desc.', 'Total'];
  const colWidths = [30, 70, 180, 50, 60, 40, 70];
  
  doc.fontSize(9).fillColor('#000000');
  let x = 50;
  headers.forEach((header, i) => {
    doc.rect(x, tableTop, colWidths[i], 20).fillAndStroke('#e0e0e0', '#000000');
    doc.fillColor('#000000').text(header, x + 5, tableTop + 5, { 
      width: colWidths[i] - 10,
      align: i >= 3 ? 'right' : 'left'
    });
    x += colWidths[i];
  });
  
  let y = tableTop + 20;
  orden.detalle.forEach((item, index) => {
    x = 50;
    const rowHeight = 25;
    
    if (index % 2 === 0) {
      doc.rect(50, y, 500, rowHeight).fillAndStroke('#f9f9f9', '#cccccc');
    } else {
      doc.rect(50, y, 500, rowHeight).stroke('#cccccc');
    }
    
    doc.fillColor('#000000');
    doc.text((index + 1).toString(), x + 5, y + 7, { width: colWidths[0] - 10, align: 'center' });
    x += colWidths[0];
    doc.text(item.codigo_producto || '-', x + 5, y + 7, { width: colWidths[1] - 10 });
    x += colWidths[1];
    doc.text(item.producto, x + 5, y + 7, { width: colWidths[2] - 10 });
    x += colWidths[2];
    doc.text(parseFloat(item.cantidad).toFixed(2), x + 5, y + 7, { width: colWidths[3] - 10, align: 'right' });
    x += colWidths[3];
    doc.text(parseFloat(item.precio_unitario).toFixed(2), x + 5, y + 7, { width: colWidths[4] - 10, align: 'right' });
    x += colWidths[4];
    const descuento = item.descuento_porcentaje || 0;
    doc.text(`${parseFloat(descuento).toFixed(0)}%`, x + 5, y + 7, { width: colWidths[5] - 10, align: 'right' });
    x += colWidths[5];
    doc.text(parseFloat(item.valor_venta || (item.cantidad * item.precio_unitario * (1 - descuento/100))).toFixed(2), x + 5, y + 7, { width: colWidths[6] - 10, align: 'right' });
    y += rowHeight;
  });
  
  y += 10;
  const monedaSimbolo = orden.moneda === 'USD' ? '$' : 'S/';
  
  doc.fontSize(10);
  doc.text('Subtotal:', 400, y);
  doc.text(`${monedaSimbolo} ${parseFloat(orden.subtotal).toFixed(2)}`, 480, y, { align: 'right' });
  y += 20;
  doc.text(`IGV (18%):`, 400, y);
  doc.text(`${monedaSimbolo} ${parseFloat(orden.igv).toFixed(2)}`, 480, y, { align: 'right' });
  y += 20;
  doc.fontSize(12).fillColor('#000000');
  doc.rect(400, y - 5, 150, 25).fillAndStroke('#e0e0e0', '#000000');
  doc.fillColor('#000000').text('TOTAL:', 405, y);
  doc.text(`${monedaSimbolo} ${parseFloat(orden.total).toFixed(2)}`, 480, y, { align: 'right' });
  y += 35;
  doc.fontSize(9);
  const totalEnLetras = numeroALetras(parseFloat(orden.total), orden.moneda);
  doc.text(`SON: ${totalEnLetras}`, 50, y, { width: 500, align: 'left' });
  
  if (orden.observaciones) {
    y += 30;
    doc.fontSize(11).text('OBSERVACIONES:', 50, y);
    doc.fontSize(9).text(orden.observaciones, 50, y + 15, { width: 500 });
  }
  
  const pageHeight = doc.page.height;
  doc.fontSize(8).fillColor('#666666');
  doc.text('Gracias por su preferencia', 50, pageHeight - 60, {
    width: 500,
    align: 'center'
  });
  
  doc.end();
}
export async function generarPDFGuiaRemision(guia, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.pipe(stream);
  
  doc.fontSize(20).text('INDPACK', 50, 50, { align: 'left' });
  doc.fontSize(10).text('Industrias del Empaque', 50, 75);
  doc.fontSize(16).text('GUÍA DE REMISIÓN', 380, 50, { align: 'right' });
  doc.fontSize(12).text(guia.numero_guia, 380, 70, { align: 'right' });
  doc.moveTo(50, 100).lineTo(550, 100).stroke();
  doc.moveDown(2);
  
  doc.fontSize(10);
  doc.text(`Fecha Emisión: ${formatearFecha(guia.fecha_emision)}`, 50, 120);
  doc.text(`Tipo Traslado: ${guia.tipo_traslado}`, 50, 135);
  doc.text(`Motivo: ${guia.motivo_traslado}`, 50, 150);
  doc.text(`Modalidad: ${guia.modalidad_transporte || 'Privado'}`, 320, 120);
  doc.text(`Peso Bruto: ${parseFloat(guia.peso_bruto_kg).toFixed(2)} kg`, 320, 135);
  doc.text(`N° Bultos: ${guia.numero_bultos}`, 320, 150);
  
  doc.fontSize(11).text('DESTINATARIO', 50, 180, { underline: true });
  doc.fontSize(10);
  doc.text(`Cliente: ${guia.cliente}`, 50, 195);
  doc.text(`RUC: ${guia.ruc_cliente}`, 50, 210);
  
  doc.fontSize(11).text('PUNTO DE PARTIDA', 50, 240, { underline: true });
  doc.fontSize(9);
  doc.text(guia.direccion_partida || 'No especificado', 50, 255, { width: 230 });
  
  doc.fontSize(11).text('PUNTO DE LLEGADA', 320, 240, { underline: true });
  doc.fontSize(9);
  doc.text(guia.direccion_llegada, 320, 255, { width: 230 });
  doc.text(`Ciudad: ${guia.ciudad_llegada}`, 320, 270);
  
  const tableTop = 300;
  const headers = ['Item', 'Código', 'Descripción', 'Cantidad', 'Unidad', 'Peso'];
  const colWidths = [30, 70, 200, 70, 60, 70];
  
  doc.fontSize(9).fillColor('#000000');
  let x = 50;
  headers.forEach((header, i) => {
    doc.rect(x, tableTop, colWidths[i], 20).fillAndStroke('#e0e0e0', '#000000');
    doc.fillColor('#000000').text(header, x + 5, tableTop + 5, { 
      width: colWidths[i] - 10,
      align: i >= 3 ? 'right' : 'left'
    });
    x += colWidths[i];
  });
  
  let y = tableTop + 20;
  guia.detalle.forEach((item, index) => {
    x = 50;
    const rowHeight = 25;
    
    if (index % 2 === 0) {
      doc.rect(50, y, 500, rowHeight).fillAndStroke('#f9f9f9', '#cccccc');
    } else {
      doc.rect(50, y, 500, rowHeight).stroke('#cccccc');
    }
    
    doc.fillColor('#000000');
    doc.text((index + 1).toString(), x + 5, y + 7, { width: colWidths[0] - 10, align: 'center' });
    x += colWidths[0];
    doc.text(item.codigo_producto || '-', x + 5, y + 7, { width: colWidths[1] - 10 });
    x += colWidths[1];
    doc.text(item.producto, x + 5, y + 7, { width: colWidths[2] - 10 });
    x += colWidths[2];
    doc.text(parseFloat(item.cantidad).toFixed(2), x + 5, y + 7, { width: colWidths[3] - 10, align: 'right' });
    x += colWidths[3];
    doc.text(item.unidad_medida || 'unidad', x + 5, y + 7, { width: colWidths[4] - 10, align: 'center' });
    x += colWidths[4];
    doc.text(`${parseFloat(item.peso_total_kg || 0).toFixed(2)} kg`, x + 5, y + 7, { width: colWidths[5] - 10, align: 'right' });
    y += rowHeight;
  });
  
  y += 10;
  doc.fontSize(10);
  doc.rect(400, y - 5, 150, 25).fillAndStroke('#e0e0e0', '#000000');
  doc.fillColor('#000000').text('PESO TOTAL:', 405, y);
  doc.text(`${parseFloat(guia.peso_bruto_kg).toFixed(2)} kg`, 480, y, { align: 'right' });
  
  if (guia.observaciones) {
    y += 40;
    doc.fontSize(11).text('OBSERVACIONES:', 50, y, { underline: true });
    doc.fontSize(9).text(guia.observaciones, 50, y + 15, { width: 500 });
  }
  
  const pageHeight = doc.page.height;
  doc.fontSize(8).fillColor('#666666');
  doc.text('Esta guía de remisión ampara el traslado de mercadería', 50, pageHeight - 60, {
    width: 500,
    align: 'center'
  });
  
  doc.end();
}
export async function generarPDFGuiaTransportista(guia, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.pipe(stream);
  
  doc.fontSize(20).text('INDPACK', 50, 50, { align: 'left' });
  doc.fontSize(10).text('Industrias del Empaque', 50, 75);
  doc.fontSize(16).text('GUÍA DE TRANSPORTISTA', 360, 50, { align: 'right' });
  doc.fontSize(12).text(guia.numero_guia, 360, 70, { align: 'right' });
  doc.moveTo(50, 100).lineTo(550, 100).stroke();
  doc.moveDown(2);
  
  doc.fontSize(10);
  doc.text(`Fecha Emisión: ${formatearFecha(guia.fecha_emision)}`, 50, 120);
  doc.text(`Guía de Remisión: ${guia.numero_guia_remision}`, 50, 135);
  if (guia.fecha_inicio_traslado) {
    doc.text(`Inicio Traslado: ${formatearFecha(guia.fecha_inicio_traslado)}`, 50, 150);
  }
  
  doc.fontSize(11).text('TRANSPORTISTA', 50, 180, { underline: true });
  doc.fontSize(10);
  doc.text(`Razón Social: ${guia.razon_social_transportista}`, 50, 195);
  doc.text(`RUC: ${guia.ruc_transportista}`, 50, 210);
  
  doc.fontSize(11).text('CONDUCTOR', 50, 240, { underline: true });
  doc.fontSize(10);
  doc.text(`Nombre: ${guia.nombre_conductor}`, 50, 255);
  doc.text(`Licencia: ${guia.licencia_conducir}`, 50, 270);
  if (guia.dni_conductor) {
    doc.text(`DNI: ${guia.dni_conductor}`, 50, 285);
  }
  if (guia.telefono_conductor) {
    doc.text(`Teléfono: ${guia.telefono_conductor}`, 50, 300);
  }
  
  doc.fontSize(11).text('VEHÍCULO', 320, 240, { underline: true });
  doc.fontSize(10);
  doc.text(`Placa: ${guia.placa_vehiculo}`, 320, 255);
  if (guia.marca_vehiculo) {
    doc.text(`Marca: ${guia.marca_vehiculo}`, 320, 270);
  }
  if (guia.modelo_vehiculo) {
    doc.text(`Modelo: ${guia.modelo_vehiculo}`, 320, 285);
  }
  if (guia.certificado_habilitacion) {
    doc.text(`Cert. Habilitación: ${guia.certificado_habilitacion}`, 320, 300);
  }
  
  const rutaY = 340;
  doc.fontSize(11).text('RUTA DE TRASLADO', 50, rutaY, { underline: true });
  doc.fontSize(10).text('PUNTO DE PARTIDA:', 50, rutaY + 20);
  doc.fontSize(9).text(guia.direccion_partida || 'No especificado', 70, rutaY + 35, { width: 460 });
  doc.fontSize(10).text('PUNTO DE LLEGADA:', 50, rutaY + 60);
  doc.fontSize(9).text(guia.direccion_llegada, 70, rutaY + 75, { width: 460 });
  doc.text(`Ciudad: ${guia.ciudad_llegada}`, 70, rutaY + 90);
  
  const cargaY = rutaY + 120;
  doc.fontSize(11).text('INFORMACIÓN DE CARGA', 50, cargaY, { underline: true });
  doc.fontSize(10);
  doc.text(`Peso Bruto: ${parseFloat(guia.peso_bruto_kg).toFixed(2)} kg`, 50, cargaY + 20);
  doc.text(`Número de Bultos: ${guia.numero_bultos}`, 50, cargaY + 35);
  
  if (guia.observaciones) {
    const obsY = cargaY + 65;
    doc.fontSize(11).text('OBSERVACIONES:', 50, obsY, { underline: true });
    doc.fontSize(9).text(guia.observaciones, 50, obsY + 15, { width: 500 });
  }
  
  const pageHeight = doc.page.height;
  const firmasY = pageHeight - 120;
  
  doc.fontSize(9);
  doc.moveTo(50, firmasY).lineTo(200, firmasY).stroke();
  doc.text('Firma del Conductor', 50, firmasY + 5, { width: 150, align: 'center' });
  doc.moveTo(350, firmasY).lineTo(500, firmasY).stroke();
  doc.text('Firma del Receptor', 350, firmasY + 5, { width: 150, align: 'center' });
  
  doc.fontSize(8).fillColor('#666666');
  doc.text('Esta guía de transportista certifica el traslado de mercadería', 50, pageHeight - 60, {
    width: 500,
    align: 'center'
  });
  
  doc.end();
}

export async function generarPDFOrdenCompra(orden, stream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
  });
  
  doc.pipe(stream);
  
  doc.fontSize(20).text('INDPACK S.A.C.', 50, 50, { align: 'left' });
  doc.fontSize(9).text('Industrias del Empaque', 50, 75);
  doc.text('AV. EL SOL LT. 4 B MZ. LL-1', 50, 88);
  doc.text('COO. LAS VERTIENTES - LIMA', 50, 100);
  
  doc.rect(380, 45, 170, 70).stroke();
  doc.fontSize(10).text('RUC: 20123456789', 390, 55);
  doc.fontSize(14).text('ORDEN DE COMPRA', 390, 75, { align: 'center', width: 150 });
  doc.fontSize(12).text(orden.numero_orden, 390, 95, { align: 'center', width: 150 });
  
  doc.moveTo(50, 130).lineTo(550, 130).stroke();
  
  let y = 150;
  doc.fontSize(10).fillColor('#000000');
  doc.text('Proveedor:', 50, y, { continued: true }).font('Helvetica-Bold').text(` ${orden.proveedor}`);
  y += 15;
  doc.font('Helvetica').text('RUC:', 50, y, { continued: true }).font('Helvetica-Bold').text(` ${orden.ruc_proveedor}`);
  y += 15;
  if (orden.direccion_proveedor) {
    doc.font('Helvetica').text('Dirección:', 50, y, { continued: true });
    doc.font('Helvetica-Bold').text(` ${orden.direccion_proveedor}`, { width: 230 });
    y += 15;
  }
  
  y = 150;
  doc.font('Helvetica').text('Condición de pago:', 320, y, { continued: true });
  doc.font('Helvetica-Bold').text(` ${orden.condicion_pago || 'Por definir'}`);
  y += 15;
  doc.font('Helvetica').text('Fecha de Pedido:', 320, y, { continued: true });
  doc.font('Helvetica-Bold').text(` ${formatearFecha(orden.fecha_pedido)}`);
  
  y += 30;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 10;
  
  doc.rect(50, y, 500, 15).fillAndStroke('#e8e8e8', '#000000');
  doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
  doc.text('DATOS LOGÍSTICOS', 250, y + 3, { align: 'center', width: 100 });
  y += 20;
  
  doc.font('Helvetica').fontSize(8);
  doc.text('Fecha confirmación:', 50, y);
  doc.font('Helvetica-Bold').text(formatearFecha(orden.fecha_confirmacion) || '-', 150, y);
  doc.font('Helvetica').text('Entrega esperada:', 280, y);
  doc.font('Helvetica-Bold').text(formatearFecha(orden.entrega_esperada) || '-', 380, y);
  y += 15;
  
  doc.font('Helvetica').text('Lugar de entrega:', 50, y);
  doc.font('Helvetica-Bold').text(orden.lugar_entrega || '-', 150, y, { width: 120 });
  doc.font('Helvetica').text('Forma de pago:', 280, y);
  doc.font('Helvetica-Bold').text(orden.forma_pago || '-', 380, y);
  y += 20;
  
  doc.font('Helvetica').text('Elaborado por:', 50, y);
  doc.font('Helvetica-Bold').text(orden.elaborado_por || '-', 150, y, { width: 120 });
  
  y += 25;
  doc.moveTo(50, y).lineTo(550, y).stroke();
  y += 15;
  
  const tableTop = y;
  const headers = ['Item', 'Código', 'Descripción', 'Cantidad', 'Unidad', 'V. Unit.', 'V. COMPRA'];
  const colWidths = [30, 70, 180, 70, 50, 60, 70];
  
  doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold');
  let x = 50;
  headers.forEach((header, i) => {
    doc.rect(x, tableTop, colWidths[i], 18).fillAndStroke('#d0d0d0', '#000000');
    doc.fillColor('#000000').text(header, x + 5, tableTop + 5, { 
      width: colWidths[i] - 10,
      align: i >= 3 ? 'right' : 'left'
    });
    x += colWidths[i];
  });
  
  y = tableTop + 18;
  doc.font('Helvetica').fontSize(8);
  
  orden.detalle.forEach((item, index) => {
    x = 50;
    const rowHeight = 20;
    
    if (index % 2 === 0) {
      doc.rect(50, y, 530, rowHeight).fillAndStroke('#f5f5f5', '#cccccc');
    } else {
      doc.rect(50, y, 530, rowHeight).stroke('#cccccc');
    }
    
    doc.fillColor('#000000');
    doc.text((index + 1).toString(), x + 5, y + 5, { width: colWidths[0] - 10, align: 'center' });
    x += colWidths[0];
    doc.text(item.codigo_producto || '-', x + 5, y + 5, { width: colWidths[1] - 10 });
    x += colWidths[1];
    const descripcion = `[${item.codigo_producto}] ${item.producto}`;
    doc.text(descripcion, x + 5, y + 5, { width: colWidths[2] - 10, ellipsis: true });
    x += colWidths[2];
    doc.text(parseFloat(item.cantidad).toFixed(5), x + 5, y + 5, { width: colWidths[3] - 10, align: 'right' });
    x += colWidths[3];
    doc.text(item.unidad_medida || 'unidad', x + 5, y + 5, { width: colWidths[4] - 10, align: 'center' });
    x += colWidths[4];
    doc.text(parseFloat(item.valor_unitario).toFixed(3), x + 5, y + 5, { width: colWidths[5] - 10, align: 'right' });
    x += colWidths[5];
    doc.text(parseFloat(item.valor_compra).toFixed(2), x + 5, y + 5, { width: colWidths[6] - 10, align: 'right' });
    y += rowHeight;
  });
  
  y += 15;
  
  const totalEnLetras = numeroALetras(parseFloat(orden.total), orden.moneda);
  doc.fontSize(8).font('Helvetica');
  doc.text('SON:', 50, y);
  doc.font('Helvetica-Bold').text(totalEnLetras, 50, y + 12, { width: 300 });
  
  if (orden.observaciones) {
    y += 40;
    doc.font('Helvetica').fontSize(8);
    doc.text('Observaciones:', 50, y);
    doc.font('Helvetica-Bold').text(orden.observaciones, 50, y + 12, { width: 300 });
  }
  
  const monedaSimbolo = orden.moneda === 'USD' ? '$' : 'S/';
  const totalesX = 400;
  let totalesY = y;
  
  doc.font('Helvetica').fontSize(9);
  doc.text('Subtotal:', totalesX, totalesY);
  doc.text(`${monedaSimbolo} ${parseFloat(orden.subtotal).toFixed(2)}`, totalesX + 80, totalesY, { align: 'right', width: 70 });
  totalesY += 15;
  doc.text('IGV (18%):', totalesX, totalesY);
  doc.text(`${monedaSimbolo} ${parseFloat(orden.igv).toFixed(2)}`, totalesX + 80, totalesY, { align: 'right', width: 70 });
  totalesY += 15;
  doc.rect(totalesX, totalesY - 3, 150, 20).fillAndStroke('#e0e0e0', '#000000');
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(11);
  doc.text('TOTAL:', totalesX + 5, totalesY);
  doc.text(`${monedaSimbolo} ${parseFloat(orden.total).toFixed(2)}`, totalesX + 80, totalesY, { align: 'right', width: 65 });
  
  const pageHeight = doc.page.height;
  doc.fontSize(7).fillColor('#666666').font('Helvetica');
  doc.text('Este documento es una orden de compra válida', 50, pageHeight - 60, {
    width: 500,
    align: 'center'
  });
  doc.text('INDPACK S.A.C. - Sistema ERP', 50, pageHeight - 45, {
    width: 500,
    align: 'center'
  });
  
  doc.end();
}