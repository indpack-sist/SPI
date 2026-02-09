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
    maximumFractionDigits: 3 
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

      let logoBuffer = null;
      try {
        logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');
      } catch (error) {
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 30, 30, { width: 180 }); 
        } catch (error) {
          dibujarLogoFallback(doc);
        }
      } else {
        dibujarLogoFallback(doc);
      }

      const yEmpresa = 85; 
      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 30, yEmpresa);
      
      doc.fontSize(7).font('Helvetica').fillColor('#444444');
      doc.text('AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA', 30, yEmpresa + 12);
      doc.text('Villa el Salvador, Lima - Perú', 30, yEmpresa + 22);
      doc.text('Teléfono: 01- 312 7858  |  E-mail: informes@indpackperu.com', 30, yEmpresa + 32);
      doc.text('Web: https://www.indpackperu.com/', 30, yEmpresa + 42);

      const xBox = 350;
      const yBox = 30;
      const wBox = 215;
      const hBox = 75;

      doc.roundedRect(xBox, yBox, wBox, hBox, 5).lineWidth(1).stroke('#000000');
      
      let yText = yBox + 18;
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12);
      doc.text('R.U.C. 20550932297', xBox, yText, { width: wBox, align: 'center' });
      yText += 20;
      
      doc.fontSize(14).fillColor('#000000');
      doc.text('ORDEN DE VENTA', xBox, yText, { width: wBox, align: 'center' });
      yText += 20;
      
      doc.fontSize(12).fillColor('#000000');
      doc.text(`No. ${orden.numero_orden}`, xBox, yText, { width: wBox, align: 'center' });

      const yInfo = 145;
      const hInfo = 95;
      
      doc.roundedRect(30, yInfo, 535, hInfo, 5).lineWidth(0.5).stroke('#000000');

      const col1X = 40;
      const col1V = 95;
      const col2X = 350;
      const col2V = 420;
      
      let currentY = yInfo + 10;
      const gap = 14;

      doc.fontSize(8).fillColor('#000000');

      doc.font('Helvetica-Bold').text('Cliente:', col1X, currentY);
      doc.font('Helvetica').text(orden.cliente || orden.razon_social || 'VARIOS', col1V, currentY, { width: 250, ellipsis: true });

      doc.font('Helvetica-Bold').text('Fecha Emisión:', col2X, currentY);
      doc.font('Helvetica').text(new Date(orden.fecha_emision).toLocaleDateString('es-PE'), col2V, currentY);
      
      currentY += gap;

      doc.font('Helvetica-Bold').text('RUC:', col1X, currentY);
      doc.font('Helvetica').text(orden.ruc_cliente || orden.ruc || '-', col1V, currentY);

      doc.font('Helvetica-Bold').text('Moneda:', col2X, currentY);
      doc.font('Helvetica').text(orden.moneda === 'USD' ? 'USD' : 'PEN', col2V, currentY);

      currentY += gap;

      doc.font('Helvetica-Bold').text('Dirección:', col1X, currentY);
      const direccionLimpia = (orden.direccion_entrega || orden.direccion_cliente || orden.direccion || '').replace(/[\r\n]+/g, " ");
      doc.font('Helvetica').text(direccionLimpia, col1V, currentY, { width: 250, height: 26, ellipsis: true });

      doc.font('Helvetica-Bold').text('Plazo/Forma:', col2X, currentY);
      const plazoForma = orden.forma_pago || orden.plazo_pago || 'Contado';
      doc.font('Helvetica').text(plazoForma, col2V, currentY);

      currentY += gap + 6;

      doc.font('Helvetica-Bold').text('Vendedor:', col1X, currentY);
      doc.font('Helvetica').text(orden.comercial || 'Oficina', col1V, currentY, { width: 250 });

      doc.font('Helvetica-Bold').text('O/C Cliente:', col2X, currentY);
      doc.font('Helvetica-Bold').text(orden.orden_compra_cliente || '-', col2V, currentY); 

      currentY += gap;

      if (orden.fecha_entrega_estimada) {
        doc.font('Helvetica-Bold').text('Entrega Est.:', col2X, currentY);
        doc.font('Helvetica').text(new Date(orden.fecha_entrega_estimada).toLocaleDateString('es-PE'), col2V, currentY);
      }

      let yTable = yInfo + hInfo + 15;
      
      doc.rect(30, yTable, 535, 20).fillAndStroke('#e0e0e0', '#000000');
      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold');
      
      doc.text('ITEM', 35, yTable + 6, { width: 30, align: 'center' });
      doc.text('CÓDIGO', 70, yTable + 6, { width: 60 });
      doc.text('DESCRIPCIÓN', 130, yTable + 6, { width: 220 });
      doc.text('UND', 350, yTable + 6, { width: 30, align: 'center' });
      doc.text('CANT.', 380, yTable + 6, { width: 50, align: 'center' });
      doc.text('P.UNIT', 435, yTable + 6, { width: 50, align: 'right' });
      doc.text('TOTAL', 490, yTable + 6, { width: 70, align: 'right' });

      yTable += 20;

      if (orden.detalle && orden.detalle.length > 0) {
        orden.detalle.forEach((item, i) => {
          if (yTable > 700) {
            doc.addPage();
            yTable = 40;
          }

          const descuento = parseFloat(item.descuento_porcentaje || 0);
          const precioUnitario = parseFloat(item.precio_unitario || 0);
          const cantidad = parseFloat(item.cantidad || 0);
          const precioFinal = precioUnitario * (1 - descuento / 100);
          const totalLinea = cantidad * precioFinal;

          if (i % 2 === 0) {
             doc.rect(30, yTable - 2, 535, 14).fillAndStroke('#f9f9f9', '#f9f9f9');
          }

          doc.fillColor('#000000').fontSize(7).font('Helvetica');
          
          doc.text(String(i + 1), 35, yTable, { width: 30, align: 'center' });
          doc.text(String(item.codigo_producto || '-'), 70, yTable);
          doc.text(String(item.producto || 'SIN NOMBRE'), 130, yTable, { width: 220, ellipsis: true });
          doc.text(String(item.unidad_medida || 'UND'), 350, yTable, { width: 30, align: 'center' });
          doc.text(fmtNum(cantidad), 380, yTable, { width: 50, align: 'center' });
          doc.text(fmtNum(precioFinal), 435, yTable, { width: 50, align: 'right' });
          doc.text(fmtNum(totalLinea), 490, yTable, { width: 70, align: 'right' });

          yTable += 14;
        });
      }

      doc.fillColor('#000000');
      doc.moveTo(30, yTable).lineTo(565, yTable).lineWidth(0.5).stroke('#aaaaaa');
      yTable += 10;

      if (yTable > 640) {
        doc.addPage();
        yTable = 40;
      }

      const yFooter = yTable;
      
      const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO'].includes(String(orden.tipo_impuesto || '').toUpperCase());

      const rawSubtotal = parseFloat(orden.subtotal || 0);
      const rawIgv = esSinImpuesto ? 0 : parseFloat(orden.igv || 0);
      const rawTotal = esSinImpuesto ? rawSubtotal : parseFloat(orden.total || 0);

      const subtotal = fmtNum(rawSubtotal);
      const igv = fmtNum(rawIgv);
      const total = fmtNum(rawTotal);
      const totalNumero = rawTotal;

      const simbolo = orden.moneda === 'USD' ? '$' : 'S/';
      const etiquetaImp = ETIQUETAS_IMPUESTO[orden.tipo_impuesto] || 'IGV (18%)';

      const xTotales = 380;
      let yTotales = yFooter;

      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      
      doc.text('SUB TOTAL:', xTotales, yTotales);
      doc.font('Helvetica').text(`${simbolo} ${subtotal}`, xTotales + 80, yTotales, { width: 100, align: 'right' });
      yTotales += 15;

      doc.fillColor('#000000').font('Helvetica-Bold').text(etiquetaImp + ':', xTotales, yTotales);
      doc.font('Helvetica').text(`${simbolo} ${igv}`, xTotales + 80, yTotales, { width: 100, align: 'right' });
      yTotales += 15;

      doc.fillColor('#000000');
      doc.moveTo(xTotales, yTotales).lineTo(565, yTotales).stroke();
      yTotales += 5;

      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold').text('TOTAL A PAGAR:', xTotales, yTotales);
      doc.text(`${simbolo} ${total}`, xTotales + 80, yTotales, { width: 100, align: 'right' });

      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold').text('OBSERVACIONES:', 30, yFooter);
      doc.font('Helvetica').text(orden.observaciones || 'Sin observaciones.', 30, yFooter + 10, { width: 330 });

      const letras = numeroALetras(totalNumero, orden.moneda);
      doc.fillColor('#000000').font('Helvetica-Bold').text('SON:', 30, yFooter + 50);
      doc.font('Helvetica').text(letras, 55, yFooter + 50, { width: 300 });

      const yBank = 710;
      doc.rect(30, yBank, 535, 55).fillAndStroke('#f0f0f0', '#cccccc');
      
      doc.fillColor('#000000').fontSize(7).font('Helvetica-Bold');
      doc.text('CUENTAS BANCARIAS - INDPACK S.A.C.', 30, yBank + 6, { width: 535, align: 'center' });
      
      doc.fillColor('#000000').font('Helvetica');
      const bankY = yBank + 20;
      
      doc.text('BCP SOLES: 194-2055093-0-22', 40, bankY);
      doc.text('CCI: 002-194-002055093022-90', 40, bankY + 12);
      
      doc.text('BBVA SOLES: 0011-0175-0100045678', 220, bankY);
      doc.text('CCI: 011-175-000100045678-99', 220, bankY + 12);

      doc.text('CUENTA DETRACCIÓN BN: 00-000-00000', 400, bankY);
      doc.text('Facturas sujetas a detracción del 10%', 400, bankY + 12);

      doc.end();
      
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
}

function dibujarLogoFallback(doc) {
    doc.rect(30, 30, 180, 50).fillAndStroke('#1e88e5', '#1e88e5');
    doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold');
    doc.text('IndPack', 40, 45);
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
  const nombreMoneda = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';
  
  return `${resultado} CON ${String(decimales).padStart(2, '0')}/100 ${nombreMoneda}`;
}