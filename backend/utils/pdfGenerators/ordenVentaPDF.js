import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fmtNum = (num) => {
  return Number(num).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

function descargarImagen(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 3000 }, (response) => {
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

export async function generarReporteVentasPDF(data, filtros) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        bufferPages: true,
        layout: 'landscape' 
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer = null;
      try {
        logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');
      } catch (error) {}

      if (logoBuffer) {
        doc.image(logoBuffer, 30, 30, { width: 150 }); 
      } else {
        doc.rect(30, 30, 150, 40).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold');
        doc.text('IndPack', 40, 40);
      }

      const yEmpresa = 75; 
      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 30, yEmpresa);
      
      doc.fontSize(7).font('Helvetica').fillColor('#444444');
      doc.text('AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA', 30, yEmpresa + 10);
      doc.text('Villa el Salvador, Lima - Perú', 30, yEmpresa + 20);
      doc.text('RUC: 20550932297', 30, yEmpresa + 30);

      const xBox = 550;
      const yBox = 30;
      const wBox = 230;
      const hBox = 60;

      doc.roundedRect(xBox, yBox, wBox, hBox, 5).lineWidth(1).stroke('#000000');
      
      let yText = yBox + 15;
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(14);
      doc.text('REPORTE DE VENTAS', xBox, yText, { width: wBox, align: 'center' });
      yText += 20;
      
      doc.fontSize(9).font('Helvetica');
      const periodo = `Del ${filtros.fechaInicio} al ${filtros.fechaFin}`;
      doc.text(periodo, xBox, yText, { width: wBox, align: 'center' });

      const yKpis = 120;
      const hKpis = 50;
      
      doc.roundedRect(30, yKpis, 750, hKpis, 5).fillAndStroke('#f4f4f4', '#cccccc');

      const kpiY = yKpis + 12;
      const kpiY2 = yKpis + 25;
      
      doc.fillColor('#000000');

      doc.fontSize(8).font('Helvetica-Bold').text('TOTAL VENTAS (PEN)', 50, kpiY);
      doc.fontSize(10).font('Helvetica').text(`S/ ${fmtNum(data.resumen.total_ventas_pen)}`, 50, kpiY2);

      doc.fontSize(8).font('Helvetica-Bold').text('TOTAL COBRADO', 200, kpiY);
      doc.fontSize(10).font('Helvetica').fillColor('#10B981').text(`S/ ${fmtNum(data.resumen.total_pagado_pen)}`, 200, kpiY2);

      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold').text('POR COBRAR', 350, kpiY);
      doc.fontSize(10).font('Helvetica').fillColor('#EF4444').text(`S/ ${fmtNum(data.resumen.total_pendiente_pen)}`, 350, kpiY2);

      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold').text('N° ORDENES', 500, kpiY);
      doc.fontSize(10).font('Helvetica').text(data.resumen.cantidad_ordenes, 500, kpiY2);

      doc.fontSize(8).font('Helvetica-Bold').text('RETRASOS', 620, kpiY);
      doc.fontSize(10).font('Helvetica').fillColor('#EF4444').text(data.resumen.pedidos_retrasados, 620, kpiY2);

      let yTable = yKpis + hKpis + 20;
      
      doc.rect(30, yTable, 750, 20).fillAndStroke('#333333', '#000000');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      
      const cols = {
        fecha: 40,
        orden: 90,
        cliente: 150,
        vendedor: 350,
        pago: 470,
        logistica: 540,
        moneda: 620,
        total: 660
      };

      doc.text('FECHA', cols.fecha, yTable + 6);
      doc.text('N° ORDEN', cols.orden, yTable + 6);
      doc.text('CLIENTE', cols.cliente, yTable + 6);
      doc.text('VENDEDOR', cols.vendedor, yTable + 6);
      doc.text('EST. PAGO', cols.pago, yTable + 6);
      doc.text('LOGÍSTICA', cols.logistica, yTable + 6);
      doc.text('MON', cols.moneda, yTable + 6);
      doc.text('TOTAL', cols.total, yTable + 6, { width: 110, align: 'right' });

      yTable += 20;

      doc.fillColor('#000000').font('Helvetica').fontSize(8);

      if (data.detalle && data.detalle.length > 0) {
        data.detalle.forEach((item, i) => {
          if (yTable > 500) {
            doc.addPage({ layout: 'landscape' });
            yTable = 40;
            
            doc.rect(30, yTable, 750, 20).fillAndStroke('#333333', '#000000');
            doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
            doc.text('FECHA', cols.fecha, yTable + 6);
            doc.text('N° ORDEN', cols.orden, yTable + 6);
            doc.text('CLIENTE', cols.cliente, yTable + 6);
            doc.text('VENDEDOR', cols.vendedor, yTable + 6);
            doc.text('EST. PAGO', cols.pago, yTable + 6);
            doc.text('LOGÍSTICA', cols.logistica, yTable + 6);
            doc.text('MON', cols.moneda, yTable + 6);
            doc.text('TOTAL', cols.total, yTable + 6, { width: 110, align: 'right' });
            yTable += 20;
          }

          if (i % 2 === 0) {
             doc.rect(30, yTable - 2, 750, 16).fillAndStroke('#f9f9f9', '#f9f9f9');
          }

          doc.fillColor('#000000').fontSize(8).font('Helvetica');
          
          doc.text(item.fecha_emision, cols.fecha, yTable);
          doc.text(item.numero, cols.orden, yTable);
          doc.text(item.cliente.substring(0, 35), cols.cliente, yTable, { width: 190, ellipsis: true });
          doc.text(item.vendedor.substring(0, 20), cols.vendedor, yTable, { width: 110, ellipsis: true });
          
          if (item.estado_pago === 'Pendiente') doc.fillColor('#EF4444');
          else if (item.estado_pago === 'Parcial') doc.fillColor('#F59E0B');
          else doc.fillColor('#10B981');
          doc.text(item.estado_pago, cols.pago, yTable);

          doc.fillColor('#000000');
          if (item.estado_logistico === 'Retrasado' || item.estado_logistico === 'Vencido') doc.fillColor('#EF4444');
          doc.text(item.estado_logistico, cols.logistica, yTable);

          doc.fillColor('#000000');
          doc.text(item.moneda, cols.moneda, yTable);
          doc.text(fmtNum(item.total_original), cols.total, yTable, { width: 110, align: 'right' });

          yTable += 16;
        });
      } else {
        doc.text('No se encontraron registros en este periodo.', cols.fecha, yTable + 10);
      }

      doc.moveTo(30, yTable).lineTo(780, yTable).lineWidth(0.5).stroke('#aaaaaa');
      
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#888888');
        doc.text(`Página ${i + 1} de ${pageCount} | Generado el ${new Date().toLocaleString('es-PE')}`, 30, 570, { align: 'center', width: 780 });
      }

      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}