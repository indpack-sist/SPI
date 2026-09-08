// Representación impresa de la GRE Remitente (09).
// El contenido sigue las secciones de SUNAT y usa la identidad visual de IndPack.
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '../../../frontend/images/indpack.png');

const COLOR = {
  navy: '#20588D',
  cyan: '#35B5D6',
  pale: '#EFF7FB',
  pale2: '#F7FAFC',
  line: '#B9CFDD',
  ink: '#183247',
  muted: '#607789',
  white: '#FFFFFF',
  danger: '#D32F2F'
};

const MOTIVOS_TRASLADO = {
  '01': 'VENTA',
  '02': 'COMPRA',
  '04': 'TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA',
  '08': 'IMPORTACIÓN',
  '09': 'EXPORTACIÓN',
  '13': 'OTROS',
  '14': 'VENTA SUJETA A CONFIRMACIÓN DEL COMPRADOR',
  '18': 'TRASLADO EMISOR ITINERANTE CP'
};

const UNIDADES = {
  NIU: 'UNIDAD (NIU)', KGM: 'KILOGRAMO (KGM)', MTR: 'METRO (MTR)',
  LTR: 'LITRO (LTR)', MIL: 'MILLAR (MIL)', BX: 'CAJA (BX)', PK: 'PAQUETE (PK)'
};

let logoCache;
function logoBuffer() {
  if (logoCache !== undefined) return logoCache;
  try { logoCache = fs.readFileSync(LOGO_PATH); } catch { logoCache = null; }
  return logoCache;
}

const limpio = (value, fallback = '—') => {
  if (value == null || value === '') return fallback;
  return String(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
};

const siNo = (value) => value ? 'SÍ' : 'NO';

const numero = (value, decimals = 2) => Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals
});

const fechaConPeriodo = (value) => {
  const raw = limpio(value, '');
  const match = raw.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw || '—';
  const hour = Number(match[2]);
  const hour12 = hour % 12 || 12;
  return `${match[1]} ${String(hour12).padStart(2, '0')}:${match[3]} ${hour >= 12 ? 'PM' : 'AM'}`;
};

/**
 * Genera el PDF de una Guía de Remisión Electrónica aceptada por SUNAT.
 * Las columnas SUNAT que no forman parte del maestro actual de productos se imprimen como “—”.
 */
export async function generarGuiaRemisionSunatPDF({
  guia: g,
  emisor,
  cliente,
  detalle = [],
  conductor,
  conductores,
  vehiculos,
  transportista = null,
  registrar = true,
  indicadores = {},
  modalidad = null,
  fechaEntrega = null,
  comex = null,
  proveedor = null,
  docRelacionado = null,
  qrBuffer
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 28, bottom: 28, left: 33, right: 33 },
        bufferPages: true,
        info: {
          Title: `Guía de Remisión Electrónica ${g.serie_sunat}-${g.numero_sunat}`,
          Author: emisor.razon_social || 'INDPACK S.A.C.',
          Subject: 'Representación impresa de la GRE Remitente'
        }
      });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_W = 595.28;
      const X = 33;
      const W = 529;
      const CONTENT_BOTTOM = 790;
      let y = 28;
      let pageNumber = 1;

      const resetText = () => doc.fillColor(COLOR.ink).font('Helvetica').fontSize(7.4);

      const drawContinuationHeader = () => {
        doc.rect(X, 28, 5, 35).fill(COLOR.cyan);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.navy)
          .text(limpio(emisor.razon_social, 'INDPACK S.A.C.'), X + 14, 31, { width: 300 });
        doc.fontSize(8).fillColor(COLOR.muted)
          .text(`GUÍA DE REMISIÓN ELECTRÓNICA · ${g.serie_sunat}-${g.numero_sunat}`, X + 14, 47, { width: 360 });
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.navy)
          .text(`CONTINUACIÓN · PÁGINA ${pageNumber}`, 420, 39, { width: 142, align: 'right' });
        doc.moveTo(X, 69).lineTo(X + W, 69).lineWidth(0.7).strokeColor(COLOR.line).stroke();
        y = 79;
        resetText();
      };

      const newPage = () => {
        doc.addPage();
        pageNumber += 1;
        drawContinuationHeader();
      };

      const ensureSpace = (height) => {
        if (y + height > CONTENT_BOTTOM) newPage();
      };

      const drawMainHeader = () => {
        const logo = logoBuffer();
        if (logo) {
          try { doc.image(logo, X, 30, { fit: [195, 53], align: 'left', valign: 'center' }); } catch { /* logo opcional */ }
        } else {
          doc.font('Helvetica-Bold').fontSize(20).fillColor(COLOR.navy).text('IndPack', X, 40);
        }

        doc.font('Helvetica-Bold').fontSize(9.2).fillColor(COLOR.ink)
          .text(limpio(emisor.razon_social, 'INDPACK S.A.C.'), X, 88, { width: 300 });
        const dirEmisor = [emisor.direccion, emisor.urbanizacion].filter(Boolean).join(' - ');
        doc.font('Helvetica').fontSize(7.2).fillColor(COLOR.muted)
          .text(limpio(dirEmisor, ''), X, 102, { width: 320, height: 24, ellipsis: true });

        const bx = 368;
        const bw = 194;
        doc.roundedRect(bx, 28, bw, 93, 7).fillAndStroke(COLOR.pale, COLOR.navy);
        doc.rect(bx, 28, 6, 93).fill(COLOR.cyan);
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR.navy)
          .text(`RUC N° ${limpio(emisor.ruc)}`, bx + 12, 40, { width: bw - 20, align: 'center' });
        doc.moveTo(bx + 16, 57).lineTo(bx + bw - 10, 57).lineWidth(0.6).strokeColor(COLOR.line).stroke();
        doc.fontSize(10).fillColor(COLOR.ink)
          .text('GUÍA DE REMISIÓN', bx + 12, 65, { width: bw - 20, align: 'center' })
          .text('ELECTRÓNICA · REMITENTE', bx + 12, 79, { width: bw - 20, align: 'center' });
        doc.fontSize(13).fillColor(COLOR.navy)
          .text(`${g.serie_sunat}-${g.numero_sunat}`, bx + 12, 98, { width: bw - 20, align: 'center' });
        y = 128;
        resetText();
      };

      const sectionStart = (title, subtitle = '') => {
        ensureSpace(42);
        const top = y;
        doc.roundedRect(X, top, W, 17, 4).fill(COLOR.navy);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.white)
          .text(title.toUpperCase(), X + 9, top + 4.5, { width: 330 });
        if (subtitle) {
          doc.font('Helvetica').fontSize(6.7).fillColor('#DCEBF5')
            .text(subtitle, X + 330, top + 5, { width: W - 339, align: 'right' });
        }
        y = top + 17;
        return top;
      };

      const sectionEnd = (top, bottomPad = 4) => {
        y += bottomPad;
        doc.roundedRect(X, top, W, y - top, 4).lineWidth(0.65).strokeColor(COLOR.line).stroke();
        y += 4;
        resetText();
      };

      const labelValue = (label, value, x, atY, width, options = {}) => {
        const labelWidth = options.labelWidth || 105;
        const valueWidth = width - labelWidth;
        const safe = limpio(value);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.muted);
        const labelHeight = doc.heightOfString(label, { width: labelWidth - 5, lineGap: 1 });
        doc.text(label, x, atY, { width: labelWidth - 5, lineGap: 1 });
        doc.font(options.boldValue ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.fontSize || 7.5).fillColor(COLOR.ink)
          .text(safe, x + labelWidth, atY, { width: valueWidth, lineGap: 1 });
        const valueHeight = doc.heightOfString(safe, { width: valueWidth, lineGap: 1 });
        const height = Math.max(labelHeight, valueHeight,
          options.minHeight || 10
        );
        return height;
      };

      const twoColumnRows = (rows) => {
        const leftX = X + 9;
        const colW = (W - 27) / 2;
        const rightX = leftX + colW + 9;
        let cursor = y + 5;
        rows.forEach(([left, right], index) => {
          const leftHeight = left ? labelValue(left[0], left[1], leftX, cursor, colW, left[2] || {}) : 10;
          const rightHeight = right ? labelValue(right[0], right[1], rightX, cursor, colW, right[2] || {}) : 10;
          const rowH = Math.max(leftHeight, rightHeight, 11) + 4;
          if (index < rows.length - 1) {
            doc.moveTo(leftX, cursor + rowH - 3).lineTo(X + W - 9, cursor + rowH - 3)
              .lineWidth(0.35).strokeColor('#DCE7EE').stroke();
          }
          cursor += rowH;
        });
        y = cursor;
      };

      const fullWidthRow = (label, value, options = {}) => {
        const rowY = y + 5;
        const height = labelValue(label, value, X + 9, rowY, W - 18, options);
        y = rowY + height + 3;
      };

      drawMainHeader();

      // Datos principales: mismo contenido de la representación SUNAT, con mayor jerarquía visual.
      let top = sectionStart('Datos de emisión y ruta', 'GRE Remitente · Documento 09');
      twoColumnRows([
        [
          ['Fecha y hora de emisión:', fechaConPeriodo(g.fecha_emision),  { labelWidth: 126, boldValue: true }],
          ['Fecha de inicio de traslado:', g.fecha_traslado, { labelWidth: 133, boldValue: true }]
        ],
        [
          ['Motivo de traslado:', MOTIVOS_TRASLADO[String(g.motivo_traslado_cod)] || 'TRASLADO', { labelWidth: 104 }],
          null
        ]
      ]);
      fullWidthRow('Punto de partida:', `[${limpio(g.ubigeo_partida)}] ${limpio(g.direccion_partida)}`, { labelWidth: 105, fontSize: 7.7 });
      fullWidthRow('Punto de llegada:', `[${limpio(g.ubigeo_llegada)}] ${limpio(g.direccion_llegada)}`, { labelWidth: 105, fontSize: 7.7 });
      sectionEnd(top);

      const esComex = !!comex;
      const destinatario = (esComex && comex.destinatario) ? comex.destinatario : (cliente || {});
      top = sectionStart('Datos del destinatario');
      twoColumnRows([
        [
          ['Razón social / nombres:', destinatario.razon_social || destinatario.nombre, { labelWidth: 118, boldValue: true }],
          ['RUC / Documento:', destinatario.ruc || destinatario.numero_documento, { labelWidth: 100, boldValue: true }]
        ]
      ]);
      if (destinatario.direccion) fullWidthRow('Dirección fiscal:', destinatario.direccion, { labelWidth: 105 });
      if (proveedor?.ruc) {
        fullWidthRow('Proveedor:', `${limpio(proveedor.razon_social)} · RUC ${limpio(proveedor.ruc)}`, { labelWidth: 105 });
      }
      if (docRelacionado?.numero) {
        const docNumero = docRelacionado.serie ? `${docRelacionado.serie}-${docRelacionado.numero}` : docRelacionado.numero;
        fullWidthRow('Documento relacionado:', `${docRelacionado.tipo_desc || 'Factura'} N° ${docNumero}`, { labelWidth: 125 });
      }
      sectionEnd(top);

      if (esComex) {
        const docsRelacionados = (comex.docsRelacionados || []).filter((item) => item?.numero);
        const contenedores = (comex.contenedores || []).filter((item) => item?.numero_contenedor);
        top = sectionStart('Comercio exterior');
        fullWidthRow('Documentos Relacionados:', docsRelacionados.length
          ? docsRelacionados.map((item) => `${item.tipo_desc || 'Documento'} N° ${item.serie ? `${item.serie}-` : ''}${item.numero}`).join(' · ')
          : '—', { labelWidth: 135 });
        fullWidthRow('Bienes por transportar:', 'Datos importados del/los documento(s) relacionado(s)', { labelWidth: 135 });
        twoColumnRows([
          [
            ['Indicador de traslado total de la DAM o DS:', siNo(comex.trasladoTotalDam), { labelWidth: 190, boldValue: true }],
            ['Contenedor(es):', contenedores.length
              ? contenedores.map((item) => `${item.numero_contenedor}${item.numero_precinto ? ` / precinto ${item.numero_precinto}` : ''}`).join(' · ')
              : '—', { labelWidth: 87 }]
          ]
        ]);
        sectionEnd(top);
      } else {
        const cols = [
          { key: 'n', label: 'N°', width: 22, align: 'center' },
          { key: 'normalizado', label: 'BIEN\nNORMAL.', width: 40, align: 'center' },
          { key: 'codigo', label: 'CÓDIGO\nDE BIEN', width: 62 },
          { key: 'codigoSunat', label: 'CÓDIGO PROD.\nSUNAT', width: 54, align: 'center' },
          { key: 'partida', label: 'PARTIDA\nARANCEL.', width: 49, align: 'center' },
          { key: 'gtin', label: 'CÓDIGO\nGTIN', width: 43, align: 'center' },
          { key: 'descripcion', label: 'DESCRIPCIÓN DETALLADA', width: 147 },
          { key: 'unidad', label: 'UNIDAD DE\nMEDIDA', width: 66, align: 'center' },
          { key: 'cantidad', label: 'CANTIDAD', width: 46, align: 'right' }
        ];

        const tableHeader = () => {
          const topTable = y;
          let x = X;
          doc.rect(X, topTable, W, 30).fill(COLOR.navy);
          cols.forEach((col) => {
            doc.font('Helvetica-Bold').fontSize(5.7).fillColor(COLOR.white)
              .text(col.label, x + 3, topTable + 7, { width: col.width - 6, align: col.align || 'left', lineGap: 0.5 });
            x += col.width;
            if (x < X + W) doc.moveTo(x, topTable).lineTo(x, topTable + 30).lineWidth(0.25).strokeColor('#73A1C4').stroke();
          });
          y += 30;
        };

        ensureSpace(70);
        top = sectionStart('Bienes por transportar', `${detalle.length} ${detalle.length === 1 ? 'ítem' : 'ítems'}`);
        tableHeader();
        detalle.forEach((item, index) => {
          const unidadCode = limpio(item.codigo_unidad_sunat || item.unidad, 'NIU').toUpperCase();
          const values = {
            n: String(index + 1),
            normalizado: item.bien_normalizado === true || item.bien_normalizado === 1 ? 'SÍ' : 'NO',
            codigo: limpio(item.codigo),
            codigoSunat: limpio(item.codigo_producto_sunat),
            partida: limpio(item.subpartida_nacional || item.partida_arancelaria),
            gtin: limpio(item.gtin),
            descripcion: limpio(item.nombre || item.descripcion || item.codigo),
            unidad: UNIDADES[unidadCode] || unidadCode,
            cantidad: numero(item.cantidad)
          };
          const descHeight = doc.font('Helvetica').fontSize(6.6)
            .heightOfString(values.descripcion, { width: 141, lineGap: 1 });
          const codeHeight = doc.heightOfString(values.codigo, { width: 56, lineGap: 1 });
          const rowH = Math.max(29, descHeight + 10, codeHeight + 10);
          if (y + rowH > CONTENT_BOTTOM) {
            sectionEnd(top, 0);
            newPage();
            top = sectionStart('Bienes por transportar', 'continuación');
            tableHeader();
          }
          if (index % 2 === 0) doc.rect(X, y, W, rowH).fill(COLOR.pale2);
          let x = X;
          cols.forEach((col) => {
            doc.font(col.key === 'descripcion' || col.key === 'codigo' ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(col.key === 'unidad' ? 5.8 : 6.5).fillColor(COLOR.ink)
              .text(values[col.key], x + 3, y + 7, {
                width: col.width - 6,
                height: rowH - 9,
                align: col.align || 'left',
                lineGap: 1,
                ellipsis: true
              });
            x += col.width;
            if (x < X + W) doc.moveTo(x, y).lineTo(x, y + rowH).lineWidth(0.25).strokeColor(COLOR.line).stroke();
          });
          doc.moveTo(X, y + rowH).lineTo(X + W, y + rowH).lineWidth(0.35).strokeColor(COLOR.line).stroke();
          y += rowH;
        });
        if (!detalle.length) {
          doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
            .text('No se registraron bienes.', X + 9, y + 8, { width: W - 18, align: 'center' });
          y += 28;
        }
        sectionEnd(top, 0);

      }

      top = sectionStart('Resumen de carga');
      twoColumnRows([
        [
          ['Unidad de medida del peso bruto:', comex?.unidadPeso || 'KGM', { labelWidth: 163, boldValue: true }],
          ['Peso bruto total de la carga:', numero(g.peso_bruto_kg), { labelWidth: 148, boldValue: true }]
        ]
      ]);
      sectionEnd(top);

      const esTercero = !!transportista?.ruc;
      const modalidadTexto = (modalidad === '01' || esTercero) ? 'PÚBLICO' : 'PRIVADO';
      top = sectionStart('Datos del traslado');
      twoColumnRows([
        [
          ['Modalidad de traslado:', modalidadTexto, { labelWidth: 116, boldValue: true }],
          ['Indicador de transbordo programado:', siNo(indicadores.transbordo), { labelWidth: 174, boldValue: true }]
        ],
        [
          ['Indicador de traslado en vehículos de categoría M1 o L:', siNo(indicadores.m1l), { labelWidth: 203, boldValue: true }],
          ['Indicador de retorno de vehículo con envases o embalajes vacíos:', siNo(indicadores.retornoVacio), { labelWidth: 215, boldValue: true }]
        ],
        [
          ['Indicador de retorno de vehículo vacío:', siNo(indicadores.retornoVehiculoVacio), { labelWidth: 181, boldValue: true }],
          esTercero
            ? ['Indicador de registrar vehículos/conductores:', siNo(registrar), { labelWidth: 198, boldValue: true }]
            : null
        ]
      ]);
      if (transportista?.ruc) {
        fullWidthRow('Empresa transportista:', `${limpio(transportista.razon)} · RUC ${limpio(transportista.ruc)}${transportista.mtc ? ` · Registro MTC ${transportista.mtc}` : ''}`, { labelWidth: 125 });
      }
      if (fechaEntrega) fullWidthRow('Fecha entrega al transportista:', fechaEntrega, { labelWidth: 150 });
      sectionEnd(top);

      const normalizedConductores = Array.isArray(conductores) && conductores.length
        ? conductores
        : (conductor ? [conductor] : []);
      const normalizedVehiculos = Array.isArray(vehiculos) && vehiculos.length
        ? vehiculos
        : (g.placa ? [{ placa: g.placa }] : []);

      if (normalizedVehiculos.length || !esTercero) {
        top = sectionStart('Datos de los vehículos');
        if (normalizedVehiculos.length) {
          normalizedVehiculos.forEach((vehicle, index) => {
            const extras = [
              vehicle.tuce ? `TUCE ${vehicle.tuce}` : null,
              vehicle.autorizacion ? `Autorización MTC ${vehicle.autorizacion}` : null
            ].filter(Boolean).join(' · ');
            fullWidthRow(index === 0 ? 'Principal · N° de placa:' : 'Secundario · N° de placa:',
              `${limpio(vehicle.placa)}${extras ? ` · ${extras}` : ''}`,
              { labelWidth: 145, boldValue: true });
          });
        } else {
          fullWidthRow('Número de placa:', '—', { labelWidth: 105 });
        }
        sectionEnd(top);
      }

      if (normalizedConductores.length || !esTercero) {
        top = sectionStart('Datos de los conductores');
        if (normalizedConductores.length) {
          normalizedConductores.forEach((driver, index) => {
            const nombre = driver.nombre_completo || driver.nombre;
            const licencia = driver.licencia_conducir || driver.licencia;
            fullWidthRow(index === 0 ? 'Conductor principal:' : 'Conductor secundario:',
              `${limpio(nombre)} · DOCUMENTO NACIONAL DE IDENTIDAD N° ${limpio(driver.dni)} · LICENCIA N° ${limpio(licencia)}`,
              { labelWidth: 112, fontSize: 7.3, boldValue: true });
          });
        } else {
          fullWidthRow('Conductor principal:', '—', { labelWidth: 105 });
        }
        sectionEnd(top);
      }

      const observacion = limpio(g.observaciones, '');
      if (observacion) {
        top = sectionStart('Observaciones');
        doc.font('Helvetica').fontSize(7.6).fillColor(COLOR.ink)
          .text(observacion, X + 9, y + 8, { width: W - 18, lineGap: 1.5 });
        y = doc.y + 2;
        sectionEnd(top);
      }

      // Pie legal completo. Si no cabe, pasa a una página limpia en lugar de superponerse al detalle.
      if (y + 94 > 800) newPage();
      const footerY = Math.max(y + 3, 700);
      doc.roundedRect(X, footerY, W, 90, 6).fillAndStroke(COLOR.pale, COLOR.line);
      doc.rect(X, footerY, 6, 90).fill(COLOR.cyan);
      if (qrBuffer) {
        try { doc.image(qrBuffer, X + 15, footerY + 9, { width: 72, height: 72 }); } catch { /* QR opcional */ }
      }
      const legalX = X + 101;
      doc.font('Helvetica-Bold').fontSize(8.3).fillColor(COLOR.navy)
        .text('REPRESENTACIÓN IMPRESA', legalX, footerY + 10, { width: 205 });
      doc.font('Helvetica').fontSize(7.2).fillColor(COLOR.ink)
        .text('Esta es una representación impresa sin valor tributario de la Guía de Remisión Electrónica generada en el sistema de la SUNAT. Puede verificarla utilizando su clave SOL.', legalX, footerY + 25, { width: 407, lineGap: 1.2 });
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLOR.muted)
        .text('El código QR contiene la información de consulta y verificación del documento electrónico.', legalX, footerY + 58, { width: 407 });
      const estado = g.sunat_estado === 'ANULADA' ? 'SIN EFECTO'
        : g.sunat_estado === 'REEMPLAZADA' ? 'REEMPLAZADA' : 'ACEPTADA POR SUNAT';
      doc.roundedRect(legalX, footerY + 70, 118, 14, 7).fill(g.sunat_estado === 'ACEPTADO' ? COLOR.navy : COLOR.danger);
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLOR.white)
        .text(estado, legalX + 5, footerY + 74, { width: 108, align: 'center' });

      // Marca de agua para guías invalidadas.
      const watermark = g.sunat_estado === 'ANULADA' ? 'SIN EFECTO'
        : g.sunat_estado === 'REEMPLAZADA' ? 'REEMPLAZADA' : null;
      if (watermark) {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i += 1) {
          doc.switchToPage(i);
          doc.save().rotate(-30, { origin: [PAGE_W / 2, 410] })
            .font('Helvetica-Bold').fontSize(64).fillColor(COLOR.danger).opacity(0.17)
            .text(watermark, 60, 380, { align: 'center', width: 480 })
            .opacity(1).restore();
        }
        doc.switchToPage(range.start + range.count - 1);
        const nota = g.sunat_estado === 'REEMPLAZADA' && g.reemplazo_ref
          ? `Reemplazada por la guía ${g.reemplazo_ref}`
          : (g.sunat_estado === 'ANULADA' && g.motivo_anulacion ? `Motivo: ${g.motivo_anulacion}` : '');
        if (nota) doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.danger).text(nota, legalX + 126, footerY + 74, { width: 275 });
      }

      // Numeración discreta en todas las páginas.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(6.5).fillColor(COLOR.muted)
          .text(`Página ${i - range.start + 1} de ${range.count}`, 465, 805, { width: 97, align: 'right', lineBreak: false });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
