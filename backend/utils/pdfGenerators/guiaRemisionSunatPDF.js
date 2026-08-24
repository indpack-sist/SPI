// utils/pdfGenerators/guiaRemisionSunatPDF.js  —  Representación impresa GRE Remitente (09). FASE 13.
// El QR de la GRE NO es la cadena pipe: es la URL que devuelve SUNAT (sunat_qr_url). Sin montos.
// Solo debe generarse cuando sunat_estado === 'ACEPTADO' (lo valida el controller).
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../../../frontend/images/indpack.png');
let _logo;
function logoBuffer() {
  if (_logo !== undefined) return _logo;
  try { _logo = fs.readFileSync(LOGO_PATH); } catch { _logo = null; }
  return _logo;
}

const trunc = (s, n) => String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s);

const MOTIVOS_TRASLADO = {
  '01': 'VENTA', '02': 'COMPRA', '04': 'TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA',
  '08': 'IMPORTACION', '09': 'EXPORTACION', '13': 'OTROS',
  '14': 'VENTA SUJETA A CONFIRMACION DEL COMPRADOR', '18': 'TRASLADO EMISOR ITINERANTE CP'
};

/**
 * @param {object} p
 * @param {object} p.guia      { serie_sunat, numero_sunat, fecha_emision, fecha_traslado, motivo_traslado_cod,
 *                               peso_bruto_kg, ubigeo_partida, direccion_partida, ubigeo_llegada, direccion_llegada,
 *                               sunat_estado, sunat_digest_value, placa }
 * @param {object} p.emisor    empresa_config
 * @param {object} p.cliente   destinatario { razon_social, ruc }
 * @param {Array}  p.detalle   [{ codigo, nombre, cantidad, codigo_unidad_sunat }]
 * @param {object|null} p.conductor  { nombre_completo, dni, licencia_conducir }
 * @param {Buffer} p.qrBuffer  PNG del QR con la URL de SUNAT
 * @returns {Promise<Buffer>}
 */
export async function generarGuiaRemisionSunatPDF({ guia: g, emisor, cliente, detalle, conductor, qrBuffer }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
      const chunks = [];
      doc.on('data', (ch) => chunks.push(ch));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Cabecera ──
      const logo = logoBuffer();
      if (logo) { try { doc.image(logo, 36, 36, { fit: [150, 46] }); } catch { /* noop */ } }
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000').text(emisor.razon_social || 'INDPACK S.A.C.', 36, 86, { width: 330 });
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      const dirEmisor = [emisor.direccion, emisor.urbanizacion].filter(Boolean).join(' - ');
      doc.text(dirEmisor || '', 36, 102, { width: 330 });

      doc.roundedRect(380, 40, 182, 70, 5).stroke('#000');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(`R.U.C. ${emisor.ruc}`, 385, 50, { align: 'center', width: 172 });
      doc.fontSize(10).text('GUÍA DE REMISIÓN', 385, 68, { align: 'center', width: 172 });
      doc.fontSize(9).text('REMITENTE ELECTRÓNICA', 385, 82, { align: 'center', width: 172 });
      doc.fontSize(12).text(`${g.serie_sunat}-${g.numero_sunat}`, 385, 94, { align: 'center', width: 172 });

      // ── Destinatario + datos generales ──
      // Doble dirección: la fiscal del destinatario va aquí; la de entrega es el "Punto de llegada".
      let y = 122;
      doc.roundedRect(33, y, 529, 60, 3).stroke('#000');
      doc.fontSize(8).fillColor('#000');
      doc.font('Helvetica-Bold').text('Destinatario:', 40, y + 8);
      doc.font('Helvetica').text(cliente.razon_social || '-', 120, y + 8, { width: 430 });
      doc.font('Helvetica-Bold').text('RUC/Doc:', 40, y + 21);
      doc.font('Helvetica').text(cliente.ruc || '-', 120, y + 21);
      doc.font('Helvetica-Bold').text('Dir. fiscal:', 40, y + 34);
      doc.font('Helvetica').text(trunc(String(cliente.direccion || '-').replace(/[\r\n]+/g, ' ').trim() || '-', 105), 120, y + 34, { width: 435 });
      doc.font('Helvetica-Bold').text('Fecha emisión:', 40, y + 47);
      doc.font('Helvetica').text(String(g.fecha_emision || '-'), 120, y + 47);
      doc.font('Helvetica-Bold').text('Inicio traslado:', 320, y + 47);
      doc.font('Helvetica').text(String(g.fecha_traslado || '-'), 400, y + 47);

      y += 68;

      // ── Datos del traslado ──
      doc.roundedRect(33, y, 529, 76, 3).stroke('#000');
      const motivo = MOTIVOS_TRASLADO[String(g.motivo_traslado_cod)] || 'TRASLADO';
      doc.font('Helvetica-Bold').text('Motivo de traslado:', 40, y + 8);
      doc.font('Helvetica').text(`${g.motivo_traslado_cod} - ${motivo}`, 155, y + 8, { width: 400 });
      doc.font('Helvetica-Bold').text('Peso bruto total:', 40, y + 22);
      doc.font('Helvetica').text(`${Number(g.peso_bruto_kg || 0).toFixed(2)} KGM`, 155, y + 22);
      doc.font('Helvetica-Bold').text('Punto de partida:', 40, y + 36);
      doc.font('Helvetica').text(`[${g.ubigeo_partida}] ${(g.direccion_partida || '-').replace(/[\r\n]+/g, ' ')}`, 155, y + 36, { width: 400 });
      doc.font('Helvetica-Bold').text('Punto de llegada:', 40, y + 50);
      doc.font('Helvetica').text(`[${g.ubigeo_llegada}] ${(g.direccion_llegada || '-').replace(/[\r\n]+/g, ' ')}`, 155, y + 50, { width: 400 });
      if (conductor) {
        doc.font('Helvetica-Bold').text('Conductor / Placa:', 40, y + 64);
        doc.font('Helvetica').text(
          `${conductor.nombre_completo || '-'} (DNI ${conductor.dni || '-'}, Lic. ${conductor.licencia_conducir || '-'})  ·  Placa ${g.placa || '-'}`,
          155, y + 64, { width: 400 });
      }

      y += 84;

      // ── Tabla de bienes (sin montos) ──
      doc.rect(33, y, 529, 18).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
      doc.text('CÓDIGO', 40, y + 5);
      doc.text('CANT.', 120, y + 5, { width: 50, align: 'center' });
      doc.text('UND.', 175, y + 5, { width: 40, align: 'center' });
      doc.text('DESCRIPCIÓN', 225, y + 5);
      y += 18;

      doc.font('Helvetica').fontSize(8);
      for (const it of detalle) {
        const desc = it.nombre || it.codigo || '-';
        const hDesc = doc.heightOfString(desc, { width: 320, lineGap: 1 });
        const hFila = Math.max(16, hDesc + 6);
        if (y + hFila > 690) { doc.addPage(); y = 40; }
        doc.fillColor('#000');
        doc.text(it.codigo || '-', 40, y + 3, { width: 78 });
        doc.text(Number(it.cantidad || 0).toFixed(2), 120, y + 3, { width: 50, align: 'center' });
        doc.text(it.codigo_unidad_sunat || 'NIU', 175, y + 3, { width: 40, align: 'center' });
        doc.text(desc, 225, y + 3, { width: 320, lineGap: 1 });
        y += hFila;
      }
      doc.moveTo(33, y).lineTo(562, y).stroke('#CCCCCC');

      // ── Pie legal: QR (URL SUNAT) + hash + leyenda ──
      const yPie = Math.max(y + 12, 700);
      if (qrBuffer) { try { doc.image(qrBuffer, 40, yPie, { width: 90, height: 90 }); } catch { /* noop */ } }
      doc.fontSize(7).font('Helvetica').fillColor('#000');
      doc.text('Representación impresa de la Guía de Remisión Electrónica.', 145, yPie + 6, { width: 400 });
      doc.text('El QR contiene la URL de consulta pública de SUNAT.', 145, yPie + 16, { width: 400 });
      doc.font('Helvetica-Bold').text('Valor resumen (hash):', 145, yPie + 30);
      doc.font('Helvetica').text(g.sunat_digest_value || '-', 145, yPie + 40, { width: 410 });

      doc.end();
    } catch (e) { reject(e); }
  });
}
