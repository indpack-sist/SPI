// backend/utils/pdfGenerators/cotizacionPDF.js
import PDFDocument from 'pdfkit';
import axios from 'axios';

/**
 * Convertir número a texto en español
 */
function numeroALetras(numero) {
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (numero === 0) return 'CERO';
  if (numero === 100) return 'CIEN';

  let letras = '';
  const entero = Math.floor(numero);
  const decimales = Math.round((numero - entero) * 100);

  // Miles
  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    if (miles === 1) {
      letras += 'MIL ';
    } else {
      letras += convertirCentenas(miles) + ' MIL ';
    }
    const resto = entero % 1000;
    if (resto > 0) {
      letras += convertirCentenas(resto);
    }
  } else {
    letras = convertirCentenas(entero);
  }

  function convertirCentenas(num) {
    let resultado = '';
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;

    if (c > 0) {
      resultado += centenas[c] + ' ';
    }

    if (d === 1 && u > 0) {
      resultado += especiales[u - 1];
    } else {
      if (d > 0) resultado += decenas[d] + ' ';
      if (u > 0) resultado += (d > 0 ? 'Y ' : '') + unidades[u];
    }

    return resultado.trim();
  }

  if (decimales > 0) {
    letras += ' CON ' + decimales.toString().padStart(2, '0') + '/100';
  }

  return letras.trim();
}

/**
 * Formatear fecha a DD/MM/YYYY
 */
function formatearFecha(fecha) {
  if (!fecha) return '';
  const date = new Date(fecha);
  const dia = date.getDate().toString().padStart(2, '0');
  const mes = (date.getMonth() + 1).toString().padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Descargar logo desde URL
 */
async function descargarLogo(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error al descargar logo:', error.message);
    return null;
  }
}

/**
 * Generar PDF de Cotización
 */
export async function generarCotizacionPDF(cotizacion) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // ============================================
      // ENCABEZADO
      // ============================================
      let yPosition = 50;

      // Logo (Izquierda)
      try {
        const logoBuffer = await descargarLogo('https://indpackperu.com/images/logohorizontal.png');
        if (logoBuffer) {
          doc.image(logoBuffer, 50, yPosition, { width: 180 });
        }
      } catch (error) {
        console.error('Error al cargar logo:', error);
      }

      // Recuadro RUC y Cotización (Derecha)
      const recuadroX = 400;
      const recuadroY = yPosition;
      const recuadroWidth = 145;
      const recuadroHeight = 80;

      doc.rect(recuadroX, recuadroY, recuadroWidth, recuadroHeight).stroke();
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('R.U.C. 20550932297', recuadroX + 10, recuadroY + 10, { width: recuadroWidth - 20, align: 'center' });
      
      doc.fontSize(14)
         .text('COTIZACIÓN', recuadroX + 10, recuadroY + 30, { width: recuadroWidth - 20, align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .text(cotizacion.numero_cotizacion, recuadroX + 10, recuadroY + 55, { width: recuadroWidth - 20, align: 'center' });

      // Datos de la empresa (Debajo del logo)
      yPosition += 100;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('INDPACK S.A.C.', 50, yPosition);
      
      yPosition += 12;
      doc.fontSize(8)
         .font('Helvetica')
         .text('Av. El Sol Mz. D Lt. 01 Sector 1 Grupo 20, Villa El Salvador', 50, yPosition);
      
      yPosition += 10;
      doc.text('Teléfono: +51 981 433 796', 50, yPosition);
      
      yPosition += 10;
      doc.text('Email: ventas@indpackperu.com', 50, yPosition);
      
      yPosition += 10;
      doc.text('www.indpackperu.com', 50, yPosition);

      // ============================================
      // INFORMACIÓN DEL CLIENTE
      // ============================================
      yPosition += 30;
      
      // Línea separadora
      doc.moveTo(50, yPosition)
         .lineTo(545, yPosition)
         .stroke();
      
      yPosition += 15;

      // Fecha
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('FECHA:', 50, yPosition, { continued: true })
         .font('Helvetica')
         .text(` ${formatearFecha(cotizacion.fecha_emision)}`, { continued: false });

      // Cliente en dos columnas
      yPosition += 15;
      const col1X = 50;
      const col2X = 300;
      let currentY = yPosition;

      // Columna 1
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('RUC:', col1X, currentY, { continued: true })
         .font('Helvetica')
         .text(` ${cotizacion.ruc_cliente || 'N/A'}`, { continued: false });

      currentY += 12;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('CLIENTE:', col1X, currentY);
      
      currentY += 12;
      doc.fontSize(9)
         .font('Helvetica')
         .text(cotizacion.cliente, col1X, currentY, { width: 240 });

      currentY += 12;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('DIRECCIÓN:', col1X, currentY);
      
      currentY += 12;
      doc.fontSize(9)
         .font('Helvetica')
         .text(cotizacion.direccion_cliente || 'N/A', col1X, currentY, { width: 240 });

      // Columna 2
      let col2Y = yPosition;
      
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('MONEDA:', col2X, col2Y, { continued: true })
         .font('Helvetica')
         .text(` ${cotizacion.moneda}`, { continued: false });

      col2Y += 12;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('PLAZO PAGO:', col2X, col2Y, { continued: true })
         .font('Helvetica')
         .text(` ${cotizacion.plazo_pago || 'Contado'}`, { continued: false });

      col2Y += 12;
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('FORMA PAGO:', col2X, col2Y, { continued: true })
         .font('Helvetica')
         .text(` ${cotizacion.forma_pago || 'N/A'}`, { continued: false });

      // Avanzar yPosition al máximo de ambas columnas
      yPosition = Math.max(currentY, col2Y) + 15;

      // Asesor en línea separada
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('ASESOR COMERCIAL:', 50, yPosition);
      
      yPosition += 12;
      doc.fontSize(9)
         .font('Helvetica')
         .text(cotizacion.comercial || 'N/A', 50, yPosition);

      if (cotizacion.email_comercial) {
        yPosition += 12;
        doc.fontSize(8)
           .font('Helvetica')
           .text(cotizacion.email_comercial, 50, yPosition);
      }

      // ============================================
      // TABLA DE PRODUCTOS
      // ============================================
      yPosition += 25;
      
      // Encabezados de tabla
      const tableTop = yPosition;
      const tableHeaders = [
        { text: 'CÓDIGO', x: 50, width: 60, align: 'left' },
        { text: 'CANT.', x: 115, width: 40, align: 'center' },
        { text: 'UNID', x: 160, width: 35, align: 'center' },
        { text: 'DESCRIPCIÓN', x: 200, width: 200, align: 'left' },
        { text: 'V. UNIT.', x: 405, width: 65, align: 'right' },
        { text: 'V. VENTA', x: 475, width: 70, align: 'right' }
      ];

      // Fondo de encabezado
      doc.rect(50, tableTop, 495, 20).fill('#2563eb');
      
      // Texto de encabezados
      doc.fillColor('#ffffff')
         .fontSize(8)
         .font('Helvetica-Bold');
      
      tableHeaders.forEach(header => {
        doc.text(header.text, header.x, tableTop + 6, { 
          width: header.width, 
          align: header.align 
        });
      });

      // Línea después del encabezado
      yPosition = tableTop + 20;
      doc.fillColor('#000000');

      // Filas de productos
      cotizacion.detalle.forEach((item, index) => {
        // Calcular altura de la fila según descripción
        const descripcionLines = Math.ceil(item.producto.length / 35);
        const rowHeight = Math.max(descripcionLines * 12, 25);

        // Alternar color de fondo
        if (index % 2 === 0) {
          doc.rect(50, yPosition, 495, rowHeight).fill('#f9fafb');
        }

        doc.fillColor('#000000')
           .fontSize(8)
           .font('Helvetica');

        const rowY = yPosition + 7;

        // CÓDIGO
        doc.text(item.codigo_producto || '', 50, rowY, { 
          width: 60, 
          align: 'left',
          lineBreak: false
        });

        // CANTIDAD
        doc.text(parseFloat(item.cantidad).toFixed(2), 115, rowY, { 
          width: 40, 
          align: 'center',
          lineBreak: false
        });

        // UNIDAD - ✅ CORREGIDO: Sin lineBreak para evitar mezcla
        doc.text(item.unidad_medida || 'UND', 160, rowY, { 
          width: 35, 
          align: 'center',
          lineBreak: false
        });

        // DESCRIPCIÓN - ✅ CORREGIDO: Con wrap para textos largos
        doc.text(item.producto, 200, rowY, { 
          width: 200, 
          align: 'left'
        });

        // VALOR UNITARIO
        const simbolo = cotizacion.moneda === 'USD' ? '$' : 'S/';
        doc.text(`${simbolo} ${parseFloat(item.precio_unitario).toFixed(2)}`, 405, rowY, { 
          width: 65, 
          align: 'right',
          lineBreak: false
        });

        // VALOR VENTA
        const valorVenta = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
        const descuento = valorVenta * (parseFloat(item.descuento_porcentaje || 0) / 100);
        const valorTotal = valorVenta - descuento;
        
        doc.text(`${simbolo} ${valorTotal.toFixed(2)}`, 475, rowY, { 
          width: 70, 
          align: 'right',
          lineBreak: false
        });

        yPosition += rowHeight;

        // Nueva página si es necesario
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }
      });

      // Línea final de tabla
      doc.moveTo(50, yPosition)
         .lineTo(545, yPosition)
         .stroke();

      // ============================================
      // TOTALES
      // ============================================
      yPosition += 15;
      const totalesX = 405;
      const simbolo = cotizacion.moneda === 'USD' ? '$' : 'S/';

      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('SUB TOTAL:', totalesX, yPosition, { width: 70, align: 'left' });
      
      doc.font('Helvetica')
         .text(`${simbolo} ${parseFloat(cotizacion.subtotal).toFixed(2)}`, totalesX + 70, yPosition, { 
           width: 70, 
           align: 'right' 
         });

      yPosition += 15;
      const nombreImpuesto = cotizacion.tipo_impuesto || 'IGV';
      const porcentajeImpuesto = parseFloat(cotizacion.porcentaje_impuesto || 18).toFixed(0);
      
      doc.font('Helvetica-Bold')
         .text(`${nombreImpuesto} (${porcentajeImpuesto}%):`, totalesX, yPosition, { width: 70, align: 'left' });
      
      doc.font('Helvetica')
         .text(`${simbolo} ${parseFloat(cotizacion.igv).toFixed(2)}`, totalesX + 70, yPosition, { 
           width: 70, 
           align: 'right' 
         });

      yPosition += 15;
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('TOTAL:', totalesX, yPosition, { width: 70, align: 'left' });
      
      doc.text(`${simbolo} ${parseFloat(cotizacion.total).toFixed(2)}`, totalesX + 70, yPosition, { 
        width: 70, 
        align: 'right' 
      });

      // ✅ NUEVO: Mostrar tipo de cambio y equivalencia
      const tipoCambio = parseFloat(cotizacion.tipo_cambio || 1);
      if (tipoCambio > 1) {
        yPosition += 20;
        
        // Tipo de cambio
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#666666')
           .text(`Tipo de Cambio: ${tipoCambio.toFixed(4)}`, totalesX, yPosition, { width: 140, align: 'left' });
        
        yPosition += 12;
        
        // Equivalencia
        if (cotizacion.moneda === 'PEN') {
          const equivalenteUSD = parseFloat(cotizacion.total) / tipoCambio;
          doc.text(`Equivalente: $ ${equivalenteUSD.toFixed(2)}`, totalesX, yPosition, { width: 140, align: 'left' });
        } else if (cotizacion.moneda === 'USD') {
          const equivalentePEN = parseFloat(cotizacion.total) * tipoCambio;
          doc.text(`Equivalente: S/ ${equivalentePEN.toFixed(2)}`, totalesX, yPosition, { width: 140, align: 'left' });
        }
        
        doc.fillColor('#000000'); // Restaurar color negro
      }

      // ============================================
      // MONTO EN LETRAS
      // ============================================
      yPosition += 25;
      const totalEnLetras = numeroALetras(parseFloat(cotizacion.total));
      const monedaLetras = cotizacion.moneda === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';
      
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('SON:', 50, yPosition, { continued: true })
         .font('Helvetica')
         .text(` ${totalEnLetras} ${monedaLetras}`, { width: 495 });

      // ============================================
      // CONDICIONES
      // ============================================
      yPosition += 25;
      
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('CONDICIONES:', 50, yPosition);
      
      yPosition += 15;
      
      // Plazo de entrega con formato mejorado
      const plazoEntrega = cotizacion.plazo_entrega || 'Según coordinación';
      let textoEntrega = plazoEntrega;
      
      // Si es solo un número, agregar "días hábiles"
      if (/^\d+$/.test(plazoEntrega)) {
        textoEntrega = `${plazoEntrega} días hábiles`;
      }
      
      doc.fontSize(8)
         .font('Helvetica')
         .text(`• Plazo de entrega: ${textoEntrega}`, 55, yPosition);
      
      yPosition += 12;
      doc.text(`• Lugar de entrega: ${cotizacion.lugar_entrega || cotizacion.direccion_cliente || 'Por coordinar'}`, 55, yPosition, { width: 490 });
      
      yPosition += 12;
      const validezDias = cotizacion.validez_dias || 7;
      doc.text(`• Validez de la oferta: ${validezDias} días calendario`, 55, yPosition);

      // Observaciones si existen
      if (cotizacion.observaciones) {
        yPosition += 20;
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text('OBSERVACIONES:', 50, yPosition);
        
        yPosition += 12;
        doc.fontSize(8)
           .font('Helvetica')
           .text(cotizacion.observaciones, 50, yPosition, { width: 495 });
      }

      // ============================================
      // PIE DE PÁGINA
      // ============================================
      doc.fontSize(7)
         .font('Helvetica')
         .fillColor('#666666')
         .text('Este documento ha sido generado electrónicamente por el sistema IndPack.', 50, 770, { 
           width: 495, 
           align: 'center' 
         });

      doc.end();

    } catch (error) {
      console.error('Error al generar PDF:', error);
      reject(error);
    }
  });
}