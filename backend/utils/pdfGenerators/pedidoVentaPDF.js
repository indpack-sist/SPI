import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMEZONE = 'America/Lima';

// Cantidad con 5 decimales (formato del documento fuente: 2,000.00000)
const fmtCantidad = (num) => {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5
  });
};

// Precio unitario: hasta 6 decimales para reconciliar con el importe.
const fmtPrecio = (num) => {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
};

// Importes/totales: 2 decimales con separador de miles.
const fmtMonto = (num) => {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

function formatearFechaHora(fecha) {
  if (!fecha) return '';
  const date = new Date(fecha);
  if (isNaN(date.getTime())) return '';
  const f = date.toLocaleDateString('es-PE', {
    timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const h = date.toLocaleTimeString('es-PE', {
    timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  return `${f} ${h}`;
}

function calcularAlturaTexto(doc, texto, ancho, fontSize = 8) {
  const currentFontSize = doc._fontSize || 12;
  doc.fontSize(fontSize);
  const h = doc.heightOfString(texto || '', { width: ancho, lineGap: 2 });
  doc.fontSize(currentFontSize);
  return Math.ceil(h);
}

function dibujarLogoFallback(doc) {
  doc.rect(30, 30, 180, 50).fillAndStroke('#1e88e5', '#1e88e5');
  doc.fontSize(24).fillColor('#FFFFFF').font('Helvetica-Bold');
  doc.text('IndPack', 40, 45);
}

/**
 * Genera el PDF de "PEDIDO" a partir de una orden de venta.
 * Replica el layout comercial: cabecera de empresa, datos del cliente,
 * tabla CANT./DESCRIPCION/P.U./IMPORTE, nota y totales.
 * @param {Object} orden - Orden de venta con `detalle` cargado.
 */
export async function generarPedidoVentaPDF(orden) {
  return new Promise(async (resolve, reject) => {
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const fs = require('fs');

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        bufferPages: true
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let logoBuffer = null;
      try {
        logoBuffer = fs.readFileSync(path.join(__dirname, '../../assets/logohorizontal.jpg'));
      } catch (e) {
        logoBuffer = null;
      }

      if (logoBuffer) {
        try { doc.image(logoBuffer, 30, 30, { width: 180 }); }
        catch (e) { dibujarLogoFallback(doc); }
      } else {
        dibujarLogoFallback(doc);
      }

      // ===== Cabecera empresa =====
      const yEmpresa = 85;
      doc.fontSize(8).fillColor('#000000').font('Helvetica-Bold');
      doc.text('INDPACK S.A.C.', 30, yEmpresa);

      doc.fontSize(7).font('Helvetica').fillColor('#444444');
      doc.text('AV. EL SOL LT. 4 B MZ. LL-1 COO. LAS VERTIENTES DE TABLADA', 30, yEmpresa + 12);
      doc.text('Villa el Salvador, Lima - Lima (PE) - Perú', 30, yEmpresa + 22);
      doc.text('Tel.: 01- 312 7858  |  E-mail: informes@indpackperu.com', 30, yEmpresa + 32);
      doc.text('Web: https://www.indpackperu.com/', 30, yEmpresa + 42);

      // ===== Recuadro RUC / PEDIDO / No. =====
      const xBox = 350, yBox = 30, wBox = 215, hBox = 75;
      doc.roundedRect(xBox, yBox, wBox, hBox, 5).lineWidth(1).stroke('#000000');

      let yText = yBox + 15;
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12);
      doc.text('R.U.C. 20550932297', xBox, yText, { width: wBox, align: 'center' });
      yText += 20;
      doc.fontSize(14);
      doc.text('PEDIDO', xBox, yText, { width: wBox, align: 'center' });
      yText += 20;
      doc.fontSize(12);
      doc.text(`${orden.numero_orden || ''}`, xBox, yText, { width: wBox, align: 'center' });

      // ===== Datos del cliente =====
      const clienteTexto = orden.cliente || orden.razon_social || 'VARIOS';
      const rucTexto = orden.ruc_cliente || orden.ruc || '-';
      const direccionLimpia = (orden.direccion_entrega || orden.direccion_cliente || orden.direccion || '-').replace(/[\r\n]+/g, ' ');
      const comercialTexto = orden.comercial || 'Oficina';
      const condicionesPago = orden.plazo_pago || orden.tipo_venta || 'Contado';
      const terminosPago = orden.forma_pago || (orden.dias_credito ? `${orden.dias_credito} días` : '');
      const ocCliente = orden.orden_compra_cliente || '';
      const fechaPedido = formatearFechaHora(orden.created_at || orden.fecha_emision);

      const yInfo = 145;
      const wInfo = 535;
      const labelX = 40, valueX = 130, valueW = 260;

      // Altura dinámica del bloque
      const filas = [
        ['Cliente:', clienteTexto],
        ['Dirección:', direccionLimpia],
        ['RUC:', rucTexto],
        ['Fecha de Pedido:', fechaPedido],
        ['Comercial:', comercialTexto],
        ['Términos de pago:', terminosPago],
        ['Condiciones de pago:', condicionesPago],
        ['Orden de Compra:', ocCliente]
      ];

      let hInfo = 10;
      const alturasFilas = filas.map(([, val]) => {
        const a = Math.max(13, calcularAlturaTexto(doc, val, valueW, 8) + 3);
        hInfo += a;
        return a;
      });
      hInfo += 8;

      doc.roundedRect(30, yInfo, wInfo, hInfo, 5).lineWidth(0.5).stroke('#000000');

      let currentY = yInfo + 8;
      doc.fontSize(8);
      filas.forEach(([label, val], idx) => {
        doc.fillColor('#000000').font('Helvetica-Bold').text(label, labelX, currentY);
        doc.font('Helvetica').text(val || '', valueX, currentY, { width: valueW, lineGap: 2 });
        currentY += alturasFilas[idx];
      });

      // ===== Cabecera de la tabla =====
      let yTable = yInfo + hInfo + 15;

      const COL = {
        cant:    { x: 30,  w: 105 },
        desc:    { x: 135, w: 290 },
        pu:      { x: 425, w: 60  },
        importe: { x: 485, w: 80  }
      };

      const drawTableHeader = (y) => {
        doc.rect(30, y, 535, 18).fillAndStroke('#e0e0e0', '#000000');
        doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');
        doc.text('CANT.', COL.cant.x + 5, y + 5, { width: COL.cant.w - 5 });
        doc.text('DESCRIPCION', COL.desc.x + 5, y + 5, { width: COL.desc.w - 5 });
        doc.text('P/U', COL.pu.x, y + 5, { width: COL.pu.w - 3, align: 'right' });
        doc.text('IMPORTE', COL.importe.x, y + 5, { width: COL.importe.w - 5, align: 'right' });
        return y + 18;
      };

      yTable = drawTableHeader(yTable);

      const simbolo = orden.moneda === 'USD' ? '$' : 'S/';
      const esSinImpuesto = ['INA', 'EXO', 'INAFECTO', 'EXONERADO'].includes(String(orden.tipo_impuesto || '').toUpperCase());

      let importeBruto = 0;
      let descuentoTotal = 0;

      const detalle = orden.detalle || [];
      detalle.forEach((item, i) => {
        const cantidad = parseFloat(item.cantidad || 0);
        const precioUnitario = parseFloat(item.precio_unitario || 0);
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        const brutoLinea = cantidad * precioUnitario;
        const importeLinea = brutoLinea * (1 - descuento / 100);

        importeBruto += brutoLinea;
        descuentoTotal += brutoLinea - importeLinea;

        const codigo = item.codigo_producto ? `[${item.codigo_producto}] ` : '';
        const descripcion = `${codigo}${item.producto || item.nombre || 'SIN NOMBRE'}`;
        const unidad = item.unidad_medida || 'UND';
        const cantTexto = `${fmtCantidad(cantidad)} ${unidad}`;

        const alturaDesc = calcularAlturaTexto(doc, descripcion, COL.desc.w - 10, 8);
        const alturaFila = Math.max(16, alturaDesc + 6);

        if (yTable + alturaFila > 720) {
          doc.addPage();
          yTable = drawTableHeader(40);
        }

        if (i % 2 === 0) {
          doc.rect(30, yTable, 535, alturaFila).fillAndStroke('#f9f9f9', '#f9f9f9');
        }

        doc.fillColor('#000000').fontSize(8).font('Helvetica');
        doc.text(cantTexto, COL.cant.x + 5, yTable + 3, { width: COL.cant.w - 5 });
        doc.text(descripcion, COL.desc.x + 5, yTable + 3, { width: COL.desc.w - 10, lineGap: 2 });
        doc.text(fmtPrecio(precioUnitario), COL.pu.x, yTable + 3, { width: COL.pu.w - 3, align: 'right' });
        doc.text(`${simbolo} ${fmtMonto(importeLinea)}`, COL.importe.x, yTable + 3, { width: COL.importe.w - 5, align: 'right' });

        yTable += alturaFila;
      });

      doc.moveTo(30, yTable).lineTo(565, yTable).lineWidth(0.5).stroke('#aaaaaa');
      yTable += 12;

      // Salto de página si no hay espacio para nota + totales
      if (yTable > 640) {
        doc.addPage();
        yTable = 40;
      }

      const yFooter = yTable;

      // ===== Nota (observaciones) =====
      doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold').text('Nota:', 30, yFooter);
      doc.font('Helvetica').fontSize(8).text(
        orden.observaciones || '',
        30, yFooter + 12, { width: 330, lineGap: 2 }
      );

      // ===== Totales =====
      const subtotalNeto = parseFloat(orden.subtotal || (importeBruto - descuentoTotal));
      const igv = esSinImpuesto ? 0 : parseFloat(orden.igv || 0);
      const total = esSinImpuesto ? subtotalNeto : parseFloat(orden.total || (subtotalNeto + igv));

      const xLabel = 390, xVal = 470, wVal = 95;
      let yTot = yFooter;

      const filaTotal = (label, valor, bold = false) => {
        doc.fillColor('#000000').fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.text(label, xLabel, yTot, { width: 75 });
        doc.text(`${simbolo} ${fmtMonto(valor)}`, xVal, yTot, { width: wVal, align: 'right' });
        yTot += 15;
      };

      filaTotal('Importe Total', importeBruto);
      filaTotal('Descuento', descuentoTotal);
      filaTotal('Subtotal', subtotalNeto);
      filaTotal(esSinImpuesto ? 'IGV (0%)' : 'IGV', igv);

      doc.moveTo(xLabel, yTot).lineTo(565, yTot).stroke('#000000');
      yTot += 4;
      filaTotal('Total', total, true);

      doc.end();

    } catch (error) {
      console.error('Error al generar PDF de pedido:', error);
      reject(error);
    }
  });
}
