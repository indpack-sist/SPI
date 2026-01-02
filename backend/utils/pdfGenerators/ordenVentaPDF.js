import PDFDocument from 'pdfkit';
import axios from 'axios';

function numeroALetras(numero) {
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (numero === 0) return 'CERO';
  if (numero === 100) return 'CIEN';

  let letras = '';
  const entero = Math.floor(numero);
  const decimales = Math.round((numero - entero) * 100);

  function convertirCentenas(num) {
    let resultado = '';
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;

    if (c > 0) {
      resultado += centenas[c] + ' ';
    }

    if (d === 1 && u > 0) {
      resultado += especiales[u - 1];
    } else {
      if (d > 0) resultado += decenas[d] + ' ';
      if (u > 0) resultado += (d > 0 ? 'Y ' : '') + unidades[u];
    }

    return resultado.trim();
  }

  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    if (miles === 1) {
      letras += 'MIL ';
    } else {
      letras += convertirCentenas(miles) + ' MIL ';
    }
    const resto = entero % 1000;
    if (resto > 0) {
      letras += convertirCentenas(resto);
    }
  } else {
    letras = convertirCentenas(entero);
  }

  if (decimales > 0) {
    letras += ' CON ' + decimales.toString().padStart(2, '0') + '/100';
  }

  return letras.trim();
}

function calcularAlturaTexto(doc, texto, ancho, fontSize = 9) {
  const currentFontSize = doc._fontSize || 12;
  doc.fontSize(fontSize);
  const heightOfString = doc.heightOfString(texto || '', {
    width: ancho,
    lineGap: 2
  });
  doc.fontSize(currentFontSize);
  return Math.ceil(heightOfString);
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  const date = new Date(fecha);
  const dia = date.getDate().toString().padStart(2, '0');
  const mes = (date.getMonth() + 1).toString().padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

async function descargarLogo(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error al descargar logo:', error.message);
    return null;
  }
}

export async function generarOrdenVentaPDF(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      let yPos = 50;

      try {
        const logoBuffer = await descargarLogo('https://indpackperu.com/images/logohorizontal.png');
        if (logoBuffer) {
          doc.image(logoBuffer, 50, yPos, { width: 180 });
        }
      } catch (error) {
        console.error('Error al cargar logo:', error);
      }

      const boxX = 400;
      const boxY = yPos;
      const boxW = 145;
      const boxH = 80;

      doc.rect(boxX, boxY, boxW, boxH).stroke();
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('R.U.C. 20550932297', boxX, boxY + 10, { width: boxW, align: 'center' });
      doc.fontSize(14);
      doc.text('ORDEN DE VENTA', boxX, boxY + 30, { width: boxW, align: 'center' });
      doc.fontSize(12).font('Helvetica');
      doc.text(orden.numero_orden, boxX, boxY + 55, { width: boxW, align: 'center' });

      yPos += 65;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, yPos);
      
      yPos += 12;
      doc.fontSize(8).font('Helvetica');
      doc.text('Av. El Sol Mz. D Lt. 01 Sector 1 Grupo 20, Villa El Salvador', 50, yPos);
      
      yPos += 10;
      doc.text('Teléfono: +51 981 433 796', 50, yPos);
      
      yPos += 10;
      doc.text('Email: ventas@indpackperu.com', 50, yPos);
      
      yPos += 10;
      doc.text('www.indpackperu.com', 50, yPos);

      yPos += 30;
      doc.moveTo(50, yPos).lineTo(545, yPos).stroke();
      yPos += 15;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('FECHA EMISIÓN:', 50, yPos);
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.fecha_emision), 130, yPos);

      yPos += 15;
      let leftY = yPos;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('RUC:', 50, leftY);
      doc.font('Helvetica');
      const rucTexto = orden.ruc_cliente || 'N/A';
      doc.text(rucTexto, 90, leftY);
      leftY += 15;

      doc.font('Helvetica-Bold');
      doc.text('CLIENTE:', 50, leftY);
      leftY += 12;
      doc.font('Helvetica');
      const clienteTexto = orden.cliente || 'N/A';
      const clienteAltura = calcularAlturaTexto(doc, clienteTexto, 230, 9);
      doc.text(clienteTexto, 50, leftY, { width: 230, lineGap: 2 });
      leftY += Math.max(clienteAltura, 12) + 5;

      doc.font('Helvetica-Bold');
      doc.text('DIRECCIÓN ENTREGA:', 50, leftY);
      leftY += 12;
      doc.font('Helvetica');
      const direccionTexto = orden.direccion_entrega || 'N/A';
      const direccionAltura = calcularAlturaTexto(doc, direccionTexto, 230, 9);
      doc.text(direccionTexto, 50, leftY, { width: 230, lineGap: 2 });
      leftY += Math.max(direccionAltura, 12) + 5;

      let rightY = yPos;
      const rightX = 300;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('MONEDA:', rightX, rightY);
      doc.font('Helvetica');
      doc.text(orden.moneda || 'PEN', rightX + 80, rightY);
      rightY += 15;

      doc.font('Helvetica-Bold');
      doc.text('PLAZO PAGO:', rightX, rightY);
      doc.font('Helvetica');
      const plazoPagoTexto = orden.plazo_pago || 'Contado';
      const plazoPagoAltura = calcularAlturaTexto(doc, plazoPagoTexto, 165, 9);
      doc.text(plazoPagoTexto, rightX + 80, rightY, { width: 165, lineGap: 2 });
      rightY += Math.max(plazoPagoAltura, 12) + 3;

      doc.font('Helvetica-Bold');
      doc.text('FORMA PAGO:', rightX, rightY);
      doc.font('Helvetica');
      const formaPagoTexto = orden.forma_pago || 'N/A';
      const formaPagoAltura = calcularAlturaTexto(doc, formaPagoTexto, 165, 9);
      doc.text(formaPagoTexto, rightX + 80, rightY, { width: 165, lineGap: 2 });
      rightY += Math.max(formaPagoAltura, 12) + 3;

      if (orden.fecha_entrega_estimada) {
        doc.font('Helvetica-Bold');
        doc.text('ENTREGA:', rightX, rightY);
        doc.font('Helvetica');
        doc.text(formatearFecha(orden.fecha_entrega_estimada), rightX + 80, rightY);
        rightY += 15;
      }

      yPos = Math.max(leftY, rightY) + 10;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('VENDEDOR:', 50, yPos);
      yPos += 12;
      doc.font('Helvetica');
      doc.text(orden.comercial || 'N/A', 50, yPos);

      yPos += 25;
      
      const tableTop = yPos;
      const headers = [
        { text: 'CÓDIGO', x: 50, w: 60 },
        { text: 'CANT.', x: 115, w: 40 },
        { text: 'UNID', x: 160, w: 35 },
        { text: 'DESCRIPCIÓN', x: 200, w: 200 },
        { text: 'P. UNIT.', x: 405, w: 65 },
        { text: 'TOTAL', x: 475, w: 70 }
      ];

      doc.rect(50, tableTop, 495, 20).fill('#2563eb');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      
      headers.forEach(h => {
        if (h.text === 'CANT.' || h.text === 'UNID') {
          doc.text(h.text, h.x, tableTop + 6, { width: h.w, align: 'center' });
        } else if (h.text === 'P. UNIT.' || h.text === 'TOTAL') {
          doc.text(h.text, h.x, tableTop + 6, { width: h.w, align: 'right' });
        } else {
          doc.text(h.text, h.x, tableTop + 6, { width: h.w, align: 'left' });
        }
      });

      yPos = tableTop + 20;
      doc.fillColor('#000000');

      orden.detalle.forEach((item, idx) => {
        const descripcion = item.producto || '';
        const descripcionAltura = calcularAlturaTexto(doc, descripcion, 200, 8);
        const rowH = Math.max(25, descripcionAltura + 14);

        if (yPos + rowH > 700) {
          doc.addPage();
          yPos = 50;
          
          doc.rect(50, 50, 495, 20).fill('#2563eb');
          doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
          headers.forEach(h => {
            if (h.text === 'CANT.' || h.text === 'UNID') {
              doc.text(h.text, h.x, 56, { width: h.w, align: 'center' });
            } else if (h.text === 'P. UNIT.' || h.text === 'TOTAL') {
              doc.text(h.text, h.x, 56, { width: h.w, align: 'right' });
            } else {
              doc.text(h.text, h.x, 56, { width: h.w, align: 'left' });
            }
          });
          yPos = 70;
          doc.fillColor('#000000');
        }

        if (idx % 2 === 0) {
          doc.rect(50, yPos, 495, rowH).fill('#f9fafb');
          doc.fillColor('#000000');
        }

        const rowY = yPos + 7;
        doc.fontSize(8).font('Helvetica');

        doc.text(item.codigo_producto || '', 50, rowY, { width: 60, lineBreak: false });
        doc.text(parseFloat(item.cantidad || 0).toFixed(2), 115, rowY, { width: 40, align: 'center', lineBreak: false });
        doc.text(item.unidad_medida || 'UND', 160, rowY, { width: 35, align: 'center', lineBreak: false });
        doc.text(descripcion, 200, rowY, { width: 200, lineGap: 2 });
        
        const sim = orden.moneda === 'USD' ? '$' : 'S/';
        doc.text(`${sim} ${parseFloat(item.precio_unitario || 0).toFixed(2)}`, 405, rowY, { width: 65, align: 'right', lineBreak: false });
        doc.text(`${sim} ${parseFloat(item.subtotal || 0).toFixed(2)}`, 475, rowY, { width: 70, align: 'right', lineBreak: false });

        yPos += rowH;
      });

      doc.moveTo(50, yPos).lineTo(545, yPos).stroke();

      yPos += 20;
      
      const totBoxX = 350;
      const totBoxY = yPos;
      const totBoxW = 195;
      
      doc.rect(totBoxX, totBoxY, totBoxW, 80).stroke();

      const sim = orden.moneda === 'USD' ? '$' : 'S/';
      let totY = totBoxY + 10;

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('SUB TOTAL:', totBoxX + 10, totY);
      doc.font('Helvetica');
      doc.text(`${sim} ${parseFloat(orden.subtotal).toFixed(2)}`, totBoxX + 100, totY, { width: 85, align: 'right' });
      totY += 15;

      const impNombre = orden.tipo_impuesto || 'IGV';
      const impPorc = parseFloat(orden.porcentaje_impuesto || 18).toFixed(0);
      doc.font('Helvetica-Bold');
      doc.text(`${impNombre} (${impPorc}%):`, totBoxX + 10, totY);
      doc.font('Helvetica');
      doc.text(`${sim} ${parseFloat(orden.igv).toFixed(2)}`, totBoxX + 100, totY, { width: 85, align: 'right' });
      totY += 15;

      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('TOTAL:', totBoxX + 10, totY);
      doc.text(`${sim} ${parseFloat(orden.total).toFixed(2)}`, totBoxX + 100, totY, { width: 85, align: 'right' });
      totY += 20;

      const tc = parseFloat(orden.tipo_cambio || 1);
      if (tc > 1) {
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text(`TC: ${tc.toFixed(4)}`, totBoxX + 10, totY);
        
        if (orden.moneda === 'PEN') {
          const eq = parseFloat(orden.total) / tc;
          doc.text(`Equiv.: $ ${eq.toFixed(2)}`, totBoxX + 100, totY, { width: 85, align: 'right' });
        } else {
          const eq = parseFloat(orden.total) * tc;
          doc.text(`Equiv.: S/ ${eq.toFixed(2)}`, totBoxX + 100, totY, { width: 85, align: 'right' });
        }
        
        doc.fillColor('#000000');
      }

      yPos += 90;

      const letras = numeroALetras(parseFloat(orden.total));
      const monLet = orden.moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('SON:', 50, yPos);
      doc.font('Helvetica');
      doc.text(`${letras} ${monLet}`, 80, yPos, { width: 465 });

      yPos += 25;
      
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('CONDICIONES COMERCIALES:', 50, yPos);
      yPos += 15;

      doc.fontSize(8).font('Helvetica');

      const condiciones = [];
      
      if (orden.plazo_pago) {
        condiciones.push(`• Forma de Pago: ${orden.plazo_pago}`);
      }
      
      if (orden.fecha_entrega_estimada) {
        condiciones.push(`• Fecha de Entrega: ${formatearFecha(orden.fecha_entrega_estimada)}`);
      }
      
      if (orden.lugar_entrega) {
        condiciones.push(`• Lugar de Entrega: ${orden.lugar_entrega}`);
      } else if (orden.direccion_entrega) {
        condiciones.push(`• Lugar de Entrega: ${orden.direccion_entrega}`);
      }
      
      if (orden.orden_compra_cliente) {
        condiciones.push(`• Orden de Compra Cliente: ${orden.orden_compra_cliente}`);
      }
      
      condiciones.push('• Los productos serán entregados según especificaciones acordadas');
      condiciones.push('• Esta orden de venta está sujeta a nuestros términos y condiciones generales');

      condiciones.forEach(cond => {
        const condAltura = calcularAlturaTexto(doc, cond, 490, 8);
        doc.text(cond, 55, yPos, { width: 490, lineGap: 2 });
        yPos += condAltura + 5;
      });

      if (orden.observaciones) {
        yPos += 10;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('OBSERVACIONES:', 50, yPos);
        yPos += 12;
        doc.fontSize(8).font('Helvetica');
        const obsTexto = orden.observaciones || '';
        const obsAlt = calcularAlturaTexto(doc, obsTexto, 495, 8);
        doc.text(obsTexto, 50, yPos, { width: 495, lineGap: 2 });
        yPos += obsAlt;
      }

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Esta orden de venta constituye un compromiso de compra-venta entre las partes.', 50, 770, { 
        width: 495, 
        align: 'center' 
      });
      doc.text('Documento generado por el sistema IndPack ERP', 50, 780, { 
        width: 495, 
        align: 'center' 
      });

      doc.end();

    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}