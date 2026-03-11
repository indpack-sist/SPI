import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.',
  web: 'https://www.indpackperu.com',
  email: 'informes@indpackperu.com',
  telefono: '01- 312 7858',
  direccion: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA, Villa el Salvador, Lima - Lima (PE) - Perú'
};

function descargarImagen(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        resolve(null);
        return;
      }
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

export const generarCompraPDF = async (orden) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Descargar e insertar Logo
      let logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.fontSize(16).font('Helvetica-Bold').text(EMPRESA.razon_social, 50, 50);
        }
      } else {
        doc.fontSize(16).font('Helvetica-Bold').text(EMPRESA.razon_social, 50, 50);
      }

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, 110);

      doc.fontSize(8).font('Helvetica')
        .text(EMPRESA.direccion, 50, 123, { width: 250 })
        .text(`Teléfono: ${EMPRESA.telefono}`)
        .text(`E-mail: ${EMPRESA.email}`)
        .text(`Web: ${EMPRESA.web}`);

      // Cuadro de RUC y Tipo de Documento
      doc.rect(350, 50, 200, 80).stroke();
      doc.fontSize(12).font('Helvetica-Bold').text(`R.U.C. ${EMPRESA.ruc}`, 350, 65, { align: 'center', width: 200 });
      doc.fontSize(14).text('ORDEN DE COMPRA', 350, 85, { align: 'center', width: 200 });
      doc.fontSize(12).text(`No. ${orden.numero_orden}`, 350, 105, { align: 'center', width: 200 });

      // Información del Proveedor y Condiciones
      let y = 185;
      doc.fontSize(10).font('Helvetica-Bold').text('DATOS DEL PROVEEDOR', 50, y);
      doc.fontSize(10).font('Helvetica-Bold').text('CONDICIONES COMERCIALES', 300, y);
      
      y += 15;
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;

      // Columna Izquierda: Proveedor
      const startY = y;
      doc.fontSize(9).font('Helvetica-Bold').text('Proveedor:', 50, y).font('Helvetica').text(orden.proveedor || '-', 110, y);
      y += 14;
      doc.font('Helvetica-Bold').text('RUC:', 50, y).font('Helvetica').text(orden.ruc_proveedor || '-', 110, y);
      y += 14;
      doc.font('Helvetica-Bold').text('Contacto:', 50, y).font('Helvetica').text(orden.contacto_proveedor || '-', 110, y);
      y += 14;
      doc.font('Helvetica-Bold').text('Teléfono:', 50, y).font('Helvetica').text(orden.telefono_proveedor || '-', 110, y);
      y += 14;
      doc.font('Helvetica-Bold').text('Email:', 50, y).font('Helvetica').text(orden.email_proveedor || '-', 110, y);

      // Columna Derecha: Condiciones
      y = startY;
      doc.fontSize(9).font('Helvetica-Bold').text('Moneda:', 300, y).font('Helvetica').text(orden.moneda === 'USD' ? 'DÓLARES (USD)' : 'SOLES (PEN)', 390, y);
      y += 14;
      doc.font('Helvetica-Bold').text('Forma Pago:', 300, y).font('Helvetica').text(orden.forma_pago_detalle || orden.tipo_compra || '-', 390, y);
      
      if (orden.tipo_compra === 'Credito' || orden.tipo_compra === 'Letras') {
        y += 14;
        doc.font('Helvetica-Bold').text('Días Crédito:', 300, y).font('Helvetica').text(`${orden.dias_credito || 0} días`, 390, y);
      }
      
      y += 14;
      doc.font('Helvetica-Bold').text('Plazo Pago:', 300, y).font('Helvetica').text(orden.plazo_pago || '-', 390, y);
      y += 14;
      doc.font('Helvetica-Bold').text('Lugar Entrega:', 300, y).font('Helvetica').text(orden.lugar_entrega || 'Almacén Principal', 390, y, { width: 160 });
      y += 24;

      // Fechas
      doc.fontSize(9).font('Helvetica-Bold').text('Fecha Emisión:', 50, y).font('Helvetica').text(new Date(orden.fecha_emision).toLocaleDateString('es-PE'), 130, y);
      doc.fontSize(9).font('Helvetica-Bold').text('Entrega Estimada:', 300, y).font('Helvetica').text(orden.fecha_entrega_estimada ? new Date(orden.fecha_entrega_estimada).toLocaleDateString('es-PE') : 'POR COORDINAR', 390, y);
      
      y += 30;

      // Tabla de Productos
      const tableTop = y;
      doc.rect(50, tableTop, 500, 20).fill('#f0f0f0').stroke('#cccccc');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      doc.text('CÓDIGO', 55, tableTop + 6, { width: 70 });
      doc.text('CANT.', 125, tableTop + 6, { width: 50, align: 'right' });
      doc.text('UNID.', 180, tableTop + 6, { width: 40 });
      doc.text('DESCRIPCIÓN', 225, tableTop + 6, { width: 180 });
      doc.text('P. UNIT.', 410, tableTop + 6, { width: 60, align: 'right' });
      doc.text('TOTAL', 480, tableTop + 6, { width: 65, align: 'right' });

      y = tableTop + 20;
      doc.font('Helvetica');

      orden.detalle.forEach((item, index) => {
        // Verificar si necesitamos nueva página
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        const isManual = item.codigo_producto === 'MANUAL';
        const itemTotal = parseFloat(item.subtotal || 0);
        const itemPrecio = parseFloat(item.precio_unitario || 0);

        doc.fontSize(8);
        doc.text(item.codigo_producto || '-', 55, y + 6, { width: 70 });
        doc.text(parseFloat(item.cantidad).toFixed(2), 125, y + 6, { width: 50, align: 'right' });
        doc.text(item.unidad_medida || 'und', 180, y + 6, { width: 40 });
        
        const descName = isManual ? item.producto : item.producto;
        doc.text(descName, 225, y + 6, { width: 180 });

        // Lógica de precio "POR COTIZAR"
        if (itemPrecio === 0) {
          doc.font('Helvetica-Bold').text('A COTIZAR', 410, y + 6, { width: 60, align: 'right' });
          doc.text('-', 480, y + 6, { width: 65, align: 'right' }).font('Helvetica');
        } else {
          doc.text(itemPrecio.toLocaleString('es-PE', { minimumFractionDigits: 2 }), 410, y + 6, { width: 60, align: 'right' });
          doc.text(itemTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 }), 480, y + 6, { width: 65, align: 'right' });
        }

        y += 20;
        doc.moveTo(50, y).lineTo(550, y).strokeColor('#eeeeee').lineWidth(0.5).stroke().strokeColor('#000000').lineWidth(1);
      });

      // Totales
      y += 10;
      if (y > 700) { doc.addPage(); y = 50; }

      const totalX = 380;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('SUB TOTAL', totalX, y, { width: 100 });
      doc.font('Helvetica').text(`${orden.moneda === 'USD' ? '$' : 'S/'} ${parseFloat(orden.subtotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 480, y, { width: 70, align: 'right' });
      
      y += 15;
      doc.font('Helvetica-Bold').text(`IGV (${orden.porcentaje_impuesto || 18}%)`, totalX, y, { width: 100 });
      doc.font('Helvetica').text(`${orden.moneda === 'USD' ? '$' : 'S/'} ${parseFloat(orden.igv || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 480, y, { width: 70, align: 'right' });
      
      y += 5;
      doc.moveTo(totalX, y + 12).lineTo(550, y + 12).stroke();
      y += 15;
      doc.fontSize(11).font('Helvetica-Bold').text('TOTAL', totalX, y, { width: 100 });
      doc.text(`${orden.moneda === 'USD' ? '$' : 'S/'} ${parseFloat(orden.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 480, y, { width: 70, align: 'right' });

      // Son letras
      y += 25;
      doc.fontSize(8).font('Helvetica-Oblique').text(`SON: ${numeroALetras(orden.total, orden.moneda)}`, 50, y);

      // Observaciones
      if (orden.observaciones) {
        y += 30;
        // Limpiamos las etiquetas de items manuales para que no salgan en el PDF
        const obsLimpia = orden.observaciones.replace(/\[ITEM_MANUAL_ID_\d+\]:.*(\n|$)/g, '').trim();
        if (obsLimpia) {
          doc.fontSize(9).font('Helvetica-Bold').text('OBSERVACIONES:', 50, y);
          y += 12;
          doc.fontSize(8).font('Helvetica').text(obsLimpia, 50, y, { width: 500 });
        }
      }

      // Footer con aviso de control interno
      doc.fontSize(7).fillColor('#888888').text('Este documento es una Orden de Compra oficial de INDPACK S.A.C. Por favor, confirmar recepción y fecha de entrega.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

function numeroALetras(monto, moneda) {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  
  const entero = Math.floor(monto);
  const decimales = Math.round((monto - entero) * 100);
  
  const convertirNumero = (num) => {
    if (num === 0) return 'CERO';
    if (num < 10) return unidades[num];
    if (num < 20) return especiales[num - 10];
    if (num < 100) return decenas[Math.floor(num / 10)] + (num % 10 !== 0 ? ' Y ' + unidades[num % 10] : '');
    if (num < 1000) {
      const resto = num % 100;
      if (num === 100) return 'CIEN';
      return (num < 200 ? 'CIENTO' : unidades[Math.floor(num / 100)] + 'CIENTOS') + (resto !== 0 ? ' ' + convertirNumero(resto) : '');
    }
    return num.toString(); // Simplificado para miles
  };
  
  const resultado = convertirNumero(entero);
  const nombreMoneda = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';
  
  return `${resultado} CON ${String(decimales).padStart(2, '0')}/100 ${nombreMoneda}`;
}