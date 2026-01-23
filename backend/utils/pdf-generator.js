import PDFDocument from 'pdfkit';
import axios from 'axios';

const EMPRESA = {
  ruc: '20550932297',
  razon_social: 'INDPACK S.A.C.',
  web: 'https://www.indpackperu.com',
  direccion: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA',
  distrito: 'Villa el Salvador',
  departamento: 'Lima',
  pais: 'Perú',
  telefono: '01- 312 7858',
  email: 'informes@indpackperu.com'
};

const TIMEZONE = 'America/Lima';

async function cargarLogoURL() {
  try {
    const response = await axios.get('https://indpackperu.com/images/logohorizontal.png', {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.warn('No se pudo cargar el logo:', error.message);
    return null;
  }
}

function formatearFecha(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  // Validar fecha inválida
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatearHora(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return 'N/A';

  return date.toLocaleTimeString('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatearFechaHora(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return 'N/A';

  const fechaStr = date.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const horaStr = date.toLocaleTimeString('en-US', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return `${fechaStr} ${horaStr}`;
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

export async function generarPDFEntrada(datos) {
  const logoBuffer = await cargarLogoURL();

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

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          console.error('Error al insertar logo:', error);
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
      doc.text(EMPRESA.direccion, 50, 123, { width: 250 });
      doc.text(`${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 148);
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 160);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 172);
      doc.text(`Web: ${EMPRESA.web}`, 50, 184);

      doc.roundedRect(380, 40, 165, 75, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('COMPROBANTE DE', 385, 65, { align: 'center', width: 155 });
      doc.text('ENTRADA', 385, 78, { align: 'center', width: 155 });
      
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`No. ${datos.id_entrada || 'N/A'}`, 385, 95, { align: 'center', width: 155 });

      const alturaInfoProveedor = 90;
      doc.roundedRect(33, 205, 529, alturaInfoProveedor, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, 213);
      doc.font('Helvetica');
      doc.text(formatearFecha(datos.fecha_movimiento), 100, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo Inventario:', 40, 228);
      doc.font('Helvetica');
      doc.text(datos.tipo_inventario || 'N/A', 140, 228, { width: 190 });
      
      doc.font('Helvetica-Bold');
      doc.text('Proveedor:', 40, 243);
      doc.font('Helvetica');
      doc.text(datos.proveedor || 'N/A', 100, 243, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('Doc. Soporte:', 40, 258);
      doc.font('Helvetica');
      doc.text(datos.documento_soporte || 'N/A', 110, 258, { width: 220 });

      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 213);
      doc.font('Helvetica');
      doc.text(datos.estado || 'N/A', 410, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Moneda:', 360, 228);
      doc.font('Helvetica');
      doc.text(datos.moneda || 'PEN', 410, 228);
      
      doc.font('Helvetica-Bold');
      doc.text('Registrado por:', 360, 243);
      doc.font('Helvetica');
      doc.text(datos.registrado_por || 'N/A', 360, 258, { width: 195 });

      let yPos = 305;

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('CANT.', 130, yPos + 6, { width: 50, align: 'center' });
      doc.text('UNID.', 185, yPos + 6, { width: 40, align: 'center' });
      doc.text('DESCRIPCIÓN', 230, yPos + 6);
      doc.text('C. UNIT.', 450, yPos + 6, { align: 'right', width: 50 });
      doc.text('SUBTOTAL', 505, yPos + 6, { align: 'right', width: 50 });

      yPos += 20;

      const simboloMoneda = datos.moneda === 'USD' ? '$' : 'S/';
      const detalles = datos.detalles || [];
      
      detalles.forEach((item, idx) => {
        const cantidad = parseFloat(item.cantidad).toFixed(2);
        const costoUnitario = parseFloat(item.costo_unitario).toFixed(2);
        const subtotal = parseFloat((item.cantidad || 0) * (item.costo_unitario || 0)).toFixed(2);
        
        const descripcion = item.producto;
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
          doc.text('C. UNIT.', 450, yPos + 6, { align: 'right', width: 50 });
          doc.text('SUBTOTAL', 505, yPos + 6, { align: 'right', width: 50 });
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        doc.text(item.codigo_producto, 40, yPos + 5);
        doc.text(cantidad, 130, yPos + 5, { width: 50, align: 'center' });
        doc.text(item.unidad_medida, 185, yPos + 5, { width: 40, align: 'center' });
        doc.text(descripcion, 230, yPos + 5, { width: 215, lineGap: 2 });
        doc.text(costoUnitario, 450, yPos + 5, { align: 'right', width: 50 });
        doc.text(`${simboloMoneda} ${subtotal}`, 505, yPos + 5, { align: 'right', width: 50 });

        yPos += alturaFila;
      });

      yPos += 10;

      if (datos.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 40, yPos + 15, { width: 330 });
      }

      const totalCosto = parseFloat(datos.total_costo || detalles.reduce((sum, d) => sum + ((d.costo_unitario || 0) * (d.cantidad || 0)), 0)).toFixed(2);

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('COSTO TOTAL', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${simboloMoneda} ${totalCosto}`, 475, yPos + 4, { align: 'right', width: 80 });

      yPos += 25;

      doc.fontSize(8).font('Helvetica');
      const totalEnLetras = numeroALetras(parseFloat(totalCosto), datos.moneda);
      doc.text(`SON: ${totalEnLetras}`, 40, yPos, { width: 522, align: 'left' });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Comprobante de registro de entrada de inventario - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFSalida(datos) {
  const logoBuffer = await cargarLogoURL();

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

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
      }

      const EMPRESA = {
          direccion: 'AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA',
          distrito: 'Villa el Salvador',
          departamento: 'Lima',
          pais: 'Perú',
          telefono: '01- 312 7858',
          email: 'informes@indpackperu.com',
          web: 'https://www.indpackperu.com/',
          ruc: '20550932297'
      };

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, 110);
      
      doc.fontSize(8).font('Helvetica');
      doc.text(EMPRESA.direccion, 50, 123, { width: 250 });
      doc.text(`${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 148);
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 160);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 172);
      doc.text(`Web: ${EMPRESA.web}`, 50, 184);

      doc.roundedRect(380, 40, 165, 75, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      
      const tituloDoc = datos.historial_despachos ? 'REPORTE DE ORDEN' : 'CONSTANCIA DE SALIDA';
      doc.text(tituloDoc, 385, 65, { align: 'center', width: 155 });
      
      doc.fontSize(14).fillColor('#cc0000'); 
      doc.text(`No. ${datos.numero_orden || datos.codigo || datos.id_salida || 'N/A'}`, 385, 90, { align: 'center', width: 155 });

      const destino = datos.tipo_movimiento === 'Venta' 
        ? (datos.cliente || datos.destinatario_nombre) 
        : (datos.departamento || datos.tipo_movimiento);

      const calcularAlturaTexto = (doc, text, width, fontSize) => {
        doc.fontSize(fontSize);
        return doc.heightOfString(text, { width: width });
      };

      doc.fontSize(8).font('Helvetica');
      const alturaDestino = calcularAlturaTexto(doc, destino || 'N/A', 195, 8);
      
      let alturaTransporte = 0;
      if (datos.conductor) alturaTransporte += calcularAlturaTexto(doc, datos.conductor, 190, 8) + 10;
      if (datos.vehiculo_placa) {
        const vTxt = `${datos.vehiculo_placa} ${datos.vehiculo_modelo ? `(${datos.vehiculo_modelo})` : ''}`;
        alturaTransporte += calcularAlturaTexto(doc, vTxt, 190, 8) + 10;
      }

      const alturaInfoSalida = Math.max(115, 55 + Math.max(alturaDestino + (datos.ruc_cliente ? 12 : 0) + (datos.direccion_despacho ? 15 : 0), alturaTransporte)); 
      
      doc.roundedRect(33, 205, 529, alturaInfoSalida + 15, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, 213);
      doc.font('Helvetica');
      doc.text(formatearFecha(datos.fecha_movimiento || datos.fecha_emision), 100, 213);
      
      if (!datos.historial_despachos) {
        doc.font('Helvetica-Bold');
        doc.text('Hora:', 40, 228);
        doc.font('Helvetica');
        const horaStr = formatearHora(datos.fecha_movimiento); 
        doc.text(horaStr, 100, 228);
      }
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo:', 40, 243);
      doc.font('Helvetica');
      doc.text(datos.tipo_inventario || 'Venta', 120, 243, { width: 210 });
      
      const yBloque2 = 260; 

      doc.font('Helvetica-Bold');
      doc.text('Cliente/Destino:', 40, yBloque2);
      doc.font('Helvetica');
      doc.text(destino || 'N/A', 120, yBloque2, { width: 180, lineGap: 2 });

      if (datos.direccion_despacho) {
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#444444');
          doc.text(`Dirección: ${datos.direccion_despacho}`, 120, doc.y + 2, { width: 180 });
          doc.fontSize(8).fillColor('#000000');
      }

      if (datos.ruc_cliente) {
          const currentY = doc.y; 
          doc.font('Helvetica-Bold');
          doc.text(`RUC: ${datos.ruc_cliente}`, 120, currentY + 2);
      }

      const xLabelRight = 310;
      const xValueRight = 370;
      const wValueRight = 180;

      doc.font('Helvetica-Bold');
      doc.text('Estado:', xLabelRight, 213);
      doc.font('Helvetica');
      doc.text(datos.estado || 'N/A', xValueRight, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Orden de Venta:', xLabelRight, 228);
      doc.font('Helvetica');
      doc.text(datos.numero_orden || '---', xValueRight, 228);

      doc.font('Helvetica-Bold');
      doc.text('OC Cliente:', xLabelRight, 243);
      doc.font('Helvetica');
      doc.text(datos.oc_cliente || 'SIN OC', xValueRight, 243);

      doc.font('Helvetica-Bold');
      doc.text('Cotización:', xLabelRight, 258);
      doc.font('Helvetica');
      doc.text(datos.numero_cotizacion || '---', xValueRight, 258);

      let yDerecha = 273;

      if (datos.conductor) {
        doc.font('Helvetica-Bold');
        doc.text('Conductor:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        const conductorTxt = datos.conductor.substring(0, 40); 
        const heightC = doc.heightOfString(conductorTxt, { width: wValueRight });
        doc.text(conductorTxt, xValueRight, yDerecha, { width: wValueRight });
        yDerecha += heightC + 4;
      }

      if (datos.vehiculo_placa) {
        doc.font('Helvetica-Bold');
        doc.text('Vehículo:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        const vehiculoTxt = `${datos.vehiculo_placa} ${datos.vehiculo_modelo ? `(${datos.vehiculo_modelo})` : ''}`;
        const heightV = doc.heightOfString(vehiculoTxt, { width: wValueRight });
        doc.text(vehiculoTxt, xValueRight, yDerecha, { width: wValueRight });
      }

      let yPos = 205 + alturaInfoSalida + 25;
      const detalles = datos.detalles || datos.detalle || [];
      
      const mostrarDetalleExtendido = detalles.some(d => d.cantidad_pendiente !== undefined);
      
      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');

      if (mostrarDetalleExtendido) {
        doc.text('CÓDIGO', 40, yPos + 6);
        doc.text('DESCRIPCIÓN', 110, yPos + 6);
        doc.text('UND', 315, yPos + 6, { width: 30, align: 'center' });
        doc.text('TOTAL', 350, yPos + 6, { width: 60, align: 'center' });
        doc.text('DESPACHADO', 415, yPos + 6, { width: 70, align: 'center' });
        doc.text('PENDIENTE', 490, yPos + 6, { width: 60, align: 'center' });
      } else {
        doc.text('CÓDIGO', 40, yPos + 6);
        doc.text('DESCRIPCIÓN', 140, yPos + 6);
        doc.text('CANTIDAD', 420, yPos + 6, { width: 60, align: 'center' });
        doc.text('UNIDAD', 485, yPos + 6, { width: 50, align: 'center' });
      }

      yPos += 20;
      const itemsAMostrar = detalles; 

      itemsAMostrar.forEach((item, idx) => {
        const descripcion = item.producto || item.nombre;
        const alturaDescripcion = calcularAlturaTexto(doc, descripcion, mostrarDetalleExtendido ? 200 : 270, 8);
        const alturaFila = Math.max(20, alturaDescripcion + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('CONTINUACIÓN...', 40, yPos);
          yPos += 20;
        }

        if (idx % 2 === 0) doc.rect(33, yPos, 529, alturaFila).fillOpacity(0.1).fill('#f0f0f0').fillOpacity(1);

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        if (mostrarDetalleExtendido) {
          doc.text(item.codigo_producto, 40, yPos + 5);
          doc.text(descripcion, 110, yPos + 5, { width: 200, lineGap: 2 });
          doc.text(item.unidad_medida, 315, yPos + 5, { width: 30, align: 'center' });
          doc.text(parseFloat(item.cantidad_total || item.cantidad).toFixed(2), 350, yPos + 5, { width: 60, align: 'center' });
          const despachado = parseFloat(item.cantidad_despachada || 0).toFixed(2);
          doc.text(despachado, 415, yPos + 5, { width: 70, align: 'center' });
          const pendiente = parseFloat(item.cantidad_pendiente || 0).toFixed(2);
          if(parseFloat(pendiente) > 0) doc.fillColor('#cc0000');
          doc.text(pendiente, 490, yPos + 5, { width: 60, align: 'center' });
          doc.fillColor('#000000');
        } else {
          doc.text(item.codigo_producto, 40, yPos + 5);
          doc.text(descripcion, 140, yPos + 5, { width: 270, lineGap: 2 });
          doc.text(parseFloat(item.cantidad).toFixed(2), 420, yPos + 5, { width: 60, align: 'center' });
          doc.text(item.unidad_medida, 485, yPos + 5, { width: 50, align: 'center' });
        }

        yPos += alturaFila;
      });

      yPos += 15;

      if (datos.historial_despachos && datos.historial_despachos.length > 0) {
        if (yPos + 40 > 700) { doc.addPage(); yPos = 50; }
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e88e5');
        doc.text('HISTORIAL DE DESPACHOS (TRAZABILIDAD)', 40, yPos);
        yPos += 15;
        doc.rect(33, yPos, 529, 15).fill('#e0e0e0');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
        doc.text('FECHA', 40, yPos + 4);
        doc.text('GUÍA / SALIDA', 120, yPos + 4);
        doc.text('PRODUCTO', 220, yPos + 4);
        doc.text('UND', 450, yPos + 4);
        doc.text('CANT', 490, yPos + 4, { align: 'right', width: 60 });
        yPos += 15;

        datos.historial_despachos.forEach((h, i) => {
          if (yPos + 15 > 700) { doc.addPage(); yPos = 50; }
          doc.fontSize(7).font('Helvetica').fillColor('#333333');
          doc.text(formatearFecha(h.fecha_movimiento), 40, yPos + 2);
          doc.text(`Salida #${h.numero_guia || h.id_salida}`, 120, yPos + 2);
          doc.text(h.producto, 220, yPos + 2, { width: 220, ellipsis: true });
          doc.text(h.unidad_medida, 450, yPos + 2);
          doc.text(parseFloat(h.cantidad).toFixed(2), 490, yPos + 2, { align: 'right', width: 60 });
          doc.moveTo(33, yPos + 12).lineTo(562, yPos + 12).lineWidth(0.5).stroke('#eeeeee');
          yPos += 12;
        });
        yPos += 10;
      }

      if (yPos + 50 > 700) { doc.addPage(); yPos = 50; }

      if (datos.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 40, yPos + 15, { width: 330 });
      }

      if (!mostrarDetalleExtendido) {
          doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('TOTAL ITEMS', 390, yPos + 4);
          doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
          doc.text(`${detalles.length}`, 475, yPos + 4, { align: 'right', width: 80 });
      }

      let yFirmas = 720;
      if (yPos > 650) {
        doc.addPage();
        yFirmas = 720;
      }

      const anchoLinea = 135;
      doc.moveTo(40, yFirmas).lineTo(40 + anchoLinea, yFirmas).stroke('#000000');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('DESPACHADO POR', 40, yFirmas + 5, { width: anchoLinea, align: 'center' });

      doc.moveTo(215, yFirmas).lineTo(215 + anchoLinea, yFirmas).stroke('#000000');
      doc.text('VERIFICADO POR', 215, yFirmas + 5, { width: anchoLinea, align: 'center' });

      doc.moveTo(390, yFirmas).lineTo(390 + anchoLinea, yFirmas).stroke('#000000');
      doc.text('RECIBIDO POR', 390, yFirmas + 5, { width: anchoLinea, align: 'center' });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Documento de Control de Inventario - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFTransferencia(datos) {
  const logoBuffer = await cargarLogoURL();

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

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
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
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('COMPROBANTE DE', 385, 60, { align: 'center', width: 155 });
      doc.text('TRANSFERENCIA', 385, 72, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${datos.id_transferencia_cabecera || 'N/A'}`, 385, 88, { align: 'center', width: 155 });

      const alturaInfoTransferencia = 90;
      doc.roundedRect(33, 205, 529, alturaInfoTransferencia, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, 213);
      doc.font('Helvetica');
      doc.text(formatearFecha(datos.fecha_transferencia), 100, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Inventario Origen:', 40, 228);
      doc.font('Helvetica');
      doc.text(datos.tipo_inventario_origen || 'N/A', 100, 228, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('Inventario Destino:', 40, 243);
      doc.font('Helvetica');
      doc.text(datos.tipo_inventario_destino || 'N/A', 100, 243, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('Registrado por:', 40, 258);
      doc.font('Helvetica');
      doc.text(datos.registrado_por || 'N/A', 100, 258, { width: 230 });

      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 213);
      doc.font('Helvetica');
      doc.text(datos.estado || 'N/A', 450, 213);

      let yPos = 305;

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓD. ORIGEN', 40, yPos + 6);
      doc.text('PRODUCTO', 130, yPos + 6);
      doc.text('CÓD. DESTINO', 320, yPos + 6);
      doc.text('CANT.', 410, yPos + 6, { width: 50, align: 'center' });
      doc.text('COSTO', 490, yPos + 6, { align: 'right', width: 60 });

      yPos += 20;

      const detalles = datos.detalles || [];
      
      detalles.forEach((item, idx) => {
        const descripcion = item.producto_nombre || item.producto || '';
        const alturaDescripcion = calcularAlturaTexto(doc, descripcion, 180, 8);
        const alturaFila = Math.max(20, alturaDescripcion + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
          doc.text('CÓD. ORIGEN', 40, yPos + 6);
          doc.text('PRODUCTO', 130, yPos + 6);
          doc.text('CÓD. DESTINO', 320, yPos + 6);
          doc.text('CANT.', 410, yPos + 6, { width: 50, align: 'center' });
          doc.text('COSTO', 490, yPos + 6, { align: 'right', width: 60 });
          yPos += 20;
        }

        const subtotal = (item.cantidad || 0) * (item.costo_unitario || 0);
        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        doc.text(item.codigo_origen || item.codigo_producto || '', 40, yPos + 5);
        doc.text(descripcion, 130, yPos + 5, { width: 180, lineGap: 2 });
        doc.text(item.codigo_destino || 'Auto', 320, yPos + 5);
        doc.text(`${parseFloat(item.cantidad || 0).toFixed(2)} ${item.unidad_medida || ''}`, 410, yPos + 5, { width: 50, align: 'center' });
        doc.text(`S/ ${subtotal.toFixed(2)}`, 490, yPos + 5, { align: 'right', width: 60 });

        yPos += alturaFila;
      });

      yPos += 10;

      if (datos.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 40, yPos + 15, { width: 330 });
      }

      const totalCosto = detalles.reduce((sum, d) => sum + ((d.cantidad || 0) * (d.costo_unitario || 0)), 0);

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('COSTO TOTAL', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`S/ ${totalCosto.toFixed(2)}`, 475, yPos + 4, { align: 'right', width: 80 });

      yPos += 25;

      doc.fontSize(8).font('Helvetica');
      const totalEnLetras = numeroALetras(parseFloat(totalCosto), 'PEN');
      doc.text(`SON: ${totalEnLetras}`, 40, yPos, { width: 522, align: 'left' });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Comprobante de transferencia entre inventarios - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFOrdenProduccion(datos, consumoMateriales = [], mermas = [], registrosParciales = []) {
  const logoBuffer = await cargarLogoURL();

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

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
      }

      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, 110);
      
      doc.fontSize(8).font('Helvetica');
      doc.text('Dirección de la Empresa, Calle 123', 50, 123, { width: 250 });
      doc.text('Lima, Lima - Perú', 50, 135);
      
      doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('R.U.C. 20123456789', 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ORDEN DE PRODUCCIÓN', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${datos.numero_orden || 'N/A'}`, 385, 83, { align: 'center', width: 155 });

      // Aumentamos altura para que quepan las fechas de inicio/fin
      const alturaInfoProduccion = 125; 
      doc.roundedRect(33, 205, 529, alturaInfoProduccion, 3).stroke('#000000');
      
      // COLUMNA IZQUIERDA
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('F. Creación:', 40, 213);
      doc.font('Helvetica');
      doc.text(formatearFechaHora(datos.fecha_creacion), 100, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Producto:', 40, 228);
      doc.font('Helvetica');
      doc.text(datos.producto || 'N/A', 100, 228, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('Código:', 40, 243);
      doc.font('Helvetica');
      doc.text(datos.codigo_producto || 'N/A', 100, 243);
      
      doc.font('Helvetica-Bold');
      doc.text('Supervisor:', 40, 258);
      doc.font('Helvetica');
      doc.text(datos.supervisor || 'N/A', 100, 258, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('Cant. Planif.:', 40, 273);
      doc.font('Helvetica');
      doc.text(`${datos.cantidad_planificada || 0} ${datos.unidad_medida || ''}`, 100, 273);

      doc.font('Helvetica-Bold');
      doc.text('Inicio Real:', 40, 288);
      doc.font('Helvetica');
      doc.text(formatearFechaHora(datos.fecha_inicio), 100, 288);

      // COLUMNA DERECHA
      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 213);
      doc.font('Helvetica');
      doc.text(datos.estado || 'N/A', 450, 213);
      
      if (datos.cantidad_producida > 0) {
        doc.font('Helvetica-Bold');
        doc.text('Cant. Prod.:', 360, 228);
        doc.font('Helvetica');
        doc.text(`${datos.cantidad_producida} ${datos.unidad_medida || ''}`, 450, 228);
      }

      doc.font('Helvetica-Bold');
      doc.text('Turno:', 360, 243);
      doc.font('Helvetica');
      doc.text(datos.turno || '-', 450, 243);

      doc.font('Helvetica-Bold');
      doc.text('Maquinista:', 360, 258);
      doc.font('Helvetica');
      doc.text(datos.maquinista || '-', 450, 258);

      doc.font('Helvetica-Bold');
      doc.text('Duración:', 360, 273);
      doc.font('Helvetica');
      doc.text(formatearDuracion(datos.tiempo_total_minutos), 450, 273);

      doc.font('Helvetica-Bold');
      doc.text('Fin Real:', 360, 288);
      doc.font('Helvetica');
      doc.text(formatearFechaHora(datos.fecha_fin), 450, 288);

      // Ajustamos posición Y inicial para el contenido
      let yPos = 345;

      if (consumoMateriales.length > 0) {
        doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('INSUMO', 40, yPos + 6);
        doc.text('CANTIDAD', 350, yPos + 6);
        doc.text('C. UNIT.', 430, yPos + 6, { align: 'right', width: 50 });
        doc.text('SUBTOTAL', 490, yPos + 6, { align: 'right', width: 60 });

        yPos += 20;

        consumoMateriales.forEach((item) => {
          const descripcion = item.insumo || '';
          const alturaDescripcion = calcularAlturaTexto(doc, descripcion, 300, 8);
          const alturaFila = Math.max(20, alturaDescripcion + 10);

          if (yPos + alturaFila > 700) {
            doc.addPage();
            yPos = 50;
            doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
            doc.text('INSUMO', 40, yPos + 6);
            doc.text('CANTIDAD', 350, yPos + 6);
            doc.text('C. UNIT.', 430, yPos + 6, { align: 'right', width: 50 });
            doc.text('SUBTOTAL', 490, yPos + 6, { align: 'right', width: 60 });
            yPos += 20;
          }

          doc.fontSize(8).font('Helvetica').fillColor('#000000');
          
          const cantidadMostrar = item.cantidad_real_consumida > 0 
            ? item.cantidad_real_consumida 
            : item.cantidad_requerida;

          const costoTotalItem = item.cantidad_real_consumida > 0 
             ? (item.cantidad_real_consumida * item.costo_unitario)
             : item.costo_total;

          doc.text(descripcion, 40, yPos + 5, { width: 300, lineGap: 2 });
          doc.text(`${parseFloat(cantidadMostrar).toFixed(4)} ${item.unidad_medida || ''}`, 350, yPos + 5);
          doc.text(`S/ ${parseFloat(item.costo_unitario).toFixed(2)}`, 430, yPos + 5, { align: 'right', width: 50 });
          doc.text(`S/ ${parseFloat(costoTotalItem).toFixed(2)}`, 490, yPos + 5, { align: 'right', width: 60 });

          yPos += alturaFila;
        });

        yPos += 10;
      }

      if (registrosParciales && registrosParciales.length > 0) {
        if (yPos + 80 > 700) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('REGISTROS PARCIALES DE PRODUCCIÓN', 40, yPos);
        yPos += 15;

        doc.rect(33, yPos, 529, 18).fill('#E0E0E0');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
        doc.text('FECHA', 40, yPos + 5);
        doc.text('CANTIDAD', 180, yPos + 5);
        doc.text('REGISTRADO POR', 270, yPos + 5);
        doc.text('OBSERVACIONES', 420, yPos + 5);

        yPos += 18;

        registrosParciales.forEach((reg) => {
          if (yPos + 16 > 750) {
            doc.addPage();
            yPos = 50;
          }

          doc.fontSize(7).font('Helvetica').fillColor('#000000');
          doc.text(formatearFechaHora(reg.fecha_registro), 40, yPos + 3);
          doc.text(`${parseFloat(reg.cantidad_registrada).toFixed(2)}`, 180, yPos + 3);
          doc.text(reg.registrado_por || '-', 270, yPos + 3, { width: 140 });
          doc.text(reg.observaciones || '-', 420, yPos + 3, { width: 130 });

          yPos += 16;
        });

        yPos += 10;
      }

      if (mermas && mermas.length > 0) {
        if (yPos + 80 > 700) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text('MERMAS GENERADAS', 40, yPos);
        yPos += 15;

        doc.rect(33, yPos, 529, 18).fill('#FFE0E0');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
        doc.text('CÓDIGO', 40, yPos + 5);
        doc.text('PRODUCTO MERMA', 120, yPos + 5);
        doc.text('CANTIDAD', 350, yPos + 5);
        doc.text('OBSERVACIONES', 450, yPos + 5);

        yPos += 18;

        mermas.forEach((merma) => {
          if (yPos + 16 > 750) {
            doc.addPage();
            yPos = 50;
          }

          doc.fontSize(7).font('Helvetica').fillColor('#000000');
          doc.text(merma.codigo || '-', 40, yPos + 3);
          doc.text(merma.producto_merma || '-', 120, yPos + 3, { width: 220 });
          doc.text(`${parseFloat(merma.cantidad).toFixed(2)} ${merma.unidad_medida || ''}`, 350, yPos + 3);
          doc.text(merma.observaciones || '-', 450, yPos + 3, { width: 100 });

          yPos += 16;
        });

        yPos += 10;
      }

      if (datos.observaciones) {
        if (yPos + 50 > 700) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 40, yPos + 15, { width: 330 });
        
        yPos += 50;
      }

      if (consumoMateriales.length > 0) {
        if (yPos + 40 > 750) {
          doc.addPage();
          yPos = 50;
        }

        let totalCosto = 0;
        consumoMateriales.forEach(c => {
             const cant = c.cantidad_real_consumida > 0 ? c.cantidad_real_consumida : c.cantidad_requerida;
             totalCosto += (cant * c.costo_unitario);
        });

        doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('COSTO MATERIALES', 390, yPos + 4);
        
        doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`S/ ${totalCosto.toFixed(2)}`, 475, yPos + 4, { align: 'right', width: 80 });

        yPos += 25;

        doc.fontSize(8).font('Helvetica');
        // Si no tienes la funcion numeroALetras, puedes comentar esta linea o implementarla
        const totalEnLetras = numeroALetras(totalCosto, 'PEN'); 
        doc.text(`SON: ${totalEnLetras}`, 40, yPos, { width: 522, align: 'left' });
      }

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Orden de producción - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFCotizacion(cotizacion) {
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
        const response = await axios.get('https://indpackperu.com/images/logohorizontal.png', {
          responseType: 'arraybuffer'
        });
        logoBuffer = Buffer.from(response.data);
      } catch (error) {
        console.error('Error al descargar logo:', error);
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
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
      
      doc.text(formatearFecha(cotizacion.fecha_emision), 40, yPosRecuadroFechas + 25, { align: 'center', width: 260 });

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

export async function generarPDFOrdenVenta(orden) {
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
        const response = await axios.get('https://indpackperu.com/images/logohorizontal.png', {
          responseType: 'arraybuffer'
        });
        logoBuffer = Buffer.from(response.data);
      } catch (error) {
        console.error('Error al descargar logo:', error);
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
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
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ORDEN DE VENTA', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${orden.numero_orden}`, 385, 83, { align: 'center', width: 155 });

      const direccionCliente = orden.direccion_entrega || orden.direccion_cliente || '';
      const alturaDireccion = calcularAlturaTexto(doc, direccionCliente, 230, 8);
      const alturaRecuadroCliente = Math.max(75, alturaDireccion + 60);
      
      doc.roundedRect(33, 195, 529, alturaRecuadroCliente, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Cliente:', 40, 203);
      doc.font('Helvetica');
      doc.text(orden.cliente || '', 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, 218);
      doc.font('Helvetica');
      doc.text(orden.ruc_cliente || '', 100, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Dirección:', 40, 233);
      doc.font('Helvetica');
      doc.text(direccionCliente, 100, 233, { width: 230, lineGap: 2 });

      doc.font('Helvetica-Bold');
      doc.text('Moneda:', 360, 203);
      doc.font('Helvetica');
      doc.text(orden.moneda === 'USD' ? 'USD' : 'PEN', 450, 203);
      
      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 218);
      doc.font('Helvetica');
      doc.text(orden.estado || '', 450, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Prioridad:', 360, 233);
      doc.font('Helvetica');
      doc.text(orden.prioridad || '', 450, 233);
      
      if (orden.orden_compra_cliente) {
        doc.font('Helvetica-Bold');
        doc.text('O/C Cliente:', 360, 248);
        doc.font('Helvetica');
        doc.text(orden.orden_compra_cliente, 450, 248);
      }

      const yPosRecuadroFechas = 195 + alturaRecuadroCliente + 8;
      
      doc.roundedRect(33, yPosRecuadroFechas, 529, 40, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha Emisión:', 40, yPosRecuadroFechas + 10, { align: 'center', width: 260 });
      doc.font('Helvetica');
      
      doc.text(formatearFecha(orden.fecha_emision), 40, yPosRecuadroFechas + 25, { align: 'center', width: 260 });

      doc.font('Helvetica-Bold');
      doc.text('Fecha Entrega Estimada:', 310, yPosRecuadroFechas + 10, { align: 'center', width: 252 });
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.fecha_entrega_estimada) || '-', 310, yPosRecuadroFechas + 25, { align: 'center', width: 252 });

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

      const simboloMoneda = orden.moneda === 'USD' ? '$' : 'S/';
      
      orden.detalle.forEach((item, idx) => {
        const cantidad = parseFloat(item.cantidad).toFixed(2);
        const precioUnitario = parseFloat(item.precio_unitario).toFixed(2);
        const valorVenta = parseFloat(item.valor_venta || (item.cantidad * item.precio_unitario * (1 - (item.descuento_porcentaje || 0)/100))).toFixed(2);
        
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

      if (orden.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(orden.observaciones, 40, yPos + 15, { width: 330 });
      }

      const subtotal = parseFloat(orden.subtotal).toFixed(2);
      const igv = parseFloat(orden.igv).toFixed(2);
      const total = parseFloat(orden.total).toFixed(2);

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
      const totalEnLetras = numeroALetras(parseFloat(total), orden.moneda);
      doc.text(`SON: ${totalEnLetras}`, 40, yPos, { width: 522, align: 'left' });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Gracias por su preferencia - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFGuiaRemision(guia) {
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
        const response = await axios.get('https://indpackperu.com/images/logohorizontal.png', {
          responseType: 'arraybuffer'
        });
        logoBuffer = Buffer.from(response.data);
      } catch (error) {
        console.error('Error al descargar logo:', error);
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
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
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('GUÍA DE REMISIÓN', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${guia.numero_guia}`, 385, 83, { align: 'center', width: 155 });

      const alturaRecuadroInfo = 105;
      doc.roundedRect(33, 195, 529, alturaRecuadroInfo, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha Emisión:', 40, 203);
      doc.font('Helvetica');
      doc.text(formatearFecha(guia.fecha_emision), 100, 203);
      
      doc.font('Helvetica-Bold');
      doc.text('Cliente:', 40, 218);
      doc.font('Helvetica');
      doc.text(guia.cliente || '', 100, 218, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, 233);
      doc.font('Helvetica');
      doc.text(guia.ruc_cliente || '', 100, 233);
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo Traslado:', 40, 248);
      doc.font('Helvetica');
      doc.text(guia.tipo_traslado || '', 100, 248);

      doc.font('Helvetica-Bold');
      doc.text('Motivo:', 360, 203);
      doc.font('Helvetica');
      doc.text(guia.motivo_traslado || '', 450, 203, { width: 135 });
      
      doc.font('Helvetica-Bold');
      doc.text('Modalidad:', 360, 218);
      doc.font('Helvetica');
      doc.text(guia.modalidad_transporte || 'Privado', 450, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Peso Bruto:', 360, 233);
      doc.font('Helvetica');
      doc.text(`${parseFloat(guia.peso_bruto_kg).toFixed(2)} kg`, 450, 233);
      
      doc.font('Helvetica-Bold');
      doc.text('N° Bultos:', 360, 248);
      doc.font('Helvetica');
      doc.text(guia.numero_bultos || '', 450, 248);

      let yPos = 310;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('PUNTO DE PARTIDA', 40, yPos);
      doc.fontSize(8).font('Helvetica');
      doc.text(guia.direccion_partida || 'No especificado', 40, yPos + 15, { width: 230 });

      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('PUNTO DE LLEGADA', 310, yPos);
      doc.fontSize(8).font('Helvetica');
      doc.text(guia.direccion_llegada, 310, yPos + 15, { width: 230 });
      doc.text(`Ciudad: ${guia.ciudad_llegada}`, 310, yPos + 30);

      yPos += 55;

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('DESCRIPCIÓN', 130, yPos + 6);
      doc.text('CANTIDAD', 380, yPos + 6, { width: 70, align: 'center' });
      doc.text('UNIDAD', 455, yPos + 6, { width: 50, align: 'center' });
      doc.text('PESO', 510, yPos + 6, { align: 'right', width: 45 });

      yPos += 20;

      guia.detalle.forEach((item, idx) => {
        const descripcion = item.producto;
        const alturaDescripcion = calcularAlturaTexto(doc, descripcion, 240, 8);
        const alturaFila = Math.max(20, alturaDescripcion + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
          doc.text('CÓDIGO', 40, yPos + 6);
          doc.text('DESCRIPCIÓN', 130, yPos + 6);
          doc.text('CANTIDAD', 380, yPos + 6, { width: 70, align: 'center' });
          doc.text('UNIDAD', 455, yPos + 6, { width: 50, align: 'center' });
          doc.text('PESO', 510, yPos + 6, { align: 'right', width: 45 });
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        doc.text(item.codigo_producto || '-', 40, yPos + 5);
        doc.text(descripcion, 130, yPos + 5, { width: 240, lineGap: 2 });
        doc.text(parseFloat(item.cantidad).toFixed(2), 380, yPos + 5, { width: 70, align: 'center' });
        doc.text(item.unidad_medida || 'unidad', 455, yPos + 5, { width: 50, align: 'center' });
        doc.text(`${parseFloat(item.peso_total_kg || 0).toFixed(2)} kg`, 510, yPos + 5, { align: 'right', width: 45 });

        yPos += alturaFila;
      });

      yPos += 10;

      if (guia.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(guia.observaciones, 40, yPos + 15, { width: 330 });
      }

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('PESO TOTAL', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${parseFloat(guia.peso_bruto_kg).toFixed(2)} kg`, 475, yPos + 4, { align: 'right', width: 80 });
      yPos += 20;

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('N° BULTOS', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(guia.numero_bultos || '', 475, yPos + 4, { align: 'right', width: 80 });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Esta guía de remisión ampara el traslado de mercadería - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFGuiaTransportista(guia) {
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
        const response = await axios.get('https://indpackperu.com/images/logohorizontal.png', {
          responseType: 'arraybuffer'
        });
        logoBuffer = Buffer.from(response.data);
      } catch (error) {
        console.error('Error al descargar logo:', error);
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
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
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('GUÍA DE TRANSPORTISTA', 385, 62, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${guia.numero_guia}`, 385, 83, { align: 'center', width: 155 });

      const alturaRecuadroInfo = 120;
      doc.roundedRect(33, 195, 529, alturaRecuadroInfo, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha Emisión:', 40, 203);
      doc.font('Helvetica');
      doc.text(formatearFecha(guia.fecha_emision), 100, 203);
      
      doc.font('Helvetica-Bold');
      doc.text('Guía Remisión:', 40, 218);
      doc.font('Helvetica');
      doc.text(guia.numero_guia_remision || '', 100, 218);
      
      if (guia.fecha_inicio_traslado) {
        doc.font('Helvetica-Bold');
        doc.text('Inicio Traslado:', 40, 233);
        doc.font('Helvetica');
        doc.text(formatearFecha(guia.fecha_inicio_traslado), 100, 233);
      }
      
      doc.font('Helvetica-Bold');
      doc.text('Transportista:', 40, 248);
      doc.font('Helvetica');
      doc.text(guia.razon_social_transportista || '', 100, 248, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, 263);
      doc.font('Helvetica');
      doc.text(guia.ruc_transportista || '', 100, 263);

      doc.font('Helvetica-Bold');
      doc.text('Conductor:', 360, 203);
      doc.font('Helvetica');
      doc.text(guia.nombre_conductor || '', 450, 203, { width: 135 });
      
      doc.font('Helvetica-Bold');
      doc.text('Licencia:', 360, 218);
      doc.font('Helvetica');
      doc.text(guia.licencia_conducir || '', 450, 218);
      
      if (guia.dni_conductor) {
        doc.font('Helvetica-Bold');
        doc.text('DNI:', 360, 233);
        doc.font('Helvetica');
        doc.text(guia.dni_conductor, 450, 233);
      }
      
      doc.font('Helvetica-Bold');
      doc.text('Placa Vehículo:', 360, 248);
      doc.font('Helvetica');
      doc.text(guia.placa_vehiculo || '', 450, 248);

      let yPos = 325;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('PUNTO DE PARTIDA', 40, yPos);
      doc.fontSize(8).font('Helvetica');
      doc.text(guia.direccion_partida || 'No especificado', 40, yPos + 15, { width: 460 });

      yPos += 35;

      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('PUNTO DE LLEGADA', 40, yPos);
      doc.fontSize(8).font('Helvetica');
      doc.text(guia.direccion_llegada, 40, yPos + 15, { width: 460 });
      doc.text(`Ciudad: ${guia.ciudad_llegada}`, 40, yPos + 30);

      yPos += 50;

      if (guia.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(guia.observaciones, 40, yPos + 15, { width: 330 });
        
        yPos += 50;
      }

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('PESO BRUTO', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${parseFloat(guia.peso_bruto_kg).toFixed(2)} kg`, 475, yPos + 4, { align: 'right', width: 80 });
      yPos += 20;

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('N° BULTOS', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(guia.numero_bultos || '', 475, yPos + 4, { align: 'right', width: 80 });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Esta guía de transportista certifica el traslado de mercadería - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFOrdenCompra(orden) {
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
        const response = await axios.get('https://indpackperu.com/images/logohorizontal.png', {
          responseType: 'arraybuffer'
        });
        logoBuffer = Buffer.from(response.data);
      } catch (error) {
        console.error('Error al descargar logo:', error);
      }

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 40, { width: 200, height: 60, fit: [200, 60] });
        } catch (error) {
          doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
          doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
        }
      } else {
        doc.rect(50, 40, 200, 60).fillAndStroke('#1e88e5', '#1e88e5');
        doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold').text('IndPack', 60, 55);
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
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ORDEN DE COMPRA', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${orden.numero_orden}`, 385, 83, { align: 'center', width: 155 });

      const direccionProveedor = orden.direccion_proveedor || '';
      const alturaDireccion = calcularAlturaTexto(doc, direccionProveedor, 230, 8);
      const alturaRecuadroProveedor = Math.max(75, alturaDireccion + 60);
      
      doc.roundedRect(33, 195, 529, alturaRecuadroProveedor, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Proveedor:', 40, 203);
      doc.font('Helvetica');
      doc.text(orden.proveedor || '', 100, 203, { width: 230 });
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, 218);
      doc.font('Helvetica');
      doc.text(orden.ruc_proveedor || '', 100, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Dirección:', 40, 233);
      doc.font('Helvetica');
      doc.text(direccionProveedor, 100, 233, { width: 230, lineGap: 2 });

      doc.font('Helvetica-Bold');
      doc.text('Condición pago:', 360, 203);
      doc.font('Helvetica');
      doc.text(orden.condicion_pago || 'Por definir', 450, 203, { width: 135 });
      
      doc.font('Helvetica-Bold');
      doc.text('Fecha Pedido:', 360, 218);
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.fecha_pedido), 450, 218);
      
      doc.font('Helvetica-Bold');
      doc.text('Entrega esperada:', 360, 233);
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.entrega_esperada) || '-', 450, 233);

      const yPosRecuadroInfo = 195 + alturaRecuadroProveedor + 8;
      
      doc.roundedRect(33, yPosRecuadroInfo, 529, 40, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Lugar de entrega:', 40, yPosRecuadroInfo + 10, { align: 'center', width: 260 });
      doc.font('Helvetica');
      doc.text(orden.lugar_entrega || '-', 40, yPosRecuadroInfo + 25, { align: 'center', width: 260 });

      doc.font('Helvetica-Bold');
      doc.text('Elaborado por:', 310, yPosRecuadroInfo + 10, { align: 'center', width: 252 });
      doc.font('Helvetica');
      doc.text(orden.elaborado_por || '-', 310, yPosRecuadroInfo + 25, { align: 'center', width: 252 });

      let yPos = yPosRecuadroInfo + 52;

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('CANT.', 130, yPos + 6, { width: 50, align: 'center' });
      doc.text('UNID.', 185, yPos + 6, { width: 40, align: 'center' });
      doc.text('DESCRIPCIÓN', 230, yPos + 6);
      doc.text('V. UNIT.', 450, yPos + 6, { align: 'right', width: 50 });
      doc.text('V. COMPRA', 505, yPos + 6, { align: 'right', width: 50 });

      yPos += 20;

      const simboloMoneda = orden.moneda === 'USD' ? '$' : 'S/';
      
      orden.detalle.forEach((item, idx) => {
        const cantidad = parseFloat(item.cantidad).toFixed(5);
        const valorUnitario = parseFloat(item.valor_unitario).toFixed(3);
        const valorCompra = parseFloat(item.valor_compra).toFixed(2);
        
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
          doc.text('V. COMPRA', 505, yPos + 6, { align: 'right', width: 50 });
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        doc.text(item.codigo_producto, 40, yPos + 5);
        doc.text(cantidad, 130, yPos + 5, { width: 50, align: 'center' });
        doc.text(item.unidad_medida, 185, yPos + 5, { width: 40, align: 'center' });
        doc.text(descripcion, 230, yPos + 5, { width: 215, lineGap: 2 });
        doc.text(valorUnitario, 450, yPos + 5, { align: 'right', width: 50 });
        doc.text(`${simboloMoneda} ${valorCompra}`, 505, yPos + 5, { align: 'right', width: 50 });

        yPos += alturaFila;
      });

      yPos += 10;

      if (orden.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(orden.observaciones, 40, yPos + 15, { width: 330 });
      }

      const subtotal = parseFloat(orden.subtotal).toFixed(2);
      const igv = parseFloat(orden.igv).toFixed(2);
      const total = parseFloat(orden.total).toFixed(2);

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
      const totalEnLetras = numeroALetras(parseFloat(total), orden.moneda);
      doc.text(`SON: ${totalEnLetras}`, 40, yPos, { width: 522, align: 'left' });

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Este documento es una orden de compra válida - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

export async function generarPDFHojaRuta(orden, receta = []) {
  const logoBuffer = await cargarLogoURL();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // --- ENCABEZADO ---
      if (logoBuffer) {
        doc.image(logoBuffer, 30, 30, { width: 120 });
      }
      
      doc.font('Helvetica-Bold').fontSize(18).text('HOJA DE RUTA DE PRODUCCIÓN', 160, 35, { align: 'center' });
      doc.fontSize(10).text('CONTROL EN PLANTA', 160, 55, { align: 'center' });

      // Cuadro de Número de Orden (Destacado)
      doc.roundedRect(430, 30, 130, 40, 5).stroke('#000000');
      doc.fontSize(10).text('N° ORDEN', 430, 35, { align: 'center', width: 130 });
      doc.fontSize(14).text(orden.numero_orden, 430, 50, { align: 'center', width: 130 });

      // --- SECCIÓN 1: DATOS GENERALES (Pre-llenados) ---
      const yInfo = 90;
      doc.rect(30, yInfo, 535, 75).stroke();
      
      // Fila 1
      doc.fontSize(9).font('Helvetica-Bold').text('PRODUCTO:', 35, yInfo + 10);
      doc.font('Helvetica').text(orden.producto, 100, yInfo + 10);
      
      doc.font('Helvetica-Bold').text('CANT. PLAN.:', 350, yInfo + 10);
      doc.font('Helvetica').text(`${orden.cantidad_planificada} ${orden.unidad_medida}`, 420, yInfo + 10);

      // Fila 2
      doc.font('Helvetica-Bold').text('MAQUINISTA:', 35, yInfo + 30);
      doc.font('Helvetica').text(orden.maquinista || '___________________', 100, yInfo + 30);

      doc.font('Helvetica-Bold').text('AYUDANTE:', 200, yInfo + 30);
      doc.font('Helvetica').text(orden.ayudante || '___________________', 260, yInfo + 30);

      doc.font('Helvetica-Bold').text('TURNO:', 400, yInfo + 30);
      doc.font('Helvetica').text(orden.turno || '___', 450, yInfo + 30);

      // Fila 3 (Espacios para llenar a mano)
      doc.moveTo(30, yInfo + 50).lineTo(565, yInfo + 50).stroke(); // Línea divisoria
      
      doc.font('Helvetica-Bold').text('FECHA INICIO:', 35, yInfo + 58);
      doc.font('Helvetica').text(formatearFecha(orden.fecha_inicio) || '___/___/____', 110, yInfo + 58);

      doc.font('Helvetica-Bold').text('HORA INICIO:', 200, yInfo + 58);
      doc.text('__:__', 270, yInfo + 58); // Manual

      doc.font('Helvetica-Bold').text('HORA FIN:', 350, yInfo + 58);
      doc.text('__:__', 410, yInfo + 58); // Manual

      // --- SECCIÓN 2: RECETA / MEZCLA SUGERIDA ---
      let yReceta = yInfo + 90;
      doc.fontSize(10).font('Helvetica-Bold').text('1. PREPARACIÓN DE MEZCLA (INSUMOS)', 30, yReceta);
      yReceta += 15;

      // Tabla de Receta
      const col1 = 30, col2 = 100, col3 = 350, col4 = 450;
      doc.rect(col1, yReceta, 535, 20).fill('#E0E0E0').stroke();
      doc.fillColor('black').text('CÓDIGO', col1 + 5, yReceta + 5);
      doc.text('INSUMO / MATERIAL', col2 + 5, yReceta + 5);
      doc.text('SOLICITADO', col3 + 5, yReceta + 5, { width: 90, align: 'right' });
      doc.text('REAL (LLENAR)', col4 + 5, yReceta + 5, { width: 80, align: 'center' });

      yReceta += 20;
      
      if (receta.length > 0) {
        receta.forEach(item => {
            doc.rect(col1, yReceta, 535, 20).stroke();
            doc.font('Helvetica').fontSize(9);
            doc.text(item.codigo_insumo || '', col1 + 5, yReceta + 5);
            doc.text(item.insumo || '', col2 + 5, yReceta + 5);
            doc.text(`${parseFloat(item.cantidad_requerida).toFixed(2)} ${item.unidad_medida}`, col3 + 5, yReceta + 5, { width: 90, align: 'right' });
            // Espacio vacío para que el operario anote lo que realmente usó
            doc.text('__________', col4 + 5, yReceta + 5, { width: 80, align: 'center' });
            yReceta += 20;
        });
      } else {
          doc.rect(col1, yReceta, 535, 20).stroke();
          doc.text('Sin receta predefinida (Orden Manual)', col1 + 5, yReceta + 5);
          yReceta += 20;
      }

      // --- SECCIÓN 3: CONTROL DE PRODUCCIÓN (Grilla para anotar) ---
      let yProduccion = yReceta + 25;
      doc.font('Helvetica-Bold').fontSize(10).text('2. REGISTRO DE BOBINAS / PRODUCTO TERMINADO', 30, yProduccion);
      yProduccion += 15;

      // Encabezados Tabla Producción
      const pCol1 = 30, pCol2 = 80, pCol3 = 160, pCol4 = 240, pCol5 = 320, pCol6 = 450;
      doc.rect(pCol1, yProduccion, 535, 20).fill('#E0E0E0').stroke();
      doc.fillColor('black').fontSize(8);
      doc.text('N°', pCol1, yProduccion + 6, { width: 50, align: 'center' });
      doc.text('HORA', pCol2, yProduccion + 6, { width: 80, align: 'center' });
      doc.text('PESO (KG)', pCol3, yProduccion + 6, { width: 80, align: 'center' });
      doc.text('METRAJE', pCol4, yProduccion + 6, { width: 80, align: 'center' });
      doc.text('OBSERVACIONES / CALIDAD', pCol5, yProduccion + 6, { width: 130, align: 'center' });
      doc.text('OK/NOK', pCol6, yProduccion + 6, { width: 115, align: 'center' });

      yProduccion += 20;

      // Generar filas vacías para llenar (ej. 15 filas)
      for (let i = 1; i <= 15; i++) {
          if (yProduccion > 750) { // Nueva página si se acaba el espacio
              doc.addPage();
              yProduccion = 50;
          }
          doc.rect(pCol1, yProduccion, 535, 20).stroke();
          doc.text(i.toString(), pCol1, yProduccion + 6, { width: 50, align: 'center' });
          yProduccion += 20;
      }

      // --- SECCIÓN 4: PARADAS DE MÁQUINA ---
      let yParadas = yProduccion + 25;
      if (yParadas > 650) { doc.addPage(); yParadas = 50; }

      doc.font('Helvetica-Bold').fontSize(10).text('3. CONTROL DE PARADAS DE MÁQUINA', 30, yParadas);
      yParadas += 15;

      // Encabezados Paradas
      const stopCol1 = 30, stopCol2 = 130, stopCol3 = 230, stopCol4 = 565;
      doc.rect(stopCol1, yParadas, 535, 20).fill('#FFCCBC').stroke(); // Color rojizo suave
      doc.fillColor('black');
      doc.text('HORA INICIO', stopCol1, yParadas + 6, { width: 100, align: 'center' });
      doc.text('HORA FIN', stopCol2, yParadas + 6, { width: 100, align: 'center' });
      doc.text('CAUSA / MOTIVO', stopCol3, yParadas + 6, { width: 335, align: 'center' });

      yParadas += 20;

      // Filas vacías para paradas (5 filas)
      for (let i = 0; i < 5; i++) {
          doc.rect(stopCol1, yParadas, 535, 20).stroke();
          yParadas += 20;
      }

      // --- PIE DE PÁGINA: TOTALES Y FIRMAS ---
      let yFooter = yParadas + 30;
      if (yFooter > 700) { doc.addPage(); yFooter = 50; }

      // Cuadros de resumen final
      doc.fontSize(9);
      doc.rect(30, yFooter, 150, 40).stroke();
      doc.font('Helvetica-Bold').text('TOTAL PRODUCIDO (KG)', 30, yFooter + 5, { width: 150, align: 'center' });
      
      doc.rect(200, yFooter, 150, 40).stroke();
      doc.text('TOTAL MERMA (KG)', 200, yFooter + 5, { width: 150, align: 'center' });

      doc.rect(370, yFooter, 195, 40).stroke();
      doc.text('EFICIENCIA / OBSERVACIÓN', 370, yFooter + 5, { width: 195, align: 'center' });

      // Firmas
      yFooter += 80;
      doc.moveTo(80, yFooter).lineTo(230, yFooter).stroke();
      doc.text('FIRMA MAQUINISTA', 80, yFooter + 5, { width: 150, align: 'center' });

      doc.moveTo(350, yFooter).lineTo(500, yFooter).stroke();
      doc.text('FIRMA SUPERVISOR', 350, yFooter + 5, { width: 150, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}