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
    const response = await axios.get('https://indpackperu.com/images/logohorizontal.png', {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
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

      const destino = orden.cliente;
      const direccionEntrega = orden.direccion_entrega;
      const rucCliente = orden.ruc_cliente;

      const isTransportePrivado = orden.tipo_entrega === 'Transporte Privado';
      const conductorFinal = isTransportePrivado ? orden.transporte_conductor : orden.conductor_nombre;
      const dniFinal = isTransportePrivado ? orden.transporte_dni : orden.conductor_dni;
      const placaFinal = isTransportePrivado ? orden.transporte_placa : orden.vehiculo_placa;
      const modeloFinal = isTransportePrivado ? '' : orden.vehiculo_modelo;
      const licenciaFinal = orden.transporte_licencia;

      doc.fontSize(8).font('Helvetica');
      const alturaDestino = calcularAlturaTexto(doc, destino || 'N/A', 195, 8);
      
      let alturaTransporteCalculada = 0;
      if (conductorFinal) alturaTransporteCalculada += calcularAlturaTexto(doc, conductorFinal, 180, 8) + 4;
      if (dniFinal) alturaTransporteCalculada += 12;
      if (licenciaFinal) alturaTransporteCalculada += 12;
      if (placaFinal) alturaTransporteCalculada += 12;

      const alturaBaseDerecha = 70; 
      const alturaTotalDerecha = alturaBaseDerecha + alturaTransporteCalculada;

      const alturaTotalIzquierda = 55 + Math.max(
        alturaDestino + (rucCliente ? 12 : 0) + (direccionEntrega ? 25 : 0), 
        0
      );

      const alturaInfoSalida = Math.max(115, Math.max(alturaTotalIzquierda, alturaTotalDerecha)) + 10;
      
      doc.roundedRect(33, 205, 529, alturaInfoSalida, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, 213);
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.fecha_emision), 100, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Hora:', 40, 228);
      doc.font('Helvetica');
      const horaStr = formatearHora(new Date()); 
      doc.text(horaStr, 100, 228);
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo:', 40, 243);
      doc.font('Helvetica');
      doc.text('Venta', 120, 243, { width: 210 });
      
      const yBloque2 = 260; 

      doc.font('Helvetica-Bold');
      doc.text('Cliente/Destino:', 40, yBloque2);
      doc.font('Helvetica');
      doc.text(destino || 'N/A', 120, yBloque2, { width: 180, lineGap: 2 });

      let currentYLeft = yBloque2 + calcularAlturaTexto(doc, destino || 'N/A', 180, 8) + 2;

      if (direccionEntrega) {
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#444444');
          doc.text(`Dirección: ${direccionEntrega}`, 120, currentYLeft, { width: 180 });
          doc.fontSize(8).fillColor('#000000');
          currentYLeft += calcularAlturaTexto(doc, direccionEntrega, 180, 7) + 2;
      }

      if (rucCliente) {
          doc.font('Helvetica-Bold');
          doc.text(`RUC: ${rucCliente}`, 120, currentYLeft + 2);
      }

      const xLabelRight = 310;
      const xValueRight = 370;
      const wValueRight = 180;

      doc.font('Helvetica-Bold');
      doc.text('Estado:', xLabelRight, 213);
      doc.font('Helvetica');
      doc.text(orden.estado || 'N/A', xValueRight, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Orden de Venta:', xLabelRight, 228);
      doc.font('Helvetica');
      doc.text(orden.numero_orden || '---', xValueRight, 228);

      doc.font('Helvetica-Bold');
      doc.text('OC Cliente:', xLabelRight, 243);
      doc.font('Helvetica');
      doc.text(orden.orden_compra_cliente || 'SIN OC', xValueRight, 243);

      doc.font('Helvetica-Bold');
      doc.text('Cotización:', xLabelRight, 258);
      doc.font('Helvetica');
      doc.text(orden.numero_cotizacion || '---', xValueRight, 258);

      let yDerecha = 273;

      if (conductorFinal) {
        doc.font('Helvetica-Bold');
        doc.text('Conductor:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        const conductorTxt = conductorFinal.substring(0, 40); 
        const heightC = doc.heightOfString(conductorTxt, { width: wValueRight });
        doc.text(conductorTxt, xValueRight, yDerecha, { width: wValueRight });
        yDerecha += heightC + 2;
      }

      if (dniFinal) {
        doc.font('Helvetica-Bold');
        doc.text('DNI:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        doc.text(dniFinal, xValueRight, yDerecha);
        yDerecha += 12;
      }

      if (licenciaFinal) {
        doc.font('Helvetica-Bold');
        doc.text('Licencia:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        doc.text(licenciaFinal, xValueRight, yDerecha);
        yDerecha += 12;
      }

      if (placaFinal) {
        doc.font('Helvetica-Bold');
        doc.text('Vehículo:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        const vehiculoTxt = `${placaFinal} ${modeloFinal ? `(${modeloFinal})` : ''}`;
        doc.text(vehiculoTxt, xValueRight, yDerecha, { width: wValueRight });
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

      if (yPos + 50 > 700) { doc.addPage(); yPos = 50; }

      if (orden.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        doc.fontSize(8).font('Helvetica');
        doc.text(orden.observaciones, 40, yPos + 15, { width: 330 });
      }

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL ITEMS', 390, yPos + 4);
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${detalles.length}`, 475, yPos + 4, { align: 'right', width: 80 });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Documento de Control Interno - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}