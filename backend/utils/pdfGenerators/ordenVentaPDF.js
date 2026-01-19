import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ETIQUETAS_IMPUESTO = {
  'IGV': 'IGV (18%)',
  'EXO': 'EXONERADO (0%)',
  'INA': 'INAFECTO (0%)'
};

const fmtNum = (num) => {
  return Number(num).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 4
  });
};

function descargarImagen(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
        timeout: 3000
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(new Error(`Status Code: ${response.statusCode}`));
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });

    request.on('error', (err) => reject(err));

    request.on('timeout', () => {
        request.destroy();
        reject(new Error("Timeout al descargar imagen"));
    });
  });
}

export async function generarOrdenVentaPDF(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        bufferPages: true
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const nombreCliente = orden.cliente || orden.razon_social || orden.nombre || 'CLIENTE SIN NOMBRE';
      const rucCliente = orden.ruc_cliente || orden.ruc || orden.numero_documento || 'SIN RUC';
      const direccionCliente = orden.direccion_entrega || orden.direccion_cliente || orden.direccion || '';

      let logoBuffer = null;
      try {
        logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');
      } catch (error) {
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          dibujarLogoFallback(doc);
        }
      } else {
        dibujarLogoFallback(doc);
      }

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, 110);
      
      doc.fontSize(8).font('Helvetica');
      const direccionEmpresa = 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA, Villa el Salvador, Lima - Lima (PE) - Perú';
      doc.text(direccionEmpresa, 50, 123, { width: 250 });
      doc.text('Teléfono: 01- 312 7858', 50, 148);
      doc.text('E-mail: informes@indpackperu.com', 50, 160);
      doc.text('Web: https://www.indpackperu.com/', 50, 172);

      doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('R.U.C. 20550932297', 385, 48, { align: 'center', width: 155 });
      
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ORDEN DE VENTA', 385, 65, { align: 'center', width: 155 });
      
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${orden.numero_orden}`, 385, 83, { align: 'center', width: 155 });

      const alturaDireccion = calcularAlturaTexto(doc, direccionCliente, 230, 8);
      const alturaRecuadroCliente = Math.max(90, alturaDireccion + 75);
      
      doc.roundedRect(33, 195, 529, alturaRecuadroCliente, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Cliente:', 40, 203);
      doc.font('Helvetica');
      doc.text(nombreCliente, 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, 218);
      doc.font('Helvetica');
      doc.text(rucCliente, 100, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Dirección:', 40, 233);
      doc.font('Helvetica');
      doc.text(direccionCliente, 100, 233, { width: 230, lineGap: 2 });
      
      const yPosicionCiudad = 233 + alturaDireccion + 5;
      
      doc.font('Helvetica-Bold');
      doc.text('Ciudad/Lugar:', 40, yPosicionCiudad);
      doc.font('Helvetica');
      const ubicacion = [orden.ciudad_entrega, orden.lugar_entrega].filter(Boolean).join(' - ');
      doc.text(ubicacion || 'Lima - Perú', 100, yPosicionCiudad, { width: 230 });

      const yPosicionContacto = yPosicionCiudad + 15;
      doc.font('Helvetica-Bold');
      doc.text('Contacto:', 40, yPosicionContacto);
      doc.font('Helvetica');
      const contactoInfo = [orden.contacto_entrega, orden.telefono_entrega].filter(Boolean).join(' / ');
      doc.text(contactoInfo || '-', 100, yPosicionContacto, { width: 230 });

      doc.font('Helvetica-Bold');
      doc.text('Moneda:', 360, 203);
      doc.font('Helvetica');
      doc.text(orden.moneda === 'USD' ? 'USD' : 'PEN', 450, 203);
      
      doc.font('Helvetica-Bold');
      doc.text('Plazo de pago:', 360, 218);
      doc.font('Helvetica');
      doc.text(orden.plazo_pago || '', 450, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Forma de pago:', 360, 233);
      doc.font('Helvetica');
      doc.text(orden.forma_pago || '', 450, 233);
      
      doc.font('Helvetica-Bold');
      doc.text('O/C Cliente:', 360, 248);
      doc.font('Helvetica');
      doc.text(orden.orden_compra_cliente || '-', 450, 248);

      const yPosRecuadroFechas = 195 + alturaRecuadroCliente + 8;
      
      doc.roundedRect(33, yPosRecuadroFechas, 529, 40, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha de Emisión:', 40, yPosRecuadroFechas + 10, { align: 'center', width: 260 });
      doc.font('Helvetica');
      const fechaEmision = new Date(orden.fecha_emision).toLocaleDateString('es-PE');
      doc.text(fechaEmision, 40, yPosRecuadroFechas + 25, { align: 'center', width: 260 });

      doc.font('Helvetica-Bold');
      doc.text('Fecha Entrega Estimada:', 310, yPosRecuadroFechas + 10, { align: 'center', width: 252 });
      doc.font('Helvetica');
      const fechaEntrega = orden.fecha_entrega_estimada ? new Date(orden.fecha_entrega_estimada).toLocaleDateString('es-PE') : 'Por coordinar';
      doc.text(fechaEntrega, 310, yPosRecuadroFechas + 25, { align: 'center', width: 252 });

      let yPos = yPosRecuadroFechas + 52;

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('CANT.', 130, yPos + 6, { width: 50, align: 'center' });
      doc.text('UNID.', 185, yPos + 6, { width: 40, align: 'center' });
      doc.text('DESCRIPCIÓN', 230, yPos + 6);
      doc.text('P. UNIT.', 450, yPos + 6, { align: 'right', width: 50 });
      doc.text('TOTAL', 505, yPos + 6, { align: 'right', width: 50 });

      yPos += 20;

      const simboloMoneda = orden.moneda === 'USD' ? '$' : 'S/';
      
      if (orden.detalle && orden.detalle.length > 0) {
        orden.detalle.forEach((item, idx) => {
          const cantidad = fmtNum(item.cantidad);
          const precioUnitario = fmtNum(item.precio_unitario);
          
          const descuento = parseFloat(item.descuento_porcentaje || 0);
          const totalLinea = (item.cantidad * item.precio_unitario) * (1 - descuento/100);
          const valorVenta = fmtNum(totalLinea);
          
          const descripcion = item.producto;
          const alturaDescripcion = calcularAlturaTexto(doc, descripcion, 215, 8);
          const alturaFila = Math.max(20, alturaDescripcion + 10);

          if (yPos + alturaFila > 700) {
            doc.addPage();
            yPos = 50;
            
            doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
            doc.text('CÓDIGO', 40, yPos + 6);
            doc.text('CANT.', 130, yPos + 6, { width: 50, align: 'center' });
            doc.text('UNID.', 185, yPos + 6, { width: 40, align: 'center' });
            doc.text('DESCRIPCIÓN', 230, yPos + 6);
            doc.text('P. UNIT.', 450, yPos + 6, { align: 'right', width: 50 });
            doc.text('TOTAL', 505, yPos + 6, { align: 'right', width: 50 });
            yPos += 20;
          }

          doc.fontSize(8).font('Helvetica').fillColor('#000000');
          
          doc.text(item.codigo_producto, 40, yPos + 5);
          doc.text(cantidad, 130, yPos + 5, { width: 50, align: 'center' });
          doc.text(item.unidad_medida || 'UND', 185, yPos + 5, { width: 40, align: 'center' });
          doc.text(descripcion, 230, yPos + 5, { width: 215, lineGap: 2 });
          doc.text(precioUnitario, 450, yPos + 5, { align: 'right', width: 50 });
          doc.text(`${simboloMoneda} ${valorVenta}`, 505, yPos + 5, { align: 'right', width: 50 });

          yPos += alturaFila;
        });
      }

      yPos += 10;
      
      const yBaseFooter = yPos;
      let yPosLeft = yBaseFooter;
      let yPosRight = yBaseFooter;

      const subtotal = fmtNum(orden.subtotal || 0);
      const igv = fmtNum(orden.igv || 0);
      const total = fmtNum(orden.total || 0);
      const totalNumero = parseFloat(orden.total || 0);
      
      const tipoImpuesto = orden.tipo_impuesto || 'IGV';
      const etiquetaImpuesto = ETIQUETAS_IMPUESTO[tipoImpuesto] || tipoImpuesto;

      doc.roundedRect(385, yPosRight, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('SUB TOTAL', 390, yPosRight + 4);
      
      doc.roundedRect(470, yPosRight, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      doc.text(`${simboloMoneda} ${subtotal}`, 475, yPosRight + 4, { align: 'right', width: 80 });

      yPosRight += 20;

      doc.roundedRect(385, yPosRight, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text(etiquetaImpuesto, 390, yPosRight + 4, { width: 80, align: 'left' });
      
      doc.roundedRect(470, yPosRight, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      doc.text(`${simboloMoneda} ${igv}`, 475, yPosRight + 4, { align: 'right', width: 80 });

      yPosRight += 20;

      doc.roundedRect(385, yPosRight, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL', 390, yPosRight + 4);
      
      doc.roundedRect(470, yPosRight, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${simboloMoneda} ${total}`, 475, yPosRight + 4, { align: 'right', width: 80 });

      yPosRight += 25;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('OBSERVACIONES', 40, yPosLeft);
      
      doc.fontSize(8).font('Helvetica');
      let alturaObservaciones = 0;
      
      if (orden.observaciones) {
        alturaObservaciones = calcularAlturaTexto(doc, orden.observaciones, 330, 8);
        doc.text(orden.observaciones, 40, yPosLeft + 15, { width: 330 });
      } else {
        alturaObservaciones = 10;
      }
      
      yPosLeft += (15 + alturaObservaciones + 10);

      if (orden.comercial) {
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Vendedor:', 40, yPosLeft);
        doc.font('Helvetica');
        doc.text(orden.comercial, 90, yPosLeft);
        yPosLeft += 15;
      }

      yPos = Math.max(yPosRight, yPosLeft) + 10;

      doc.fillColor('#000000');
      doc.fontSize(8).font('Helvetica');
      const totalEnLetras = numeroALetras(totalNumero, orden.moneda);
      doc.text(`SON: ${totalEnLetras}`, 40, yPos, { width: 522, align: 'left' });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Page: 1 / 1', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
}

function dibujarLogoFallback(doc) {
    doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
    doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold');
    doc.text('IndPack', 60, 55);
    doc.fontSize(10).font('Helvetica');
    doc.text('EMBALAJE INDUSTRIAL', 60, 80);
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

function numeroALetras(numero, moneda) {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const especiales = {
    11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
    16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE'
  };
  
  const entero = Math.floor(numero);
  const decimales = Math.round((numero - entero) * 100);
  
  function convertirNumero(num) {
    if (num === 0) return 'CERO';
    if (num < 10) return unidades[num];
    if (num >= 11 && num <= 19) return especiales[num];
    if (num < 100) {
      const d = Math.floor(num / 10);
      const u = num % 10;
      if (num === 20) return 'VEINTE';
      if (num > 20 && num < 30) return 'VEINTI' + unidades[u];
      return decenas[d] + (u > 0 ? ' Y ' + unidades[u] : '');
    }
    if (num < 1000) {
      const c = Math.floor(num / 100);
      const resto = num % 100;
      if (num === 100) return 'CIEN';
      return centenas[c] + (resto > 0 ? ' ' + convertirNumero(resto) : '');
    }
    if (num < 1000000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      const textoMiles = miles === 1 ? 'MIL' : convertirNumero(miles) + ' MIL';
      return textoMiles + (resto > 0 ? ' ' + convertirNumero(resto) : '');
    }
    const millones = Math.floor(num / 1000000);
    const resto = num % 1000000;
    const textoMillones = millones === 1 ? 'UN MILLON' : convertirNumero(millones) + ' MILLONES';
    return textoMillones + (resto > 0 ? ' ' + convertirNumero(resto) : '');
  }
  
  const resultado = convertirNumero(entero);
  const nombreMoneda = moneda === 'USD' ? 'DÓLARES' : 'SOLES';
  
  return `${resultado} CON ${String(decimales).padStart(2, '0')}/100 ${nombreMoneda}`;
}