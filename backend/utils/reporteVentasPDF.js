import PDFDocument from 'pdfkit';
import https from 'https';

const fmtNum = (num) => {
  const valor = Number(num);
  if (isNaN(valor)) return '0.00';
  return valor.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2
  });
};

const fmtFecha = (fecha) => {
  if (!fecha) return 'N/A';
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

function descargarImagen(url) {
  return new Promise((resolve) => {
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

export async function generarReporteVentasPDF(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, 40, { width: 180, height: 55, fit: [180, 55] });
        } catch (error) {
          doc.rect(40, 40, 180, 55).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold');
          doc.text('IndPack', 50, 55);
        }
      } else {
        doc.rect(40, 40, 180, 55).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold');
        doc.text('IndPack', 50, 55);
      }

      doc.fontSize(18).fillColor('#000000').font('Helvetica-Bold');
      doc.text('REPORTE DE VENTAS', 230, 50, { align: 'center', width: 325 });
      
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      const ahora = new Date().toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generado: ${ahora}`, 230, 72, { align: 'center', width: 325 });

      let yPos = 115;

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
      doc.text('RESUMEN EJECUTIVO', 40, yPos);
      
      yPos += 20;

      const resumen = data.resumen;

      doc.roundedRect(40, yPos, 515, 90, 5).fillAndStroke('#F5F5F5', '#CCCCCC');

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Total Ventas (PEN):', 50, yPos + 10);
      doc.font('Helvetica').fillColor('#1976D2');
      doc.text(`S/ ${fmtNum(resumen.total_ventas_pen)}`, 200, yPos + 10);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Total Cobrado:', 50, yPos + 25);
      doc.font('Helvetica').fillColor('#388E3C');
      doc.text(`S/ ${fmtNum(resumen.total_pagado_pen)}`, 200, yPos + 25);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Por Cobrar:', 50, yPos + 40);
      doc.font('Helvetica').fillColor('#D32F2F');
      doc.text(`S/ ${fmtNum(resumen.total_pendiente_pen)}`, 200, yPos + 40);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Comisiones:', 50, yPos + 55);
      doc.font('Helvetica').fillColor('#7B1FA2');
      doc.text(`S/ ${fmtNum(resumen.total_comisiones_pen || 0)}`, 200, yPos + 55);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Ventas al Contado:', 50, yPos + 70);
      doc.font('Helvetica');
      doc.text(`S/ ${fmtNum(resumen.contado_pen)}`, 200, yPos + 70);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Ventas al Crédito:', 300, yPos + 10);
      doc.font('Helvetica');
      doc.text(`S/ ${fmtNum(resumen.credito_pen)}`, 430, yPos + 10);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Cantidad Órdenes:', 300, yPos + 25);
      doc.font('Helvetica');
      doc.text(`${resumen.cantidad_ordenes}`, 430, yPos + 25);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Pedidos Atrasados:', 300, yPos + 40);
      doc.font('Helvetica').fillColor(resumen.pedidos_retrasados > 0 ? '#D32F2F' : '#388E3C');
      doc.text(`${resumen.pedidos_retrasados}`, 430, yPos + 40);

      if (resumen.total_ventas_usd > 0) {
        doc.font('Helvetica-Bold').fillColor('#333333');
        doc.text('Total Ventas (USD):', 300, yPos + 55);
        doc.font('Helvetica').fillColor('#1976D2');
        doc.text(`$ ${fmtNum(resumen.total_ventas_usd)}`, 430, yPos + 55);
      }

      yPos += 110;

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
      doc.text('DETALLE DE ÓRDENES', 40, yPos);
      
      yPos += 20;

      const ordenes = data.detalle || [];

      if (ordenes.length === 0) {
        doc.fontSize(9).font('Helvetica').fillColor('#999999');
        doc.text('No se encontraron órdenes en el período seleccionado.', 40, yPos);
        doc.end();
        return;
      }

      ordenes.forEach((orden, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const alturaOrden = 85;
        doc.roundedRect(40, yPos, 515, alturaOrden, 3).stroke('#DDDDDD');

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1976D2');
        doc.text(`${index + 1}. ${orden.numero}`, 45, yPos + 8);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333');
        doc.text('Cliente:', 300, yPos + 8);
        doc.font('Helvetica');
        doc.text(orden.cliente.substring(0, 35), 340, yPos + 8);

        yPos += 20;

        doc.fontSize(7).font('Helvetica').fillColor('#666666');
        
        let colY = yPos;
        
        doc.text(`RUC: ${orden.ruc}`, 45, colY);
        colY += 12;
        doc.text(`Vendedor: ${orden.vendedor || 'N/A'}`, 45, colY);
        colY += 12;
        
        if (orden.tipo_comprobante && orden.numero_comprobante) {
          doc.text(`${orden.tipo_comprobante}: ${orden.numero_comprobante}`, 45, colY);
          colY += 12;
        }
        
        doc.text(`Estado: ${orden.estado}`, 45, colY);
        
        colY = yPos;
        
        doc.text(`Emisión: ${fmtFecha(orden.fecha_emision)}`, 200, colY);
        colY += 12;
        
        if (orden.fecha_despacho) {
          doc.text(`Despacho: ${fmtFecha(orden.fecha_despacho)}`, 200, colY);
          colY += 12;
        }
        
        if (orden.fecha_vencimiento) {
          doc.text(`Vencimiento: ${fmtFecha(orden.fecha_vencimiento)}`, 200, colY);
          colY += 12;
        }

        doc.text(`Tipo Venta: ${orden.tipo_venta}`, 200, colY);

        colY = yPos;
        
        doc.text(`Moneda: ${orden.moneda}`, 360, colY);
        colY += 12;
        doc.text(`Subtotal: ${orden.moneda} ${fmtNum(orden.subtotal)}`, 360, colY);
        colY += 12;
        doc.text(`IGV: ${orden.moneda} ${fmtNum(orden.igv)}`, 360, colY);
        colY += 12;
        doc.font('Helvetica-Bold');
        doc.text(`Total: ${orden.moneda} ${fmtNum(orden.total)}`, 360, colY);
        doc.font('Helvetica');
        colY += 12;
        doc.fillColor('#388E3C');
        doc.text(`Pagado: ${orden.moneda} ${fmtNum(orden.monto_pagado)}`, 360, colY);

        yPos += alturaOrden + 10;

        if (orden.observaciones) {
          if (yPos > 720) {
            doc.addPage();
            yPos = 50;
          }
          
          doc.fontSize(7).font('Helvetica-Bold').fillColor('#555555');
          doc.text('Obs:', 45, yPos);
          doc.font('Helvetica').fillColor('#777777');
          doc.text(orden.observaciones.substring(0, 100), 70, yPos, { width: 475 });
          yPos += 12;
        }

        yPos += 5;
      });

      const numeroPaginas = doc.bufferedPageRange().count;
      for (let i = 0; i < numeroPaginas; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font('Helvetica').fillColor('#999999');
        doc.text(`Página ${i + 1} de ${numeroPaginas}`, 40, 780, { align: 'center', width: 515 });
      }

      doc.end();
      
    } catch (error) {
      console.error('Error generando PDF reporte ventas:', error);
      reject(error);
    }
  });
}