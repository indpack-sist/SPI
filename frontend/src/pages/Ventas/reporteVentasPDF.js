import PDFDocument from 'pdfkit/js/pdfkit.standalone';

const fmtNum = (num) => {
  const valor = Number(num);
  if (isNaN(valor)) return '0.00';
  return valor.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 3
  });
};

const fmtFecha = (fecha) => {
  if (!fecha) return 'N/A';
  const dateObj = new Date(fecha + 'T00:00:00'); 
  return dateObj.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

async function descargarImagen(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blob.arrayBuffer(); 
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function generarReporteVentasPDF(data, incluirDetalle = true) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        bufferPages: true
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const blob = new Blob(chunks, { type: 'application/pdf' });
        resolve(blob); 
      });
      doc.on('error', reject);

      let logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, 40, { width: 180, height: 55, fit: [180, 55] });
        } catch (error) {
          doc.fontSize(20).fillColor('#1e88e5').font('Helvetica-Bold').text('IndPack', 40, 55);
        }
      } else {
        doc.fontSize(20).fillColor('#1e88e5').font('Helvetica-Bold').text('IndPack', 40, 55);
      }

      doc.fontSize(18).fillColor('#000000').font('Helvetica-Bold');
      doc.text('REPORTE DE VENTAS', 230, 50, { align: 'center', width: 325 });
      
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      const ahora = new Date().toLocaleString('es-PE');
      doc.text(`Generado: ${ahora}`, 230, 72, { align: 'center', width: 325 });

      let yPos = 115;

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
      doc.text('RESUMEN EJECUTIVO', 40, yPos);
      
      yPos += 20;
      const resumen = data.resumen;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Total Ventas (PEN):', 50, yPos);
      doc.font('Helvetica').fillColor('#1976D2');
      doc.text(`S/ ${fmtNum(resumen.total_ventas_pen)}`, 200, yPos);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Total Cobrado (PEN):', 50, yPos + 15);
      doc.font('Helvetica').fillColor('#388E3C');
      doc.text(`S/ ${fmtNum(resumen.total_pagado_pen)}`, 200, yPos + 15);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Por Cobrar (PEN):', 50, yPos + 30);
      doc.font('Helvetica').fillColor('#D32F2F');
      doc.text(`S/ ${fmtNum(resumen.total_pendiente_pen)}`, 200, yPos + 30);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Ventas Contado (PEN):', 50, yPos + 45);
      doc.font('Helvetica');
      doc.text(`S/ ${fmtNum(resumen.contado_pen)}`, 200, yPos + 45);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Ventas Crédito (PEN):', 50, yPos + 60);
      doc.font('Helvetica');
      doc.text(`S/ ${fmtNum(resumen.credito_pen)}`, 200, yPos + 60);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Total Ventas (USD):', 300, yPos);
      doc.font('Helvetica').fillColor('#1976D2');
      doc.text(`$ ${fmtNum(resumen.total_ventas_usd)}`, 430, yPos);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Por Cobrar (USD):', 300, yPos + 15);
      doc.font('Helvetica').fillColor('#D32F2F');
      doc.text(`$ ${fmtNum(resumen.total_pendiente_usd || 0)}`, 430, yPos + 15);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Ventas Contado (USD):', 300, yPos + 30);
      doc.font('Helvetica');
      doc.text(`$ ${fmtNum(resumen.contado_usd)}`, 430, yPos + 30);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Ventas Crédito (USD):', 300, yPos + 45);
      doc.font('Helvetica');
      doc.text(`$ ${fmtNum(resumen.credito_usd)}`, 430, yPos + 45);

      doc.font('Helvetica-Bold').fillColor('#333333');
      doc.text('Cantidad Órdenes:', 300, yPos + 60);
      doc.font('Helvetica');
      doc.text(`${resumen.cantidad_ordenes}`, 430, yPos + 60);

      yPos += 80;
      doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor('#CCCCCC').lineWidth(1).stroke();
      yPos += 20;

      if (incluirDetalle) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
        doc.text('DETALLE DE ÓRDENES', 40, yPos);
        yPos += 20;

        const ordenes = data.detalle || [];

        if (ordenes.length === 0) {
          doc.fontSize(9).font('Helvetica').fillColor('#999999');
          doc.text('No se encontraron órdenes.', 40, yPos);
        } else {
            ordenes.forEach((orden, index) => {
              if (yPos + 80 > 750) { doc.addPage(); yPos = 50; }

              doc.fontSize(9).font('Helvetica-Bold').fillColor('#1976D2');
              doc.text(`${index + 1}. ${orden.numero}`, 40, yPos);
              
              doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
              doc.text(orden.cliente.substring(0, 45), 250, yPos, { width: 300, align: 'right' });

              yPos += 15;

              const startY = yPos;
              doc.fontSize(8).font('Helvetica').fillColor('#555555');
              
              let colY = yPos;
              doc.text(`RUC: ${orden.ruc}`, 40, colY);
              colY += 12;
              doc.text(`Vendedor: ${orden.vendedor || 'N/A'}`, 40, colY);
              colY += 12;
              if (orden.tipo_comprobante && orden.numero_comprobante) {
                doc.text(`${orden.tipo_comprobante}: ${orden.numero_comprobante}`, 40, colY);
                colY += 12;
              }
              doc.text(`Estado: ${orden.estado}`, 40, colY);
              
              colY = startY;
              doc.text(`Emisión: ${fmtFecha(orden.fecha_emision)}`, 200, colY);
              colY += 12;
              if(orden.fecha_despacho) {
                  doc.text(`Despacho: ${fmtFecha(orden.fecha_despacho)}`, 200, colY);
                  colY += 12;
              }
              if(orden.fecha_vencimiento) {
                  doc.text(`Vencimiento: ${fmtFecha(orden.fecha_vencimiento)}`, 200, colY);
                  colY += 12;
              }
              doc.text(`Tipo Venta: ${orden.tipo_venta}`, 200, colY);
              
              if (orden.tipo_venta === 'Crédito' && orden.dias_credito) {
                colY += 12;
                doc.text(`Forma Pago: Crédito ${orden.dias_credito} Días`, 200, colY);
              }

              colY = startY;
              doc.text(`Moneda: ${orden.moneda}`, 400, colY, { align: 'right', width: 155 });
              colY += 12;
              doc.text(`Subtotal: ${orden.moneda} ${fmtNum(orden.subtotal)}`, 400, colY, { align: 'right', width: 155 });
              colY += 12;
              doc.text(`IGV: ${orden.moneda} ${fmtNum(orden.igv)}`, 400, colY, { align: 'right', width: 155 });
              colY += 12;
              doc.font('Helvetica-Bold');
              doc.text(`Total: ${orden.moneda} ${fmtNum(orden.total)}`, 400, colY, { align: 'right', width: 155 });
              doc.font('Helvetica');
              colY += 12;
              doc.fillColor('#388E3C');
              doc.text(`Pagado: ${orden.moneda} ${fmtNum(orden.monto_pagado)}`, 400, colY, { align: 'right', width: 155 });
              doc.fillColor('#666666');

              yPos = Math.max(yPos, startY + 75); 

              if (orden.detalles && orden.detalles.length > 0) {
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#555555');
                doc.text('Productos:', 40, yPos);
                yPos += 10;
                
                doc.fontSize(7).font('Helvetica').fillColor('#666666');
                orden.detalles.forEach(det => {
                    if (yPos > 760) {
                        doc.moveTo(40, yPos + 5).lineTo(555, yPos + 5).strokeColor('#EEEEEE').lineWidth(1).stroke();
                        doc.addPage(); 
                        yPos = 50; 
                        doc.fontSize(7).font('Helvetica-Bold').fillColor('#1976D2');
                        doc.text(`(Cont.) ${orden.numero}`, 40, yPos);
                        yPos += 15;
                        doc.fontSize(7).font('Helvetica').fillColor('#666666');
                    }
                    const textoProd = `• ${det.producto_nombre} | ${det.cantidad} ${det.unidad_medida} | P.U: ${orden.moneda} ${det.precio_unitario} | Sub: ${orden.moneda} ${det.subtotal}`;
                    doc.text(textoProd, 50, yPos);
                    yPos += 10;
                });
              }

              if (orden.observaciones) {
                yPos += 5;
                if (yPos > 760) { 
                    doc.moveTo(40, yPos + 5).lineTo(555, yPos + 5).strokeColor('#EEEEEE').lineWidth(1).stroke();
                    doc.addPage(); 
                    yPos = 50; 
                    doc.fontSize(7).font('Helvetica-Bold').fillColor('#1976D2');
                    doc.text(`(Cont.) ${orden.numero}`, 40, yPos);
                    yPos += 15;
                }
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#555555');
                doc.text('Obs:', 40, yPos, { continued: true });
                doc.font('Helvetica').fillColor('#777777');
                doc.text(` ${orden.observaciones.substring(0, 150)}`);
                yPos += 15;
              }

              yPos += 5;
              doc.moveTo(40, yPos).lineTo(555, yPos).strokeColor('#EEEEEE').lineWidth(1).stroke();
              yPos += 15;
            });
        }
      }

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.fontSize(7).font('Helvetica').fillColor('#999999');
        doc.text(`Página ${i + 1} de ${range.count}`, 40, 780, { align: 'center', width: 515 });
      }

      doc.end();
      
    } catch (error) {
      console.error('Error PDF:', error);
      reject(error);
    }
  });
}