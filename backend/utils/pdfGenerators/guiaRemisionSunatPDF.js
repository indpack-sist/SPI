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
 *                               sunat_estado, sunat_digest_value, placa, observaciones }
 * @param {object} p.emisor    empresa_config
 * @param {object} p.cliente   destinatario { razon_social, ruc }
 * @param {Array}  p.detalle   [{ codigo, nombre, cantidad, codigo_unidad_sunat }]
 * @param {object|null} p.conductor  { nombre_completo, dni, licencia_conducir } (legacy; usar p.conductores)
 * @param {Array}  [p.conductores] [{ nombre_completo|nombre, dni, licencia_conducir|licencia }] (1-2)
 * @param {Array}  [p.vehiculos]   [{ placa, tuce, autorizacion }] (1-2)
 * @param {object|null} [p.transportista] { razon, ruc, mtc } (solo tercero/público)
 * @param {boolean} [p.registrar=true] tercero: 1=registró veh/cond (Caso 2/3); 0=solo transportista (Caso 1)
 * @param {object} [p.indicadores] { transbordo, m1l, retornoVacio } booleans
 * @param {string|null} [p.modalidad] '01' público | '02' privado
 * @param {string|null} [p.fechaEntrega] fecha entrega de bienes al transportista (dd/mm/yyyy o ISO)
 * @param {object|null} [p.comex]  Comercio exterior (exportación). null = guía doméstica (no imprime nada comex).
 *        { destinatario:{razon_social,ruc}|null, docsRelacionados:[{tipo_desc,serie,numero}],
 *          contenedores:[{numero_contenedor,numero_precinto}], trasladoTotalDam:boolean, unidadPeso:'KGM' }
 * @param {Buffer} p.qrBuffer  PNG del QR con la URL de SUNAT
 * @returns {Promise<Buffer>}
 */
export async function generarGuiaRemisionSunatPDF({ guia: g, emisor, cliente, detalle, conductor, conductores, vehiculos, transportista = null, registrar = true, indicadores = {}, modalidad = null, fechaEntrega = null, comex = null, qrBuffer }) {
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
      // En exportación el destinatario NO es el cliente de la OV (ese va en la factura), sino el
      // operador de puerto/depósito (destinatario_ruc/razon). Se usa el comex cuando viene.
      const esComex = !!comex;
      const dest = (esComex && comex.destinatario) ? comex.destinatario : cliente;
      let y = 122;
      const boxDestTop = y;
      const pad = 8;
      let yl = boxDestTop + pad;
      yl = campo('Destinatario:', dest.razon_social, 40, 118, 193, yl);
      yl = campo('RUC/Doc:', dest.ruc, 40, 118, 193, yl);
      // Dir. fiscal: solo si existe (el destinatario comex del catálogo no la captura → se omite).
      if (dest.direccion) yl = campo('Dir. fiscal:', dest.direccion, 40, 118, 193, yl);
      let yr = boxDestTop + pad;
      yr = campo('Fecha emisión:', g.fecha_emision, 322, 410, 150, yr);
      yr = campo('Inicio traslado:', g.fecha_traslado, 322, 410, 150, yr);
      const boxDestH = (Math.max(yl, yr) + 4) - boxDestTop;
      doc.roundedRect(33, boxDestTop, 529, boxDestH, 3).stroke('#000');
      y = boxDestTop + boxDestH + 8;

      // ── Normalización de transporte (soporta 3 casos + legacy conductor/placa) ──
      const esTercero = !!(transportista && transportista.ruc);
      const conds = (Array.isArray(conductores) && conductores.length)
        ? conductores
        : (conductor ? [conductor] : []);
      const vehs = (Array.isArray(vehiculos) && vehiculos.length)
        ? vehiculos
        : (g.placa ? [{ placa: g.placa }] : []);
      const si = (b) => (b ? 'SÍ' : 'NO');
      // Peso con separador de miles, sin decimales redundantes (ej. "1,200"), como el PDF de SUNAT.
      const pesoFmt = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
      const docLabel = (d) => {
        const desc = (d.tipo_desc && String(d.tipo_desc).trim()) || 'Documento relacionado';
        const num = d.serie ? `${d.serie}-${d.numero}` : d.numero;
        return `${desc} N° ${num}`;
      };

      // ── Comercio exterior (exportación) ──────────────────────────────────────────
      // Bloque intermedio, en el orden EXACTO del PDF oficial de SUNAT (EG07-273):
      //   Documentos Relacionados (DAM) → Bienes por transportar (importados del doc.) →
      //   Indicador de traslado total + contenedor/precinto → Unidad + Peso bruto.
      // En traslado total de la DAM, SUNAT NO itemiza los bienes (se importan del documento):
      // por eso la tabla de productos se omite abajo cuando la guía es comex. Todo condicionado
      // a que el dato exista (no se pinta lo que no vino).
      if (esComex) {
        const docsRel = Array.isArray(comex.docsRelacionados) ? comex.docsRelacionados.filter(d => d && d.numero) : [];
        const conts = Array.isArray(comex.contenedores) ? comex.contenedores.filter(c => c && c.numero_contenedor) : [];
        const boxCxTop = y;
        let yc = boxCxTop + pad;
        const header = (txt, atY) => {
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#000').text(txt, 40, atY, { width: 515 });
          return atY + 13;
        };
        const linea = (txt, atY, x = 48, w = 507) => {
          doc.fontSize(8).font('Helvetica').fillColor('#000').text(txt, x, atY, { width: w });
          const h = doc.heightOfString(txt, { width: w });
          return atY + Math.max(h, 11) + 2;
        };
        // Documentos Relacionados
        if (docsRel.length) {
          yc = header('Documentos Relacionados:', yc);
          for (const d of docsRel) yc = linea(docLabel(d), yc);
          yc += 2;
        }
        // Bienes por transportar (importados del/los documento(s) relacionado(s))
        yc = header('Bienes por transportar:', yc);
        yc = linea('Datos importados del/los documento(s) relacionado(s)', yc);
        for (const d of docsRel) yc = linea(docLabel(d), yc);
        yc += 2;
        // Indicador de traslado total (izq) + contenedores/precintos (der), a dos columnas.
        const yIndTop = yc;
        let yLeft = campo('Ind. traslado total de la DAM o DS (*):', si(comex.trasladoTotalDam), 40, 230, 60, yIndTop);
        let yRight = yIndTop;
        conts.forEach((c, i) => {
          yRight = campo(`N° de contenedor ${i + 1}:`, c.numero_contenedor, 305, 400, 157, yRight);
          if (c.numero_precinto) yRight = campo(`N° de precinto ${i + 1}:`, c.numero_precinto, 305, 400, 157, yRight);
        });
        yc = Math.max(yLeft, yRight) + 2;
        // Unidad de medida + peso bruto (de la DAM en traslado total).
        yc = campo('Unidad de medida del peso bruto:', comex.unidadPeso || 'KGM', 40, 200, 340, yc);
        yc = campo('Peso bruto total de la carga:', pesoFmt(g.peso_bruto_kg), 40, 200, 340, yc);
        const boxCxH = (yc + 4) - boxCxTop;
        doc.roundedRect(33, boxCxTop, 529, boxCxH, 3).stroke('#000');
        y = boxCxTop + boxCxH + 8;
      }

      // ── Datos del traslado (flujo dinámico, full-width) ──
      const boxTrasTop = y;
      const motivo = MOTIVOS_TRASLADO[String(g.motivo_traslado_cod)] || 'TRASLADO';
      const modalidadTxt = (modalidad === '01' || esTercero) ? 'PÚBLICO (transporte por tercero)' : 'PRIVADO';
      let yt = boxTrasTop + pad;
      yt = campo('Motivo de traslado:', `${g.motivo_traslado_cod} - ${motivo}`, 40, 155, 405, yt);
      yt = campo('Modalidad de traslado:', modalidadTxt, 40, 155, 405, yt);
      // El peso bruto ya se muestra en el bloque de comercio exterior (unidad + peso de la DAM).
      if (!esComex) yt = campo('Peso bruto total:', `${Number(g.peso_bruto_kg || 0).toFixed(2)} KGM`, 40, 155, 405, yt);
      yt = campo('Punto de partida:', `[${g.ubigeo_partida}] ${g.direccion_partida || '-'}`, 40, 155, 405, yt);
      yt = campo('Punto de llegada:', `[${g.ubigeo_llegada}] ${g.direccion_llegada || '-'}`, 40, 155, 405, yt);

      if (esTercero) {
        // Indicadores SUNAT: solo aplican al transporte público (tercero). En privado no se listan.
        yt = campo('Ind. transbordo programado:', si(indicadores.transbordo), 40, 260, 300, yt);
        yt = campo('Ind. traslado en vehículo M1/L:', si(indicadores.m1l), 40, 260, 300, yt);
        yt = campo('Ind. retorno con envases/embalajes vacíos:', si(indicadores.retornoVacio), 40, 300, 260, yt);
        // Indicador propio del tercero + datos del transportista (Caso 1/2/3).
        yt = campo('Ind. registrar veh./cond. del transportista:', si(registrar), 40, 300, 260, yt);
        yt = campo('Transportista:',
          `${transportista.razon || '-'}  ·  RUC ${transportista.ruc}${transportista.mtc ? `  ·  MTC ${transportista.mtc}` : ''}`,
          40, 155, 405, yt);
        if (fechaEntrega) yt = campo('Fecha entrega al transportista:', fechaEntrega, 40, 220, 340, yt);
      }

      // Datos de los vehículos (principal + secundario, con TUCE/autorización si aplican).
      vehs.forEach((v, i) => {
        const partes = [
          v.placa ? `Placa ${v.placa}` : null,
          v.tuce ? `TUCE ${v.tuce}` : null,
          v.autorizacion ? `Autoriz. MTC ${v.autorizacion}` : null,
        ].filter(Boolean).join('  ·  ');
        yt = campo(i === 0 ? 'Vehículo principal:' : 'Vehículo secundario:', partes || '-', 40, 155, 405, yt);
      });

      // Datos de los conductores (principal + secundario).
      conds.forEach((c, i) => {
        const nom = c.nombre_completo || c.nombre || '-';
        const lic = c.licencia_conducir || c.licencia || '-';
        yt = campo(i === 0 ? 'Conductor principal:' : 'Conductor secundario:',
          `${nom} (DNI ${c.dni || '-'}, Lic. ${lic})`, 40, 155, 405, yt);
      });

      const boxTrasH = (yt + 4) - boxTrasTop;
      doc.roundedRect(33, boxTrasTop, 529, boxTrasH, 3).stroke('#000');
      y = boxTrasTop + boxTrasH + 8;

      // ── Tabla de bienes (sin montos) ──
      // En comercio exterior con traslado total de la DAM, SUNAT NO lista los ítems (los bienes se
      // importan del documento relacionado, ya declarado arriba en "Bienes por transportar"): se
      // omite la tabla. Esto mantiene la GRE de exportación en una sola hoja sin importar la OV.
      if (!esComex) {
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
        y += 8;
      }

      // ── Observaciones (texto libre + OC) — texto plano, sin recuadro, posición inteligente ──
      // Mismo diseño que la factura: fluye bajo la tabla (baja con ella cuando hay muchos ítems) y
      // el mismo texto viaja a SUNAT en cbc:Note. SUNAT la refleja como "Observaciones".
      const obsTxt = String(g.observaciones || '').replace(/[\r\n]+/g, ' ').trim();
      if (obsTxt) {
        doc.fontSize(8).fillColor('#000')
          .font('Helvetica-Bold').text('Observaciones: ', 40, y, { continued: true, width: 515 })
          .font('Helvetica').text(obsTxt);
        y = doc.y + 2;
      }

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
