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

// Nombre del comprobante en minúsculas para la leyenda legal estilo SUNAT
// ("…representación impresa de la nota de crédito electrónica, generada en el Sistema de SUNAT…").
const LEYENDA_TIPO = {
  '01': 'factura electrónica',
  '07': 'nota de crédito electrónica',
  '08': 'nota de débito electrónica'
};

// Descripción del código de unidad (catálogo 03) para imprimir "UNIDAD", "MILLAR"… como el PDF de
// SUNAT, en lugar del código (NIU, MIL…). Fallback: el propio código si no está mapeado.
const UNIDAD_NOMBRE = {
  NIU: 'UNIDAD', ZZ: 'SERVICIO', MIL: 'MILLAR', KGM: 'KILOGRAMO', GRM: 'GRAMO', TNE: 'TONELADA',
  MTR: 'METRO', CMT: 'CENTÍMETRO', MTK: 'METRO CUADRADO', MTQ: 'METRO CÚBICO', LTR: 'LITRO',
  BX: 'CAJA', PK: 'PAQUETE', BG: 'BOLSA', ROL: 'ROLLO', SET: 'JUEGO', DZN: 'DOCENA', CEN: 'CIENTO',
  GLL: 'GALÓN', BE: 'FARDO', PR: 'PAR', BOB: 'BOBINA'
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
      // Anulado = dado de baja (RA) O reversado por una Nota de Crédito de anulación (estado interno
      // 'Anulada' aunque su sunat_estado siga 'ACEPTADO'). Ambos casos llevan marca de agua ANULADO.
      const anulado = c.sunat_estado === 'BAJA' || c.estado === 'Anulada';
      const anuladoPorNota = c.estado === 'Anulada' && c.sunat_estado !== 'BAJA';
      const rechazado = c.sunat_estado === 'RECHAZADO';

      // ── Cabecera: logo + emisor (izq) + recuadro RUC/tipo/serie-numero (der) ──
      const logo = logoBuffer();
      if (logo) { try { doc.image(logo, 36, 36, { fit: [150, 46] }); } catch { /* noop */ } }
      doc.fontSize(12).fillColor('#000').font('Helvetica-Bold').text(emisor.razon_social || 'INDPACK S.A.C.', 36, 86, { width: 330 });
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      const dirEmisor = [emisor.direccion, emisor.urbanizacion].filter(Boolean).join(' - ');
      doc.text(dirEmisor || '', 36, 102, { width: 330 });
      if (emisor.telefono) doc.text(`Teléfono: ${emisor.telefono}`, 36, doc.y + 1, { width: 330 });
      if (emisor.email) doc.text(`E-mail: ${emisor.email}`, 36, doc.y + 1, { width: 330 });

      doc.roundedRect(380, 40, 182, 78, 5).stroke('#000');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(`R.U.C. ${emisor.ruc}`, 385, 48, { align: 'center', width: 172 });
      // El tipo se dibuja línea por línea (p. ej. "NOTA DE CRÉDITO" / "ELECTRÓNICA")
      // para repartir el espacio vertical de forma pareja en vez de dejar que se ajuste solo.
      const lineasTipo = tipoNombre.endsWith(' ELECTRÓNICA')
        ? [tipoNombre.slice(0, -' ELECTRÓNICA'.length), 'ELECTRÓNICA']
        : [tipoNombre];
      let yTipo = 66;
      for (const linea of lineasTipo) {
        doc.fontSize(11).text(linea, 385, yTipo, { align: 'center', width: 172 });
        yTipo += 15;
      }
      doc.fontSize(12).text(`${c.serie}-${c.numero}`, 385, yTipo + 3, { align: 'center', width: 172 });

      // ── Datos del comprobante (formato SUNAT: lista de campos etiquetados en una columna) ──
      // Orden como el PDF oficial: Fecha de Emisión, [Documento que modifica + doc afectado],
      // Señor(es), RUC, Tipo de Moneda, Forma de Pago, [Vencimiento], Observación (motivo/nota).
      let y = 140;
      const boxTop = y;
      const boxPad = 8;
      const labelW = 96;          // ancho de la etiqueta
      const valX = 40 + labelW;   // x del valor ("­: valor")
      const valW = 400;           // ancho del valor (envuelve valores largos)
      let yc = boxTop + boxPad;

      // Fila "Etiqueta : valor" (una sola columna, con wrap del valor). Avanza yc.
      const filaSunat = (label, valor) => {
        const v = valor == null || valor === '' ? '-' : String(valor).replace(/[\r\n]+/g, ' ').trim();
        doc.fontSize(8).fillColor('#000');
        doc.font('Helvetica-Bold').text(label, 40, yc, { width: labelW - 3, lineBreak: false });
        doc.font('Helvetica').text(`: ${v}`, valX, yc, { width: valW });
        yc += Math.max(doc.heightOfString(`: ${v}`, { width: valW }), 11) + 3;
      };

      const esCredito = String(c.tipo_venta || '').toLowerCase().startsWith('cr');
      const diasCredito = Number(c.dias_credito) || 0;
      const formaPago = esCredito
        ? (diasCredito > 0 ? `CRÉDITO A ${diasCredito} DÍAS` : 'CRÉDITO')
        : 'CONTADO';
      const monedaTxt = String(c.moneda) === 'USD' ? 'DÓLAR AMERICANO' : 'SOLES';

      // "Observación" = motivo de la nota (sin el prefijo "NN - ", en mayúsculas como SUNAT) o, en
      // factura/ND, las observaciones libres (cbc:Note). La razón social del cliente va en "Señor(es)".
      const motivoTxt = c.docAfectado?.motivo
        ? String(c.docAfectado.motivo).replace(/^\s*\d+\s*-\s*/, '').toUpperCase()
        : null;
      // Sustento libre de la nota (lo que escribió el usuario y viajó a SUNAT). Se rotula aparte del
      // motivo del catálogo, igual que el preliminar de SUNAT ("Motivo o Sustento" + etiqueta del código).
      const sustentoTxt = c.docAfectado?.sustento
        ? String(c.docAfectado.sustento).replace(/[\r\n]+/g, ' ').trim()
        : null;
      const obsHeader = motivoTxt || String(c.observaciones || '').replace(/[\r\n]+/g, ' ').trim();
      // La OC ya se imprime como campo propio ("Orden de Compra"). Si la observación libre solo la
      // repite (dato heredado de cuando la OC viajaba embebida en cbc:Note, p. ej. "OC: <número>"),
      // no se vuelve a mostrar como "Observación" para no duplicarla.
      const normOC = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      // Se compara sin el prefijo "OC"/"O/C"/"ORDEN DE COMPRA" a AMBOS lados: la OC puede venir
      // escrita con ese prefijo dentro del propio campo (p. ej. "OC - 4600144796"), y sin quitarlo
      // también de la OC la comparación nunca casaba y la observación se duplicaba.
      const stripOC = (s) => normOC(s).replace(/^(OC|ORDENDECOMPRA)+/, '');
      const ocNorm = normOC(c.orden_compra);
      const obsRepiteOC = !!ocNorm && !motivoTxt && stripOC(obsHeader) === stripOC(c.orden_compra);

      filaSunat('Fecha de Emisión', c.fecha_emision);
      if (c.docAfectado) {
        // El documento afectado por una nota siempre es una Factura Electrónica (01) en este sistema.
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text('Documento que modifica:', 40, yc, { lineBreak: false });
        yc += 12;
        filaSunat('Factura Electrónica', c.docAfectado.comprobante);
      }
      filaSunat('Señor(es)', cliente.razon_social);
      filaSunat(String(cliente.tipo_documento || '').toUpperCase() === 'RUC' ? 'RUC' : 'Documento', cliente.ruc);
      filaSunat('Tipo de Moneda', monedaTxt);
      filaSunat('Forma de Pago', formaPago);
      if (esCredito) filaSunat('Fecha de Vencimiento', c.fecha_vencimiento);
      // Orden de compra (cac:OrderReference) como campo propio de la cabecera, igual que SUNAT.
      if (c.orden_compra) filaSunat('Orden de Compra', String(c.orden_compra).trim());
      // En notas: primero el sustento del usuario, luego la etiqueta del catálogo (motivo).
      if (sustentoTxt) filaSunat('Motivo o Sustento', sustentoTxt);
      if (obsHeader && !obsRepiteOC) filaSunat('Observación', obsHeader);

      const boxH = (yc + boxPad) - boxTop;
      doc.roundedRect(33, boxTop, 529, boxH, 3).stroke('#000');
      y = boxTop + boxH + 8;

      // ── Banda de estado (rojo): RECHAZADO o ANULADO + su motivo, para dejar constancia impresa ──
      if (rechazado || anulado) {
        const titulo = rechazado
          ? 'COMPROBANTE RECHAZADO POR SUNAT — SIN VALIDEZ'
          : (anuladoPorNota
            ? 'COMPROBANTE ANULADO — NOTA DE CRÉDITO ACEPTADA'
            : 'COMPROBANTE ANULADO — COMUNICACIÓN DE BAJA ACEPTADA');
        const motivo = c.motivoEstado
          || (rechazado ? 'Comprobante rechazado por SUNAT.'
            : (anuladoPorNota ? 'Operación anulada mediante Nota de Crédito.' : 'Comprobante dado de baja ante SUNAT.'));
        doc.fontSize(8).font('Helvetica');
        const hBanner = doc.heightOfString(`Motivo: ${motivo}`, { width: 515 }) + 24;
        doc.roundedRect(33, y, 529, hBanner, 3).fillAndStroke('#FDECEA', '#D32F2F');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#D32F2F').text(titulo, 40, y + 6, { width: 515 });
        doc.fontSize(8).font('Helvetica').fillColor('#D32F2F').text(`Motivo: ${motivo}`, 40, y + 19, { width: 515 });
        y += hBanner + 8;
        doc.fillColor('#000');
      }

      // ── Tabla de ítems (formato SUNAT: Cantidad | Unidad de Medida | Descripción | Valor Unitario) ──
      doc.rect(33, y, 529, 18).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
      doc.text('CANTIDAD', 40, y + 5, { width: 55, align: 'center' });
      doc.text('UNIDAD DE MEDIDA', 98, y + 5, { width: 78, align: 'center' });
      doc.text('DESCRIPCIÓN', 182, y + 5);
      doc.text('VALOR UNITARIO', 450, y + 5, { width: 108, align: 'right' });
      y += 18;

      doc.font('Helvetica').fontSize(8);
      for (const it of detalle) {
        const desc = it.descripcion || it.nombre || it.codigo || '-';
        const cant = Number(it.cantidad || 0);
        // "Valor Unitario" = precio_unitario SIN IGV, tal cual. `descuento_porcentaje` es el MARGEN
        // (markup), NO un descuento — no debe restarse (ver calcularComprobante en ubl.service.js).
        const valorUnit = Number(it.precio_unitario || 0);
        const und = it.unidad || it.codigo_unidad_sunat || 'NIU';
        const undTxt = UNIDAD_NOMBRE[und] || und;
        const hDesc = doc.heightOfString(desc, { width: 262, lineGap: 1 });
        const hFila = Math.max(16, hDesc + 6);
        if (y + hFila > 690) { doc.addPage(); y = 40; }
        doc.fillColor('#000');
        doc.text(cant.toFixed(2), 40, y + 3, { width: 55, align: 'center' });
        doc.text(undTxt, 98, y + 3, { width: 78, align: 'center' });
        doc.text(desc, 182, y + 3, { width: 262, lineGap: 1 });
        doc.text(`${simbolo} ${n2(valorUnit)}`, 450, y + 3, { width: 108, align: 'right' });
        y += hFila;
      }
      doc.moveTo(33, y).lineTo(562, y).stroke('#CCCCCC');
      y += 8;

      // El bloque de totales SUNAT ocupa ~150px; si no cabe en la página actual, salta a la siguiente
      // para no encimarse con el pie ni cortarse.
      if (y + 170 > 720) { doc.addPage(); y = 40; }

      // ── Totales (desglose completo, formato SUNAT) ──
      // La mayoría de conceptos no aplican en el modelo actual (van en 0.00): se imprimen igual
      // para replicar el formato oficial. Los importes autoritativos son subtotal/igv/total.
      const filaTotal = (label, valor, bold) => {
        doc.roundedRect(360, y, 118, 13, 2).fill('#CCCCCC');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#000').text(label, 364, y + 3.5, { width: 112 });
        doc.roundedRect(480, y, 82, 13, 2).stroke('#CCCCCC');
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000').text(`${simbolo} ${n2(valor)}`, 484, y + 3.5, { width: 74, align: 'right' });
        y += 15;
      };
      const yTotalesInicio = y;
      const afect = String(c.afectacion || '10');
      filaTotal('Sub Total Ventas', c.subtotal);
      filaTotal('Anticipos', 0);
      filaTotal('Descuentos', 0);
      filaTotal('Valor Venta', c.subtotal);
      filaTotal('ISC', 0);
      filaTotal('IGV', c.igv);
      filaTotal('Otros Cargos', 0);
      filaTotal('Otros Tributos', 0);
      filaTotal('Monto de Redondeo', 0);
      filaTotal('Importe Total', c.total, true);

      // ── Columna izquierda: tipo de operación (afectación) + SON en letras ──
      // El tipo de operación (Gravada/Exonerada/Inafecta/Exportación) se rotula aparte para que la
      // afectación quede impresa sin ambigüedad, aunque el bloque de totales use rótulos genéricos.
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
      doc.text(`Tipo de operación: ${OPERACION_LABEL[afect] || 'OP. GRAVADA'}`, 40, yTotalesInicio, { width: 300 });
      doc.font('Helvetica');
      doc.text(`SON: ${numeroALetras(Number(c.total || 0), c.moneda)}`, 40, yTotalesInicio + 16, { width: 300 });

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

      // ── Guías de remisión que amparan el traslado — texto plano, SIN recuadro ──
      // Fluye justo debajo de los totales. La OC y las observaciones (cbc:Note) ya se imprimen en la
      // cabecera (campos "Orden de Compra" / "Observación", formato SUNAT), por eso no se repiten.
      // Refleja los cac:DespatchDocumentReference declarados en el XML.
      doc.fontSize(8).fillColor('#000');
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
      // El QR (validez SUNAT) solo tiene sentido si el comprobante existe en SUNAT: se omite en los
      // RECHAZADOS (nunca se registraron). En ACEPTADO/BAJA sí se imprime.
      if (qrBuffer && !rechazado) { try { doc.image(qrBuffer, 40, yPie, { width: 90, height: 90 }); } catch { /* noop */ } }
      doc.fontSize(7).font('Helvetica').fillColor('#000');
      const leyendaTipo = LEYENDA_TIPO[c.codigo_tipo_sunat] || 'comprobante electrónico';
      if (rechazado) {
        doc.fillColor('#D32F2F').text(`Representación impresa de una ${leyendaTipo} RECHAZADA por SUNAT. No tiene validez como comprobante de pago.`, 145, yPie + 6, { width: 410 });
        doc.fillColor('#000');
      } else {
        doc.text(`Esta es una representación impresa de la ${leyendaTipo}, generada en el Sistema de SUNAT. Puede verificarla utilizando su clave SOL, además del número de RUC y otros datos del comprobante, en www.sunat.gob.pe`, 145, yPie + 6, { width: 410 });
      }

      const marcaAgua = rechazado ? 'RECHAZADO' : (anulado ? 'ANULADO' : null);
      if (marcaAgua) {
        // fontSize reducido + lineBreak:false para que la palabra completa entre en UNA sola línea
        // (a 72px "RECHAZADO" desbordaba el ancho y la "O" caía debajo). Caja centrada en la página.
        doc.save().rotate(-30, { origin: [297, 400] })
          .fontSize(56).fillColor('#D32F2F').opacity(0.22)
          .text(marcaAgua, 80, 385, { width: 435, align: 'center', lineBreak: false })
          .opacity(1).restore();
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}
