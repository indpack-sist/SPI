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
  const limaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  return limaDate.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatearHora(fecha) {
  if (!fecha) return 'N/A';
  const date = new Date(fecha);
  const limaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  return limaDate.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
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
  const logoBuffer = await cargarLogoURL(); // Asegúrate de que esta función exista o usa la lógica anterior

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

      // --- CABECERA Y LOGO ---
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

      // Nota: Asumo que el objeto EMPRESA está disponible en el ámbito o importado
      // Si no, deberás definirlo o usar strings directos como en la función anterior.
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
      doc.text('CONSTANCIA DE SALIDA', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`No. ${datos.codigo || datos.id_salida || 'N/A'}`, 385, 95, { align: 'center', width: 155 });

      const destino = datos.tipo_movimiento === 'Venta' 
        ? datos.cliente 
        : datos.departamento || datos.tipo_movimiento;

      const alturaDestino = calcularAlturaTexto(doc, destino || 'N/A', 195, 8);
      const alturaInfoSalida = Math.max(105, alturaDestino + 90);
      
      doc.roundedRect(33, 205, 529, alturaInfoSalida, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, 213);
      doc.font('Helvetica');
      doc.text(new Date(datos.fecha_movimiento).toLocaleDateString('es-PE'), 100, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Hora:', 40, 228);
      doc.font('Helvetica');
      // Función simple para hora si no tienes formatearHora
      const horaStr = new Date(datos.fecha_movimiento).toLocaleTimeString('es-PE', {hour: '2-digit', minute:'2-digit'});
      doc.text(horaStr, 100, 228);
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo Inventario:', 40, 243);
      doc.font('Helvetica');
      doc.text(datos.tipo_inventario || 'N/A', 120, 243, { width: 210 });
      
      doc.font('Helvetica-Bold');
      doc.text('Tipo Movimiento:', 40, 258);
      doc.font('Helvetica');
      doc.text(datos.tipo_movimiento || 'N/A', 120, 258, { width: 210 });

      doc.font('Helvetica-Bold');
      doc.text('Destinatario/Área:', 40, 273);
      doc.font('Helvetica');
      doc.text(destino || 'N/A', 120, 273, { width: 210, lineGap: 2 });

      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 213);
      doc.font('Helvetica');
      doc.text(datos.estado || 'N/A', 410, 213);
      
      doc.font('Helvetica-Bold');
      doc.text('Referencia/Vehículo:', 360, 228);
      doc.font('Helvetica');
      doc.text(datos.vehiculo || '---', 360, 243, { width: 195 });

      let yPos = 205 + alturaInfoSalida + 10;

      doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('CÓDIGO', 40, yPos + 6);
      doc.text('DESCRIPCIÓN', 140, yPos + 6);
      doc.text('CANTIDAD', 420, yPos + 6, { width: 60, align: 'center' });
      doc.text('UNIDAD', 485, yPos + 6, { width: 50, align: 'center' });

      yPos += 20;

      const detalles = datos.detalles || [];
      
      detalles.forEach((item, idx) => {
        const descripcion = item.producto;
        const alturaDescripcion = calcularAlturaTexto(doc, descripcion, 270, 8);
        const alturaFila = Math.max(20, alturaDescripcion + 10);

        if (yPos + alturaFila > 700) {
          doc.addPage();
          yPos = 50;
          
          doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
          doc.text('CÓDIGO', 40, yPos + 6);
          doc.text('DESCRIPCIÓN', 140, yPos + 6);
          doc.text('CANTIDAD', 420, yPos + 6, { width: 60, align: 'center' });
          doc.text('UNIDAD', 485, yPos + 6, { width: 50, align: 'center' });
          yPos += 20;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        
        doc.text(item.codigo_producto, 40, yPos + 5);
        doc.text(descripcion, 140, yPos + 5, { width: 270, lineGap: 2 });
        doc.text(parseFloat(item.cantidad || 0).toFixed(2), 420, yPos + 5, { width: 60, align: 'center' });
        doc.text(item.unidad_medida || '', 485, yPos + 5, { width: 50, align: 'center' });

        yPos += alturaFila;
      });

      yPos += 10;

      if (datos.observaciones) {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('OBSERVACIONES', 40, yPos);
        
        doc.fontSize(8).font('Helvetica');
        doc.text(datos.observaciones, 40, yPos + 15, { width: 330 });
      }

      doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('TOTAL ITEMS', 390, yPos + 4);
      
      doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`${detalles.length}`, 475, yPos + 4, { align: 'right', width: 80 });

      // ============================================
      // NUEVA SECCIÓN DE FIRMAS (TIPO PIE DE PÁGINA)
      // ============================================
      
      // Definimos la posición Y fija para el pie de página
      let yFirmas = 720;
      
      // Si el contenido actual está muy cerca del final (más allá de Y=650),
      // creamos nueva página para evitar que las firmas se monten o queden cortadas.
      if (yPos > 650) {
        doc.addPage();
        // En la nueva página, mantenemos yFirmas al fondo
        yFirmas = 720;
      }

      // Dibujamos las 3 firmas alineadas horizontalmente
      const anchoLinea = 135;
      
      // 1. DESPACHADO POR (Izquierda) - X aprox 40
      doc.moveTo(40, yFirmas).lineTo(40 + anchoLinea, yFirmas).stroke('#000000');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('DESPACHADO POR', 40, yFirmas + 5, { width: anchoLinea, align: 'center' });

      // 2. VERIFICADO POR (Centro) - X aprox 215
      doc.moveTo(215, yFirmas).lineTo(215 + anchoLinea, yFirmas).stroke('#000000');
      doc.text('VERIFICADO POR', 215, yFirmas + 5, { width: anchoLinea, align: 'center' });

      // 3. RECIBIDO POR (Derecha) - X aprox 390
      doc.moveTo(390, yFirmas).lineTo(390 + anchoLinea, yFirmas).stroke('#000000');
      doc.text('RECIBIDO POR', 390, yFirmas + 5, { width: anchoLinea, align: 'center' });

      // ============================================
      // FIN SECCIÓN FIRMAS
      // ============================================

      doc.fontSize(7).font('Helvetica').fillColor('#666666');
      doc.text('Documento de Control de Inventario - INDPACK S.A.C.', 50, 770, { align: 'center', width: 495 });

      doc.end();
      
    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}

// Función auxiliar necesaria si no la tienes importada
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

      doc.roundedRect(380, 40, 165, 65, 5).stroke('#000000');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text(`R.U.C. ${EMPRESA.ruc}`, 385, 48, { align: 'center', width: 155 });
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('ORDEN DE PRODUCCIÓN', 385, 65, { align: 'center', width: 155 });
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`No. ${datos.numero_orden || 'N/A'}`, 385, 83, { align: 'center', width: 155 });

      const alturaInfoProduccion = 105;
      doc.roundedRect(33, 205, 529, alturaInfoProduccion, 3).stroke('#000000');
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Fecha:', 40, 213);
      doc.font('Helvetica');
      doc.text(formatearFecha(datos.fecha_creacion), 100, 213);
      
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
      doc.text('Cant. Planificada:', 40, 273);
      doc.font('Helvetica');
      doc.text(`${datos.cantidad_planificada || 0} ${datos.unidad_medida || ''}`, 100, 273);

      doc.font('Helvetica-Bold');
      doc.text('Estado:', 360, 213);
      doc.font('Helvetica');
      doc.text(datos.estado || 'N/A', 450, 213);
      
      if (datos.cantidad_producida > 0) {
        doc.font('Helvetica-Bold');
        doc.text('Cant. Producida:', 360, 228);
        doc.font('Helvetica');
        doc.text(`${datos.cantidad_producida} ${datos.unidad_medida || ''}`, 450, 228);
      }

      let yPos = 320;

      if (consumoMateriales.length > 0) {
        doc.rect(33, yPos, 529, 20).fill('#CCCCCC');
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text('INSUMO', 40, yPos + 6);
        doc.text('CANTIDAD', 350, yPos + 6);
        doc.text('C. UNIT.', 430, yPos + 6, { align: 'right', width: 50 });
        doc.text('SUBTOTAL', 490, yPos + 6, { align: 'right', width: 60 });

        yPos += 20;

        consumoMateriales.forEach((item, idx) => {
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
          
          doc.text(descripcion, 40, yPos + 5, { width: 300, lineGap: 2 });
          doc.text(`${item.cantidad_requerida} ${item.unidad_medida || ''}`, 350, yPos + 5);
          doc.text(`S/ ${parseFloat(item.costo_unitario).toFixed(2)}`, 430, yPos + 5, { align: 'right', width: 50 });
          doc.text(`S/ ${parseFloat(item.costo_total).toFixed(2)}`, 490, yPos + 5, { align: 'right', width: 60 });

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

        registrosParciales.forEach((reg, idx) => {
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

        mermas.forEach((merma, idx) => {
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

        doc.roundedRect(385, yPos, 85, 15, 3).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
        doc.text('COSTO MATERIALES', 390, yPos + 4);
        
        doc.roundedRect(470, yPos, 92, 15, 3).stroke('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`S/ ${parseFloat(datos.costo_materiales).toFixed(2)}`, 475, yPos + 4, { align: 'right', width: 80 });

        yPos += 25;

        doc.fontSize(8).font('Helvetica');
        const totalEnLetras = numeroALetras(parseFloat(datos.costo_materiales), 'PEN');
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
      const fechaEmision = formatearFecha(orden.fecha_emision);
      doc.text(fechaEmision, 40, yPosRecuadroFechas + 25, { align: 'center', width: 260 });

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