import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function descargarImagen(url) {
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

function medirAnchoTexto(doc, texto, font, fontSize) {
  const prevFont = doc._font ? doc._font.name : 'Helvetica';
  const prevSize = doc._fontSize || 12;
  doc.font(font).fontSize(fontSize);
  const ancho = doc.widthOfString(texto || '');
  doc.font(prevFont).fontSize(prevSize);
  return ancho;
}

function campoInline(doc, colX, y, colWidth, label, value, fontSize = 8, dibujar = true) {
  const anchoLabel = medirAnchoTexto(doc, label, 'Helvetica-Bold', fontSize);
  const gap = 4;
  const valX = colX + anchoLabel + gap;
  const valWidth = Math.max(30, colX + colWidth - valX);
  const alturaValor = calcularAlturaTexto(doc, value, valWidth, fontSize);
  const alturaFila = Math.max(15, alturaValor + 5);

  if (dibujar) {
    doc.fontSize(fontSize).font('Helvetica-Bold').fillColor('#000000');
    doc.text(label, colX, y);
    doc.font('Helvetica');
    doc.text(value || '-', valX, y, { width: valWidth, lineGap: 2 });
  }

  return alturaFila;
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

export async function generarFacturaPDF(orden) {
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
      doc.text('FACTURA ELECTRÓNICA', 385, 65, { align: 'center', width: 155 });

      doc.fontSize(11).font('Helvetica-Bold');
      const numeroCorrelativo = orden.serie_correlativo || orden.numero_comprobante || orden.numero_orden;
      doc.text(`No. ${numeroCorrelativo}`, 385, 83, { align: 'center', width: 155 });

      const esExportacion = Number(orden.es_exportacion) === 1;

      const clienteTexto = orden.cliente || '';
      const rucTexto = esExportacion ? 'SIN DOCUMENTO (-)' : (orden.ruc_cliente || '');

      const tituloDireccion = esExportacion ? 'Establecimiento del Emisor:' : 'Dirección:';

      const direccionCliente = esExportacion
        ? [orden.direccion_empresa, orden.urbanizacion_empresa, 'LIMA-LIMA-VILLA EL SALVADOR'].filter(Boolean).join(' - ')
        : (orden.direccion_entrega || orden.direccion_cliente || '').replace(/[\r\n]+/g, " ");

      const ubicacionTexto = esExportacion ? '' : ([orden.ciudad_entrega, orden.lugar_entrega].filter(Boolean).join(' - ') || 'Lima - Perú');
      const contactoTexto = [orden.contacto_entrega, orden.telefono_entrega].filter(Boolean).join(' / ') || '-';

      const padding = 7;
      const gapColumnas = 20;
      const anchoUtil = 529 - padding * 2;
      const colWidth = (anchoUtil - gapColumnas) / 2;
      const colXIzq = 33 + padding;
      const colXDer = colXIzq + colWidth + gapColumnas;

      const camposIzquierda = [
        ['Cliente:', clienteTexto],
        [esExportacion ? 'Tipo de Documento:' : 'RUC:', rucTexto],
        [tituloDireccion, direccionCliente],
      ];
      if (ubicacionTexto) camposIzquierda.push(['Ciudad/Lugar:', ubicacionTexto]);
      camposIzquierda.push(['Contacto:', contactoTexto]);

      const camposDerecha = [
        ['Tipo de Moneda:', orden.moneda === 'USD' ? 'USD' : 'PEN'],
        ['Plazo de pago:', orden.plazo_pago || '-'],
        ['Forma de pago:', orden.forma_pago || '-'],
        ['O/C Cliente:', orden.orden_compra_cliente || '-'],
      ];

      const alturaColumna = (campos, colX) =>
        campos.reduce((acc, [label, value]) => acc + campoInline(doc, colX, 0, colWidth, label, value, 8, false), 0);

      const leftH = alturaColumna(camposIzquierda, colXIzq);
      const rightH = alturaColumna(camposDerecha, colXDer);

      const alturaRecuadroCliente = Math.max(90, Math.max(leftH, rightH) + 15);
      doc.roundedRect(33, 195, 529, alturaRecuadroCliente, 3).stroke('#000000');

      let cursorYIzq = 203;
      for (const [label, value] of camposIzquierda) {
        const altura = campoInline(doc, colXIzq, cursorYIzq, colWidth, label, value, 8, true);
        cursorYIzq += altura;
      }

      let cursorYDer = 203;
      for (const [label, value] of camposDerecha) {
        const altura = campoInline(doc, colXDer, cursorYDer, colWidth, label, value, 8, true);
        cursorYDer += altura;
      }

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

      orden.detalle.forEach((item, idx) => {
        const cantidad = parseFloat(item.cantidad).toFixed(2);
        const precioUnitario = parseFloat(item.precio_unitario).toFixed(2);
        const totalLinea = (item.cantidad * item.precio_unitario);
        const valorVenta = parseFloat(totalLinea).toFixed(2);
        const descripcion = `[${item.codigo_producto}] ${item.producto}`;
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

      yPos += 10;
      const footerStartY = yPos;

      const subtotal = parseFloat(orden.subtotal).toFixed(2);
      const igv = parseFloat(orden.igv).toFixed(2);
      const total = parseFloat(orden.total).toFixed(2);
      const tipoImpuesto = orden.tipo_impuesto || 'IGV';
      const porcImpuesto = parseFloat(orden.porcentaje_impuesto || 18);
      const etiquetaImpuesto = `${tipoImpuesto} (${porcImpuesto}%)`;

      let footerRightY = footerStartY;
      doc.roundedRect(385, footerRightY, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('SUB TOTAL', 390, footerRightY + 4);
      doc.roundedRect(470, footerRightY, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      doc.text(`${simboloMoneda} ${subtotal}`, 475, footerRightY + 4, { align: 'right', width: 80 });
      footerRightY += 20;

      doc.roundedRect(385, footerRightY, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text(etiquetaImpuesto, 390, footerRightY + 4, { width: 80, align: 'left' });
      doc.roundedRect(470, footerRightY, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      doc.text(`${simboloMoneda} ${igv}`, 475, footerRightY + 4, { align: 'right', width: 80 });
      footerRightY += 20;

      doc.roundedRect(385, footerRightY, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL', 390, footerRightY + 4);
      doc.roundedRect(470, footerRightY, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${simboloMoneda} ${total}`, 475, footerRightY + 4, { align: 'right', width: 80 });
      footerRightY += 25;

      if (orden.tipo_cambio && parseFloat(orden.tipo_cambio) > 1) {
        doc.fontSize(8).font('Helvetica').fillColor('#666666');
        doc.text(`T.C. Ref: ${parseFloat(orden.tipo_cambio).toFixed(3)}`, 475, footerRightY, { align: 'right', width: 80 });
        footerRightY += 15;
        doc.fillColor('#000000');
      }

      let footerLeftY = footerStartY;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('OBSERVACIONES', 40, footerLeftY);
      footerLeftY += 15;

      doc.fontSize(8).font('Helvetica');
      if (orden.observaciones) {
        doc.text(orden.observaciones, 40, footerLeftY, { width: 330 });
        footerLeftY += calcularAlturaTexto(doc, orden.observaciones, 330, 8);
      }
      footerLeftY += 10;

      if (orden.comercial) {
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text('Vendedor:', 40, footerLeftY);
        doc.font('Helvetica');
        doc.text(orden.comercial, 90, footerLeftY);
        footerLeftY += 15;
      }

      yPos = Math.max(footerLeftY, footerRightY) + 5;

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