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

      // Logo
      let logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');
      if (logoBuffer) {
        try { doc.image(logoBuffer, 50, 40, { width: 180 }); } catch (e) { doc.fontSize(16).font('Helvetica-Bold').text(EMPRESA.razon_social, 50, 50); }
      } else {
        doc.fontSize(16).font('Helvetica-Bold').text(EMPRESA.razon_social, 50, 50);
      }

      // Datos de Empresa
      doc.fontSize(9).fillColor('#333333').font('Helvetica-Bold').text(EMPRESA.razon_social, 50, 100);
      doc.fontSize(8).font('Helvetica')
        .text(EMPRESA.direccion, 50, 112, { width: 250 })
        .text(`Teléfono: ${EMPRESA.telefono}`)
        .text(`E-mail: ${EMPRESA.email}`)
        .text(`Web: ${EMPRESA.web}`);

      // Cuadro de RUC
      doc.rect(350, 50, 200, 80).lineWidth(1.5).stroke();
      doc.fontSize(12).font('Helvetica-Bold').text(`R.U.C. ${EMPRESA.ruc}`, 350, 65, { align: 'center', width: 200 });
      doc.fontSize(14).text('ORDEN DE COMPRA', 350, 85, { align: 'center', width: 200 });
      doc.fontSize(12).text(`No. ${orden.numero_orden}`, 350, 105, { align: 'center', width: 200 });

      let y = 175;
      
      // Bloque de Proveedor y Condiciones
      doc.rect(50, y, 500, 100).lineWidth(0.5).strokeColor('#dddddd').stroke().strokeColor('#000000');
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text('DATOS DEL PROVEEDOR', 60, y + 10);
      doc.text('CONDICIONES COMERCIALES', 300, y + 10);
      
      doc.moveTo(50, y + 22).lineTo(550, y + 22).strokeColor('#dddddd').stroke().strokeColor('#000000');

      let currentY = y + 30;
      // Proveedor
      doc.fontSize(8).font('Helvetica-Bold').text('Proveedor:', 60, currentY).font('Helvetica').text(orden.proveedor || '-', 115, currentY, { width: 170 });
      // Condiciones Derecha
      doc.font('Helvetica-Bold').text('Condición:', 300, currentY).font('Helvetica').text(orden.forma_pago_detalle || orden.tipo_compra || '-', 385, currentY);
      
      currentY += 13;
      doc.font('Helvetica-Bold').text('RUC:', 60, currentY).font('Helvetica').text(orden.ruc_proveedor || '-', 115, currentY);
      doc.font('Helvetica-Bold').text('Moneda:', 300, currentY).font('Helvetica').text(orden.moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES', 385, currentY);

      currentY += 13;
      doc.font('Helvetica-Bold').text('Contacto:', 60, currentY).font('Helvetica').text(orden.contacto_proveedor || '-', 115, currentY);
      doc.font('Helvetica-Bold').text('Días entre Cuotas:', 300, currentY).font('Helvetica').text(`${orden.dias_entre_cuotas || 0} días`, 385, currentY);

      currentY += 13;
      doc.font('Helvetica-Bold').text('Email:', 60, currentY).font('Helvetica').text(orden.email_proveedor || '-', 115, currentY);
      doc.font('Helvetica-Bold').text('Lugar Entr.:', 300, currentY).font('Helvetica').text(orden.lugar_entrega || 'Almacén Principal', 385, currentY, { width: 160 });

      currentY += 13;
      doc.font('Helvetica-Bold').text('Fecha Emisión:', 60, currentY).font('Helvetica').text(new Date(orden.fecha_emision).toLocaleDateString('es-PE'), 130, currentY);
      doc.font('Helvetica-Bold').text('Entr. Estimada:', 300, currentY).font('Helvetica').text(orden.fecha_entrega_estimada ? new Date(orden.fecha_entrega_estimada).toLocaleDateString('es-PE') : 'POR COORDINAR', 385, currentY);

      y += 120;

      // Tabla de Productos
      doc.rect(50, y, 500, 20).fill('#f5f5f5').stroke('#cccccc');
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
      doc.text('CÓDIGO', 55, y + 6, { width: 70 });
      doc.text('CANT.', 125, y + 6, { width: 50, align: 'right' });
      doc.text('UNID.', 180, y + 6, { width: 40 });
      doc.text('DESCRIPCIÓN', 225, y + 6, { width: 180 });
      doc.text('P. UNIT.', 410, y + 6, { width: 60, align: 'right' });
      doc.text('TOTAL', 480, y + 6, { width: 65, align: 'right' });

      y += 20;
      doc.font('Helvetica').fillColor('#000000');

      orden.detalle.forEach((item) => {
        if (y > 700) { doc.addPage(); y = 50; }
        const itemPrecio = parseFloat(item.precio_unitario || 0);
        
        doc.fontSize(8);
        doc.text(item.codigo_producto || '-', 55, y + 6, { width: 70 });
        doc.text(parseFloat(item.cantidad).toFixed(2), 125, y + 6, { width: 50, align: 'right' });
        doc.text(item.unidad_medida || 'und', 180, y + 6, { width: 40 });
        doc.text(item.producto, 225, y + 6, { width: 180 });

        if (itemPrecio === 0) {
          doc.font('Helvetica-Bold').text('A COTIZAR', 410, y + 6, { width: 60, align: 'right' }).font('Helvetica');
          doc.text('-', 480, y + 6, { width: 65, align: 'right' });
        } else {
          doc.text(itemPrecio.toLocaleString('es-PE', { minimumFractionDigits: 2 }), 410, y + 6, { width: 60, align: 'right' });
          doc.text(parseFloat(item.subtotal).toLocaleString('es-PE', { minimumFractionDigits: 2 }), 480, y + 6, { width: 65, align: 'right' });
        }

        y += 20;
        doc.moveTo(50, y).lineTo(550, y).strokeColor('#eeeeee').lineWidth(0.5).stroke().strokeColor('#000000').lineWidth(1);
      });

      // Totales
      y += 10;
      if (y > 700) { doc.addPage(); y = 50; }
      const totalX = 380;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('SUB TOTAL', totalX, y);
      doc.font('Helvetica').text(`${orden.moneda === 'USD' ? '$' : 'S/'} ${parseFloat(orden.subtotal || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 480, y, { width: 70, align: 'right' });
      y += 15;
      doc.font('Helvetica-Bold').text(`IGV (${orden.porcentaje_impuesto || 18}%)`, totalX, y);
      doc.font('Helvetica').text(`${orden.moneda === 'USD' ? '$' : 'S/'} ${parseFloat(orden.igv || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 480, y, { width: 70, align: 'right' });
      y += 5;
      doc.moveTo(totalX, y + 12).lineTo(550, y + 12).stroke();
      y += 15;
      doc.fontSize(11).font('Helvetica-Bold').text('TOTAL', totalX, y);
      doc.text(`${orden.moneda === 'USD' ? '$' : 'S/'} ${parseFloat(orden.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 480, y, { width: 70, align: 'right' });

      y += 30;
      doc.fontSize(8).font('Helvetica-Oblique').text(`SON: ${numeroALetras(orden.total, orden.moneda)}`, 50, y);

      // CRONOGRAMA DE PAGOS (SOLO SI HAY CUOTAS)
      if (orden.cuotas && orden.cuotas.length > 0) {
        y += 30;
        if (y > 650) { doc.addPage(); y = 50; }
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('CRONOGRAMA DE PAGOS ACORDADO', 50, y);
        y += 15;
        
        const cronoTop = y;
        doc.rect(50, cronoTop, 300, 18).fill('#eeeeee').stroke('#cccccc');
        doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
        doc.text('CUOTA N°', 55, cronoTop + 5, { width: 60 });
        doc.text('VENCIMIENTO', 120, cronoTop + 5, { width: 100 });
        doc.text('MONTO CUOTA', 230, cronoTop + 5, { width: 110, align: 'right' });
        
        y += 18;
        doc.font('Helvetica');
        orden.cuotas.forEach((cuota, idx) => {
          doc.fontSize(8);
          doc.text(`Cuota ${cuota.numero_cuota || idx + 1}`, 55, y + 5);
          doc.text(new Date(cuota.fecha_vencimiento).toLocaleDateString('es-PE'), 120, y + 5);
          doc.text(`${orden.moneda === 'USD' ? '$' : 'S/'} ${parseFloat(cuota.monto_cuota || cuota.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 230, y + 5, { width: 110, align: 'right' });
          y += 16;
          doc.moveTo(50, y).lineTo(350, y).strokeColor('#f0f0f0').stroke();
        });
        doc.strokeColor('#000000');
      }

      // Observaciones
      if (orden.observaciones) {
        y += 30;
        const obsLimpia = orden.observaciones.replace(/\[ITEM_MANUAL_ID_\d+\]:.*(\n|$)/g, '').replace(/\[PLAZO_PAGO\]:.*(\n|$)/g, '').replace(/\[LUGAR_ENTREGA\]:.*(\n|$)/g, '').trim();
        if (obsLimpia) {
          doc.fontSize(9).font('Helvetica-Bold').text('OBSERVACIONES ADICIONALES:', 50, y);
          y += 12;
          doc.fontSize(8).font('Helvetica').text(obsLimpia, 50, y, { width: 500 });
        }
      }

      doc.fontSize(7).fillColor('#888888').text('Este documento es una Orden de Compra oficial de INDPACK S.A.C. Por favor, confirmar recepción y fecha de entrega.', 50, 770, { align: 'center', width: 495 });
      doc.end();
    } catch (error) { reject(error); }
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
    return num.toString();
  };
  const resultado = convertirNumero(entero);
  const nombreMoneda = moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';
  return `${resultado} CON ${String(decimales).padStart(2, '0')}/100 ${nombreMoneda}`;
}