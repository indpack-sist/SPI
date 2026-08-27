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

// Rótulo de la operación por afectación IGV (catálogo 07): así el total de la base se muestra
// como Gravada / Exonerada / Inafecta / Exportación, sin incongruencias con el importe (0 si no grava).
const OPERACION_LABEL = {
  '10': 'OP. GRAVADA',
  '20': 'OP. EXONERADA',
  '30': 'OP. INAFECTA',
  '40': 'OP. EXPORTACIÓN'
};

const n2 = (v) => Number(v || 0).toFixed(2);

/**
 * @param {object} p
 * @param {object} p.comprobante  { codigo_tipo_sunat, serie, numero, fecha_emision, moneda,
 *                                   subtotal, igv, total, afectacion?: '10'|'20'|'30'|'40',
 *                                   guias?: 'TE01-5, TE01-6' (guías de remisión que ampara),
 *                                   sunat_digest_value, sunat_estado,
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

      // ── Datos del cliente (layout de flujo dinámico anti-desborde) ──
      // Cada campo mide su propio alto real y el siguiente arranca debajo, de modo que los
      // valores largos (razón social) envuelven sin taparse entre sí. Dos columnas estrictamente
      // separadas: izquierda (cliente/RUC) x40–313, derecha (condición comercial/fecha/moneda)
      // x325–560; la observación va full-width al final, bajo ambas columnas.
      let y = 140;
      const boxTop = y;
      const boxPad = 8;

      // Dibuja "Etiqueta: valor" con el valor envuelto dentro de vw. Devuelve la Y tras la fila.
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

      const rucLabel = String(cliente.tipo_documento || '').toUpperCase() === 'RUC' ? 'RUC:' : 'Doc:';

      // Columna izquierda — solo identificación del adquiriente (razón social + documento).
      // La representación impresa de SUNAT NO muestra la dirección del cliente receptor: ni la
      // fiscal ni la de entrega. Esta última, además, no aplica cuando es recojo en tienda. Se
      // omiten a propósito para reflejar el mismo formato que el PDF generado por SUNAT.
      let yl = boxTop + boxPad;
      yl = campo('Cliente:', cliente.razon_social, 40, 108, 205, yl);
      yl = campo(rucLabel, cliente.ruc, 40, 108, 205, yl);

      // Columna derecha — condición comercial (misma fuente que el cac:PaymentTerms del XML).
      const esCredito = String(c.tipo_venta || '').toLowerCase().startsWith('cr');
      const diasCredito = Number(c.dias_credito) || 0;
      const formaPago = esCredito
        ? (diasCredito > 0 ? `CRÉDITO A ${diasCredito} DÍAS` : 'CRÉDITO')
        : 'CONTADO';
      let yr = boxTop + boxPad;
      yr = campo('Forma de pago:', formaPago, 325, 410, 150, yr);
      if (esCredito) yr = campo('Vencimiento:', c.fecha_vencimiento, 325, 410, 150, yr);
      yr = campo('Fecha emisión:', c.fecha_emision, 325, 410, 150, yr);
      yr = campo('Moneda:', String(c.moneda) === 'USD' ? 'DÓLARES (USD)' : 'SOLES (PEN)', 325, 410, 150, yr);

      // La OC y las observaciones YA NO van en este recuadro: se imprimen abajo, en el espacio
      // libre entre los totales y el QR (ver bloque "Observaciones"). Aquí solo se cierra el alto
      // del recuadro de datos según la columna más larga.
      const yo = Math.max(yl, yr);

      // La altura del recuadro se calcula tras medir todo, y el borde se dibuja al final.
      const boxH = (yo + boxPad) - boxTop;
      doc.roundedRect(33, boxTop, 529, boxH, 3).stroke('#000');

      y = boxTop + boxH + 8;

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
      const afect = String(c.afectacion || '10');
      const gravado = afect === '10';
      filaTotal(OPERACION_LABEL[afect] || 'OP. GRAVADA', c.subtotal);
      filaTotal(gravado ? 'IGV (18%)' : 'IGV', c.igv);
      filaTotal('IMPORTE TOTAL', c.total, true);

      // ── SON en letras (lado izquierdo, a la altura de los totales) ──
      // La OC y las observaciones se imprimen más abajo, en el recuadro "Observaciones" que ocupa
      // el espacio entre los totales y el QR.
      doc.fontSize(8).font('Helvetica').fillColor('#000');
      doc.text(`SON: ${numeroALetras(Number(c.total || 0), c.moneda)}`, 40, yTotalesInicio, { width: 330 });

      y += 6;

      // ── Información del crédito (cuotas) — solo ventas a crédito, formato SUNAT ──
      if (esCredito) {
        const hCred = 60;
        doc.roundedRect(33, y, 529, hCred, 3).stroke('#000');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text('Información del crédito', 40, y + 6);
        doc.font('Helvetica-Bold').text('Monto neto pendiente de pago:', 40, y + 20);
        doc.font('Helvetica').text(`${simbolo} ${n2(c.total)}`, 200, y + 20);
        doc.font('Helvetica-Bold').text('Total de cuotas:', 320, y + 20);
        doc.font('Helvetica').text('1', 400, y + 20);
        // Encabezado de la tabla de cuotas (MVP: 1 cuota única).
        doc.font('Helvetica-Bold').text('N° Cuota', 40, y + 36);
        doc.text('Fec. Venc.', 120, y + 36);
        doc.text('Monto', 220, y + 36, { width: 80, align: 'right' });
        doc.font('Helvetica').text('1', 40, y + 48);
        doc.text(c.fecha_vencimiento || '-', 120, y + 48);
        doc.text(`${simbolo} ${n2(c.total)}`, 220, y + 48, { width: 80, align: 'right' });
        y += hCred + 6;
      }

      // ── OC + Observaciones — texto plano pegado a la izquierda, SIN recuadro ni bordes ──
      // Fluye justo debajo de los totales, así que se desplaza solo cuando el detalle tiene muchos
      // ítems (los totales bajan y estas líneas bajan con ellos). La OC va arriba y las
      // observaciones libres debajo. Ambas también viajan a SUNAT en el XML.
      doc.fontSize(8).fillColor('#000');
      if (c.orden_compra) {
        doc.font('Helvetica-Bold').text('Orden de compra: ', 40, y, { continued: true, width: 515 })
           .font('Helvetica').text(String(c.orden_compra).trim());
        y = doc.y + 2;
      }
      const obsTxt = String(c.observaciones || '').replace(/[\r\n]+/g, ' ').trim();
      if (obsTxt) {
        doc.font('Helvetica-Bold').text('Observaciones: ', 40, y, { continued: true, width: 515 })
           .font('Helvetica').text(obsTxt);
        y = doc.y + 2;
      }
      // Guías de remisión que amparan el traslado (las declaradas en el XML). Solo aplica a la
      // factura cuando la GRE se emitió antes; refleja el cac:DespatchDocumentReference.
      const guiasTxt = String(c.guias || '').trim();
      if (guiasTxt) {
        doc.font('Helvetica-Bold').text('Guía(s) de remisión: ', 40, y, { continued: true, width: 515 })
           .font('Helvetica').text(guiasTxt);
        y = doc.y + 2;
      }

      // ── Pie legal: QR + leyenda ──
      // El "Valor resumen (hash/digestValue)" NO se imprime: las facturas reales no lo muestran
      // (el digest sigue en el XML firmado y en el CDR; solo se omite de la representación impresa).
      const yPie = Math.max(y, 700);
      if (qrBuffer) { try { doc.image(qrBuffer, 40, yPie, { width: 90, height: 90 }); } catch { /* noop */ } }
      doc.fontSize(7).font('Helvetica').fillColor('#000');
      doc.text('Representación impresa del Comprobante de Pago Electrónico.', 145, yPie + 6, { width: 410 });
      doc.font('Helvetica').fillColor('#555').text('Autorizado mediante Resolución de Intendencia. Consulte su validez en www.sunat.gob.pe', 145, yPie + 22, { width: 410 });

      if (anulado) {
        doc.save().rotate(-30, { origin: [297, 400] })
          .fontSize(72).fillColor('#D32F2F').opacity(0.25)
          .text('ANULADO', 120, 380, { align: 'center' }).opacity(1).restore();
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}
