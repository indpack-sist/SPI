import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function descargarImagen(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

export async function generarCotizacionPDF(cotizacion) {
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
        console.error('Error al descargar logo, usando fallback:', error);
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
      doc.text('COTIZACION', 385, 65, { align: 'center', width: 155 });
      
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${cotizacion.numero_cotizacion}`, 385, 83, { align: 'center', width: 155 });

      const direccionCliente = cotizacion.direccion_entrega || 
                               cotizacion.direccion_despacho || 
                               cotizacion.direccion_cliente || 
                               '';
      
      const alturaDireccion = calcularAlturaTexto(doc, direccionCliente, 230, 8);
      const alturaRecuadroCliente = Math.max(75, alturaDireccion + 60);
      
      doc.roundedRect(33, 195, 529, alturaRecuadroCliente, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Cliente:', 40, 203);
      doc.font('Helvetica');
      doc.text(cotizacion.cliente || '', 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, 218);
      doc.font('Helvetica');
      doc.text(cotizacion.ruc_cliente || '', 100, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Dirección:', 40, 233);
      doc.font('Helvetica');
      doc.text(direccionCliente, 100, 233, { width: 230, lineGap: 2 });
      
      const yPosicionCiudad = 233 + alturaDireccion + 10;
      
      doc.font('Helvetica-Bold');
      doc.text('Ciudad:', 40, yPosicionCiudad);
      doc.font('Helvetica');
      doc.text(cotizacion.ciudad_entrega || 'Lima - Perú', 100, yPosicionCiudad);

      doc.font('Helvetica-Bold');
      doc.text('Moneda:', 360, 203);
      doc.font('Helvetica');
      doc.text(cotizacion.moneda === 'USD' ? 'USD' : 'PEN', 450, 203);
      
      doc.font('Helvetica-Bold');
      doc.text('Plazo de pago:', 360, 218);
      doc.font('Helvetica');
      doc.text(cotizacion.plazo_pago || '', 450, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Forma de pago:', 360, 233);
      doc.font('Helvetica');
      doc.text(cotizacion.forma_pago || '', 450, 233);
      
      doc.font('Helvetica-Bold');
      doc.text('Orden de Compra', 360, 248);
      doc.font('Helvetica');
      doc.text(cotizacion.orden_compra_cliente || '', 450, 248);

      const yPosRecuadroFechas = 195 + alturaRecuadroCliente + 8;
      
      doc.roundedRect(33, yPosRecuadroFechas, 529, 40, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha de Pedido:', 40, yPosRecuadroFechas + 10, { align: 'center', width: 260 });
      doc.font('Helvetica');
      const fechaEmision = new Date(cotizacion.fecha_emision).toLocaleDateString('es-PE');
      doc.text(fechaEmision, 40, yPosRecuadroFechas + 25, { align: 'center', width: 260 });

      doc.font('Helvetica-Bold');
      doc.text('Comercial:', 310, yPosRecuadroFechas + 10, { align: 'center', width: 252 });
      doc.font('Helvetica');
      doc.text(cotizacion.comercial || '', 310, yPosRecuadroFechas + 20, { align: 'center', width: 252 });
      doc.text(cotizacion.email_comercial || '', 310, yPosRecuadroFechas + 30, { align: 'center', width: 252 });

      let yPos = yPosRecuadroFechas + 52;

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('CANT.', 130, yPos + 6, { width: 50, align: 'center' });
      doc.text('UNID.', 185, yPos + 6, { width: 40, align: 'center' });
      doc.text('DESCRIPCIÓN', 230, yPos + 6);
      doc.text('V. UNIT.', 450, yPos + 6, { align: 'right', width: 50 });
      doc.text('V. VENTA', 505, yPos + 6, { align: 'right', width: 50 });

      yPos += 20;

      const simboloMoneda = cotizacion.moneda === 'USD' ? '$' : 'S/';
      
      cotizacion.detalle.forEach((item, idx) => {
        const cantidad = parseFloat(item.cantidad).toFixed(5);
        const precioUnitario = parseFloat(item.precio_unitario).toFixed(2);
        const valorVenta = parseFloat(item.valor_venta || item.subtotal).toFixed(2);
        
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
          doc.text('V. UNIT.', 450, yPos + 6, { align: 'right', width: 50 });
          doc.text('V. VENTA', 505, yPos + 6, { align: 'right', width: 50 });
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        doc.text(item.codigo_producto, 40, yPos + 5);
        doc.text(cantidad, 130, yPos + 5, { width: 50, align: 'center' });
        doc.text(item.unidad_medida, 185, yPos + 5, { width: 40, align: 'center' });
        doc.text(descripcion, 230, yPos + 5, { width: 215, lineGap: 2 });
        doc.text(precioUnitario, 450, yPos + 5, { align: 'right', width: 50 });
        doc.text(`${simboloMoneda} ${valorVenta}`, 505, yPos + 5, { align: 'right', width: 50 });

        yPos += alturaFila;
      });

      yPos += 10;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('OBSERVACIONES', 40, yPos);
      
      doc.fontSize(8).font('Helvetica');
      if (cotizacion.observaciones) {
        doc.text(cotizacion.observaciones, 40, yPos + 15, { width: 330 });
      }

      const subtotal = parseFloat(cotizacion.subtotal).toFixed(2);
      const igv = parseFloat(cotizacion.igv).toFixed(2);
      const total = parseFloat(cotizacion.total).toFixed(2);

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('SUB TOTAL', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      doc.text(`${simboloMoneda} ${subtotal}`, 475, yPos + 4, { align: 'right', width: 80 });

      yPos += 20;

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('IGV', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      doc.text(`${simboloMoneda} ${igv}`, 475, yPos + 4, { align: 'right', width: 80 });

      yPos += 20;

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${simboloMoneda} ${total}`, 475, yPos + 4, { align: 'right', width: 80 });

      yPos += 25;

      doc.fontSize(8).font('Helvetica');
      const totalEnLetras = numeroALetras(parseFloat(total), cotizacion.moneda);
      doc.text(`SON: ${totalEnLetras}`, 40, yPos, { width: 522, align: 'left' });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Page: 1 / 1', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

function generarCabeceraComun(doc, logoBuffer, titulo, numero) {
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
  const direccionEmpresa = 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA, Villa el Salvador, Lima - Lima (PE) - Perú';
  doc.text(direccionEmpresa, 50, 123, { width: 250 });
  doc.text('Teléfono: 01- 312 7858', 50, 148);
  doc.text('E-mail: informes@indpackperu.com', 50, 160);
  doc.text('Web: https://www.indpackperu.com/', 50, 172);

  doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
  
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
  doc.text('R.U.C. 20550932297', 385, 48, { align: 'center', width: 155 });
  
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(titulo, 385, 65, { align: 'center', width: 155 });
  
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text(`No. ${numero}`, 385, 83, { align: 'center', width: 155 });
}

export async function generarPDFEntrada(datos) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}
      
      generarCabeceraComun(doc, logoBuffer, 'ENTRADA ALMACEN', datos.id_entrada || 'N/A');

      doc.roundedRect(33, 195, 529, 85, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Proveedor:', 40, 203);
      doc.font('Helvetica');
      doc.text(datos.proveedor || '', 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('Doc. Soporte:', 40, 218);
      doc.font('Helvetica');
      doc.text(datos.documento_soporte || 'N/A', 100, 218);

      doc.font('Helvetica-Bold');
      doc.text('Tipo Inv:', 40, 233);
      doc.font('Helvetica');
      doc.text(datos.tipo_inventario || '', 100, 233);

      doc.font('Helvetica-Bold');
      doc.text('Fecha:', 360, 203);
      doc.font('Helvetica');
      doc.text(new Date(datos.fecha_movimiento).toLocaleDateString('es-PE'), 450, 203);

      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 218);
      doc.font('Helvetica');
      doc.text(datos.estado || '', 450, 218);

      doc.font('Helvetica-Bold');
      doc.text('Registrado por:', 360, 233);
      doc.font('Helvetica');
      doc.text(datos.registrado_por || '', 450, 233);

      let yPos = 290;
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('PRODUCTO', 140, yPos + 6);
      doc.text('CANTIDAD', 350, yPos + 6);
      doc.text('COSTO U.', 420, yPos + 6);
      doc.text('SUBTOTAL', 490, yPos + 6, { align: 'right' });
      yPos += 20;

      const detalles = datos.detalles || [];
      const simboloMoneda = datos.moneda === 'USD' ? '$' : 'S/';

      detalles.forEach((det) => {
        const nombreProducto = (det.producto || '').substring(0, 40);
        const alturaTexto = calcularAlturaTexto(doc, nombreProducto, 200, 8);
        const alturaFila = Math.max(20, alturaTexto + 10);
        
        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text(det.codigo_producto || '', 40, yPos + 5);
        doc.text(nombreProducto, 140, yPos + 5, { width: 200 });
        doc.text(`${parseFloat(det.cantidad).toFixed(2)} ${det.unidad_medida || ''}`, 350, yPos + 5);
        doc.text(`${simboloMoneda} ${parseFloat(det.costo_unitario).toFixed(2)}`, 420, yPos + 5);
        const sub = (det.cantidad || 0) * (det.costo_unitario || 0);
        doc.text(`${simboloMoneda} ${sub.toFixed(2)}`, 490, yPos + 5, { align: 'right' });
        yPos += alturaFila;
      });

      yPos += 15;
      const totalCosto = datos.total_costo || detalles.reduce((sum, d) => sum + ((d.costo_unitario || 0) * (d.cantidad || 0)), 0);
      
      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${simboloMoneda} ${totalCosto.toFixed(2)}`, 475, yPos + 4, { align: 'right', width: 80 });

      if (datos.observaciones) {
        yPos += 30;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES:', 40, yPos);
        doc.font('Helvetica').text(datos.observaciones, 40, yPos + 15);
      }

      doc.end();
    } catch (error) { reject(error); }
  });
}

export async function generarPDFSalida(datos) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}

      generarCabeceraComun(doc, logoBuffer, 'SALIDA ALMACEN', datos.codigo || datos.id_salida || 'N/A');

      doc.roundedRect(33, 195, 529, 85, 3).stroke('#000000');
      
      const destino = datos.tipo_movimiento === 'Venta' ? datos.cliente : (datos.departamento || datos.tipo_movimiento);
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Destino/Cliente:', 40, 203);
      doc.font('Helvetica');
      doc.text(destino || '', 110, 203, { width: 220 });
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo Mov:', 40, 218);
      doc.font('Helvetica');
      doc.text(datos.tipo_movimiento || '', 110, 218);

      doc.font('Helvetica-Bold');
      doc.text('Referencia:', 40, 233);
      doc.font('Helvetica');
      doc.text(datos.vehiculo || '---', 110, 233);

      doc.font('Helvetica-Bold');
      doc.text('Fecha:', 360, 203);
      doc.font('Helvetica');
      doc.text(new Date(datos.fecha_movimiento).toLocaleDateString('es-PE'), 450, 203);

      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 218);
      doc.font('Helvetica');
      doc.text(datos.estado || '', 450, 218);

      let yPos = 290;
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('DESCRIPCIÓN', 140, yPos + 6);
      doc.text('CANTIDAD', 420, yPos + 6, { width: 60, align: 'center' });
      doc.text('UNIDAD', 485, yPos + 6, { width: 50, align: 'center' });
      yPos += 20;

      const detalles = datos.detalles || [];
      detalles.forEach((det) => {
        const descProducto = (det.producto || '').substring(0, 50);
        const alturaTexto = calcularAlturaTexto(doc, descProducto, 270, 8);
        const alturaFila = Math.max(20, alturaTexto + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text((det.codigo_producto || '').substring(0, 15), 40, yPos + 5);
        doc.text(descProducto, 140, yPos + 5, { width: 270 });
        doc.text(parseFloat(det.cantidad || 0).toFixed(2), 420, yPos + 5, { width: 60, align: 'center' });
        doc.text(det.unidad_medida || '', 485, yPos + 5, { width: 50, align: 'center' });
        yPos += alturaFila;
      });

      if (datos.observaciones) {
        yPos += 20;
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES:', 40, yPos);
        doc.font('Helvetica').text(datos.observaciones, 40, yPos + 15);
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generarPDFTransferencia(datos) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}

      generarCabeceraComun(doc, logoBuffer, 'TRANSFERENCIA', datos.id_transferencia_cabecera || 'N/A');

      doc.roundedRect(33, 195, 529, 85, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Origen:', 40, 203);
      doc.font('Helvetica').text(datos.tipo_inventario_origen || '', 110, 203);
      
      doc.font('Helvetica-Bold').text('Destino:', 40, 218);
      doc.font('Helvetica').text(datos.tipo_inventario_destino || '', 110, 218);

      doc.font('Helvetica-Bold').text('Fecha:', 360, 203);
      doc.font('Helvetica').text(new Date(datos.fecha_transferencia).toLocaleDateString('es-PE'), 450, 203);

      doc.font('Helvetica-Bold').text('Estado:', 360, 218);
      doc.font('Helvetica').text(datos.estado || '', 450, 218);

      let yPos = 290;
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓD. ORIGEN', 40, yPos + 6);
      doc.text('PRODUCTO', 140, yPos + 6);
      doc.text('CÓD. DESTINO', 320, yPos + 6);
      doc.text('CANTIDAD', 410, yPos + 6);
      yPos += 20;

      const detalles = datos.detalles || [];
      detalles.forEach((det) => {
        const nombreProducto = (det.producto_nombre || det.producto || '').substring(0, 35);
        const alturaTexto = calcularAlturaTexto(doc, nombreProducto, 170, 8);
        const alturaFila = Math.max(20, alturaTexto + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text((det.codigo_origen || det.codigo_producto || '').substring(0, 15), 40, yPos + 5);
        doc.text(nombreProducto, 140, yPos + 5, { width: 170 });
        doc.text((det.codigo_destino || 'Auto').substring(0, 15), 320, yPos + 5);
        doc.text(`${parseFloat(det.cantidad).toFixed(2)} ${det.unidad_medida || ''}`, 410, yPos + 5);
        yPos += alturaFila;
      });

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generarPDFOrdenProduccion(datos, consumoMateriales = []) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}

      generarCabeceraComun(doc, logoBuffer, 'ORDEN PRODUCCION', datos.numero_orden || 'N/A');

      doc.roundedRect(33, 195, 529, 85, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Producto:', 40, 203);
      doc.font('Helvetica').text(datos.producto || '', 100, 203, { width: 220 });
      
      doc.font('Helvetica-Bold').text('Código:', 40, 218);
      doc.font('Helvetica').text(datos.codigo_producto || '', 100, 218);

      doc.font('Helvetica-Bold').text('Planificado:', 40, 233);
      doc.font('Helvetica').text(`${datos.cantidad_planificada} ${datos.unidad_medida}`, 100, 233);

      doc.font('Helvetica-Bold').text('Fecha:', 360, 203);
      doc.font('Helvetica').text(new Date(datos.fecha_creacion).toLocaleDateString('es-PE'), 450, 203);

      doc.font('Helvetica-Bold').text('Estado:', 360, 218);
      doc.font('Helvetica').text(datos.estado || '', 450, 218);

      let yPos = 290;
      doc.fontSize(10).font('Helvetica-Bold').text('MATERIALES CONSUMIDOS', 40, yPos - 15);

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('INSUMO', 60, yPos + 6);
      doc.text('CANTIDAD', 350, yPos + 6);
      doc.text('COSTO UNIT.', 420, yPos + 6);
      doc.text('SUBTOTAL', 490, yPos + 6, { align: 'right' });
      yPos += 20;

      consumoMateriales.forEach((mat) => {
        const nombreInsumo = (mat.insumo || '').substring(0, 50);
        const alturaTexto = calcularAlturaTexto(doc, nombreInsumo, 280, 8);
        const alturaFila = Math.max(20, alturaTexto + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text(nombreInsumo, 60, yPos + 5, { width: 280 });
        doc.text(`${mat.cantidad_requerida} ${mat.unidad_medida || ''}`, 350, yPos + 5);
        doc.text(parseFloat(mat.costo_unitario).toFixed(2), 420, yPos + 5);
        doc.text(parseFloat(mat.costo_total).toFixed(2), 490, yPos + 5, { align: 'right' });
        yPos += alturaFila;
      });

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generarPDFOrdenVenta(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}

      generarCabeceraComun(doc, logoBuffer, 'ORDEN DE VENTA', orden.numero_orden || 'N/A');

      const direccion = orden.direccion_entrega || orden.direccion_cliente || '';
      const alturaDireccion = calcularAlturaTexto(doc, direccion, 230, 8);
      const alturaRecuadro = Math.max(75, alturaDireccion + 60);

      doc.roundedRect(33, 195, 529, alturaRecuadro, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Cliente:', 40, 203);
      doc.font('Helvetica').text(orden.cliente || '', 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold').text('RUC:', 40, 218);
      doc.font('Helvetica').text(orden.ruc_cliente || '', 100, 218);
      
      doc.font('Helvetica-Bold').text('Dirección:', 40, 233);
      doc.font('Helvetica').text(direccion, 100, 233, { width: 230 });

      doc.font('Helvetica-Bold').text('Moneda:', 360, 203);
      doc.font('Helvetica').text(orden.moneda || 'PEN', 450, 203);
      
      doc.font('Helvetica-Bold').text('Fecha:', 360, 218);
      doc.font('Helvetica').text(new Date(orden.fecha_emision).toLocaleDateString('es-PE'), 450, 218);

      let yPos = 195 + alturaRecuadro + 15;
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('ITEM', 40, yPos + 6);
      doc.text('DESCRIPCIÓN', 100, yPos + 6);
      doc.text('CANT.', 350, yPos + 6);
      doc.text('P.U.', 420, yPos + 6);
      doc.text('TOTAL', 490, yPos + 6, { align: 'right' });
      yPos += 20;

      const monedaSimbolo = orden.moneda === 'USD' ? '$' : 'S/';
      
      orden.detalle.forEach((item, idx) => {
        const desc = item.producto || '';
        const alturaTexto = calcularAlturaTexto(doc, desc, 240, 8);
        const alturaFila = Math.max(20, alturaTexto + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text((idx + 1).toString(), 40, yPos + 5);
        doc.text(desc, 100, yPos + 5, { width: 240 });
        doc.text(parseFloat(item.cantidad).toFixed(2), 350, yPos + 5);
        doc.text(parseFloat(item.precio_unitario).toFixed(2), 420, yPos + 5);
        const totalLinea = item.valor_venta || (item.cantidad * item.precio_unitario);
        doc.text(`${monedaSimbolo} ${parseFloat(totalLinea).toFixed(2)}`, 490, yPos + 5, { align: 'right' });
        yPos += alturaFila;
      });

      yPos += 15;
      const total = parseFloat(orden.total).toFixed(2);
      
      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL', 390, yPos + 4);
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${monedaSimbolo} ${total}`, 475, yPos + 4, { align: 'right', width: 80 });

      yPos += 25;
      doc.fontSize(8).font('Helvetica');
      doc.text(`SON: ${numeroALetras(parseFloat(total), orden.moneda)}`, 40, yPos);

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generarPDFGuiaRemision(guia) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}

      generarCabeceraComun(doc, logoBuffer, 'GUIA REMISION', guia.numero_guia || 'N/A');

      doc.roundedRect(33, 195, 529, 90, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Destinatario:', 40, 203);
      doc.font('Helvetica').text(guia.cliente || '', 110, 203, { width: 220 });
      doc.font('Helvetica-Bold').text('RUC:', 40, 218);
      doc.font('Helvetica').text(guia.ruc_cliente || '', 110, 218);
      
      doc.font('Helvetica-Bold').text('Punto Partida:', 40, 233);
      doc.font('Helvetica').text(guia.direccion_partida || '', 110, 233, { width: 220 });
      
      doc.font('Helvetica-Bold').text('Punto Llegada:', 40, 258);
      doc.font('Helvetica').text(guia.direccion_llegada || '', 110, 258, { width: 220 });

      doc.font('Helvetica-Bold').text('Fecha:', 360, 203);
      doc.font('Helvetica').text(new Date(guia.fecha_emision).toLocaleDateString('es-PE'), 450, 203);
      doc.font('Helvetica-Bold').text('Motivo:', 360, 218);
      doc.font('Helvetica').text(guia.motivo_traslado || '', 450, 218);
      doc.font('Helvetica-Bold').text('Peso Bruto:', 360, 233);
      doc.font('Helvetica').text(`${guia.peso_bruto_kg} kg`, 450, 233);

      let yPos = 300;
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('DESCRIPCIÓN', 130, yPos + 6);
      doc.text('UNIDAD', 350, yPos + 6);
      doc.text('CANTIDAD', 420, yPos + 6);
      doc.text('PESO', 490, yPos + 6);
      yPos += 20;

      guia.detalle.forEach((item) => {
        const desc = item.producto || '';
        const alturaTexto = calcularAlturaTexto(doc, desc, 200, 8);
        const alturaFila = Math.max(20, alturaTexto + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text(item.codigo_producto || '', 40, yPos + 5);
        doc.text(desc, 130, yPos + 5, { width: 200 });
        doc.text(item.unidad_medida, 350, yPos + 5);
        doc.text(parseFloat(item.cantidad).toFixed(2), 420, yPos + 5);
        doc.text(`${parseFloat(item.peso_total_kg || 0).toFixed(2)} kg`, 490, yPos + 5);
        yPos += alturaFila;
      });

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generarPDFGuiaTransportista(guia) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}

      generarCabeceraComun(doc, logoBuffer, 'GUIA TRANSPORTISTA', guia.numero_guia || 'N/A');

      doc.roundedRect(33, 195, 529, 110, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Transportista:', 40, 203);
      doc.font('Helvetica').text(guia.razon_social_transportista || '', 110, 203, { width: 220 });
      doc.font('Helvetica-Bold').text('RUC Trans:', 40, 218);
      doc.font('Helvetica').text(guia.ruc_transportista || '', 110, 218);
      
      doc.font('Helvetica-Bold').text('Conductor:', 40, 233);
      doc.font('Helvetica').text(guia.nombre_conductor || '', 110, 233);
      doc.font('Helvetica-Bold').text('Licencia:', 40, 248);
      doc.font('Helvetica').text(guia.licencia_conducir || '', 110, 248);

      doc.font('Helvetica-Bold').text('Vehículo Placa:', 360, 203);
      doc.font('Helvetica').text(guia.placa_vehiculo || '', 450, 203);
      doc.font('Helvetica-Bold').text('Marca/Modelo:', 360, 218);
      doc.font('Helvetica').text(`${guia.marca_vehiculo || ''} ${guia.modelo_vehiculo || ''}`, 450, 218);
      
      doc.font('Helvetica-Bold').text('Partida:', 40, 268);
      doc.font('Helvetica').text(guia.direccion_partida || '', 110, 268, { width: 220 });
      doc.font('Helvetica-Bold').text('Llegada:', 40, 288);
      doc.font('Helvetica').text(guia.direccion_llegada || '', 110, 288, { width: 220 });

      let yPos = 320;
      if (guia.observaciones) {
         doc.fontSize(8).font('Helvetica-Bold').text('OBSERVACIONES:', 40, yPos);
         doc.font('Helvetica').text(guia.observaciones, 130, yPos);
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}

export async function generarPDFOrdenCompra(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer;
      try { logoBuffer = await descargarImagen('https://indpackperu.com/images/logohorizontal.png'); } catch (e) {}

      generarCabeceraComun(doc, logoBuffer, 'ORDEN DE COMPRA', orden.numero_orden || 'N/A');

      const direccion = orden.direccion_proveedor || '';
      const alturaDireccion = calcularAlturaTexto(doc, direccion, 230, 8);
      const alturaRecuadro = Math.max(75, alturaDireccion + 60);

      doc.roundedRect(33, 195, 529, alturaRecuadro, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Proveedor:', 40, 203);
      doc.font('Helvetica').text(orden.proveedor || '', 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold').text('RUC:', 40, 218);
      doc.font('Helvetica').text(orden.ruc_proveedor || '', 100, 218);
      
      doc.font('Helvetica-Bold').text('Dirección:', 40, 233);
      doc.font('Helvetica').text(direccion, 100, 233, { width: 230 });

      doc.font('Helvetica-Bold').text('Moneda:', 360, 203);
      doc.font('Helvetica').text(orden.moneda || 'PEN', 450, 203);
      doc.font('Helvetica-Bold').text('Cond. Pago:', 360, 218);
      doc.font('Helvetica').text(orden.condicion_pago || '', 450, 218);
      doc.font('Helvetica-Bold').text('Fecha:', 360, 233);
      doc.font('Helvetica').text(new Date(orden.fecha_pedido).toLocaleDateString('es-PE'), 450, 233);

      let yPos = 195 + alturaRecuadro + 15;
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('PRODUCTO', 130, yPos + 6);
      doc.text('CANT.', 350, yPos + 6);
      doc.text('V. UNIT.', 420, yPos + 6);
      doc.text('TOTAL', 490, yPos + 6, { align: 'right' });
      yPos += 20;

      const monedaSimbolo = orden.moneda === 'USD' ? '$' : 'S/';

      orden.detalle.forEach((item) => {
        const desc = item.producto || '';
        const alturaTexto = calcularAlturaTexto(doc, desc, 200, 8);
        const alturaFila = Math.max(20, alturaTexto + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text(item.codigo_producto || '', 40, yPos + 5);
        doc.text(desc, 130, yPos + 5, { width: 200 });
        doc.text(parseFloat(item.cantidad).toFixed(2), 350, yPos + 5);
        doc.text(parseFloat(item.valor_unitario).toFixed(2), 420, yPos + 5);
        doc.text(`${monedaSimbolo} ${parseFloat(item.valor_compra).toFixed(2)}`, 490, yPos + 5, { align: 'right' });
        yPos += alturaFila;
      });

      yPos += 15;
      const total = parseFloat(orden.total).toFixed(2);
      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL', 390, yPos + 4);
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${monedaSimbolo} ${total}`, 475, yPos + 4, { align: 'right', width: 80 });

      yPos += 25;
      doc.fontSize(8).font('Helvetica');
      doc.text(`SON: ${numeroALetras(parseFloat(total), orden.moneda)}`, 40, yPos);

      doc.end();
    } catch (e) { reject(e); }
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