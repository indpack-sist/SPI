import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function descargarImagen(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

export async function generarOrdenCompraPDF(orden) {
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

      let logoBuffer;
      try {
        logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');
      } catch (error) {
        console.error(error);
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold');
          doc.text('IndPack', 60, 55);
          doc.fontSize(10).font('Helvetica');
          doc.text('EMBALAJE INDUSTRIAL', 60, 80);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold');
        doc.text('IndPack', 60, 55);
        doc.fontSize(10).font('Helvetica');
        doc.text('EMBALAJE INDUSTRIAL', 60, 80);
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
      doc.text('ORDEN DE COMPRA', 385, 65, { align: 'center', width: 155 });
      
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${orden.numero_orden}`, 385, 83, { align: 'center', width: 155 });

      const direccionProveedor = orden.direccion_proveedor || 
                                 orden.direccion_entrega || 
                                 '';
      
      const alturaDireccion = calcularAlturaTexto(doc, direccionProveedor, 230, 8);
      const alturaRecuadroProveedor = Math.max(90, alturaDireccion + 75);
      
      doc.roundedRect(33, 195, 529, alturaRecuadroProveedor, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Proveedor:', 40, 203);
      doc.font('Helvetica');
      doc.text(orden.proveedor || '', 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, 218);
      doc.font('Helvetica');
      doc.text(orden.ruc_proveedor || '', 100, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Dirección:', 40, 233);
      doc.font('Helvetica');
      doc.text(direccionProveedor, 100, 233, { width: 230, lineGap: 2 });
      
      const yPosicionLugar = 233 + alturaDireccion + 5;
      
      doc.font('Helvetica-Bold');
      doc.text('Lugar Entrega:', 40, yPosicionLugar);
      doc.font('Helvetica');
      const lugarEntrega = orden.lugar_entrega || 'Almacén Principal';
      doc.text(lugarEntrega, 100, yPosicionLugar, { width: 230 });

      const yPosicionContacto = yPosicionLugar + 15;
      doc.font('Helvetica-Bold');
      doc.text('Contacto:', 40, yPosicionContacto);
      doc.font('Helvetica');
      const contactoInfo = [orden.contacto_proveedor, orden.telefono_proveedor].filter(Boolean).join(' / ');
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
      doc.text('Días Crédito:', 360, 248);
      doc.font('Helvetica');
      doc.text(orden.dias_credito ? `${orden.dias_credito} días` : '-', 450, 248);

      const yPosRecuadroFechas = 195 + alturaRecuadroProveedor + 8;
      
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
      
      orden.detalle.forEach((item, idx) => {
        const cantidad = parseFloat(item.cantidad).toFixed(2);
        const precioUnitario = parseFloat(item.precio_unitario).toFixed(2);
        
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        const totalLinea = (item.cantidad * item.precio_unitario) * (1 - descuento/100);
        const valorCompra = parseFloat(totalLinea).toFixed(2);
        
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
        doc.text(`${simboloMoneda} ${valorCompra}`, 505, yPos + 5, { align: 'right', width: 50 });

        yPos += alturaFila;
      });

      yPos += 10;
      
      const yBaseFooter = yPos;
      let yPosLeft = yBaseFooter;
      let yPosRight = yBaseFooter;

      const subtotal = parseFloat(orden.subtotal).toFixed(2);
      const igv = parseFloat(orden.igv).toFixed(2);
      const total = parseFloat(orden.total).toFixed(2);
      
      const tipoImpuesto = orden.tipo_impuesto || 'IGV';
      const porcImpuesto = parseFloat(orden.porcentaje_impuesto || 18);
      const etiquetaImpuesto = `${tipoImpuesto} (${porcImpuesto}%)`;

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

      if (orden.tipo_cambio && parseFloat(orden.tipo_cambio) > 1) {
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text(`T.C. Ref: ${parseFloat(orden.tipo_cambio).toFixed(3)}`, 475, yPosRight, { align: 'right', width: 80 });
        yPosRight += 15;
      }

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

      if (orden.responsable) {
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Responsable:', 40, yPosLeft);
        doc.font('Helvetica');
        doc.text(orden.responsable, 95, yPosLeft);
        yPosLeft += 15;
      }

      yPos = Math.max(yPosRight, yPosLeft) + 10;

      doc.fillColor('#000000');
      doc.fontSize(8).font('Helvetica');
      const totalEnLetras = numeroALetras(parseFloat(total), orden.moneda);
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