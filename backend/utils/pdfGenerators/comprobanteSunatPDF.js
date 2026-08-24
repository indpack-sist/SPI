// utils/pdfGenerators/comprobanteSunatPDF.js  —  Representación impresa (RS 193-2020). FASE 13.
// Cubre FACTURA (01), NOTA DE CRÉDITO (07) y NOTA DE DÉBITO (08). Incluye el QR (cadena pipe),
// el valor resumen (hash/digestValue) y la leyenda legal. Para notas imprime el documento
// afectado y el motivo. NO consulta BD: recibe todo ya resuelto por el controller.
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { numeroALetras } from '../numeroALetras.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Logo de la empresa (frontend/images/indpack.png). Se cachea en memoria; si falta, se omite.
const LOGO_PATH = path.join(__dirname, '../../../frontend/images/indpack.png');
let _logo; // undefined = sin intentar; null = no disponible; Buffer = cargado
function logoBuffer() {
  if (_logo !== undefined) return _logo;
  try { _logo = fs.readFileSync(LOGO_PATH); } catch { _logo = null; }
  return _logo;
}

// Nombre legible del comprobante por código de tipo (catálogo 01).
export const NOMBRE_TIPO = {
  '01': 'FACTURA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA'
};

const n2 = (v) => Number(v || 0).toFixed(2);

/**
 * @param {object} p
 * @param {object} p.comprobante  { codigo_tipo_sunat, serie, numero, fecha_emision, moneda,
 *                                   subtotal, igv, total, sunat_digest_value, sunat_estado,
 *                                   docAfectado?: { comprobante, motivo } }
 * @param {object} p.emisor       empresa_config { razon_social, ruc, direccion, urbanizacion, telefono, email }
 * @param {object} p.cliente      { razon_social, ruc, tipo_documento, direccion }
 * @param {Array}  p.detalle      [{ codigo, nombre, cantidad, precio_unitario, unidad, descuento_porcentaje }]
 * @param {Buffer} p.qrBuffer     PNG del QR (cadena pipe sunat_qr_data)
 * @returns {Promise<Buffer>}
 */
export async function generarComprobanteSunatPDF({ comprobante: c, emisor, cliente, detalle, qrBuffer }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', (ch) => chunks.push(ch));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const simbolo = String(c.moneda) === 'USD' ? '$' : 'S/';
      const tipoNombre = NOMBRE_TIPO[c.codigo_tipo_sunat] || 'COMPROBANTE ELECTRÓNICO';
      const anulado = c.sunat_estado === 'BAJA';

      // ── Cabecera: logo + emisor (izq) + recuadro RUC/tipo/serie-numero (der) ──
      const logo = logoBuffer();
      if (logo) { try { doc.image(logo, 36, 36, { fit: [150, 46] }); } catch { /* noop */ } }
      doc.fontSize(12).fillColor('#000').font('Helvetica-Bold').text(emisor.razon_social || 'INDPACK S.A.C.', 36, 86, { width: 330 });
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      const dirEmisor = [emisor.direccion, emisor.urbanizacion].filter(Boolean).join(' - ');
      doc.text(dirEmisor || '', 36, 102, { width: 330 });
      if (emisor.telefono) doc.text(`Teléfono: ${emisor.telefono}`, 36, doc.y + 1, { width: 330 });
      if (emisor.email) doc.text(`E-mail: ${emisor.email}`, 36, doc.y + 1, { width: 330 });

      doc.roundedRect(380, 40, 182, 70, 5).stroke('#000');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(`R.U.C. ${emisor.ruc}`, 385, 50, { align: 'center', width: 172 });
      doc.fontSize(11).text(tipoNombre, 385, 68, { align: 'center', width: 172 });
      doc.fontSize(12).text(`${c.serie}-${c.numero}`, 385, 90, { align: 'center', width: 172 });

      // ── Datos del cliente ──
      let y = 140;
      doc.roundedRect(33, y, 529, 62, 3).stroke('#000');
      doc.fontSize(8).fillColor('#000');
      doc.font('Helvetica-Bold').text('Cliente:', 40, y + 8);
      doc.font('Helvetica').text(cliente.razon_social || '-', 110, y + 8, { width: 440 });
      doc.font('Helvetica-Bold').text(String(cliente.tipo_documento || '').toUpperCase() === 'RUC' ? 'RUC:' : 'Doc:', 40, y + 22);
      doc.font('Helvetica').text(cliente.ruc || '-', 110, y + 22);
      doc.font('Helvetica-Bold').text('Dirección:', 40, y + 36);
      doc.font('Helvetica').text((cliente.direccion || '-').replace(/[\r\n]+/g, ' '), 110, y + 36, { width: 440 });
      doc.font('Helvetica-Bold').text('Fecha emisión:', 40, y + 50);
      doc.font('Helvetica').text(String(c.fecha_emision || '-'), 110, y + 50);
      doc.font('Helvetica-Bold').text('Moneda:', 320, y + 50);
      doc.font('Helvetica').text(String(c.moneda) === 'USD' ? 'DÓLARES (USD)' : 'SOLES (PEN)', 380, y + 50);

      y += 70;

      // ── Notas: documento afectado + motivo ──
      if (c.docAfectado) {
        doc.roundedRect(33, y, 529, 30, 3).stroke('#000');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text('Documento que modifica:', 40, y + 6);
        doc.font('Helvetica').text(c.docAfectado.comprobante || '-', 165, y + 6);
        doc.font('Helvetica-Bold').text('Motivo:', 40, y + 18);
        doc.font('Helvetica').text(c.docAfectado.motivo || '-', 165, y + 18, { width: 385 });
        y += 38;
      }

      // ── Tabla de ítems ──
      doc.rect(33, y, 529, 18).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
      doc.text('CÓDIGO', 40, y + 5);
      doc.text('CANT.', 120, y + 5, { width: 45, align: 'center' });
      doc.text('UND.', 168, y + 5, { width: 35, align: 'center' });
      doc.text('DESCRIPCIÓN', 210, y + 5);
      doc.text('P.UNIT.', 450, y + 5, { width: 50, align: 'right' });
      doc.text('TOTAL', 505, y + 5, { width: 55, align: 'right' });
      y += 18;

      doc.font('Helvetica').fontSize(8);
      for (const it of detalle) {
        // El código ya tiene su propia columna: la descripción lleva solo el nombre del producto.
        const desc = it.descripcion || it.nombre || it.codigo || '-';
        const cant = Number(it.cantidad || 0);
        const pu = Number(it.precio_unitario || 0);
        const totalLinea = cant * pu * (1 - Number(it.descuento_porcentaje || 0) / 100);
        const hDesc = doc.heightOfString(desc, { width: 235, lineGap: 1 });
        const hFila = Math.max(16, hDesc + 6);
        if (y + hFila > 690) { doc.addPage(); y = 40; }
        doc.fillColor('#000');
        doc.text(it.codigo || '-', 40, y + 3, { width: 78 });
        doc.text(cant.toFixed(2), 120, y + 3, { width: 45, align: 'center' });
        doc.text(it.unidad || it.codigo_unidad_sunat || 'NIU', 168, y + 3, { width: 35, align: 'center' });
        doc.text(desc, 210, y + 3, { width: 235, lineGap: 1 });
        doc.text(n2(pu), 450, y + 3, { width: 50, align: 'right' });
        doc.text(`${simbolo} ${n2(totalLinea)}`, 505, y + 3, { width: 55, align: 'right' });
        y += hFila;
      }
      doc.moveTo(33, y).lineTo(562, y).stroke('#CCCCCC');
      y += 8;

      // ── Totales ──
      const filaTotal = (label, valor, bold) => {
        doc.roundedRect(385, y, 85, 15, 3).fill('#CCCCCC');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFF').text(label, 390, y + 4, { width: 80 });
        doc.roundedRect(472, y, 90, 15, 3).stroke('#CCCCCC');
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000').text(`${simbolo} ${n2(valor)}`, 476, y + 4, { width: 82, align: 'right' });
        y += 19;
      };
      const yTotalesInicio = y;
      filaTotal('OP. GRAVADA', c.subtotal);
      filaTotal('IGV (18%)', c.igv);
      filaTotal('IMPORTE TOTAL', c.total, true);

      // ── SON: en letras (lado izquierdo, a la altura de los totales) ──
      doc.fontSize(8).font('Helvetica').fillColor('#000');
      doc.text(`SON: ${numeroALetras(Number(c.total || 0), c.moneda)}`, 40, yTotalesInicio, { width: 330 });

      y += 6;

      // ── Pie legal: QR + hash + leyenda ──
      const yPie = Math.max(y, 700);
      if (qrBuffer) { try { doc.image(qrBuffer, 40, yPie, { width: 90, height: 90 }); } catch { /* noop */ } }
      doc.fontSize(7).font('Helvetica').fillColor('#000');
      doc.text('Representación impresa del Comprobante de Pago Electrónico.', 145, yPie + 6, { width: 400 });
      doc.font('Helvetica-Bold').text('Valor resumen (hash):', 145, yPie + 24);
      doc.font('Helvetica').text(c.sunat_digest_value || '-', 145, yPie + 34, { width: 410 });
      doc.font('Helvetica').fillColor('#555').text('Autorizado mediante Resolución de Intendencia. Consulte su validez en www.sunat.gob.pe', 145, yPie + 52, { width: 410 });

      if (anulado) {
        doc.save().rotate(-30, { origin: [297, 400] })
          .fontSize(72).fillColor('#D32F2F').opacity(0.25)
          .text('ANULADO', 120, 380, { align: 'center' }).opacity(1).restore();
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}
