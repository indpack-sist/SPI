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
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const logoPath = path.join(__dirname, '../assets/logohorizontal.jpg');
    return fs.readFileSync(logoPath);
  } catch (error) {
    console.warn('No se pudo cargar el logo local:', error.message);
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

function fmtCantidad(valor) {
  return String(parseFloat(parseFloat(valor || 0).toFixed(4)));
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
      doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 123, { width: 250 });
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 148);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 160);
      doc.text(`Web: ${EMPRESA.web}`, 50, 172);

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
        const cantidad = fmtCantidad(item.cantidad);
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

  const fmtPeso = (pesoKg) => {
    if (!pesoKg || pesoKg === 0) return '-';
    if (pesoKg < 1) return `${(pesoKg * 1000).toFixed(0)} g`;
    return `${pesoKg.toFixed(3)} kg`;
  };

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
      doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 123, { width: 250 });
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 148);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 160);
      doc.text(`Web: ${EMPRESA.web}`, 50, 172);

      doc.roundedRect(380, 40, 165, 75, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      
      const tituloDoc = datos.historial_despachos ? 'REPORTE DE ORDEN' : 'CONSTANCIA DE SALIDA';
      doc.text(tituloDoc, 385, 65, { align: 'center', width: 155 });
      
      const numSalida = datos.numero_salida || datos.id_salida;
      const textoSalida = numSalida ? `SAL-${String(numSalida).padStart(6, '0')}` : 'N/A';
      doc.fontSize(14).fillColor('#cc0000'); 
      doc.text(`No. ${textoSalida}`, 385, 90, { align: 'center', width: 155 });

      const destino = datos.tipo_movimiento === 'Venta' 
        ? (datos.cliente || datos.destinatario_nombre) 
        : (datos.departamento || datos.tipo_movimiento);

      const calcularAlturaTexto = (doc, text, width, fontSize) => {
        const currentSize = doc._fontSize;
        doc.fontSize(fontSize);
        const h = doc.heightOfString(text || '', { width: width });
        doc.fontSize(currentSize);
        return h;
      };

      doc.fontSize(8).font('Helvetica');
      const alturaDestino = calcularAlturaTexto(doc, destino || 'N/A', 195, 8);
      
      let alturaTransporte = 60; 
      
      if (datos.tipo_entrega === 'Vehiculo Empresa') {
        alturaTransporte = 0;
        if (datos.conductor) alturaTransporte += calcularAlturaTexto(doc, datos.conductor, 190, 8) + 4;
        if (datos.conductor_dni) alturaTransporte += 12;
        if (datos.transporte_licencia) alturaTransporte += 12;
        if (datos.vehiculo_placa) alturaTransporte += 12;

      } else if (datos.tipo_entrega === 'Transporte Privado') {
        alturaTransporte = 12; 
        if (datos.transporte_privado_nombre) alturaTransporte += calcularAlturaTexto(doc, datos.transporte_privado_nombre, 190, 8) + 4;
        if (datos.transporte_privado_conductor) alturaTransporte += calcularAlturaTexto(doc, datos.transporte_privado_conductor, 190, 8) + 4;
        if (datos.transporte_privado_dni) alturaTransporte += 12;
        if (datos.transporte_licencia) alturaTransporte += 12;
        if (datos.transporte_privado_placa) alturaTransporte += 12;

      } else if (datos.tipo_entrega === 'Recojo Tienda') {
        alturaTransporte = 45;
      }

      const alturaInfoSalida = Math.max(115, 65 + Math.max(alturaDestino + (datos.ruc_cliente ? 12 : 0) + (datos.direccion_despacho ? 25 : 0), alturaTransporte)); 
      
      const clienteTexto = destino || 'N/A';
      const rucTexto = datos.ruc_cliente || '';
      const direccionTexto = (datos.direccion_despacho || '').replace(/[\r\n]+/g, " ");

      const hCliente = calcularAlturaTexto(doc, clienteTexto, 180, 8);
      const hDireccion = calcularAlturaTexto(doc, direccionTexto, 180, 8);

      let leftH = 15; // Fecha
      leftH += 15; // Tipo
      leftH += Math.max(15, hCliente + 5);
      if (datos.direccion_despacho) leftH += Math.max(15, hDireccion + 5);
      if (rucTexto) leftH += 15;

      const xLabelRight = 310;
      const xValueRight = 375;
      const wValueRight = 175;

      let rightH = 15; // Estado
      rightH += 15; // Orden Venta
      rightH += 15; // OC Cliente
      rightH += 15; // Cotizacion
      
      if (datos.tipo_entrega) {
        rightH += 15; // Espacio y Titulo
        rightH += alturaTransporte;
      }

      const hInfoFinal = Math.max(115, Math.max(leftH, rightH) + 15);
      
      doc.roundedRect(33, 205, 529, hInfoFinal, 3).stroke('#000000');
      
      let cursorY = 213;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(formatearFecha(datos.fecha_movimiento || datos.fecha_emision), 100, cursorY);
      cursorY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(datos.tipo_inventario || 'Venta', 100, cursorY, { width: 210 });
      cursorY += 17;
      
      doc.font('Helvetica-Bold');
      doc.text('Cliente/Destino:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(clienteTexto, 120, cursorY, { width: 180, lineGap: 2 });
      cursorY += Math.max(15, hCliente + 5);

      if (datos.direccion_despacho) {
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#444444');
          doc.text(`Dirección: ${direccionTexto}`, 120, cursorY, { width: 180, lineGap: 2 });
          doc.fontSize(8).fillColor('#000000');
          cursorY += Math.max(15, hDireccion + 5);
      }

      if (rucTexto) {
          doc.font('Helvetica-Bold');
          doc.text(`RUC: ${rucTexto}`, 120, cursorY);
      }

      let rightY = 213;
      doc.font('Helvetica-Bold').text('Estado:', xLabelRight, rightY);
      doc.font('Helvetica').text(datos.estado || 'N/A', xValueRight, rightY);
      rightY += 15;
      
      doc.font('Helvetica-Bold').text('Orden de Venta:', xLabelRight, rightY);
      doc.font('Helvetica').text(datos.numero_orden || '---', xValueRight, rightY);
      rightY += 15;

      doc.font('Helvetica-Bold').text('OC Cliente:', xLabelRight, rightY);
      doc.font('Helvetica').text(datos.oc_cliente || 'SIN OC', xValueRight, rightY);
      rightY += 15;

      doc.font('Helvetica-Bold').text('Cotización:', xLabelRight, rightY);
      doc.font('Helvetica').text(datos.numero_cotizacion || '---', xValueRight, rightY);

      let yPos = 205 + hInfoFinal + 25;
      let yDerecha = rightY + 15;
      
      if (datos.tipo_entrega) {
        doc.font('Helvetica-Bold').fillColor('#1e88e5');
        doc.text('Entrega y Logística', xLabelRight, yDerecha);
        doc.moveTo(xLabelRight, yDerecha + 10).lineTo(xLabelRight + 200, yDerecha + 10).lineWidth(0.5).stroke('#1e88e5');
        doc.fillColor('#000000');
        yDerecha += 15;
      }

      if (datos.tipo_entrega === 'Vehiculo Empresa') {
        if (datos.conductor) {
          doc.font('Helvetica-Bold');
          doc.text('Conductor:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          const heightC = calcularAlturaTexto(doc, datos.conductor, wValueRight, 8);
          doc.text(datos.conductor, xValueRight, yDerecha, { width: wValueRight });
          yDerecha += heightC + 2;
        }

        if (datos.conductor_dni) {
          doc.font('Helvetica-Bold');
          doc.text('DNI:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          doc.text(datos.conductor_dni, xValueRight, yDerecha);
          yDerecha += 12;
        }

        if (datos.transporte_licencia) {
          doc.font('Helvetica-Bold');
          doc.text('Licencia:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          doc.text(datos.transporte_licencia, xValueRight, yDerecha);
          yDerecha += 12;
        }

        if (datos.vehiculo_placa) {
          doc.font('Helvetica-Bold');
          doc.text('Vehículo:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          const vehiculoTxt = `${datos.vehiculo_placa} ${datos.vehiculo_modelo ? `(${datos.vehiculo_modelo})` : ''}`;
          doc.text(vehiculoTxt, xValueRight, yDerecha, { width: wValueRight });
          yDerecha += 12;
        }
        
      } else if (datos.tipo_entrega === 'Transporte Privado') {
        doc.font('Helvetica-Bold');
        doc.text('Transporte:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        doc.text('PRIVADO / TERCERO', xValueRight, yDerecha, { width: wValueRight });
        yDerecha += 12;

        if (datos.transporte_privado_nombre) {
          doc.font('Helvetica-Bold');
          doc.text('Empresa:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          const heightN = calcularAlturaTexto(doc, datos.transporte_privado_nombre, wValueRight, 8);
          doc.text(datos.transporte_privado_nombre, xValueRight, yDerecha, { width: wValueRight });
          yDerecha += heightN + 2;
        }

        if (datos.transporte_privado_conductor) {
          doc.font('Helvetica-Bold');
          doc.text('Chofer:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          const heightCh = calcularAlturaTexto(doc, datos.transporte_privado_conductor, wValueRight, 8);
          doc.text(datos.transporte_privado_conductor, xValueRight, yDerecha, { width: wValueRight });
          yDerecha += heightCh + 2;
        }

        if (datos.transporte_privado_dni) {
          doc.font('Helvetica-Bold');
          doc.text('DNI:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          doc.text(datos.transporte_privado_dni, xValueRight, yDerecha);
          yDerecha += 12;
        }

        if (datos.transporte_licencia) {
          doc.font('Helvetica-Bold');
          doc.text('Licencia:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          doc.text(datos.transporte_licencia, xValueRight, yDerecha);
          yDerecha += 12;
        }

        if (datos.transporte_privado_placa) {
          doc.font('Helvetica-Bold');
          doc.text('Placa:', xLabelRight, yDerecha);
          doc.font('Helvetica');
          doc.text(datos.transporte_privado_placa, xValueRight, yDerecha);
          yDerecha += 12;
        }
        
      } else if (datos.tipo_entrega === 'Recojo Tienda') {
        doc.font('Helvetica-Bold');
        doc.text('Entrega:', xLabelRight, yDerecha);
        doc.font('Helvetica');
        doc.text('RECOJO EN TIENDA', xValueRight, yDerecha, { width: wValueRight });
        yDerecha += 12;
        
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#666666');
        doc.text('El cliente retirará la mercadería', xValueRight, yDerecha, { width: wValueRight });
        doc.text('en nuestras instalaciones', xValueRight, yDerecha + 9, { width: wValueRight });
        doc.fontSize(8).fillColor('#000000');
        yDerecha += 22;
      }

      const detalles = datos.detalles || datos.detalle || [];

      const mostrarDetalleExtendido = detalles.some(d => d.cantidad_pendiente !== undefined);
      // Variante valorizada (uso interno): solo en la vista simple de un despacho.
      const mostrarValores = !!datos.incluir_valores && !mostrarDetalleExtendido;
      const simboloMonedaSalida = datos.moneda === 'USD' ? '$' : 'S/';
      // Decimales: precio unitario y los importes intermedios (V. VENTA, SUBTOTAL, IGV)
      // conservan hasta 6 decimales (según el precio de la OV). Solo el TOTAL final
      // se redondea a 2 decimales. Todo con separador de miles.
      const fmtPrecio = (v) => `${simboloMonedaSalida} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(parseFloat(v || 0))}`;
      const fmtValor  = (v) => `${simboloMonedaSalida} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(parseFloat(v || 0))}`;
      const fmtTotal  = (v) => `${simboloMonedaSalida} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v || 0))}`;

      // Columnas de la variante valorizada (dentro del ancho útil 33..562, sin desborde).
      const COLV = {
        codigo:  { x: 40,  w: 52 },
        desc:    { x: 94,  w: 176 },
        cant:    { x: 272, w: 44 },
        und:     { x: 318, w: 34 },
        vunit:   { x: 354, w: 95 },
        vventa:  { x: 452, w: 108 }
      };

      if (mostrarValores) {
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#cc0000');
        doc.text('COPIA INTERNA VALORIZADA — uso interno, no destinada al cliente', 33, yPos, { width: 529 });
        doc.fillColor('#000000');
        yPos += 12;
      }

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');

      if (mostrarDetalleExtendido) {
        doc.text('CÓDIGO', 40, yPos + 6);
        doc.text('DESCRIPCIÓN', 110, yPos + 6);
        doc.text('UND', 280, yPos + 6, { width: 25, align: 'center' });
        doc.text('TOTAL', 305, yPos + 6, { width: 50, align: 'center' });
        doc.text('PESO', 355, yPos + 6, { width: 50, align: 'center' });
        doc.text('DESPACHADO', 410, yPos + 6, { width: 65, align: 'center' });
        doc.text('PENDIENTE', 480, yPos + 6, { width: 60, align: 'center' });
      } else if (mostrarValores) {
        doc.text('CÓDIGO', COLV.codigo.x, yPos + 6, { width: COLV.codigo.w });
        doc.text('DESCRIPCIÓN', COLV.desc.x, yPos + 6, { width: COLV.desc.w });
        doc.text('CANT.', COLV.cant.x, yPos + 6, { width: COLV.cant.w, align: 'center' });
        doc.text('UND', COLV.und.x, yPos + 6, { width: COLV.und.w, align: 'center' });
        doc.text('V. UNIT.', COLV.vunit.x, yPos + 6, { width: COLV.vunit.w, align: 'right' });
        doc.text('V. VENTA', COLV.vventa.x, yPos + 6, { width: COLV.vventa.w, align: 'right' });
      } else {
        doc.text('CÓDIGO', 40, yPos + 6);
        doc.text('DESCRIPCIÓN', 140, yPos + 6);
        doc.text('CANTIDAD', 370, yPos + 6, { width: 55, align: 'center' });
        doc.text('PESO', 425, yPos + 6, { width: 55, align: 'center' });
        doc.text('UNIDAD', 485, yPos + 6, { width: 50, align: 'center' });
      }

      yPos += 20;
      const itemsAMostrar = detalles; 

      itemsAMostrar.forEach((item, idx) => {
        const descripcion = item.producto || item.nombre;
        const anchoDesc = mostrarDetalleExtendido ? 165 : (mostrarValores ? COLV.desc.w : 220);
        const alturaDescripcion = calcularAlturaTexto(doc, descripcion, anchoDesc, 8);
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
          const cantidadItem = parseFloat(item.cantidad_total || item.cantidad);
          const pesoUE = parseFloat(item.peso_unitario || 0);
          const pesoTE = pesoUE > 0 ? cantidadItem * pesoUE : 0;

          doc.text(item.codigo_producto, 40, yPos + 5);
          doc.text(descripcion, 110, yPos + 5, { width: 165, lineGap: 2 });
          doc.text(item.unidad_medida, 280, yPos + 5, { width: 25, align: 'center' });
          doc.text(fmtCantidad(cantidadItem), 305, yPos + 5, { width: 50, align: 'center' });
          doc.text(pesoTE > 0 ? fmtPeso(pesoTE) : '-', 355, yPos + 5, { width: 50, align: 'center' });
          const despachado = fmtCantidad(item.cantidad_despachada || 0);
          doc.text(despachado, 410, yPos + 5, { width: 65, align: 'center' });
          const pendiente = fmtCantidad(item.cantidad_pendiente || 0);
          if(parseFloat(pendiente) > 0) doc.fillColor('#cc0000');
          doc.text(pendiente, 480, yPos + 5, { width: 60, align: 'center' });
          doc.fillColor('#000000');
        } else if (mostrarValores) {
          const cantidadItem = parseFloat(item.cantidad);
          const precioU = parseFloat(item.precio_unitario || 0);
          const valorV = cantidadItem * precioU;

          doc.text(item.codigo_producto, COLV.codigo.x, yPos + 5, { width: COLV.codigo.w });
          doc.text(descripcion, COLV.desc.x, yPos + 5, { width: COLV.desc.w, lineGap: 2 });
          doc.text(fmtCantidad(cantidadItem), COLV.cant.x, yPos + 5, { width: COLV.cant.w, align: 'center' });
          doc.text(item.unidad_medida, COLV.und.x, yPos + 5, { width: COLV.und.w, align: 'center' });
          doc.text(fmtPrecio(precioU), COLV.vunit.x, yPos + 5, { width: COLV.vunit.w, align: 'right' });
          doc.text(fmtValor(valorV), COLV.vventa.x, yPos + 5, { width: COLV.vventa.w, align: 'right' });
        } else {
          const cantidadItem = parseFloat(item.cantidad);
          const pesoU = parseFloat(item.peso_unitario || 0);
          const pesoT = pesoU > 0 ? cantidadItem * pesoU : 0;

          doc.text(item.codigo_producto, 40, yPos + 5);
          doc.text(descripcion, 140, yPos + 5, { width: 220, lineGap: 2 });
          doc.text(fmtCantidad(cantidadItem), 370, yPos + 5, { width: 55, align: 'center' });
          doc.text(pesoT > 0 ? fmtPeso(pesoT) : '-', 425, yPos + 5, { width: 55, align: 'center' });
          doc.text(item.unidad_medida, 485, yPos + 5, { width: 50, align: 'center' });
        }

        yPos += alturaFila;
      });

      // Totales valorizados del despacho (solo variante interna): SUBTOTAL / IGV / TOTAL,
      // para que el TOTAL sea comparable con la factura (que incluye IGV).
      if (mostrarValores) {
        const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
        // Subtotal e IGV conservan su precisión completa (hasta 6 dec, según el precio).
        // El redondeo a 2 decimales se aplica RECIÉN al total final.
        const subT = itemsAMostrar.reduce(
          (acc, it) => acc + parseFloat(it.cantidad || 0) * parseFloat(it.precio_unitario || 0), 0
        );
        const pctImp = parseFloat(datos.porcentaje_impuesto || 0);
        const tipoImp = String(datos.tipo_impuesto || '').toUpperCase();
        const sinIgv = pctImp <= 0 || ['EXO', 'EXONERADO', 'INA', 'INAFECTO', 'INAFECTA'].includes(tipoImp);
        const igvT = sinIgv ? 0 : subT * pctImp / 100;
        const totT = round2(subT + igvT);

        const filas = [['SUBTOTAL', subT, false]];
        if (!sinIgv) filas.push([`IGV (${pctImp}%)`, igvT, false]);
        filas.push(['TOTAL', totT, true]);

        if (yPos + filas.length * 18 + 4 > 700) { doc.addPage(); yPos = 50; }

        filas.forEach(([label, val, bold]) => {
          doc.roundedRect(COLV.vunit.x, yPos, COLV.vunit.w, 15, 3).fill('#CCCCCC');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text(label, COLV.vunit.x + 5, yPos + 4, { width: COLV.vunit.w - 10 });
          doc.roundedRect(COLV.vventa.x, yPos, COLV.vventa.w, 15, 3).stroke('#CCCCCC');
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000000');
          // El TOTAL (bold) se muestra redondeado a 2 decimales; subtotal/IGV con su precisión.
          doc.text((bold ? fmtTotal : fmtValor)(val), COLV.vventa.x + 4, yPos + 4, { width: COLV.vventa.w - 8, align: 'right' });
          yPos += 18;
        });
        yPos += 4;
      }

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
          doc.text(fmtCantidad(h.cantidad), 490, yPos + 2, { align: 'right', width: 60 });
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
          const pesoTotalSalida = detalles.reduce((acc, item) => {
            const p = parseFloat(item.peso_unitario || 0);
            if (p > 0) acc += parseFloat(item.cantidad) * p;
            return acc;
          }, 0);

          if (pesoTotalSalida > 0) {
            doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
            doc.text('PESO TOTAL', 390, yPos + 4);
            doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
            doc.text(fmtPeso(pesoTotalSalida), 475, yPos + 4, { align: 'right', width: 80 });
            yPos += 20;
          }

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
      doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 123, { width: 250 });
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 148);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 160);
      doc.text(`Web: ${EMPRESA.web}`, 50, 172);

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
        doc.text(`${fmtCantidad(item.cantidad)} ${item.unidad_medida || ''}`, 410, yPos + 5, { width: 50, align: 'center' });
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

export async function generarPDFOrdenProduccion(datos, consumoMateriales = []) {
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

      // ===== Encabezado de empresa =====
      doc.fontSize(9).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 50, 100);

      doc.fontSize(7).font('Helvetica').fillColor('#444444');
      doc.text(`${EMPRESA.direccion}`, 50, 112, { width: 240 });
      doc.text(`Tel: ${EMPRESA.telefono}  ·  ${EMPRESA.email}`, 50, 134);

      doc.roundedRect(380, 40, 165, 55, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 50, { align: 'center', width: 155 });
      doc.fontSize(8).font('Helvetica');
      doc.text('Documento de Producción', 385, 72, { align: 'center', width: 155 });

      // ===== Barra de título =====
      doc.rect(33, 150, 529, 22).fill('#1e88e5');
      doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold');
      doc.text(`ORDEN DE PRODUCCIÓN  -  ${datos.numero_orden || 'N/A'}`, 33, 157, { align: 'center', width: 529 });

      // ===== Helpers de formato locales =====
      const fmt5 = (v) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).format(parseFloat(v || 0));
      const hora24 = (fecha) => {
        if (!fecha) return '--:--';
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return '--:--';
        return d.toLocaleTimeString('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false });
      };
      const minutosAHoras = (min) => {
        const m = parseInt(min || 0);
        if (!m || m <= 0) return '--:--';
        return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      };

      // Cantidad a producir: preferimos unidades (UND/MILL); si no hay, usamos kilos.
      const cantProducir = parseFloat(datos.cantidad_unidades) > 0
        ? `${fmt5(datos.cantidad_unidades)} ${datos.unidad_medida || 'UND'}`
        : `${fmt5(datos.cantidad_planificada)} KG`;

      const fechaPlan = datos.fecha_programada
        ? `${formatearFechaHora(datos.fecha_programada)}${datos.fecha_programada_fin ? '  -  ' + formatearFechaHora(datos.fecha_programada_fin) : ''}`
        : 'N/A';

      // ===== Recuadro de datos generales =====
      const boxTop = 182;
      const boxH = 138;
      doc.roundedRect(33, boxTop, 529, boxH, 3).stroke('#000000');

      const xL = 40, xLv = 130, wLv = 168;
      const xR = 305, xRv = 388, wRv = 168;
      const rowH = 15;
      let ry = boxTop + 8;
      doc.fontSize(8).fillColor('#000000');

      const par = (label, value, x, xv, wv) => {
        doc.font('Helvetica-Bold').fillColor('#000000').text(label, x, ry);
        doc.font('Helvetica').text((value === 0 || value) ? String(value) : '-', xv, ry, { width: wv });
      };

      par('RESPONSABLE:', datos.supervisor, xL, xLv, wLv);
      par('F. PLANIFICADA:', fechaPlan, xR, xRv, wRv);
      ry += rowH;

      par('CANT. A PRODUCIR:', cantProducir, xL, xLv, wLv);
      par('DOC. ORIGEN:', datos.numero_orden_venta, xR, xRv, wRv);
      ry += rowH;

      doc.font('Helvetica-Bold').fillColor('#000000').text('PRODUCTO TERMINADO:', xL, ry);
      doc.font('Helvetica').text(`[${datos.codigo_producto || '-'}] ${datos.producto || ''}`, xLv, ry, { width: 434 });
      ry += rowH;

      par('F. IMPRESIÓN:', formatearFecha(new Date()), xL, xLv, wLv);
      par('TURNO:', datos.turno, xR, xRv, wRv);
      ry += rowH;

      par('MAQUINISTA:', datos.maquinista || datos.operario_corte, xL, xLv, wLv);
      par('AYUDANTE:', datos.ayudante || datos.operario_embalaje, xR, xRv, wRv);
      ry += rowH;

      par('MÁQUINA:', datos.maquina, xL, xLv, wLv);
      par('ESTADO:', datos.estado, xR, xRv, wRv);
      ry += rowH;

      par('HORA INICIO:', hora24(datos.fecha_inicio), xL, xLv, wLv);
      par('HORA FIN:', hora24(datos.fecha_fin), xR, xRv, wRv);
      ry += rowH;

      par('HORAS:', minutosAHoras(datos.tiempo_setup_minutos), xL, xLv, wLv);
      par('HORAS TRABAJADAS:', minutosAHoras(datos.tiempo_total_minutos), xR, xRv, wRv);

      let yPos = boxTop + boxH + 20;

      // ===== PRODUCTOS CONSUMIDOS =====
      const C = {
        n:    { x: 36,  w: 24 },
        prod: { x: 62,  w: 236 },
        disp: { x: 300, w: 92 },
        tot:  { x: 394, w: 92 },
        ori:  { x: 488, w: 72 }
      };

      const drawConsumoHeader = () => {
        doc.rect(33, yPos, 529, 18).fill('#333333');
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        doc.text('N°', C.n.x, yPos + 5, { width: C.n.w, align: 'center' });
        doc.text('PRODUCTO', C.prod.x, yPos + 5, { width: C.prod.w });
        doc.text('DISPONIBLE', C.disp.x, yPos + 5, { width: C.disp.w, align: 'right' });
        doc.text('TOTAL', C.tot.x, yPos + 5, { width: C.tot.w, align: 'right' });
        doc.text('ORIGEN', C.ori.x, yPos + 5, { width: C.ori.w, align: 'center' });
        yPos += 18;
      };

      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      doc.text('PRODUCTOS CONSUMIDOS', 33, yPos);
      yPos += 15;

      drawConsumoHeader();

      if (!consumoMateriales || consumoMateriales.length === 0) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#888888');
        doc.text('Sin insumos registrados para esta orden.', 40, yPos + 4);
        yPos += 20;
      } else {
        consumoMateriales.forEach((item, idx) => {
          const nombre = `[${item.codigo_insumo || '-'}] ${item.insumo || ''}`;
          const alturaDesc = calcularAlturaTexto(doc, nombre, C.prod.w, 8);
          const alturaFila = Math.max(18, alturaDesc + 8);

          if (yPos + alturaFila > 760) {
            doc.addPage();
            yPos = 40;
            drawConsumoHeader();
          }

          if (idx % 2 === 0) {
            doc.rect(33, yPos, 529, alturaFila).fillOpacity(0.06).fill('#000000').fillOpacity(1);
          }

          const um = item.unidad_medida || '';
          doc.fontSize(8).font('Helvetica').fillColor('#000000');
          doc.text(String(idx + 1), C.n.x, yPos + 4, { width: C.n.w, align: 'center' });
          doc.text(nombre, C.prod.x, yPos + 4, { width: C.prod.w, lineGap: 1 });
          doc.text(`${fmt5(item.disponible)} ${um}`, C.disp.x, yPos + 4, { width: C.disp.w, align: 'right' });
          doc.text(`${fmt5(item.cantidad_total)} ${um}`, C.tot.x, yPos + 4, { width: C.tot.w, align: 'right' });
          doc.fontSize(7).fillColor('#555555');
          doc.text(parseFloat(item.disponible) > 0 ? (item.origen || 'STOCK') : '-', C.ori.x, yPos + 4, { width: C.ori.w, align: 'center' });

          yPos += alturaFila;
          doc.moveTo(33, yPos).lineTo(562, yPos).lineWidth(0.3).stroke('#dddddd');
        });
      }

      yPos += 12;

      if (datos.observaciones) {
        const obs = String(datos.observaciones).replace(/\[VERIFICACIÓN CALIDAD\].*?(?:\n|$)/gi, '').trim();
        if (obs) {
          if (yPos + 50 > 760) { doc.addPage(); yPos = 40; }
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
          doc.text('OBSERVACIONES', 40, yPos);
          doc.fontSize(8).font('Helvetica');
          doc.text(obs, 40, yPos + 14, { width: 522 });
        }
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

      let logoBuffer = await cargarLogoURL();

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

      let logoBuffer = await cargarLogoURL();

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
      doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 123, { width: 250 });
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 148);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 160);
      doc.text(`Web: ${EMPRESA.web}`, 50, 172);

      doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ORDEN DE VENTA', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${orden.numero_orden}`, 385, 83, { align: 'center', width: 155 });

      const clienteTexto = orden.cliente || '';
      const rucTexto = orden.ruc_cliente || '';
      const direccionCliente = (orden.direccion_entrega || orden.direccion_cliente || '').replace(/[\r\n]+/g, " ");

      const hCliente = calcularAlturaTexto(doc, clienteTexto, 230, 8);
      const hRuc = 15;
      const hDireccion = calcularAlturaTexto(doc, direccionCliente, 230, 8);

      let leftH = Math.max(15, hCliente + 5);
      leftH += hRuc;
      leftH += Math.max(15, hDireccion + 5);

      let rightH = 15; // Moneda
      rightH += 15; // Estado
      rightH += 15; // Prioridad
      if (orden.orden_compra_cliente) rightH += 15;

      const hRecuadro = Math.max(75, Math.max(leftH, rightH) + 15);
      
      doc.roundedRect(33, 195, 529, hRecuadro, 3).stroke('#000000');
      
      let cursorY = 203;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Cliente:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(clienteTexto, 100, cursorY, { width: 230, lineGap: 2 });
      cursorY += Math.max(15, hCliente + 5);
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(rucTexto, 100, cursorY);
      cursorY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Dirección:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(direccionCliente, 100, cursorY, { width: 230, lineGap: 2 });

      let rightY = 203;
      doc.font('Helvetica-Bold');
      doc.text('Moneda:', 360, rightY);
      doc.font('Helvetica');
      doc.text(orden.moneda === 'USD' ? 'USD' : 'PEN', 450, rightY);
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, rightY);
      doc.font('Helvetica');
      doc.text(orden.estado || '', 450, rightY);
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Prioridad:', 360, rightY);
      doc.font('Helvetica');
      doc.text(orden.prioridad || '', 450, rightY);
      
      if (orden.orden_compra_cliente) {
        rightY += 15;
        doc.font('Helvetica-Bold');
        doc.text('O/C Cliente:', 360, rightY);
        doc.font('Helvetica');
        doc.text(orden.orden_compra_cliente, 450, rightY);
      }

      const yPosRecuadroFechas = 195 + hRecuadro + 8;
      
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
        const cantidad = fmtCantidad(item.cantidad);
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

      let logoBuffer = await cargarLogoURL();

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
      doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 123, { width: 250 });
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 148);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 160);
      doc.text(`Web: ${EMPRESA.web}`, 50, 172);

      doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('GUÍA DE REMISIÓN', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${guia.numero_guia}`, 385, 83, { align: 'center', width: 155 });

      const clienteTexto = guia.cliente || '';
      const rucTexto = guia.ruc_cliente || '';
      const tipoTrasladoTexto = guia.tipo_traslado || '';
      const motivoTexto = guia.motivo_traslado || '';

      const alturaCliente = calcularAlturaTexto(doc, clienteTexto, 230, 8);
      const alturaRUC = calcularAlturaTexto(doc, rucTexto, 230, 8);
      const alturaTipo = calcularAlturaTexto(doc, tipoTrasladoTexto, 230, 8);
      const alturaMotivo = calcularAlturaTexto(doc, motivoTexto, 135, 8);

      let leftH = 15; // Fecha
      leftH += Math.max(15, alturaCliente + 5);
      leftH += Math.max(15, alturaRUC + 5);
      leftH += Math.max(15, alturaTipo + 5);

      let rightH = Math.max(15, alturaMotivo + 5);
      rightH += 15; // Modalidad
      rightH += 15; // Peso
      rightH += 15; // Bultos

      const alturaRecuadroInfo = Math.max(105, Math.max(leftH, rightH) + 15);
      
      doc.roundedRect(33, 195, 529, alturaRecuadroInfo, 3).stroke('#000000');
      
      let cursorY = 203;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha Emisión:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(formatearFecha(guia.fecha_emision), 100, cursorY);
      cursorY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Cliente:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(clienteTexto, 100, cursorY, { width: 230, lineGap: 2 });
      cursorY += Math.max(15, alturaCliente + 5);
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(rucTexto, 100, cursorY);
      cursorY += Math.max(15, alturaRUC + 5);
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo Traslado:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(tipoTrasladoTexto, 100, cursorY, { width: 230, lineGap: 2 });

      let rightY = 203;
      doc.font('Helvetica-Bold');
      doc.text('Motivo:', 360, rightY);
      doc.font('Helvetica');
      doc.text(motivoTexto, 450, rightY, { width: 135, lineGap: 2 });
      rightY += Math.max(15, alturaMotivo + 5);
      
      doc.font('Helvetica-Bold');
      doc.text('Modalidad:', 360, rightY);
      doc.font('Helvetica');
      doc.text(guia.modalidad_transporte || 'Privado', 450, rightY);
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Peso Bruto:', 360, rightY);
      doc.font('Helvetica');
      doc.text(`${parseFloat(guia.peso_bruto_kg).toFixed(2)} kg`, 450, rightY);
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('N° Bultos:', 360, rightY);
      doc.font('Helvetica');
      doc.text(guia.numero_bultos || '', 450, rightY);

      let yPosTable = 195 + alturaRecuadroInfo + 10;
      yPosTable = 310; // Manteniendo el yPos original del Punto de Partida si es posible o ajustando
      
      // Ajuste: Si el recuadro creció mucho, el yPos del Punto de Partida debe bajar
      const yPuntos = Math.max(310, 195 + alturaRecuadroInfo + 10);
      let yPos = yPuntos;

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
        doc.text(fmtCantidad(item.cantidad), 380, yPos + 5, { width: 70, align: 'center' });
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

      let logoBuffer = await cargarLogoURL();

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
      doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 123, { width: 250 });
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 148);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 160);
      doc.text(`Web: ${EMPRESA.web}`, 50, 172);

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

      let logoBuffer = await cargarLogoURL();

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
      doc.text(`${EMPRESA.direccion}, ${EMPRESA.distrito}, ${EMPRESA.departamento} - ${EMPRESA.pais}`, 50, 123, { width: 250 });
      doc.text(`Teléfono: ${EMPRESA.telefono}`, 50, 148);
      doc.text(`E-mail: ${EMPRESA.email}`, 50, 160);
      doc.text(`Web: ${EMPRESA.web}`, 50, 172);

      doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ORDEN DE COMPRA', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${orden.numero_orden}`, 385, 83, { align: 'center', width: 155 });

      const proveedorTexto = orden.proveedor || '';
      const rucProveedor = orden.ruc_proveedor || '';
      const direccionProveedor = (orden.direccion_proveedor || '').replace(/[\r\n]+/g, " ");

      const hProv = calcularAlturaTexto(doc, proveedorTexto, 230, 8);
      const hRuc = 15;
      const hDir = calcularAlturaTexto(doc, direccionProveedor, 230, 8);

      let leftH = Math.max(15, hProv + 5);
      leftH += hRuc;
      leftH += Math.max(15, hDir + 5);

      let rightH = 15; // Condicion
      rightH += 15; // Fecha Pedido
      rightH += 15; // Entrega esperada

      const hRecuadro = Math.max(75, Math.max(leftH, rightH) + 15);
      
      doc.roundedRect(33, 195, 529, hRecuadro, 3).stroke('#000000');
      
      let cursorY = 203;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Proveedor:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(proveedorTexto, 100, cursorY, { width: 230, lineGap: 2 });
      cursorY += Math.max(15, hProv + 5);
      
      doc.font('Helvetica-Bold');
      doc.text('RUC:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(rucProveedor, 100, cursorY);
      cursorY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Dirección:', 40, cursorY);
      doc.font('Helvetica');
      doc.text(direccionProveedor, 100, cursorY, { width: 230, lineGap: 2 });

      let rightY = 203;
      doc.font('Helvetica-Bold');
      doc.text('Condición pago:', 360, rightY);
      doc.font('Helvetica');
      doc.text(orden.condicion_pago || 'Por definir', 450, rightY, { width: 135, lineGap: 2 });
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Fecha Pedido:', 360, rightY);
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.fecha_pedido), 450, rightY);
      rightY += 15;
      
      doc.font('Helvetica-Bold');
      doc.text('Entrega esperada:', 360, rightY);
      doc.font('Helvetica');
      doc.text(formatearFecha(orden.entrega_esperada) || '-', 450, rightY);

      const yPosRecuadroInfo = 195 + hRecuadro + 8;
      
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
      const doc = new PDFDocument({ margin: 20, size: 'A4' });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      if (logoBuffer) {
        doc.image(logoBuffer, 20, 20, { width: 80 });
      } else {
        doc.fontSize(16).font('Helvetica-Bold').text('IndPack', 20, 25);
      }
      
      doc.font('Helvetica-Bold').fontSize(12).text('HOJA DE RUTA DE PRODUCCIÓN', 110, 25, { align: 'center', width: 350 });
      doc.fontSize(7).font('Helvetica').text('CONTROL EN PLANTA', 110, 38, { align: 'center', width: 350 });

      doc.roundedRect(470, 20, 105, 30, 4).stroke();
      doc.fontSize(6).font('Helvetica-Bold').text('N° ORDEN', 470, 23, { align: 'center', width: 105 });
      doc.fontSize(10).text(orden.numero_orden, 470, 33, { align: 'center', width: 105 });

      const esLamina = (orden.producto && (orden.producto.toUpperCase().includes('LÁMINA') || orden.producto.toUpperCase().includes('LAMINA'))) || orden.operario_corte;
      const esEsquinero = orden.producto && orden.producto.toUpperCase().includes('ESQUINERO');
      const esZuncho = orden.producto && orden.producto.toUpperCase().includes('ZUNCHO');
      const esBurbupack = orden.producto && (orden.producto.toUpperCase().includes('BURBUPACK') && !esLamina);
      const esGrapa = orden.producto && orden.producto.toUpperCase().includes('GRAPA');
      
      const unidadProduccion = orden.unidad_medida ? orden.unidad_medida.toUpperCase() : (esLamina ? 'MILL' : 'UDS');
      
      const yInfo = 60; 
      const alturaDatos = 45; 
      doc.rect(20, yInfo, 555, alturaDatos).stroke(); 
      doc.fontSize(6).font('Helvetica-Bold');
      
      doc.rect(22, yInfo + 2, 350, 10).fill('#FFF176');
      doc.fillColor('black').text('PRODUCTO:', 25, yInfo + 5);
      doc.font('Helvetica').text(orden.producto, 70, yInfo + 5, { width: 300, ellipsis: true });
      
      const metaUnidades = orden.cantidad_unidades ? `${parseInt(orden.cantidad_unidades)} ${unidadProduccion}` : '---';
      doc.font('Helvetica-Bold').text(`META ${unidadProduccion}:`, 380, yInfo + 6);
      doc.font('Helvetica').text(metaUnidades, 430, yInfo + 6);
      doc.font('Helvetica-Bold').text('META KG:', 480, yInfo + 6);
      doc.font('Helvetica').text(fmtCantidad(orden.cantidad_planificada), 520, yInfo + 6);

      let currentY = yInfo + 18;
      if (esLamina) {
          doc.font('Helvetica-Bold').text('OP. CORTE:', 25, currentY);
          doc.font('Helvetica').text(orden.operario_corte || '____________________', 70, currentY);
          doc.font('Helvetica-Bold').text('OP. EMBALAJE:', 200, currentY);
          doc.font('Helvetica').text(orden.operario_embalaje || '____________________', 260, currentY);
      } else {
          doc.font('Helvetica-Bold').text('MAQUINISTA:', 25, currentY);
          doc.font('Helvetica').text(orden.maquinista || '____________________', 75, currentY);
          doc.font('Helvetica-Bold').text('AYUDANTE:', 200, currentY);
          doc.font('Helvetica').text(orden.ayudante || '____________________', 245, currentY);
      }

      doc.font('Helvetica-Bold').text('TURNO:', 380, currentY);
      doc.font('Helvetica').text(orden.turno || '___', 410, currentY);

      const yLinea = yInfo + alturaDatos - 14;
      doc.moveTo(20, yLinea).lineTo(575, yLinea).lineWidth(0.5).stroke(); 
      
      const yFechas = yLinea + 4;
      doc.font('Helvetica-Bold').text('FECHA:', 25, yFechas);
      doc.font('Helvetica').text(formatearFecha(orden.fecha_inicio) || '__/__/__', 55, yFechas);
      doc.font('Helvetica-Bold').text('INICIO:', 150, yFechas);
      doc.text('__:__', 180, yFechas); 
      doc.font('Helvetica-Bold').text('FIN:', 250, yFechas);
      doc.text('__:__', 270, yFechas); 

      let yPos = yInfo + alturaDatos + 6;
      const ANCHO_REDUCIDO = 290;
      const ANCHO_COMPLETO = 555;

      if (esLamina) {
          doc.fontSize(7).font('Helvetica-Bold').fillColor('black').text('1. HISTORIAL DE ROLLOS BURBUPACK USADOS', 20, yPos);
          yPos += 8;
          
          doc.rect(20, yPos, ANCHO_REDUCIDO, 10).fill('#E0E0E0').stroke();
          doc.fillColor('black').fontSize(5).font('Helvetica-Bold');
          doc.text('N°', 20, yPos + 3, { width: 30, align: 'center' });
          doc.text('MEDIDA', 50, yPos + 3, { width: 150, align: 'left' });
          doc.text('CANT', 200, yPos + 3, { width: 40, align: 'center' });
          doc.text('PESO', 240, yPos + 3, { width: 40, align: 'center' });
          yPos += 10;
          for (let i = 0; i < 8; i++) {
              doc.rect(20, yPos, ANCHO_REDUCIDO, 10).stroke();
              doc.fontSize(6).font('Helvetica');
              doc.text((i + 1).toString(), 20, yPos + 3, { width: 30, align: 'center' });
              yPos += 10;
          }
          yPos += 5;
      } else {
          doc.fontSize(7).font('Helvetica-Bold').fillColor('black').text('1. MEZCLA / INSUMOS', 20, yPos);
          yPos += 8;
          
          const wCode = 40;
          const wDesc = 140;
          const wPlan = 55;
          const wReal = 55;
          const xCode = 20;
          const xDesc = xCode + wCode;
          const xPlan = xDesc + wDesc;
          const xReal = xPlan + wPlan;

          doc.rect(20, yPos, ANCHO_REDUCIDO, 10).fill('#E0E0E0').stroke();
          doc.fillColor('black').fontSize(5).font('Helvetica-Bold');
          doc.text('CÓDIGO', xCode + 2, yPos + 3, { width: wCode });
          doc.text('DESCRIPCIÓN', xDesc + 2, yPos + 3, { width: wDesc });
          doc.text('PLANIF.', xPlan + 2, yPos + 3, { width: wPlan, align: 'center' });
          doc.text('REAL', xReal + 2, yPos + 3, { width: wReal, align: 'center' });
          yPos += 10;
          
          if (receta.length > 0) {
              receta.forEach(item => {
                  doc.rect(20, yPos, ANCHO_REDUCIDO, 10).stroke();
                  doc.fontSize(6).font('Helvetica');
                  doc.text(item.codigo_insumo || '', xCode + 2, yPos + 3, { width: wCode });
                  doc.text(item.insumo || '', xDesc + 2, yPos + 3, { width: wDesc, height: 8, lineBreak: false, ellipsis: true });
                  
                  const cantidadPlan = fmtCantidad(item.cantidad_requerida || item.cantidad || item.cantidad_formulada || 0);
                  doc.text(cantidadPlan, xPlan + 2, yPos + 3, { width: wPlan, align: 'center' });

                  yPos += 10;
              });
          }

          const slotsVacios = receta.length > 0 ? Math.max(0, 5 - receta.length) : 5;
          for (let i = 0; i < slotsVacios; i++) {
              doc.rect(20, yPos, ANCHO_REDUCIDO, 10).stroke();
              yPos += 10;
          }
          yPos += 5;
      }

      let labelSlot = 'N°';
      if (esLamina || esEsquinero) labelSlot = 'PAQ';
      else if (esZuncho || esBurbupack) labelSlot = 'ROLLO';
      else if (esGrapa) labelSlot = 'BOLSA';

      let slotsNecesarios = 0;
      if (esLamina) {
          slotsNecesarios = Math.ceil((parseFloat(orden.cantidad_unidades || 0) * 1000) / 500) + 10;
      } else if (esEsquinero) {
          slotsNecesarios = Math.min(250, Math.ceil(parseInt(orden.cantidad_unidades || 0) / 25) + 10);
      } else {
          slotsNecesarios = parseInt(orden.cantidad_unidades || orden.cantidad_planificada || 0) + 10;
      }

      const altoHeaderSeccion2 = 18;
      doc.rect(20, yPos, ANCHO_COMPLETO, altoHeaderSeccion2).fill('#FFCC80').stroke();
      doc.fillColor('black');

      doc.fontSize(7).font('Helvetica-Bold').text('2. REGISTRO DE PRODUCCIÓN', 25, yPos + 6);

      doc.fontSize(6);
      
      const xInfo = 250;
      if (orden.gramaje) {
        doc.font('Helvetica-Bold').text('GRAMAJE:', xInfo, yPos + 6);
        doc.font('Helvetica').text(orden.gramaje, xInfo + 40, yPos + 6);
      }
      
      if (orden.medida) {
        doc.font('Helvetica-Bold').text('MEDIDA:', xInfo + 100, yPos + 6);
        doc.font('Helvetica').text(orden.medida, xInfo + 135, yPos + 6);
      }

      if (orden.peso_producto) {
        doc.font('Helvetica-Bold').text('PESO:', xInfo + 210, yPos + 6);
        doc.font('Helvetica').text(orden.peso_producto, xInfo + 235, yPos + 6);
      }

      yPos += altoHeaderSeccion2;

      const columnasGrid = 4;
      const alturaFila = 12;
      const filasPorColumna = Math.ceil(slotsNecesarios / columnasGrid);
      const anchoColumna = ANCHO_COMPLETO / columnasGrid; 
      const headerGridHeight = 10;

      for (let c = 0; c < columnasGrid; c++) {
          const xBase = 20 + (c * anchoColumna);
          doc.rect(xBase, yPos, anchoColumna, headerGridHeight).fill('#F0F0F0').stroke();
          doc.fillColor('black').fontSize(5).font('Helvetica-Bold');
          
          const w1 = anchoColumna * 0.3;
          const w2 = anchoColumna * 0.7;
          doc.text(labelSlot, xBase, yPos + 3, { width: w1, align: 'center' });
          doc.text('PESO', xBase + w1, yPos + 3, { width: w2, align: 'center' });
      }
      yPos += headerGridHeight;

      doc.fontSize(7).font('Helvetica');
      for (let i = 0; i < filasPorColumna; i++) {
          for (let c = 0; c < columnasGrid; c++) {
              const numeroSlot = i + 1 + (c * filasPorColumna);
              const xBase = 20 + (c * anchoColumna);
              const w1 = anchoColumna * 0.3;

              if (numeroSlot <= slotsNecesarios) {
                  doc.rect(xBase, yPos, anchoColumna, alturaFila).stroke();
                  doc.moveTo(xBase + w1, yPos).lineTo(xBase + w1, yPos + alturaFila).lineWidth(0.5).stroke();
                  doc.text(numeroSlot.toString(), xBase, yPos + 3, { width: w1, align: 'center' });
              }
          }
          yPos += alturaFila;
      }

      yPos += 10;
      if (yPos > 720) { doc.addPage(); yPos = 30; }

      doc.fontSize(7).font('Helvetica-Bold').fillColor('black').text('REGISTRO DE MERMAS', 20, yPos);
      yPos += 8;

      const gap = 10;
      const anchoBloqueMerma = (ANCHO_REDUCIDO - gap) / 2;
      const anchoNumMerma = 25;
      const anchoPesoMerma = anchoBloqueMerma - anchoNumMerma;
      const filasMerma = 10; 

      const xBlock1 = 20;
      const xBlock2 = 20 + anchoBloqueMerma + gap;
      
      doc.fontSize(5).font('Helvetica-Bold');
      doc.rect(xBlock1, yPos, anchoBloqueMerma, 10).fill('#FFCC80').stroke();
      doc.fillColor('black').text('N°', xBlock1, yPos + 3, { width: anchoNumMerma, align: 'center' });
      doc.text('PESO / CANT', xBlock1 + anchoNumMerma, yPos + 3, { width: anchoPesoMerma, align: 'center' });

      doc.rect(xBlock2, yPos, anchoBloqueMerma, 10).fill('#FFCC80').stroke();
      doc.fillColor('black').text('N°', xBlock2, yPos + 3, { width: anchoNumMerma, align: 'center' });
      doc.text('PESO / CANT', xBlock2 + anchoNumMerma, yPos + 3, { width: anchoPesoMerma, align: 'center' });

      yPos += 10;

      doc.fontSize(6).font('Helvetica');
      for (let i = 0; i < filasMerma; i++) {
        const yRow = yPos + (i * 12);
        
        doc.rect(xBlock1, yRow, anchoBloqueMerma, 12).stroke();
        doc.moveTo(xBlock1 + anchoNumMerma, yRow).lineTo(xBlock1 + anchoNumMerma, yRow + 12).stroke();
        doc.text((i + 1).toString(), xBlock1, yRow + 3, { width: anchoNumMerma, align: 'center' });

        doc.rect(xBlock2, yRow, anchoBloqueMerma, 12).stroke();
        doc.moveTo(xBlock2 + anchoNumMerma, yRow).lineTo(xBlock2 + anchoNumMerma, yRow + 12).stroke();
        doc.text((i + 11).toString(), xBlock2, yRow + 3, { width: anchoNumMerma, align: 'center' });
      }
      yPos += (filasMerma * 12);

      yPos += 15;
      if (yPos > 720) { doc.addPage(); yPos = 30; }

      doc.fontSize(7).font('Helvetica-Bold').text('3. PARADAS Y OBSERVACIONES', 20, yPos);
      yPos += 8;
      
      const wHora = 40;
      doc.rect(20, yPos, ANCHO_REDUCIDO, 10).fill('#FFF176').stroke();
      doc.fillColor('black').fontSize(5);
      doc.text('INICIO', 20, yPos + 3, { width: wHora, align: 'center' });
      doc.text('FIN', 20 + wHora, yPos + 3, { width: wHora, align: 'center' });
      doc.text('MOTIVO / CAUSA', 20 + (wHora * 2) + 5, yPos + 3);

      yPos += 10;
      for (let i = 0; i < 3; i++) {
          doc.rect(20, yPos, ANCHO_REDUCIDO, 10).stroke();
          yPos += 10;
      }

      let yFooter = yPos + 20;
      if (yFooter + 20 > 800) {
        doc.addPage();
        yFooter = 30;
      }

      doc.fontSize(6);
      const wBox = 135;
      doc.rect(20, yFooter, wBox, 20).stroke();
      doc.font('Helvetica-Bold').text(`TOTAL ${unidadProduccion}:`, 25, yFooter + 8);
      doc.rect(20 + wBox + 5, yFooter, wBox, 20).stroke();
      doc.text('TOTAL KG PRODUCIDO:', 20 + wBox + 10, yFooter + 8);
      doc.rect(20 + (wBox * 2) + 10, yFooter, wBox, 20).stroke();
      doc.text('TOTAL MERMA KG:', 20 + (wBox * 2) + 15, yFooter + 8);
      doc.rect(20 + (wBox * 3) + 15, yFooter, 135, 20).stroke();
      doc.text('V°B° SUPERVISOR:', 20 + (wBox * 3) + 20, yFooter + 8);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Reporte Kardex de inventario (resumen por producto en un rango de fechas).
// `datos.filas` es un arreglo con: categoria, codigo, producto, unidad,
// balance_inicial, entrada, salida, stock, stock_terminado.
// `datos.filtros` lleva { desde, hasta, tipo_inventario } para el encabezado.
export async function generarPDFKardex(datos) {
  const logoBuffer = await cargarLogoURL();
  const filas = datos.filas || [];
  const filtros = datos.filtros || {};

  // Formatea cantidades: entero si no tiene decimales, si no hasta 2 decimales.
  const fmtNum = (valor) => {
    const n = parseFloat(valor || 0);
    const redondeado = Math.round(n * 100) / 100;
    const str = Number.isInteger(redondeado)
      ? String(redondeado)
      : redondeado.toFixed(2);
    // Separador de miles
    const [entero, dec] = str.split('.');
    const enteroFmt = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec ? `${enteroFmt}.${dec}` : enteroFmt;
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        bufferPages: true,
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Geometría de columnas (A4 apaisado: 842 x 595, usable ~782)
      const cols = {
        categoria: { x: 30, w: 90, align: 'left' },
        codigo: { x: 120, w: 85, align: 'left' },
        producto: { x: 205, w: 210, align: 'left' },
        balance: { x: 415, w: 70, align: 'right' },
        entrada: { x: 485, w: 60, align: 'right' },
        salida: { x: 545, w: 60, align: 'right' },
        stock: { x: 605, w: 60, align: 'right' },
        stockTerm: { x: 665, w: 80, align: 'right' }
      };
      const tablaFin = cols.stockTerm.x + cols.stockTerm.w; // 745
      const LIMITE_Y = 560; // salto de página

      // --- Encabezado de empresa + título ---
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 30, 25, { width: 150, height: 45, fit: [150, 45] });
        } catch (error) {
          doc.fontSize(18).fillColor('#1e88e5').font('Helvetica-Bold').text('IndPack', 30, 30);
        }
      } else {
        doc.fontSize(18).fillColor('#1e88e5').font('Helvetica-Bold').text('IndPack', 30, 30);
      }

      doc.fontSize(15).fillColor('#000000').font('Helvetica-Bold');
      doc.text('REPORTE KARDEX', 200, 30, { align: 'right', width: tablaFin - 200 });
      doc.fontSize(9).font('Helvetica');
      doc.text(`R.U.C. ${EMPRESA.ruc} - INDPACK S.A.C.`, 200, 50, { align: 'right', width: tablaFin - 200 });

      // --- Metadatos del reporte ---
      doc.fontSize(8).fillColor('#000000');
      doc.font('Helvetica-Bold').text('Fecha de impresión:', 30, 78, { continued: true });
      doc.font('Helvetica').text(` ${formatearFechaHora(new Date())}`);

      doc.font('Helvetica-Bold').text('Desde:', 30, 90, { continued: true });
      doc.font('Helvetica').text(` ${filtros.desde || 'Inicio'}    `, { continued: true });
      doc.font('Helvetica-Bold').text('Hasta:', { continued: true });
      doc.font('Helvetica').text(` ${filtros.hasta || 'Hoy'}    `, { continued: true });
      doc.font('Helvetica-Bold').text('Tipo de inventario:', { continued: true });
      doc.font('Helvetica').text(` ${filtros.tipo_inventario || 'Todos'}`);

      let yPos = 110;

      // --- Cabecera de tabla (reutilizable por página) ---
      const dibujarCabecera = (y) => {
        doc.rect(30, y, tablaFin - 30, 22).fill('#333333');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('CATEGORÍA', cols.categoria.x + 3, y + 7, { width: cols.categoria.w - 4 });
        doc.text('CÓDIGO', cols.codigo.x + 3, y + 7, { width: cols.codigo.w - 4 });
        doc.text('PRODUCTO', cols.producto.x + 3, y + 7, { width: cols.producto.w - 4 });
        doc.text('BALANCE\nINICIAL', cols.balance.x, y + 3, { width: cols.balance.w - 4, align: 'right' });
        doc.text('ENTRADA', cols.entrada.x, y + 7, { width: cols.entrada.w - 4, align: 'right' });
        doc.text('SALIDA', cols.salida.x, y + 7, { width: cols.salida.w - 4, align: 'right' });
        doc.text('STOCK', cols.stock.x, y + 7, { width: cols.stock.w - 4, align: 'right' });
        doc.text('STOCK\nTERMI.', cols.stockTerm.x, y + 3, { width: cols.stockTerm.w - 4, align: 'right' });
        return y + 22;
      };

      yPos = dibujarCabecera(yPos);

      // --- Filas ---
      const totales = { balance: 0, entrada: 0, salida: 0, stock: 0, stockTerm: 0 };

      if (filas.length === 0) {
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666');
        doc.text('No se encontraron productos con movimientos o stock en el rango seleccionado.', 30, yPos + 10, { width: tablaFin - 30, align: 'center' });
      }

      filas.forEach((fila, idx) => {
        const nombre = fila.producto || '';
        doc.fontSize(7.5).font('Helvetica');
        const altoNombre = doc.heightOfString(nombre, { width: cols.producto.w - 4, lineGap: 1 });
        const altoFila = Math.max(16, altoNombre + 6);

        if (yPos + altoFila > LIMITE_Y) {
          doc.addPage();
          yPos = 40;
          yPos = dibujarCabecera(yPos);
        }

        // Zebra
        if (idx % 2 === 0) {
          doc.rect(30, yPos, tablaFin - 30, altoFila).fill('#F5F5F5');
        }

        doc.fontSize(7.5).font('Helvetica').fillColor('#000000');
        doc.text(fila.categoria || '-', cols.categoria.x + 3, yPos + 4, { width: cols.categoria.w - 4, ellipsis: true });
        doc.text(fila.codigo || '-', cols.codigo.x + 3, yPos + 4, { width: cols.codigo.w - 4, ellipsis: true });
        doc.text(nombre, cols.producto.x + 3, yPos + 4, { width: cols.producto.w - 4, lineGap: 1 });
        doc.text(fmtNum(fila.balance_inicial), cols.balance.x, yPos + 4, { width: cols.balance.w - 4, align: 'right' });
        doc.text(fmtNum(fila.entrada), cols.entrada.x, yPos + 4, { width: cols.entrada.w - 4, align: 'right' });
        doc.text(fmtNum(fila.salida), cols.salida.x, yPos + 4, { width: cols.salida.w - 4, align: 'right' });
        doc.font('Helvetica-Bold');
        doc.text(fmtNum(fila.stock), cols.stock.x, yPos + 4, { width: cols.stock.w - 4, align: 'right' });
        doc.text(fmtNum(fila.stock_terminado), cols.stockTerm.x, yPos + 4, { width: cols.stockTerm.w - 4, align: 'right' });

        totales.balance += parseFloat(fila.balance_inicial || 0);
        totales.entrada += parseFloat(fila.entrada || 0);
        totales.salida += parseFloat(fila.salida || 0);
        totales.stock += parseFloat(fila.stock || 0);
        totales.stockTerm += parseFloat(fila.stock_terminado || 0);

        yPos += altoFila;
      });

      // --- Fila de totales ---
      if (filas.length > 0) {
        if (yPos + 20 > LIMITE_Y) {
          doc.addPage();
          yPos = 40;
          yPos = dibujarCabecera(yPos);
        }
        doc.rect(30, yPos, tablaFin - 30, 18).fill('#DDDDDD');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`TOTALES (${filas.length} productos)`, cols.categoria.x + 3, yPos + 5, { width: cols.producto.w + cols.codigo.w });
        doc.text(fmtNum(totales.balance), cols.balance.x, yPos + 5, { width: cols.balance.w - 4, align: 'right' });
        doc.text(fmtNum(totales.entrada), cols.entrada.x, yPos + 5, { width: cols.entrada.w - 4, align: 'right' });
        doc.text(fmtNum(totales.salida), cols.salida.x, yPos + 5, { width: cols.salida.w - 4, align: 'right' });
        doc.text(fmtNum(totales.stock), cols.stock.x, yPos + 5, { width: cols.stock.w - 4, align: 'right' });
        doc.text(fmtNum(totales.stockTerm), cols.stockTerm.x, yPos + 5, { width: cols.stockTerm.w - 4, align: 'right' });
        yPos += 18;
      }

      // --- Numeración de páginas ---
      const rango = doc.bufferedPageRange();
      for (let i = rango.start; i < rango.start + rango.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font('Helvetica').fillColor('#666666');
        doc.text(`Página ${i - rango.start + 1} de ${rango.count}`, 30, 570, { align: 'right', width: tablaFin - 30 });
      }

      doc.end();
    } catch (error) {
      console.error('Error al generar PDF Kardex:', error);
      reject(error);
    }
  });
}

// Reporte por producto (producción vs despacho) para entrega a terceros.
// Regla de consistencia: el DESPACHADO mostrado nunca es menor que el PRODUCIDO
// (se compensa hacia arriba a nivel del total del rango). `datos` lleva:
//   producto: { codigo, nombre, unidad, stock_actual }
//   filtros:  { desde, hasta }
//   producido (num), despachado_real (num), despachado (num, ya compensado)
//   ordenes:  [{ fecha, numero_orden, cantidad }]
export async function generarPDFReporteProducto(datos) {
  const logoBuffer = await cargarLogoURL();
  const producto = datos.producto || {};
  const filtros = datos.filtros || {};
  const ordenes = datos.ordenes || [];
  const unidad = producto.unidad || '';

  const fmtNum = (valor) => {
    const n = parseFloat(valor || 0);
    const r = Math.round(n * 100) / 100;
    const str = Number.isInteger(r) ? String(r) : r.toFixed(2);
    const [ent, dec] = str.split('.');
    const entFmt = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec ? `${entFmt}.${dec}` : entFmt;
  };

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        bufferPages: true,
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const izq = 30;
      const der = 565; // margen derecho
      const anchoUtil = der - izq;

      // --- Encabezado empresa ---
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, izq, 25, { width: 170, height: 50, fit: [170, 50] });
        } catch (e) {
          doc.fontSize(18).fillColor('#1e88e5').font('Helvetica-Bold').text('IndPack', izq, 30);
        }
      } else {
        doc.fontSize(18).fillColor('#1e88e5').font('Helvetica-Bold').text('IndPack', izq, 30);
      }

      doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold');
      doc.text('REPORTE POR PRODUCTO', 300, 30, { align: 'right', width: der - 300 });
      doc.fontSize(9).font('Helvetica');
      doc.text('Producción y Despacho', 300, 48, { align: 'right', width: der - 300 });
      doc.text(`R.U.C. ${EMPRESA.ruc} - INDPACK S.A.C.`, 300, 61, { align: 'right', width: der - 300 });

      // --- Datos del producto ---
      let y = 95;
      doc.roundedRect(izq, y, anchoUtil, 74, 4).stroke('#000000');
      doc.fontSize(9).fillColor('#000000');

      doc.font('Helvetica-Bold').text('Producto:', izq + 8, y + 8, { continued: true });
      doc.font('Helvetica').text(` ${producto.codigo || ''} - ${producto.nombre || ''}`, { width: anchoUtil - 90 });

      doc.font('Helvetica-Bold').text('Unidad:', izq + 8, y + 26, { continued: true });
      doc.font('Helvetica').text(` ${unidad || 'N/A'}`);

      doc.font('Helvetica-Bold').text('Stock actual:', izq + 200, y + 26, { continued: true });
      doc.font('Helvetica').text(` ${fmtNum(producto.stock_actual)} ${unidad}`);

      doc.font('Helvetica-Bold').text('Desde:', izq + 8, y + 44, { continued: true });
      doc.font('Helvetica').text(` ${filtros.desde || 'Inicio'}`, { continued: true });
      doc.font('Helvetica-Bold').text('    Hasta:', { continued: true });
      doc.font('Helvetica').text(` ${filtros.hasta || 'Hoy'}`);

      doc.font('Helvetica-Bold').text('Fecha de impresión:', izq + 8, y + 60, { continued: true });
      doc.font('Helvetica').text(` ${formatearFechaHora(new Date())}`);

      // --- Resumen: Existencia anterior / Producido / Despachado / Saldo final ---
      y += 92;
      const existenciaAnterior = parseFloat(datos.existencia_anterior || 0);
      const producido = parseFloat(datos.producido || 0);
      const despachado = parseFloat(datos.despachado || 0);
      // Saldo final = lo que había antes + lo producido - lo despachado.
      const saldo = existenciaAnterior + producido - despachado;

      const cajas = [
        { titulo: 'EXISTENCIA ANTERIOR', valor: existenciaAnterior, color: '#8e44ad' },
        { titulo: 'TOTAL PRODUCIDO', valor: producido, color: '#1e88e5' },
        { titulo: 'TOTAL DESPACHADO', valor: despachado, color: '#2e7d32' },
        { titulo: 'SALDO FINAL', valor: saldo, color: '#616161' }
      ];
      const cajaW = (anchoUtil - 10 * (cajas.length - 1)) / cajas.length;
      cajas.forEach((c, i) => {
        const cx = izq + i * (cajaW + 10);
        doc.roundedRect(cx, y, cajaW, 50, 4).fillAndStroke('#F5F5F5', '#CCCCCC');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#555555');
        doc.text(c.titulo, cx, y + 8, { align: 'center', width: cajaW });
        doc.fontSize(15).font('Helvetica-Bold').fillColor(c.color);
        doc.text(`${fmtNum(c.valor)}`, cx, y + 22, { align: 'center', width: cajaW });
        doc.fontSize(7).font('Helvetica').fillColor('#777777');
        doc.text(unidad, cx, y + 40, { align: 'center', width: cajaW });
      });

      // --- Detalle de producción ---
      y += 74;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Detalle de Producción (órdenes finalizadas)', izq, y);
      y += 18;

      const cols = {
        fecha: { x: izq, w: 120 },
        orden: { x: izq + 120, w: 250 },
        cant: { x: izq + 370, w: anchoUtil - 370 }
      };

      const cabeceraTabla = (yy) => {
        doc.rect(izq, yy, anchoUtil, 18).fill('#333333');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('FECHA', cols.fecha.x + 5, yy + 5, { width: cols.fecha.w - 6 });
        doc.text('N° ORDEN', cols.orden.x + 5, yy + 5, { width: cols.orden.w - 6 });
        doc.text('PRODUCIDO', cols.cant.x, yy + 5, { width: cols.cant.w - 5, align: 'right' });
        return yy + 18;
      };

      y = cabeceraTabla(y);

      if (ordenes.length === 0) {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#666666');
        doc.text('No hay órdenes de producción finalizadas en el rango seleccionado.', izq, y + 8, { width: anchoUtil, align: 'center' });
        y += 26;
      }

      doc.fontSize(8.5).font('Helvetica').fillColor('#000000');
      ordenes.forEach((o, idx) => {
        if (y + 16 > 780) {
          doc.addPage();
          y = 40;
          y = cabeceraTabla(y);
          doc.fontSize(8.5).font('Helvetica').fillColor('#000000');
        }
        if (idx % 2 === 0) {
          doc.rect(izq, y, anchoUtil, 16).fill('#F5F5F5');
        }
        doc.fillColor('#000000').font('Helvetica');
        doc.text(formatearFecha(o.fecha), cols.fecha.x + 5, y + 4, { width: cols.fecha.w - 6 });
        doc.text(o.numero_orden || '-', cols.orden.x + 5, y + 4, { width: cols.orden.w - 6, ellipsis: true });
        doc.text(fmtNum(o.cantidad), cols.cant.x, y + 4, { width: cols.cant.w - 5, align: 'right' });
        y += 16;
      });

      // Total producido
      doc.rect(izq, y, anchoUtil, 18).fill('#DDDDDD');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text('TOTAL PRODUCIDO', cols.fecha.x + 5, y + 5, { width: cols.orden.w + cols.fecha.w });
      doc.text(`${fmtNum(producido)} ${unidad}`, cols.cant.x, y + 5, { width: cols.cant.w - 5, align: 'right' });
      y += 26;

      // --- Pie de página (nota + numeración) por página, en posición fija dentro
      // de los márgenes para no desbordar y crear una hoja vacía. ---
      const rango = doc.bufferedPageRange();
      for (let i = rango.start; i < rango.start + rango.count; i++) {
        doc.switchToPage(i);
        const pageH = doc.page.height;          // A4 ~ 841.9
        const notaY = pageH - 66;               // ~776
        const pagY = pageH - 44;                // ~798 (dentro del margen inferior)

        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#888888');
        doc.text(
          'El total despachado corresponde a las salidas por venta del producto en el periodo. Documento informativo emitido por INDPACK S.A.C.',
          izq, notaY, { width: anchoUtil, align: 'center', lineBreak: true }
        );

        doc.fontSize(7).font('Helvetica').fillColor('#666666');
        doc.text(`Página ${i - rango.start + 1} de ${rango.count}`, izq, pagY, { align: 'right', width: anchoUtil, lineBreak: false });
      }

      doc.end();
    } catch (error) {
      console.error('Error al generar PDF Reporte Producto:', error);
      reject(error);
    }
  });
}