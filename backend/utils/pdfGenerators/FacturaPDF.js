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

      // --- INICIO DEL REEMPLAZO (Recuadro Cliente/Emisor Dividido en 2 Columnas) ---
      const esExportacion = Number(orden.es_exportacion) === 1;

      // 1. Datos Dinámicos (Exportación vs Nacional)
      const clienteTexto = orden.cliente || '';
      const rucTexto = esExportacion ? 'SIN DOCUMENTO (-)' : (orden.ruc_cliente || '');
      
      const tituloDireccion = esExportacion ? 'Establecimiento del Emisor:' : 'Dirección:';
      const tituloMoneda = 'Tipo de Moneda:';

      const direccionCliente = esExportacion
        ? [orden.direccion_empresa, orden.urbanizacion_empresa, 'LIMA-LIMA-VILLA EL SALVADOR'].filter(Boolean).join(' - ')
        : (orden.direccion_entrega || orden.direccion_cliente || '').replace(/[\r\n]+/g, " ");

      const ubicacionTexto = esExportacion ? '' : ([orden.ciudad_entrega, orden.lugar_entrega].filter(Boolean).join(' - ') || 'Lima - Perú');
      const contactoTexto = [orden.contacto_entrega, orden.telefono_entrega].filter(Boolean).join(' / ') || '-';

      // 2. Coordenadas: División estricta en 2 columnas (50% - 50%)
      // COLUMNA 1 (Izquierda) - Ancho total disponible 255
      const col1LabelX = 40;
      const col1ValX = 140; 
      const col1ValWidth = 155; 

      // COLUMNA 2 (Derecha) - Ancho total disponible 250
      const col2LabelX = 310;
      const col2ValX = 390; 
      const col2ValWidth = 160; 

      // 3. Cálculos de altura dinámica (Respetando el ancho estricto de su columna)
      const alturaCliente = calcularAlturaTexto(doc, clienteTexto, col1ValWidth, 8);
      const alturaRUC = calcularAlturaTexto(doc, rucTexto, col1ValWidth, 8);
      const alturaDireccion = calcularAlturaTexto(doc, direccionCliente, col1ValWidth, 8);
      const alturaLabelDir = calcularAlturaTexto(doc, tituloDireccion, col1ValX - col1LabelX - 5, 8); // En caso el label se rompa en 2 líneas
      const alturaUbicacion = ubicacionTexto ? calcularAlturaTexto(doc, ubicacionTexto, col1ValWidth, 8) : 0;
      const alturaContacto = calcularAlturaTexto(doc, contactoTexto, col1ValWidth, 8);

      // Sumatoria de alturas columna izquierda (se adapta al texto más largo)
      let leftH = 5;
      leftH += Math.max(15, alturaCliente + 5);
      leftH += Math.max(15, alturaRUC + 5);
      leftH += Math.max(15, Math.max(alturaDireccion, alturaLabelDir) + 5); 
      if (ubicacionTexto) leftH += Math.max(15, alturaUbicacion + 5);
      leftH += Math.max(15, alturaContacto + 5);

      // Sumatoria de alturas columna derecha
      let rightH = 5 + 15 + 15 + 15 + 15; // 4 campos x 15

      // 4. Dibujo del recuadro
      const alturaRecuadroCliente = Math.max(90, Math.max(leftH, rightH) + 15);
      doc.roundedRect(33, 195, 529, alturaRecuadroCliente, 3).stroke('#000000');
      
      // 5. Renderizado Columna Izquierda
      let cursorY = 203;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Cliente:', col1LabelX, cursorY, { width: col1ValX - col1LabelX - 5 });
      doc.font('Helvetica');
      doc.text(clienteTexto, col1ValX, cursorY, { width: col1ValWidth, lineGap: 2 });
      cursorY += Math.max(15, alturaCliente + 5);
      
      doc.font('Helvetica-Bold');
      doc.text(esExportacion ? 'Tipo de Documento:' : 'RUC:', col1LabelX, cursorY, { width: col1ValX - col1LabelX - 5 });
      doc.font('Helvetica');
      doc.text(rucTexto, col1ValX, cursorY, { width: col1ValWidth });
      cursorY += Math.max(15, alturaRUC + 5);
      
      doc.font('Helvetica-Bold');
      doc.text(tituloDireccion, col1LabelX, cursorY, { width: col1ValX - col1LabelX - 5 }); 
      doc.font('Helvetica');
      doc.text(direccionCliente, col1ValX, cursorY, { width: col1ValWidth, lineGap: 2 });
      cursorY += Math.max(15, Math.max(alturaDireccion, alturaLabelDir) + 5);
      
      if (ubicacionTexto) {
          doc.font('Helvetica-Bold');
          doc.text('Ciudad/Lugar:', col1LabelX, cursorY, { width: col1ValX - col1LabelX - 5 });
          doc.font('Helvetica');
          doc.text(ubicacionTexto, col1ValX, cursorY, { width: col1ValWidth, lineGap: 2 });
          cursorY += Math.max(15, alturaUbicacion + 5);
      }

      doc.font('Helvetica-Bold');
      doc.text('Contacto:', col1LabelX, cursorY, { width: col1ValX - col1LabelX - 5 });
      doc.font('Helvetica');
      doc.text(contactoTexto, col1ValX, cursorY, { width: col1ValWidth, lineGap: 2 });

      // 6. Renderizado Columna Derecha (Comienza desde el mismo eje Y superior)
      let rightY = 203;
      doc.font('Helvetica-Bold');
      doc.text(tituloMoneda, col2LabelX, rightY, { width: col2ValX - col2LabelX - 5 });
      doc.font('Helvetica');
      doc.text(orden.moneda === 'USD' ? 'DÓLARES' : 'SOLES', col2ValX, rightY, { width: col2ValWidth });
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Plazo de pago:', col2LabelX, rightY, { width: col2ValX - col2LabelX - 5 });
      doc.font('Helvetica');
      doc.text(orden.plazo_pago || '-', col2ValX, rightY, { width: col2ValWidth });
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Forma de pago:', col2LabelX, rightY, { width: col2ValX - col2LabelX - 5 });
      doc.font('Helvetica');
      doc.text(orden.forma_pago || '-', col2ValX, rightY, { width: col2ValWidth });
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('O/C Cliente:', col2LabelX, rightY, { width: col2ValX - col2LabelX - 5 });
      doc.font('Helvetica');
      doc.text(orden.orden_compra_cliente || '-', col2ValX, rightY, { width: col2ValWidth });
      // --- FIN DEL REEMPLAZO ---

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

      // -- LADO DERECHO: CUADROS DE TOTALES --
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

      // -- LADO IZQUIERDO: OBSERVACIONES Y VENDEDOR --
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

      // El total en letras se dibuja debajo de todo
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