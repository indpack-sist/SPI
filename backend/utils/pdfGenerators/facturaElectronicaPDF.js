/**
 * Representación impresa de la Factura Electrónica (SEE SUNAT), con código QR.
 * Devuelve un Buffer PDF. Layout A4 autocontenido (no depende del PDF manual).
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { montoALetras } from '../../services/sunat/ubl/numero-a-letras.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONEDA_LABEL = { PEN: 'SOLES', USD: 'DÓLARES AMERICANOS' };
const SIMBOLO = { PEN: 'S/', USD: 'US$' };

const money = (n) => Number(n || 0).toFixed(2);

/**
 * @param {object} d datos ya resueltos (ver controlador generarPDFFacturaElectronica)
 * @returns {Promise<Buffer>}
 */
export async function generarFacturaElectronicaPDF(d) {
  const qrDataUrl = await QRCode.toBuffer(d.qrString, { margin: 1, width: 220 });

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageW = doc.page.width;
      const left = 40;
      const right = pageW - 40;
      const sim = SIMBOLO[d.moneda] || 'S/';

      // ===== Encabezado =====
      let logoBuf = null;
      try {
        logoBuf = fs.readFileSync(path.join(__dirname, '../../assets/logohorizontal.jpg'));
      } catch { /* sin logo */ }
      if (logoBuf) {
        try { doc.image(logoBuf, left, 40, { fit: [180, 60] }); } catch {}
      }
      doc.fontSize(9).fillColor('#333');
      doc.text(d.emisor.razonSocial || '', left, 105, { width: 300 });
      doc.fontSize(8).fillColor('#555');
      doc.text(d.emisor.direccion || '', left, doc.y, { width: 300 });
      if (d.emisor.distrito) doc.text(`${d.emisor.distrito} - ${d.emisor.provincia} - ${d.emisor.departamento}`, { width: 300 });

      // Caja RUC / Factura (derecha)
      const boxX = right - 200, boxY = 40, boxW = 200, boxH = 80;
      doc.rect(boxX, boxY, boxW, boxH).lineWidth(1).stroke('#c00');
      doc.fillColor('#000').fontSize(11).font('Helvetica-Bold');
      doc.text(`R.U.C. ${d.emisor.ruc}`, boxX, boxY + 10, { width: boxW, align: 'center' });
      doc.fontSize(12).text(d.esExportacion ? 'FACTURA ELECTRÓNICA' : 'FACTURA ELECTRÓNICA', boxX, boxY + 32, { width: boxW, align: 'center' });
      doc.fontSize(12).text(`${d.serie} - ${d.numero}`, boxX, boxY + 54, { width: boxW, align: 'center' });
      doc.font('Helvetica');

      // ===== Datos del cliente =====
      let y = 150;
      doc.lineWidth(0.5).rect(left, y, right - left, 62).stroke('#999');
      doc.fillColor('#000').fontSize(8);
      const row = (label, value, yy) => {
        doc.font('Helvetica-Bold').text(label, left + 8, yy, { width: 90, continued: false });
        doc.font('Helvetica').text(value || '-', left + 100, yy, { width: right - left - 110 });
      };
      row('Señor(es):', d.cliente.razonSocial, y + 8);
      row(`${d.cliente.docLabel}:`, d.cliente.numDoc, y + 22);
      row('Dirección:', d.cliente.direccion, y + 36);
      row('Fecha Emisión:', d.fechaEmision, y + 50);
      // Moneda a la derecha
      doc.font('Helvetica-Bold').text('Moneda:', right - 180, y + 50, { width: 60 });
      doc.font('Helvetica').text(MONEDA_LABEL[d.moneda] || d.moneda, right - 120, y + 50, { width: 110 });

      // ===== Tabla de ítems =====
      y += 78;
      const cols = { cant: left + 4, um: left + 55, desc: left + 95, vunit: right - 150, imp: right - 70 };
      doc.rect(left, y, right - left, 18).fill('#f0f0f0').stroke('#999');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(8);
      doc.text('Cant.', cols.cant, y + 5);
      doc.text('U.M.', cols.um, y + 5);
      doc.text('Descripción', cols.desc, y + 5);
      doc.text('V. Unit.', cols.vunit, y + 5, { width: 70, align: 'right' });
      doc.text('Importe', cols.imp, y + 5, { width: 60, align: 'right' });
      y += 18;

      doc.font('Helvetica').fontSize(8);
      d.lineas.forEach((ln) => {
        const importe = Number(ln.cantidad) * Number(ln.valorUnitario);
        const hDesc = doc.heightOfString(ln.descripcion || '', { width: cols.vunit - cols.desc - 6 });
        const rowH = Math.max(16, hDesc + 6);
        doc.fillColor('#000');
        doc.text(String(ln.cantidad), cols.cant, y + 3, { width: 48 });
        doc.text(ln.unidad || 'NIU', cols.um, y + 3, { width: 38 });
        doc.text(ln.descripcion || '', cols.desc, y + 3, { width: cols.vunit - cols.desc - 6 });
        doc.text(money(ln.valorUnitario), cols.vunit, y + 3, { width: 70, align: 'right' });
        doc.text(money(importe), cols.imp, y + 3, { width: 60, align: 'right' });
        y += rowH;
        doc.moveTo(left, y).lineTo(right, y).lineWidth(0.3).stroke('#ddd');
      });

      // ===== Totales =====
      y += 10;
      const totLabelX = right - 200, totValX = right - 90;
      const totLine = (label, val) => {
        doc.font('Helvetica').fontSize(8).text(label, totLabelX, y, { width: 100, align: 'right' });
        doc.text(`${sim} ${money(val)}`, totValX, y, { width: 82, align: 'right' });
        y += 14;
      };
      if (d.esExportacion) {
        totLine('Op. Exportación:', d.totales.exportacion);
      } else {
        totLine('Op. Gravada:', d.totales.gravado);
        totLine('I.G.V. (18%):', d.totales.igv);
      }
      doc.font('Helvetica-Bold');
      totLine('IMPORTE TOTAL:', d.totales.total);
      doc.font('Helvetica');

      // Monto en letras
      const letras = `SON: ${montoALetras(d.totales.total)} ${MONEDA_LABEL[d.moneda] || ''}`.trim();
      doc.fontSize(8).font('Helvetica-Bold').text(letras, left, y, { width: right - left - 10 });
      y += 24;

      // ===== QR + hash =====
      doc.image(qrDataUrl, left, y, { width: 100 });
      doc.font('Helvetica').fontSize(7).fillColor('#333');
      doc.text('Representación impresa de la FACTURA ELECTRÓNICA.', left + 115, y + 4, { width: right - left - 120 });
      doc.text(`Autorizado mediante Resolución de SUNAT. Consulte en www.sunat.gob.pe`, left + 115, y + 18, { width: right - left - 120 });
      if (d.hash) doc.text(`Hash (Resumen): ${d.hash}`, left + 115, y + 40, { width: right - left - 120 });
      if (d.sunatEstado) doc.fillColor(d.sunatEstado === 'ANULADA' ? '#c00' : '#080').text(`Estado SUNAT: ${d.sunatEstado}`, left + 115, y + 54);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
