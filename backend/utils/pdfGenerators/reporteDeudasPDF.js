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
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2
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
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold');
          doc.text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold');
        doc.text('IndPack', 60, 55);
      }

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, 110);
      
      doc.fontSize(8).font('Helvetica');
      doc.text(EMPRESA.direccion, 50, 123, { width: 250 });
      doc.text(`${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 148);
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 160);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 172);
      doc.text(`Web: ${EMPRESA.web}`, 50, 184);

      doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      if (isCliente && clienteData) {
        doc.text(`R.U.C. ${clienteData.ruc}`, 385, 48, { align: 'center', width: 155 });
      } else {
        doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      }
      
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(isCliente ? 'ESTADO DE CUENTA' : 'REPORTE DE DEUDAS', 385, 65, { align: 'center', width: 155 });
      
      doc.fontSize(10).font('Helvetica-Bold');
      const fechaHoy = new Date().toLocaleDateString('es-PE');
      doc.text(fechaHoy, 385, 83, { align: 'center', width: 155 });

      const alturaRecuadroInfo = 85;
      doc.roundedRect(33, 195, 529, alturaRecuadroInfo, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');

      if (isCliente && clienteData) {
        doc.text('Cliente:', 40, 203);
        doc.font('Helvetica');
        doc.text(clienteData.cliente || '', 100, 203, { width: 230 });
        
        doc.font('Helvetica-Bold');
        doc.text('RUC:', 40, 218);
        doc.font('Helvetica');
        doc.text(clienteData.ruc || '', 100, 218);
        
        doc.font('Helvetica-Bold');
        doc.text('Dirección:', 40, 233);
        doc.font('Helvetica');
        const direccion = clienteData.direccion || 'Sin dirección registrada';
        doc.text(direccion, 100, 233, { width: 230, lineGap: 2 });

        doc.font('Helvetica-Bold');
        doc.text('Teléfono:', 360, 203);
        doc.font('Helvetica');
        doc.text(clienteData.telefono || '-', 450, 203);

        doc.font('Helvetica-Bold');
        doc.text('Email:', 360, 218);
        doc.font('Helvetica');
        doc.text(clienteData.email || '-', 450, 218, { width: 100 });

      } else {
        doc.text('Reporte:', 40, 203);
        doc.font('Helvetica');
        doc.text('General de Cuentas por Cobrar', 100, 203);

        doc.font('Helvetica-Bold');
        doc.text('Filtro Fecha:', 40, 218);
        doc.font('Helvetica');
        const rango = (filtros.fecha_inicio && filtros.fecha_fin) 
          ? `Del ${formatearFecha(filtros.fecha_inicio)} al ${formatearFecha(filtros.fecha_fin)}` 
          : 'Histórico Completo';
        doc.text(rango, 100, 218);

        doc.font('Helvetica-Bold');
        doc.text('Total Registros:', 360, 203);
        doc.font('Helvetica');
        doc.text(deudas.length.toString(), 450, 203);
      }

      let yPos = 300;

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
        doc.rect(33, y, 529, 20).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('DOCUMENTO', 40, y + 6);
        doc.text('EMISIÓN', 110, y + 6);
        doc.text('VENCIMIENTO', 170, y + 6);
        doc.text('ESTADO', 230, y + 6);
        
        if (!isCliente) {
          doc.text('CLIENTE', 290, y + 6, { width: 100, ellipsis: true });
        }

        doc.text('MON', isCliente ? 300 : 400, y + 6);
        doc.text('TOTAL', isCliente ? 340 : 430, y + 6, { align: 'right', width: 60 });
        doc.text('A CTA.', isCliente ? 410 : 490, y + 6, { align: 'right', width: 50 });
        doc.text('SALDO', isCliente ? 470 : 540, y + 6, { align: 'right', width: 50 });
      };

      grupos.forEach(grupo => {
        if (grupo.datos.length === 0) return;

        if (yPos + 40 > 700) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(10).font('Helvetica-Bold').fillColor(grupo.colorTitulo);
        doc.text(grupo.titulo, 33, yPos);
        yPos += 15;

        dibujarCabeceraTabla(yPos);
        yPos += 20;

        grupo.datos.forEach((item, idx) => {
          const descripcionCliente = item.cliente || '';
          const anchoCliente = 100;
          
          const alturaCliente = !isCliente ? calcularAlturaTexto(doc, descripcionCliente, anchoCliente, 8) : 0;
          const alturaFila = Math.max(20, alturaCliente + 10);

          if (yPos + alturaFila > 700) {
            doc.addPage();
            yPos = 50;
            dibujarCabeceraTabla(yPos);
            yPos += 20;
          }

          if (idx % 2 === 0) doc.rect(33, yPos, 529, alturaFila).fillOpacity(0.1).fill('#f0f0f0').fillOpacity(1);

          doc.fontSize(8).font('Helvetica').fillColor('#000000');
          
          doc.text(item.numero_orden, 40, yPos + 5);
          doc.text(formatearFecha(item.fecha_emision), 110, yPos + 5);
          doc.text(formatearFecha(item.fecha_vencimiento), 170, yPos + 5);
          
          let colorEstado = '#000000';
          if (item.estado_deuda === 'Vencido') colorEstado = '#CC0000';
          if (item.estado_deuda === 'Próximo a Vencer') colorEstado = '#E65100';
          
          doc.fillColor(colorEstado).text(item.estado_deuda, 230, yPos + 5);
          doc.fillColor('#000000');

          if (!isCliente) {
            doc.text(descripcionCliente, 290, yPos + 5, { width: anchoCliente, lineGap: 2 });
          }

          doc.text(item.moneda, isCliente ? 300 : 400, yPos + 5);
          doc.text(fmtNum(item.total), isCliente ? 340 : 430, yPos + 5, { align: 'right', width: 60 });
          doc.text(fmtNum(item.monto_pagado), isCliente ? 410 : 490, yPos + 5, { align: 'right', width: 50 });
          doc.font('Helvetica-Bold').text(fmtNum(item.saldo_pendiente), isCliente ? 470 : 540, yPos + 5, { align: 'right', width: 50 });

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

      if (yPos + 60 > 700) {
        doc.addPage();
        yPos = 50;
      }

      if (totalSaldoPEN > 0) {
        doc.roundedRect(300, yPos, 140, 15, 3).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('TOTAL PENDIENTE PEN', 305, yPos + 4);
        
        doc.roundedRect(445, yPos, 117, 15, 3).stroke('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`S/ ${fmtNum(totalSaldoPEN)}`, 450, yPos + 4, { align: 'right', width: 105 });
        yPos += 20;
      }

      if (totalSaldoUSD > 0) {
        doc.roundedRect(300, yPos, 140, 15, 3).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('TOTAL PENDIENTE USD', 305, yPos + 4);
        
        doc.roundedRect(445, yPos, 117, 15, 3).stroke('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`$ ${fmtNum(totalSaldoUSD)}`, 450, yPos + 4, { align: 'right', width: 105 });
      }

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Reporte generado por sistema - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}