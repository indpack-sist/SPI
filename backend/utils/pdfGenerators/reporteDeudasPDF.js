import PDFDocument from 'pdfkit';
import https from 'https';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.',
  direccion: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA',
  distrito: 'Villa el Salvador',
  departamento: 'Lima',
  pais: 'Perú',
  telefono: '01- 312 7858',
  email: 'informes@indpackperu.com',
  web: 'https://www.indpackperu.com/'
};

const fmtNum = (num) => {
  return Number(num).toLocaleString('en-US', { 
    minimumFractionDigits: 3, 
    maximumFractionDigits: 3
  });
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
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

export async function generarReporteDeudasPDF(deudas, filtros) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        layout: 'landscape',
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      });
      
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png');

      const isCliente = !!filtros.id_cliente;
      const clienteData = isCliente && deudas.length > 0 ? deudas[0] : null;

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 30, 30, { width: 180, height: 50, fit: [180, 50] });
        } catch (error) {
          doc.rect(30, 30, 180, 50).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold');
          doc.text('IndPack', 40, 45);
        }
      } else {
        doc.rect(30, 30, 180, 50).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(20).fillColor('#FFFFFF').font('Helvetica-Bold');
        doc.text('IndPack', 40, 45);
      }

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 30, 90);
      
      doc.fontSize(8).font('Helvetica');
      doc.text(EMPRESA.direccion, 30, 103, { width: 300 });
      doc.text(`${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 30, 115);
      
      doc.text(`Tel: ${EMPRESA.telefono}  |  Email: ${EMPRESA.email}`, 30, 127);

      doc.roundedRect(580, 30, 230, 60, 5).stroke('#000000');
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      if (isCliente && clienteData) {
        doc.text(`R.U.C. ${clienteData.ruc}`, 585, 38, { align: 'center', width: 220 });
      } else {
        doc.text(`R.U.C. ${EMPRESA.ruc}`, 585, 38, { align: 'center', width: 220 });
      }
      
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(isCliente ? 'ESTADO DE CUENTA' : 'REPORTE GENERAL DE DEUDAS', 585, 53, { align: 'center', width: 220 });
      
      doc.fontSize(10).font('Helvetica-Bold');
      const fechaHoy = new Date().toLocaleDateString('es-PE');
      doc.text(fechaHoy, 585, 70, { align: 'center', width: 220 });

      const alturaRecuadroInfo = 60;
      doc.roundedRect(30, 145, 782, alturaRecuadroInfo, 3).stroke('#000000');
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');

      if (isCliente && clienteData) {
        doc.text('Cliente:', 40, 155);
        doc.font('Helvetica');
        doc.text(clienteData.cliente || '', 90, 155, { width: 300 });
        
        doc.font('Helvetica-Bold');
        doc.text('RUC:', 40, 170);
        doc.font('Helvetica');
        doc.text(clienteData.ruc || '', 90, 170);
        
        doc.font('Helvetica-Bold');
        doc.text('Dirección:', 40, 185);
        doc.font('Helvetica');
        const direccion = clienteData.direccion || 'Sin dirección registrada';
        doc.text(direccion, 90, 185, { width: 300, lineGap: 2 });

        doc.font('Helvetica-Bold');
        doc.text('Teléfono:', 450, 155);
        doc.font('Helvetica');
        doc.text(clienteData.telefono || '-', 510, 155);

        doc.font('Helvetica-Bold');
        doc.text('Email:', 450, 170);
        doc.font('Helvetica');
        doc.text(clienteData.email || '-', 510, 170, { width: 200 });

      } else {
        doc.text('Reporte:', 40, 155);
        doc.font('Helvetica');
        doc.text('Listado General de Cuentas por Cobrar', 100, 155);

        doc.font('Helvetica-Bold');
        doc.text('Filtro Fecha:', 40, 170);
        doc.font('Helvetica');
        const rango = (filtros.fecha_inicio && filtros.fecha_fin) 
          ? `Del ${formatearFecha(filtros.fecha_inicio)} al ${formatearFecha(filtros.fecha_fin)}` 
          : 'Histórico Completo';
        doc.text(rango, 100, 170);

        doc.font('Helvetica-Bold');
        doc.text('Registros:', 450, 155);
        doc.font('Helvetica');
        doc.text(deudas.length.toString() + ' documentos encontrados', 510, 155);
      }

      let yPos = 225;

      const grupos = [
        {
          titulo: 'PENDIENTES DE PAGO (CONTADO)',
          datos: deudas.filter(d => d.tipo_venta === 'Contado'),
          colorTitulo: '#DC2626' 
        },
        {
          titulo: 'CARTERA DE CRÉDITO',
          datos: deudas.filter(d => d.tipo_venta !== 'Contado'),
          colorTitulo: '#2563EB' 
        }
      ];

      const dibujarCabeceraTabla = (y) => {
        doc.rect(30, y, 782, 20).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        
        doc.text('DOCUMENTO', 35, y + 6);
        doc.text('EMISIÓN', 110, y + 6);
        doc.text('VENCIMIENTO', 170, y + 6);
        doc.text('ESTADO', 240, y + 6);
        
        if (!isCliente) {
          doc.text('CLIENTE', 310, y + 6, { width: 220, ellipsis: true });
        }

        doc.text('MON', isCliente ? 320 : 540, y + 6);
        doc.text('TOTAL', isCliente ? 380 : 590, y + 6, { align: 'right', width: 60 });
        doc.text('A CTA.', isCliente ? 460 : 670, y + 6, { align: 'right', width: 60 });
        doc.text('SALDO', isCliente ? 540 : 750, y + 6, { align: 'right', width: 60 });
      };

      grupos.forEach(grupo => {
        if (grupo.datos.length === 0) return;

        if (yPos + 40 > 550) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(10).font('Helvetica-Bold').fillColor(grupo.colorTitulo);
        doc.text(grupo.titulo, 30, yPos);
        yPos += 15;

        dibujarCabeceraTabla(yPos);
        yPos += 20;

        grupo.datos.forEach((item, idx) => {
          const descripcionCliente = item.cliente || '';
          const anchoCliente = 220; 
          
          const alturaCliente = !isCliente ? calcularAlturaTexto(doc, descripcionCliente, anchoCliente, 8) : 0;
          const alturaFila = Math.max(20, alturaCliente + 8);

          if (yPos + alturaFila > 550) {
            doc.addPage();
            yPos = 50;
            dibujarCabeceraTabla(yPos);
            yPos += 20;
          }

          if (idx % 2 === 0) doc.rect(30, yPos, 782, alturaFila).fillOpacity(0.1).fill('#f0f0f0').fillOpacity(1);

          doc.fontSize(8).font('Helvetica').fillColor('#000000');
          
          doc.text(item.numero_orden, 35, yPos + 5);
          doc.text(formatearFecha(item.fecha_emision), 110, yPos + 5);
          doc.text(formatearFecha(item.fecha_vencimiento), 170, yPos + 5);
          
          let colorEstado = '#000000';
          if (item.estado_deuda === 'Vencido') colorEstado = '#CC0000';
          if (item.estado_deuda === 'Próximo a Vencer') colorEstado = '#E65100';
          
          doc.fillColor(colorEstado).text(item.estado_deuda, 240, yPos + 5);
          doc.fillColor('#000000');

          if (!isCliente) {
            doc.text(descripcionCliente, 310, yPos + 5, { width: anchoCliente, lineGap: 2 });
          }

          doc.text(item.moneda, isCliente ? 320 : 540, yPos + 5);
          doc.text(fmtNum(item.total), isCliente ? 380 : 590, yPos + 5, { align: 'right', width: 60 });
          doc.text(fmtNum(item.monto_pagado), isCliente ? 460 : 670, yPos + 5, { align: 'right', width: 60 });
          doc.font('Helvetica-Bold').text(fmtNum(item.saldo_pendiente), isCliente ? 540 : 750, yPos + 5, { align: 'right', width: 60 });

          yPos += alturaFila;
        });

        yPos += 20; 
      });

      let totalSaldoPEN = 0;
      let totalSaldoUSD = 0;

      deudas.forEach(item => {
        const saldo = parseFloat(item.saldo_pendiente);
        if (item.moneda === 'PEN') totalSaldoPEN += saldo;
        if (item.moneda === 'USD') totalSaldoUSD += saldo;
      });

      if (yPos + 60 > 550) {
        doc.addPage();
        yPos = 50;
      }

      const xLabel = 500;
      const xValue = 720;
      const widthValue = 90;

      if (totalSaldoPEN > 0) {
        doc.roundedRect(xLabel, yPos, 210, 18, 3).fill('#CCCCCC');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('TOTAL PENDIENTE PEN', xLabel + 10, yPos + 5);
        
        doc.roundedRect(xValue - 10, yPos, 120, 18, 3).stroke('#CCCCCC');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`S/ ${fmtNum(totalSaldoPEN)}`, xValue, yPos + 5, { align: 'right', width: 100 });
        yPos += 22;
      }

      if (totalSaldoUSD > 0) {
        doc.roundedRect(xLabel, yPos, 210, 18, 3).fill('#CCCCCC');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('TOTAL PENDIENTE USD', xLabel + 10, yPos + 5);
        
        doc.roundedRect(xValue - 10, yPos, 120, 18, 3).stroke('#CCCCCC');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`$ ${fmtNum(totalSaldoUSD)}`, xValue, yPos + 5, { align: 'right', width: 100 });
      }

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Reporte generado por sistema - INDPACK S.A.C.', 30, 560, { align: 'center', width: 782 });

      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}