import PDFDocument from 'pdfkit';
import axios from 'axios';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.',
  web: 'https://www.indpackperu.com',
  direccion: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA',
  distrito: 'Villa el Salvador',
  departamento: 'Lima',
  pais: 'Perú',
  telefono: '01- 312 7858',
  email: 'informes@indpackperu.com'
};

const TIMEZONE = 'America/Lima';

async function cargarLogoURL() {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logoPath = path.join(__dirname, '../../assets/logohorizontal.jpg');
    return fs.readFileSync(logoPath);
  } catch (error) {
    return null;
  }
}

function formatearFecha(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatearHora(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleTimeString('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function calcularAlturaTexto(doc, texto, ancho, fontSize = 8) {
  const currentFontSize = doc._fontSize || 12;
  doc.fontSize(fontSize);
  const heightOfString = doc.heightOfString(texto || '', {
    width: ancho,
    lineGap: 2
  });
  doc.fontSize(currentFontSize);
  return Math.ceil(heightOfString);
}

export async function generarPDFGuiaInterna(orden, numeroGuiaInterna) {
  const logoBuffer = await cargarLogoURL();

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
      }

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, 110);
      
      doc.fontSize(8).font('Helvetica');
      doc.text(EMPRESA.direccion, 50, 123, { width: 250 });
      doc.text(`${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 148);
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 160);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 172);
      doc.text(`Web: ${EMPRESA.web}`, 50, 184);

      doc.roundedRect(380, 40, 165, 75, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('GUÍA INTERNA', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(14).fillColor('#cc0000'); 
      doc.text(`No. ${numeroGuiaInterna}`, 385, 90, { align: 'center', width: 155 });

      const clienteTexto = orden.cliente || 'VARIOS';
      const rucTexto = orden.ruc_cliente || '-';
      const direccionEntrega = (orden.direccion_entrega || '').replace(/[\r\n]+/g, " ");

      const isTransportePrivado = orden.tipo_entrega === 'Transporte Privado';
      const conductorFinal = isTransportePrivado ? orden.transporte_conductor : orden.conductor_nombre;
      const dniFinal = isTransportePrivado ? orden.transporte_dni : orden.conductor_dni;
      const placaFinal = isTransportePrivado ? orden.transporte_placa : orden.vehiculo_placa;
      const modeloFinal = isTransportePrivado ? '' : orden.vehiculo_modelo;
      const licenciaFinal = orden.transporte_licencia;

      const alturaCliente = calcularAlturaTexto(doc, clienteTexto, 180, 8);
      const alturaDireccion = calcularAlturaTexto(doc, direccionEntrega, 180, 8);
      const alturaConductor = calcularAlturaTexto(doc, conductorFinal || '', 180, 8);

      let leftH = 15; // Fecha
      leftH += 15; // Hora
      leftH += 15; // Tipo
      leftH += Math.max(15, alturaCliente + 5);
      if (direccionEntrega) leftH += Math.max(15, alturaDireccion + 5);
      if (rucTexto) leftH += 15;

      let rightH = 15; // Estado
      rightH += 15; // Orden Venta
      rightH += 15; // OC Cliente
      rightH += 15; // Cotizacion
      if (conductorFinal) rightH += Math.max(15, alturaConductor + 5);
      if (dniFinal) rightH += 12;
      if (licenciaFinal) rightH += 12;
      if (placaFinal) rightH += 12;

      const alturaInfoSalida = Math.max(115, Math.max(leftH, rightH) + 15);
      
      doc.roundedRect(33, 205, 529, alturaInfoSalida, 3).stroke('#000000');
      
      let cursorY = 213;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.fecha_emision), 100, cursorY);
      cursorY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Hora:', 40, cursorY);
      doc.font('Helvetica');
      const horaStr = formatearHora(new Date()); 
      doc.text(horaStr, 100, cursorY);
      cursorY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo:', 40, cursorY);
      doc.font('Helvetica');
      doc.text('Venta', 120, cursorY, { width: 210 });
      cursorY += 17;
      
      doc.font('Helvetica-Bold');
      doc.text('Cliente/Destino:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(clienteTexto, 120, cursorY, { width: 180, lineGap: 2 });
      cursorY += Math.max(15, alturaCliente + 5);

      if (direccionEntrega) {
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#444444');
          doc.text(`Dirección: ${direccionEntrega}`, 120, cursorY, { width: 180, lineGap: 2 });
          doc.fontSize(8).fillColor('#000000');
          cursorY += Math.max(15, alturaDireccion + 5);
      }

      if (rucTexto) {
          doc.font('Helvetica-Bold');
          doc.text(`RUC: ${rucTexto}`, 120, cursorY);
      }

      const xLabelRight = 310;
      const xValueRight = 375;
      const wValueRight = 175;

      let rightY = 213;
      doc.font('Helvetica-Bold');
      doc.text('Estado:', xLabelRight, rightY);
      doc.font('Helvetica');
      doc.text(orden.estado || 'N/A', xValueRight, rightY);
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Orden de Venta:', xLabelRight, rightY);
      doc.font('Helvetica');
      doc.text(orden.numero_orden || '---', xValueRight, rightY);
      rightY += 15;

      doc.font('Helvetica-Bold');
      doc.text('OC Cliente:', xLabelRight, rightY);
      doc.font('Helvetica');
      doc.text(orden.orden_compra_cliente || 'SIN OC', xValueRight, rightY);
      rightY += 15;

      doc.font('Helvetica-Bold');
      doc.text('Cotización:', xLabelRight, rightY);
      doc.font('Helvetica');
      doc.text(orden.numero_cotizacion || '---', xValueRight, rightY);
      rightY += 15;

      if (conductorFinal) {
        doc.font('Helvetica-Bold');
        doc.text('Conductor:', xLabelRight, rightY);
        doc.font('Helvetica');
        doc.text(conductorFinal, xValueRight, rightY, { width: wValueRight, lineGap: 2 });
        rightY += Math.max(15, alturaConductor + 5);
      }

      if (dniFinal) {
        doc.font('Helvetica-Bold');
        doc.text('DNI:', xLabelRight, rightY);
        doc.font('Helvetica');
        doc.text(dniFinal, xValueRight, rightY);
        rightY += 12;
      }

      if (licenciaFinal) {
        doc.font('Helvetica-Bold');
        doc.text('Licencia:', xLabelRight, rightY);
        doc.font('Helvetica');
        doc.text(licenciaFinal, xValueRight, rightY);
        rightY += 12;
      }

      if (placaFinal) {
        doc.font('Helvetica-Bold');
        doc.text('Vehículo:', xLabelRight, rightY);
        doc.font('Helvetica');
        const vehiculoTxt = `${placaFinal} ${modeloFinal ? `(${modeloFinal})` : ''}`;
        doc.text(vehiculoTxt, xValueRight, rightY, { width: wValueRight });
      }

      let yPos = 205 + alturaInfoSalida + 15;
      const detalles = orden.detalle || [];
      
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');

      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('DESCRIPCIÓN', 140, yPos + 6);
      doc.text('CANTIDAD', 420, yPos + 6, { width: 60, align: 'center' });
      doc.text('UNIDAD', 485, yPos + 6, { width: 50, align: 'center' });

      yPos += 20;

      detalles.forEach((item, idx) => {
        const descripcion = item.producto || item.nombre;
        const alturaDescripcion = calcularAlturaTexto(doc, descripcion, 270, 8);
        const alturaFila = Math.max(20, alturaDescripcion + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('CONTINUACIÓN...', 40, yPos);
          yPos += 20;
        }

        if (idx % 2 === 0) doc.rect(33, yPos, 529, alturaFila).fillOpacity(0.1).fill('#f0f0f0').fillOpacity(1);

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        doc.text(item.codigo_producto, 40, yPos + 5);
        doc.text(descripcion, 140, yPos + 5, { width: 270, lineGap: 2 });
        doc.text(parseFloat(item.cantidad).toFixed(2), 420, yPos + 5, { width: 60, align: 'center' });
        doc.text(item.unidad_medida, 485, yPos + 5, { width: 50, align: 'center' });

        yPos += alturaFila;
      });

      yPos += 15;

      // -- LADO DERECHO: TOTAL ITEMS --
      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL ITEMS', 390, yPos + 4);
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${detalles.length}`, 475, yPos + 4, { align: 'right', width: 80 });

      // -- LADO IZQUIERDO: OBSERVACIONES --
      if (orden.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        doc.fontSize(8).font('Helvetica');
        doc.text(orden.observaciones, 40, yPos + 15, { width: 330 });
      }

      // -- SECCIÓN DE FIRMA ESTÁTICA AL PIE DE PÁGINA --
      // Posición fija cerca del pie, sin importar el contenido anterior (si no hubo overflow general)
      const firmaY = 660; 
      
      // Asegurarse de no sobrescribir, en un caso muy extremo donde observaciones lleguen hasta abajo.
      // Normalmente esto ya está manejado por los saltos de página anteriores.
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CONFORMIDAD DE RECEPCIÓN', 0, firmaY, { align: 'center' });
      
      // Coordenadas para centrar el bloque de firma
      // Ancho total del bloque estimado: 350
      const startX = 145; // (595 - 350) / 2 para centrar en A4 (width ~595)
      const labelX = startX;
      const lineX = startX + 160; // Punto común donde empiezan las líneas '_'
      
      doc.font('Helvetica');
      doc.text('Recibido por (Nombre y Apellido):', labelX, firmaY + 25);
      doc.text('____________________________________________________', lineX, firmaY + 25);
      
      doc.text('Firma:', labelX, firmaY + 50);
      doc.text('____________________________________________________', lineX, firmaY + 50);

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Documento de Control Interno - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}