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

      // Helper: "Etiqueta: valor" con el valor envuelto dentro de vw. Devuelve la Y tras la fila.
      // Mismo layout de flujo dinámico que el comprobante: evita que valores largos (razón social,
      // direcciones) se taparen entre sí como pasaba con las posiciones Y fijas.
      const campo = (label, valor, lx, vx, vw, atY) => {
        const v = valor == null || valor === ''
          ? '-'
          : (String(valor).replace(/[\r\n]+/g, ' ').trim() || '-');
        doc.fontSize(8).fillColor('#000');
        doc.font('Helvetica-Bold').text(label, lx, atY, { width: vx - lx - 3, lineBreak: false });
        doc.font('Helvetica').text(v, vx, atY, { width: vw });
        const h = doc.heightOfString(v, { width: vw });
        return atY + Math.max(h, 11) + 3;
      };

      // ── Destinatario + datos generales (flujo dinámico anti-desborde) ──
      // Doble dirección: la fiscal del destinatario va aquí; la de entrega es el "Punto de llegada".
      // Izquierda (destinatario/RUC/dir.fiscal) x40–311 · derecha (fechas) x322–560.
      let y = 122;
      const boxDestTop = y;
      const pad = 8;
      let yl = boxDestTop + pad;
      yl = campo('Destinatario:', cliente.razon_social, 40, 118, 193, yl);
      yl = campo('RUC/Doc:', cliente.ruc, 40, 118, 193, yl);
      yl = campo('Dir. fiscal:', cliente.direccion, 40, 118, 193, yl);
      let yr = boxDestTop + pad;
      yr = campo('Fecha emisión:', g.fecha_emision, 322, 410, 150, yr);
      yr = campo('Inicio traslado:', g.fecha_traslado, 322, 410, 150, yr);
      const boxDestH = (Math.max(yl, yr) + 4) - boxDestTop;
      doc.roundedRect(33, boxDestTop, 529, boxDestH, 3).stroke('#000');
      y = boxDestTop + boxDestH + 8;

      // ── Datos del traslado (flujo dinámico, full-width) ──
      const boxTrasTop = y;
      const motivo = MOTIVOS_TRASLADO[String(g.motivo_traslado_cod)] || 'TRASLADO';
      let yt = boxTrasTop + pad;
      yt = campo('Motivo de traslado:', `${g.motivo_traslado_cod} - ${motivo}`, 40, 155, 405, yt);
      yt = campo('Peso bruto total:', `${Number(g.peso_bruto_kg || 0).toFixed(2)} KGM`, 40, 155, 405, yt);
      yt = campo('Punto de partida:', `[${g.ubigeo_partida}] ${g.direccion_partida || '-'}`, 40, 155, 405, yt);
      yt = campo('Punto de llegada:', `[${g.ubigeo_llegada}] ${g.direccion_llegada || '-'}`, 40, 155, 405, yt);
      if (conductor) {
        yt = campo('Conductor / Placa:',
          `${conductor.nombre_completo || '-'} (DNI ${conductor.dni || '-'}, Lic. ${conductor.licencia_conducir || '-'})  ·  Placa ${g.placa || '-'}`,
          40, 155, 405, yt);
      }
      const boxTrasH = (yt + 4) - boxTrasTop;
      doc.roundedRect(33, boxTrasTop, 529, boxTrasH, 3).stroke('#000');
      y = boxTrasTop + boxTrasH + 8;

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

      // ── Pie legal: QR (URL SUNAT) + leyenda ──
      // El "Valor resumen (hash)" NO se imprime (consistente con la factura; el digest sigue en el
      // XML firmado y el CDR). Las representaciones impresas reales no lo muestran.
      const yPie = Math.max(y + 12, 700);
      if (qrBuffer) { try { doc.image(qrBuffer, 40, yPie, { width: 90, height: 90 }); } catch { /* noop */ } }
      doc.fontSize(7).font('Helvetica').fillColor('#000');
      doc.text('Representación impresa de la Guía de Remisión Electrónica.', 145, yPie + 6, { width: 410 });
      doc.text('El QR contiene la URL de consulta pública de SUNAT.', 145, yPie + 16, { width: 410 });

      // ── Marca de agua Fase 12: guía sin efecto / reemplazada ──
      const wm = g.sunat_estado === 'ANULADA' ? 'SIN EFECTO'
        : g.sunat_estado === 'REEMPLAZADA' ? 'REEMPLAZADA' : null;
      if (wm) {
        doc.save().rotate(-30, { origin: [297, 400] })
          .fontSize(70).fillColor('#D32F2F').opacity(0.22)
          .text(wm, 60, 380, { align: 'center', width: 480 }).opacity(1).restore();
        if (g.sunat_estado === 'REEMPLAZADA' && g.reemplazo_ref) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#D32F2F')
            .text(`Reemplazada por la guía ${g.reemplazo_ref}`, 145, yPie + 30, { width: 410 });
        }
        if (g.sunat_estado === 'ANULADA' && g.motivo_anulacion) {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#D32F2F')
            .text(`Sin efecto — motivo: ${g.motivo_anulacion}`, 145, yPie + 30, { width: 410 });
        }
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}
