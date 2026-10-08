import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { numeroALetras } from '../numeroALetras.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../../../frontend/images/indpack.png');
let _logo;
function logoBuffer() {
  if (_logo !== undefined) return _logo;
  try { _logo = fs.readFileSync(LOGO_PATH); } catch { _logo = null; }
  return _logo;
}

const BCP_LOGO_PATH = path.join(__dirname, '../../../frontend/public/bcp.png');
const BCP_LOGO_RATIO = 241 / 700;
let _bcpLogo;
function bcpLogo() {
  if (_bcpLogo !== undefined) return _bcpLogo;
  try { _bcpLogo = fs.readFileSync(BCP_LOGO_PATH); } catch { _bcpLogo = null; }
  return _bcpLogo;
}

export const NOMBRE_TIPO = {
  '01': 'FACTURA ELECTRÓNICA',
  '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
  '08': 'NOTA DE DÉBITO ELECTRÓNICA'
};

const OPERACION_LABEL = {
  '10': 'OP. GRAVADA',
  '20': 'OP. EXONERADA',
  '30': 'OP. INAFECTA',
  '40': 'OP. EXPORTACIÓN'
};

const LEYENDA_TIPO = {
  '01': 'factura electrónica',
  '07': 'nota de crédito electrónica',
  '08': 'nota de débito electrónica'
};

const UNIDAD_NOMBRE = {
  NIU: 'UNIDAD', ZZ: 'SERVICIO', MIL: 'MILLAR', KGM: 'KILOGRAMO', GRM: 'GRAMO', TNE: 'TONELADA',
  MTR: 'METRO', CMT: 'CENTÍMETRO', MTK: 'METRO CUADRADO', MTQ: 'METRO CÚBICO', LTR: 'LITRO',
  BX: 'CAJA', PK: 'PAQUETE', BG: 'BOLSA', ROL: 'ROLLO', SET: 'JUEGO', DZN: 'DOCENA', CEN: 'CIENTO',
  GLL: 'GALÓN', BE: 'FARDO', PR: 'PAR', BOB: 'BOBINA'
};

const n2 = (v) => Number(v || 0).toFixed(2);
const n2Miles = (v) => Number(v || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const nUnit = (v) => {
  const r = Math.round((Number(v || 0) + Number.EPSILON) * 1e6) / 1e6;
  return r.toFixed(6).replace(/(\.\d{2}\d*?)0+$/, '$1');
};
const nUnitMiles = (v) => {
  const r = Math.round((Number(v || 0) + Number.EPSILON) * 1e6) / 1e6;
  return r.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

function medirAnchoTexto(doc, texto, font, fontSize) {
  const prevFont = doc._font ? doc._font.name : 'Helvetica';
  const prevSize = doc._fontSize || 12;
  doc.font(font).fontSize(fontSize);
  const ancho = doc.widthOfString(texto || '');
  doc.font(prevFont).fontSize(prevSize);
  return ancho;
}

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
      const anulado = c.sunat_estado === 'BAJA' || c.estado === 'Anulada';
      const anuladoPorNota = c.estado === 'Anulada' && c.sunat_estado !== 'BAJA';
      const rechazado = c.sunat_estado === 'RECHAZADO';
      const esExportacion = String(c.afectacion || '') === '40';
      const monto2 = esExportacion ? n2Miles : n2;

      const logo = logoBuffer();
      if (logo) { try { doc.image(logo, 36, 36, { fit: [150, 46] }); } catch {} }
      doc.fontSize(12).fillColor('#000').font('Helvetica-Bold').text(emisor.razon_social || 'INDPACK S.A.C.', 36, 86, { width: 330 });
      doc.fontSize(8).font('Helvetica').fillColor('#333');
      const dirEmisor = [emisor.direccion, emisor.urbanizacion].filter(Boolean).join(' - ');
      doc.text(dirEmisor || '', 36, 102, { width: 330 });
      if (emisor.telefono) doc.text(`Teléfono: ${emisor.telefono}`, 36, doc.y + 1, { width: 330 });
      if (emisor.email) doc.text(`E-mail: ${emisor.email}`, 36, doc.y + 1, { width: 330 });

      doc.roundedRect(380, 40, 182, 78, 5).stroke('#000');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000').text(`R.U.C. ${emisor.ruc}`, 385, 48, { align: 'center', width: 172 });
      const lineasTipo = tipoNombre.endsWith(' ELECTRÓNICA')
        ? [tipoNombre.slice(0, -' ELECTRÓNICA'.length), 'ELECTRÓNICA']
        : [tipoNombre];
      let yTipo = 66;
      for (const linea of lineasTipo) {
        doc.fontSize(11).text(linea, 385, yTipo, { align: 'center', width: 172 });
        yTipo += 15;
      }
      doc.fontSize(12).text(`${c.serie}-${c.numero}`, 385, yTipo + 3, { align: 'center', width: 172 });

      let y = 140;
      const boxTop = y;
      const boxPad = 8;

      const gapColumnas = 20;
      const anchoUtil = 529 - boxPad * 2;
      const colWidth = (anchoUtil - gapColumnas) / 2;
      const colXIzq = 33 + boxPad;
      const colXDer = colXIzq + colWidth + gapColumnas;

      const campoSunat = (colX, yPos, label, valor, dibujar = true, multilinea = false) => {
        if (valor === null) {
          if (dibujar) {
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text(label, colX, yPos, { width: colWidth });
          }
          return 12;
        }
        const v = valor == null || valor === ''
          ? '-'
          : (multilinea
            ? String(valor).replace(/\r\n?/g, '\n').replace(/\n{2,}/g, '\n').trim()
            : String(valor).replace(/[\r\n]+/g, ' ').trim());
        const anchoLabel = medirAnchoTexto(doc, `${label}: `, 'Helvetica-Bold', 8);
        const valX = colX + anchoLabel;
        const valWidth = Math.max(30, colX + colWidth - valX);
        const alturaValor = doc.fontSize(8).heightOfString(v, { width: valWidth });
        const alturaFila = Math.max(11, alturaValor) + 3;

        if (dibujar) {
          doc.fontSize(8).fillColor('#000');
          doc.font('Helvetica-Bold').text(`${label}: `, colX, yPos, { lineBreak: false });
          doc.font('Helvetica').text(v, valX, yPos, { width: valWidth });
        }
        return alturaFila;
      };

      const esCredito = String(c.tipo_venta || '').toLowerCase().startsWith('cr');
      const diasCredito = Number(c.dias_credito) || 0;
      const formaPago = esCredito
        ? (diasCredito > 0 ? `CRÉDITO A ${diasCredito} DÍAS` : 'CRÉDITO')
        : 'CONTADO';
      const monedaTxt = String(c.moneda) === 'USD' ? 'DÓLAR AMERICANO' : 'SOLES';

      const motivoTxt = c.docAfectado?.motivo
        ? String(c.docAfectado.motivo).replace(/^\s*\d+\s*-\s*/, '').toUpperCase()
        : null;
      const sustentoTxt = c.docAfectado?.sustento
        ? String(c.docAfectado.sustento).replace(/[\r\n]+/g, ' ').trim()
        : null;
      const obsHeader = motivoTxt || String(c.observaciones || '').trim();
      const normOC = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const stripOC = (s) => normOC(s).replace(/^(OC|ORDENDECOMPRA)+/, '');
      const ocNorm = normOC(c.orden_compra);
      const obsRepiteOC = !!ocNorm && !motivoTxt && stripOC(obsHeader) === stripOC(c.orden_compra);

      const camposIzquierda = [['Fecha de Emisión', c.fecha_emision]];
      if (c.docAfectado) {
        camposIzquierda.push(['Documento que modifica:', null]);
        camposIzquierda.push(['Factura Electrónica', c.docAfectado.comprobante]);
      }
      camposIzquierda.push(['Señor(es)', cliente.razon_social]);
      if (esExportacion) {
        camposIzquierda.push(['Establecimiento del Emisor', cliente.direccion_despacho || c.direccion_entrega]);
      } else {
        camposIzquierda.push([String(cliente.tipo_documento || '').toUpperCase() === 'RUC' ? 'RUC' : 'Documento', cliente.ruc]);
      }
      if (c.orden_compra) camposIzquierda.push(['Orden de Compra', String(c.orden_compra).trim()]);
      const guiasHeaderTxt = String(c.guias || '').trim();
      if (!esExportacion && guiasHeaderTxt) camposIzquierda.push(['Guía(s) de Remisión', guiasHeaderTxt]);

      const camposDerecha = [
        ['Tipo de Moneda', monedaTxt],
        ['Forma de Pago', formaPago],
      ];
      if (esCredito) camposDerecha.push(['Fecha de Vencimiento', c.fecha_vencimiento]);
      if (sustentoTxt) camposDerecha.push(['Motivo o Sustento', sustentoTxt]);
      if (obsHeader && !obsRepiteOC) camposDerecha.push(['Observación', obsHeader, !motivoTxt]);

      const alturaColumna = (campos, colX) =>
        campos.reduce((acc, [label, valor, multilinea]) => acc + campoSunat(colX, 0, label, valor, false, multilinea), 0);

      const leftH = alturaColumna(camposIzquierda, colXIzq);
      const rightH = alturaColumna(camposDerecha, colXDer);
      const boxH = Math.max(leftH, rightH) + boxPad * 2;

      doc.roundedRect(33, boxTop, 529, boxH, 3).stroke('#000');

      let yIzq = boxTop + boxPad;
      for (const [label, valor, multilinea] of camposIzquierda) {
        yIzq += campoSunat(colXIzq, yIzq, label, valor, true, multilinea);
      }

      let yDer = boxTop + boxPad;
      for (const [label, valor, multilinea] of camposDerecha) {
        yDer += campoSunat(colXDer, yDer, label, valor, true, multilinea);
      }

      y = boxTop + boxH + 8;

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

      doc.rect(33, y, 529, 18).fill('#CCCCCC');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
      if (esExportacion) {
        doc.text('CANTIDAD', 37, y + 5, { width: 48, align: 'center' });
        doc.text('UNIDAD', 88, y + 5, { width: 62, align: 'center' });
        doc.text('CÓDIGO', 154, y + 5, { width: 66, align: 'center' });
        doc.text('DESCRIPCIÓN', 224, y + 5, { width: 190 });
        doc.text('VALOR UNIT.', 418, y + 5, { width: 76, align: 'right' });
        doc.text('ICBPER', 500, y + 5, { width: 56, align: 'right' });
      } else {
        doc.text('CANTIDAD', 37, y + 5, { width: 48, align: 'center' });
        doc.text('UNIDAD', 88, y + 5, { width: 70, align: 'center' });
        doc.text('CÓDIGO', 162, y + 5, { width: 65, align: 'center' });
        doc.text('DESCRIPCIÓN', 231, y + 5, { width: 225 });
        doc.text('VALOR UNITARIO', 460, y + 5, { width: 96, align: 'right' });
      }
      y += 18;

      doc.font('Helvetica').fontSize(8);
      for (const it of detalle) {
        const desc = it.descripcion || it.nombre || it.codigo || '-';
        const cant = Number(it.cantidad || 0);
        const valorUnit = Number(it.precio_unitario || 0);
        const und = it.unidad || it.codigo_unidad_sunat || 'NIU';
        const undTxt = UNIDAD_NOMBRE[und] || und;
        const hDesc = doc.heightOfString(desc, { width: esExportacion ? 190 : 225, lineGap: 1 });
        const hFila = Math.max(16, hDesc + 6);
        if (y + hFila > 690) { doc.addPage(); y = 40; }
        doc.fillColor('#000');
        if (esExportacion) {
          doc.text(cant.toFixed(2), 37, y + 3, { width: 48, align: 'center' });
          doc.text(undTxt, 88, y + 3, { width: 62, align: 'center' });
          doc.text(String(it.codigo || '-'), 154, y + 3, { width: 66, align: 'center' });
          doc.text(desc, 224, y + 3, { width: 190, lineGap: 1 });
          doc.text(nUnitMiles(valorUnit), 418, y + 3, { width: 76, align: 'right' });
          doc.text('0.00', 500, y + 3, { width: 56, align: 'right' });
        } else {
          doc.text(cant.toFixed(2), 37, y + 3, { width: 48, align: 'center' });
          doc.text(undTxt, 88, y + 3, { width: 70, align: 'center' });
          doc.text(String(it.codigo || '-'), 162, y + 3, { width: 65, align: 'center' });
          doc.text(desc, 231, y + 3, { width: 225, lineGap: 1 });
          doc.text(`${simbolo} ${nUnit(valorUnit)}`, 460, y + 3, { width: 96, align: 'right' });
        }
        y += hFila;
      }
      doc.moveTo(33, y).lineTo(562, y).stroke('#CCCCCC');
      y += 8;

      if (y + 170 > 720) { doc.addPage(); y = 40; }

      const filaTotal = (label, valor, bold) => {
        doc.roundedRect(360, y, 118, 13, 2).fill('#CCCCCC');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#000').text(label, 364, y + 3.5, { width: 112 });
        doc.roundedRect(480, y, 82, 13, 2).stroke('#CCCCCC');
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#000').text(`${simbolo} ${monto2(valor)}`, 484, y + 3.5, { width: 74, align: 'right' });
        y += 15;
      };
      const yTotalesInicio = y;
      const afect = String(c.afectacion || '10');
      filaTotal('Sub Total Ventas', c.subtotal);
      filaTotal('Anticipos', 0);
      filaTotal('Descuentos', 0);
      filaTotal('Valor Venta', c.subtotal);
      filaTotal('ISC', 0);
      if (!esExportacion) filaTotal('IGV', c.igv);
      if (esExportacion) filaTotal('ICBPER', 0);
      filaTotal('Otros Cargos', 0);
      filaTotal('Otros Tributos', 0);
      filaTotal('Monto de Redondeo', 0);
      filaTotal('Importe Total', c.total, true);

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
      doc.text(`Tipo de operación: ${OPERACION_LABEL[afect] || 'OP. GRAVADA'}`, 40, yTotalesInicio, { width: 300 });
      doc.font('Helvetica');
      doc.text(`SON: ${numeroALetras(Number(c.total || 0), c.moneda)}`, 40, yTotalesInicio + 16, { width: 300 });

      y += 6;

      if (esCredito) {
        const hCred = 60;
        doc.roundedRect(33, y, 529, hCred, 3).stroke('#000');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text('Información del crédito', 40, y + 6);
        doc.font('Helvetica-Bold').text('Monto neto pendiente de pago:', 40, y + 20);
        doc.font('Helvetica').text(`${simbolo} ${monto2(c.total)}`, 200, y + 20);
        doc.font('Helvetica-Bold').text('Total de cuotas:', 320, y + 20);
        doc.font('Helvetica').text('1', 400, y + 20);
        doc.font('Helvetica-Bold').text('N° Cuota', 40, y + 36);
        doc.text('Fec. Venc.', 120, y + 36);
        doc.text('Monto', 220, y + 36, { width: 80, align: 'right' });
        doc.font('Helvetica').text('1', 40, y + 48);
        doc.text(c.fecha_vencimiento || '-', 120, y + 48);
        doc.text(`${simbolo} ${monto2(c.total)}`, 220, y + 48, { width: 80, align: 'right' });
        y += hCred + 6;
      }

      doc.fontSize(8).fillColor('#000');
      const guiasDetalle = Array.isArray(c.guias_detalle) ? c.guias_detalle : [];
      if (esExportacion && guiasDetalle.length) {
        for (const guia of guiasDetalle) {
          const etiqueta = String(guia.tipo_documento) === '31'
            ? 'GUÍA DE REMISIÓN TRANSPORTISTA'
            : 'GUÍA DE REMISIÓN REMITENTE';
          doc.font('Helvetica-Bold').text(`${etiqueta}: `, 40, y, { continued: true, width: 515 })
             .font('Helvetica').text(`${guia.serie} ${guia.numero}`);
          y = doc.y + 2;
        }
      }

      if (c.codigo_tipo_sunat === '01') {
        const BCP_AZUL = '#002A8F';
        const BCP_NARANJA = '#EF7D00';
        const GRIS_BORDE = '#D8DEE9';
        const GRIS_TXT = '#6B7280';

        const cardX = 33, cardW = 529, cardH = 74;
        if (y + cardH + 10 > 690) { doc.addPage(); y = 40; }
        y += 6;
        const cardY = y;

        doc.roundedRect(cardX, cardY, cardW, cardH, 6).fillAndStroke('#FFFFFF', GRIS_BORDE);
        doc.save();
        doc.roundedRect(cardX, cardY, cardW, cardH, 6).clip();
        doc.rect(cardX, cardY, 4, cardH).fill(BCP_NARANJA);
        doc.restore();

        const logoPanelW = 132;
        const logoAreaX = cardX + 14;
        const logo = bcpLogo();
        if (logo) {
          const logoW = 104;
          const logoH = logoW * BCP_LOGO_RATIO;
          try {
            doc.image(logo, logoAreaX, cardY + (cardH - logoH) / 2, { width: logoW, height: logoH });
          } catch { doc.fillColor(BCP_AZUL).font('Helvetica-Bold').fontSize(22).text('BCP', logoAreaX, cardY + 26); }
        } else {
          doc.fillColor(BCP_AZUL).font('Helvetica-Bold').fontSize(22).text('BCP', logoAreaX, cardY + 26);
        }
        const divX = cardX + logoPanelW;
        doc.moveTo(divX, cardY + 12).lineTo(divX, cardY + cardH - 12).lineWidth(0.6).stroke(GRIS_BORDE);

        const accX = divX + 16;
        const accAreaW = cardX + cardW - accX - 14;
        doc.fillColor(BCP_AZUL).font('Helvetica-Bold').fontSize(7)
           .text('CUENTAS PARA DEPÓSITO / TRANSFERENCIA', accX, cardY + 9, { width: accAreaW, characterSpacing: 0.4 });

        const gap = 18;
        const colW2 = (accAreaW - gap) / 2;
        const celdaCuenta = (cx, moneda, simb, cuenta, cci) => {
          let cy = cardY + 22;
          const badgeTxt = `${moneda}`;
          doc.font('Helvetica-Bold').fontSize(7);
          const bTxtW = doc.widthOfString(badgeTxt);
          const bSimbW = doc.widthOfString(`${simb} `);
          const badgeW = bTxtW + bSimbW + 14;
          doc.roundedRect(cx, cy, badgeW, 13, 6.5).fill(BCP_AZUL);
          doc.fillColor(BCP_NARANJA).font('Helvetica-Bold').fontSize(7).text(`${simb} `, cx + 7, cy + 3.5, { continued: true })
             .fillColor('#FFFFFF').text(badgeTxt);
          cy += 19;
          doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text(cuenta, cx, cy, { width: colW2 });
          cy += 14;
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor(GRIS_TXT).text('CCI: ', cx, cy, { continued: true })
             .fillColor('#111827').text(cci);
        };
        celdaCuenta(accX, 'DÓLARES', 'US$', '194-2116093-1-86', '002-194-002116093186-97');
        celdaCuenta(accX + colW2 + gap, 'SOLES', 'S/', '194-2134322-0-07', '002-194-002134322007-91');

        doc.fillColor('#000').lineWidth(1);
        y = cardY + cardH + 6;
      }

      const yPie = Math.max(y, 700);
      if (qrBuffer && !rechazado) { try { doc.image(qrBuffer, 40, yPie, { width: 90, height: 90 }); } catch {} }
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
        doc.save().rotate(-30, { origin: [297, 400] })
          .fontSize(56).fillColor('#D32F2F').opacity(0.22)
          .text(marcaAgua, 80, 385, { width: 435, align: 'center', lineBreak: false })
          .opacity(1).restore();
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}