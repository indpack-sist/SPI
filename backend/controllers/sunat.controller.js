// controllers/sunat.controller.js
// Orquestación del módulo SUNAT.
import { promises as fs } from 'fs';
import { sunatConfig } from '../config/sunat.js';
import { pool, withTransaction } from '../config/database.js';
import { obtenerCorrelativo, obtenerCorrelativoDiario } from '../services/sunat/numeracion.service.js';
import { construirInvoiceXML } from '../services/sunat/ubl.service.js';
import { construirNotaXML, motivosValidos } from '../services/sunat/ubl-nota.service.js';
import { construirVoidedDocumentsXML } from '../services/sunat/ubl-baja.service.js';
import { construirDespatchAdviceXML } from '../services/sunat/ubl-gre.service.js';
import { obtenerTokenGre, enviarGuia, consultarGuia } from '../services/sunat/gre.service.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { zipXml } from '../services/sunat/zip.service.js';
import { sendBill, sendSummary, getStatus, getStatusCdr } from '../services/sunat/soap.service.js';
import { parsearCdr } from '../services/sunat/cdr.service.js';
import { generarQr, qrPng } from '../services/sunat/qr.service.js';
import { generarComprobanteSunatPDF } from '../utils/pdfGenerators/comprobanteSunatPDF.js';
import { generarGuiaRemisionSunatPDF } from '../utils/pdfGenerators/guiaRemisionSunatPDF.js';
import { registrarSunatLog } from '../services/sunat/log.service.js';
import { subirRaw } from '../services/cloudinary.service.js';
import AppError from '../utils/AppError.js';

// Tipos de comprobante dentro de alcance (catálogo 01). Boletas (03) y otros: fuera de alcance.
const TIPOS_PERMITIDOS = ['01', '07', '08'];

// Fecha/hora en zona Lima (America/Lima) para IssueDate/IssueTime.
function fechaLima() {
  const now = new Date();
  const emision = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  let hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(now);
  hora = hora.replace(/^24/, '00'); // quirk de medianoche en algunos runtimes
  // Datetime Lima completo 'YYYY-MM-DD HH:MM:SS' para PERSISTIR en BD. Se escribe explícito
  // (no NOW()/CURRENT_TIMESTAMP) porque la sesión MySQL corre en UTC (time_zone=SYSTEM) y
  // guardaría la hora +5h. Coincide exactamente con el IssueDate+IssueTime del XML.
  const emisionDateTime = `${emision} ${hora}`;
  return { emision, hora, emisionDateTime };
}
function addDiasISO(iso, dias) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}
// Días calendario entre dos fechas ISO ('YYYY-MM-DD'). desde=emisión, hasta=hoy.
function diffDiasISO(desdeISO, hastaISO) {
  const a = new Date(desdeISO + 'T00:00:00');
  const b = new Date(hastaISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Las columnas xml_url/cdr_url guardan {url:...} (JSON u objeto según el driver). Devuelve el string.
function extraerUrl(v) {
  if (!v) return null;
  if (typeof v === 'object') return v.url || null;
  try { return JSON.parse(v).url || null; } catch { return v; }
}
async function copiaLocal(nombre, contenido) {
  try {
    await fs.mkdir('sunat-output', { recursive: true });
    await fs.writeFile(`sunat-output/${nombre}`, contenido);
  } catch { /* depuración, no crítico */ }
}

// GET /api/sunat/ping  -> verificación de despliegue (sin auth)
export async function ping(req, res) {
  res.json({ mode: sunatConfig.mode });
}

// GET /api/sunat/health -> verifica que el permiso 'facturacion' está operativo
export async function health(req, res) {
  res.json({
    ok: true,
    mode: sunatConfig.mode,
    rol: req.user?.rol || null
  });
}

// POST /api/sunat/comprobantes/emitir  { id_orden_venta, tipo? }
// Emite una FACTURA (01) a partir de una Orden de Venta aprobada y no facturada.
export async function emitirComprobante(req, res, next) {
  const { id_orden_venta } = req.body;
  const tipo = req.body.tipo || '01';
  const idEmpleado = req.user?.id_empleado || null;
  try {
    if (!id_orden_venta) throw new AppError('Falta id_orden_venta', 400);
    if (!TIPOS_PERMITIDOS.includes(tipo)) {
      throw new AppError(`Tipo de comprobante ${tipo} fuera de alcance (solo 01/07/08; boletas no se emiten)`, 400);
    }
    if (tipo !== '01') {
      throw new AppError('Las notas 07/08 se emiten desde el endpoint de notas (Fase 7)', 400);
    }

    const { emision, hora, emisionDateTime } = fechaLima();
    const serie = 'FE01';

    // ── TX1: validar + reservar correlativo + INSERT factura ENVIADO (traza) ──
    const prep = await withTransaction(async (conn) => {
      const [[ov]] = await conn.query(
        'SELECT * FROM ordenes_venta WHERE id_orden_venta = ? FOR UPDATE', [id_orden_venta]);
      if (!ov) throw new AppError('Orden de venta no existe', 404);
      if (ov.facturado_sunat) throw new AppError('La OV ya fue facturada', 409);
      if (ov.estado_verificacion !== 'Aprobada') throw new AppError('La OV debe estar Aprobada para facturar', 422);

      const [[cliente]] = await conn.query('SELECT * FROM clientes WHERE id_cliente = ?', [ov.id_cliente]);
      if (!cliente) throw new AppError('Cliente de la OV no existe', 404);
      const esExport = Number(ov.es_exportacion) === 1;
      if (!esExport && (String(cliente.tipo_documento).toUpperCase() !== 'RUC' || !/^\d{11}$/.test(String(cliente.ruc || '')))) {
        throw new AppError('La factura (01) requiere un cliente con RUC de 11 dígitos', 422);
      }

      const [detalle] = await conn.query(
        'SELECT d.*, p.codigo, p.nombre, p.codigo_unidad_sunat ' +
        'FROM detalle_orden_venta d JOIN productos p ON p.id_producto = d.id_producto ' +
        'WHERE d.id_orden_venta = ?', [id_orden_venta]);
      const [[empresa]] = await conn.query('SELECT * FROM empresa_config WHERE id = 1');

      const numero = await obtenerCorrelativo(conn, tipo, serie);
      const fecha = {
        emision, hora,
        vencimiento: String(ov.tipo_venta || '').toLowerCase().startsWith('cr')
          ? addDiasISO(emision, ov.dias_credito) : null
      };

      const { xml, totales } = construirInvoiceXML({ serie, numero, ov, detalle, cliente, empresa, fecha });
      const { xmlFirmado, digestValue } = firmarXml(xml);
      // El número del nombre de archivo debe coincidir EXACTO con cbc:ID (serie-numero),
      // SIN ceros a la izquierda: SUNAT (fault 1036) compara ambos sin normalizar el padding.
      const nombre = `${sunatConfig.ruc}-${tipo}-${serie}-${numero}`;

      const qr = generarQr({
        ruc: sunatConfig.ruc, tipo, serie, numero,
        igv: totales.igv, total: totales.total, fechaEmision: emision,
        tipoDocCliente: esExport ? '0' : '6', numDocCliente: cliente.ruc || '0'
      });

      const [ins] = await conn.query(
        `INSERT INTO facturas_venta
          (numero_factura, id_orden_venta, id_cliente, tipo_comprobante, serie, numero,
           subtotal, igv, total, moneda, estado, codigo_tipo_sunat, tipo_operacion_sunat,
           fecha_emision,
           sunat_estado, sunat_digest_value, sunat_qr_data, sunat_nombre_xml, hash_see,
           sunat_fecha_envio, id_registrado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, ?, 'ENVIADO', ?,?,?,?, ?, ?)`,
        [`${serie}-${numero}`, id_orden_venta, ov.id_cliente, 'Factura', serie, numero,
         totales.subtotal, totales.igv, totales.total, ov.moneda || 'PEN', 'Emitida',
         tipo, esExport ? '0200' : (ov.tipo_operacion_sunat || '0101'),
         emisionDateTime,
         digestValue, qr.data, nombre, digestValue, emisionDateTime, idEmpleado]);

      return { idFactura: ins.insertId, numero, nombre, xmlFirmado, digestValue, totales };
    });

    // ── Fuera de transacción: envío a SUNAT + subida de archivos ──
    const { idFactura, numero, nombre, xmlFirmado, totales } = prep;
    // Diagnóstico fault 1036: las TRES cadenas deben producir el mismo Serie-Número.
    const cbcId = /<cbc:ID>([^<]+)<\/cbc:ID>/.exec(xmlFirmado)?.[1] || null;
    const debug = { fileNameSoap: `${nombre}.zip`, zipEntry: `${nombre}.xml`, cbcId, rucLen: String(sunatConfig.ruc).length };
    console.log('[SUNAT] emitir ->', JSON.stringify(debug));
    await copiaLocal(`${nombre}.xml`, xmlFirmado);
    const zipBuf = zipXml(`${nombre}.xml`, xmlFirmado);

    let cdrZip, cdr;
    const t0 = Date.now();
    try {
      cdrZip = await sendBill(`${nombre}.zip`, zipBuf);
      cdr = parsearCdr(cdrZip);
    } catch (e) {
      // Fault SOAP (timeout, 1033, 0111, caída...): la fila queda ENVIADO para consulta/reintento.
      await pool.query(
        'UPDATE facturas_venta SET sunat_response_desc = ?, sunat_intentos = sunat_intentos + 1 WHERE id_factura = ?',
        [`FAULT ${e.faultCode || ''}: ${e.message}`.slice(0, 4000), idFactura]);
      await registrarSunatLog({ origen: 'FACTURA', referenciaId: idFactura, evento: 'sendBill',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      return res.status(502).json({
        ok: false, estado: 'ENVIADO', idFactura, serie, numero,
        faultCode: e.faultCode || null, error: e.message, debug
      });
    }
    await copiaLocal(`R-${nombre}.zip`, cdrZip);

    const aceptado = cdr.responseCode === '0';
    const codigo = Number(cdr.responseCode);
    const rechazado = codigo >= 2000 && codigo <= 3999;
    const estadoFinal = aceptado ? 'ACEPTADO' : (rechazado ? 'RECHAZADO' : 'ENVIADO');
    const descripcion = (cdr.description || '') + (cdr.notas.length ? ' | OBS: ' + cdr.notas.join('; ') : '');

    // Subida a Cloudinary (no crítica: si falla, la factura queda registrada igual).
    let xmlUrl = null, cdrUrl = null;
    try { xmlUrl = await subirRaw(Buffer.from(xmlFirmado, 'utf8'), `sunat/xml/${nombre}.xml`); }
    catch (e) { console.warn('[SUNAT] subir XML falló:', e.message); }
    try { cdrUrl = await subirRaw(cdrZip, `sunat/cdr/R-${nombre}.zip`); }
    catch (e) { console.warn('[SUNAT] subir CDR falló:', e.message); }

    // ── TX2: estado final + marca en la OV si fue aceptado ──
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE facturas_venta SET sunat_estado = ?, sunat_response_code = ?, sunat_response_desc = ?,
           xml_url = ?, cdr_url = ? WHERE id_factura = ?`,
        [estadoFinal, cdr.responseCode, descripcion.slice(0, 4000),
         xmlUrl ? JSON.stringify({ url: xmlUrl }) : null,
         cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, idFactura]);

      if (aceptado) {
        await conn.query(
          `UPDATE ordenes_venta SET facturado_sunat = 1, fecha_facturacion_sunat = ?,
             numero_comprobante_sunat = ?, id_facturador = ? WHERE id_orden_venta = ?`,
          [emisionDateTime, `${serie}-${numero}`, idEmpleado, id_orden_venta]);
      }
    });

    await registrarSunatLog({ origen: 'FACTURA', referenciaId: idFactura, evento: 'sendBill',
      exito: aceptado, httpStatus: 200, detalle: `${cdr.responseCode} ${descripcion}`.slice(0, 4000),
      duracionMs: Date.now() - t0 });

    res.json({
      ok: aceptado, estado: estadoFinal, idFactura, serie, numero,
      comprobante: `${serie}-${numero}`, responseCode: cdr.responseCode,
      descripcion, totales, xmlUrl, cdrUrl
    });
  } catch (e) { next(e); }
}

// Serie fija por tipo de nota (asociadas a facturas FE01).
const SERIES_NOTA = { '07': 'FC01', '08': 'FD01' };

// POST /api/sunat/comprobantes/notas/emitir  { id_factura_ref, tipo, motivo_codigo, items? }
// Emite una Nota de Crédito (07) o Débito (08) sobre una FACTURA (01) ACEPTADA.
export async function emitirNota(req, res, next) {
  const { id_factura_ref, motivo_codigo } = req.body;
  const tipo = String(req.body.tipo || '');
  const items = Array.isArray(req.body.items) ? req.body.items : null;
  const idEmpleado = req.user?.id_empleado || null;
  try {
    if (!id_factura_ref) throw new AppError('Falta id_factura_ref', 400);
    if (!SERIES_NOTA[tipo]) throw new AppError('tipo de nota inválido (07 NC | 08 ND)', 400);
    if (!motivo_codigo) throw new AppError('Falta motivo_codigo', 400);
    const serie = SERIES_NOTA[tipo];
    const { emision, hora, emisionDateTime } = fechaLima();

    // ── TX1: validar doc afectado + reservar correlativo + INSERT nota ENVIADO ──
    const prep = await withTransaction(async (conn) => {
      const [[ref]] = await conn.query(
        'SELECT * FROM facturas_venta WHERE id_factura = ? FOR UPDATE', [id_factura_ref]);
      if (!ref) throw new AppError('Comprobante afectado no existe', 404);
      if (ref.codigo_tipo_sunat !== '01') throw new AppError('Solo se emiten notas sobre facturas (01)', 422);
      if (ref.sunat_estado !== 'ACEPTADO') throw new AppError('El comprobante afectado no está ACEPTADO por SUNAT', 409);
      if (ref.estado === 'Anulada') throw new AppError('El comprobante afectado ya está anulado', 409);

      const [[ov]] = await conn.query(
        'SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [ref.id_orden_venta]);
      if (!ov) throw new AppError('Orden de venta del comprobante afectado no existe', 404);
      const [[cliente]] = await conn.query('SELECT * FROM clientes WHERE id_cliente = ?', [ref.id_cliente]);
      if (!cliente) throw new AppError('Cliente del comprobante afectado no existe', 404);
      const [[empresa]] = await conn.query('SELECT * FROM empresa_config WHERE id = 1');

      // Líneas: parcial (items del request) o total (replica el detalle de la OV facturada).
      let detalle;
      if (items) {
        detalle = items.map((it) => ({
          codigo: it.codigo || null,
          nombre: it.descripcion || it.nombre || null,
          descripcion: it.descripcion || null,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          codigo_unidad_sunat: it.codigo_unidad_sunat,
          codigo_afectacion_igv: it.codigo_afectacion_igv || '10',
          descuento_porcentaje: it.descuento_porcentaje || 0
        }));
      } else {
        [detalle] = await conn.query(
          'SELECT d.*, p.codigo, p.nombre, p.codigo_unidad_sunat ' +
          'FROM detalle_orden_venta d JOIN productos p ON p.id_producto = d.id_producto ' +
          'WHERE d.id_orden_venta = ?', [ref.id_orden_venta]);
      }

      const numero = await obtenerCorrelativo(conn, tipo, serie);
      const fecha = { emision, hora };
      const docAfectado = { comprobante: ref.numero_factura, tipo: '01' };

      const { xml, totales } = construirNotaXML({
        tipo, serie, numero, motivoCodigo: String(motivo_codigo),
        docAfectado, ov, detalle, cliente, empresa, fecha
      });
      const { xmlFirmado, digestValue } = firmarXml(xml);
      const nombre = `${sunatConfig.ruc}-${tipo}-${serie}-${numero}`;

      const qr = generarQr({
        ruc: sunatConfig.ruc, tipo, serie, numero,
        igv: totales.igv, total: totales.total, fechaEmision: emision,
        tipoDocCliente: String(cliente.tipo_documento || '').toUpperCase() === 'RUC' ? '6' : '0',
        numDocCliente: cliente.ruc || '0'
      });

      const [ins] = await conn.query(
        `INSERT INTO facturas_venta
          (numero_factura, id_orden_venta, id_cliente, tipo_comprobante, serie, numero,
           subtotal, igv, total, moneda, estado, codigo_tipo_sunat, tipo_operacion_sunat,
           id_factura_ref, motivo_nota_codigo, fecha_emision,
           sunat_estado, sunat_digest_value, sunat_qr_data, sunat_nombre_xml, hash_see,
           sunat_fecha_envio, id_registrado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ENVIADO', ?,?,?,?, ?, ?)`,
        [`${serie}-${numero}`, ref.id_orden_venta, ref.id_cliente, 'Factura', serie, numero,
         totales.subtotal, totales.igv, totales.total, ref.moneda || 'PEN', 'Emitida',
         tipo, ov.tipo_operacion_sunat || '0101',
         id_factura_ref, String(motivo_codigo), emisionDateTime,
         digestValue, qr.data, nombre, digestValue, emisionDateTime, idEmpleado]);

      return { idNota: ins.insertId, numero, nombre, xmlFirmado, totales };
    });

    // ── Envío a SUNAT + CDR (mismo flujo que la factura) ──
    const { idNota, numero, nombre, xmlFirmado, totales } = prep;
    const cbcId = /<cbc:ID>([^<]+)<\/cbc:ID>/.exec(xmlFirmado)?.[1] || null;
    const debug = { fileNameSoap: `${nombre}.zip`, zipEntry: `${nombre}.xml`, cbcId, rucLen: String(sunatConfig.ruc).length };
    console.log('[SUNAT] emitirNota ->', JSON.stringify(debug));
    await copiaLocal(`${nombre}.xml`, xmlFirmado);
    const zipBuf = zipXml(`${nombre}.xml`, xmlFirmado);

    let cdrZip, cdr;
    const t0 = Date.now();
    try {
      cdrZip = await sendBill(`${nombre}.zip`, zipBuf);
      cdr = parsearCdr(cdrZip);
    } catch (e) {
      await pool.query(
        'UPDATE facturas_venta SET sunat_response_desc = ?, sunat_intentos = sunat_intentos + 1 WHERE id_factura = ?',
        [`FAULT ${e.faultCode || ''}: ${e.message}`.slice(0, 4000), idNota]);
      await registrarSunatLog({ origen: 'NOTA', referenciaId: idNota, evento: 'sendBill',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      return res.status(502).json({
        ok: false, estado: 'ENVIADO', idNota, serie, numero,
        faultCode: e.faultCode || null, error: e.message, debug
      });
    }
    await copiaLocal(`R-${nombre}.zip`, cdrZip);

    const aceptado = cdr.responseCode === '0';
    const codigo = Number(cdr.responseCode);
    const rechazado = codigo >= 2000 && codigo <= 3999;
    const estadoFinal = aceptado ? 'ACEPTADO' : (rechazado ? 'RECHAZADO' : 'ENVIADO');
    const descripcion = (cdr.description || '') + (cdr.notas.length ? ' | OBS: ' + cdr.notas.join('; ') : '');

    let xmlUrl = null, cdrUrl = null;
    try { xmlUrl = await subirRaw(Buffer.from(xmlFirmado, 'utf8'), `sunat/xml/${nombre}.xml`); }
    catch (e) { console.warn('[SUNAT] subir XML nota falló:', e.message); }
    try { cdrUrl = await subirRaw(cdrZip, `sunat/cdr/R-${nombre}.zip`); }
    catch (e) { console.warn('[SUNAT] subir CDR nota falló:', e.message); }

    // ── TX2: estado final + anulación del original si NC total (motivo 01) ──
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE facturas_venta SET sunat_estado = ?, sunat_response_code = ?, sunat_response_desc = ?,
           xml_url = ?, cdr_url = ? WHERE id_factura = ?`,
        [estadoFinal, cdr.responseCode, descripcion.slice(0, 4000),
         xmlUrl ? JSON.stringify({ url: xmlUrl }) : null,
         cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, idNota]);

      if (aceptado && tipo === '07' && String(motivo_codigo) === '01') {
        await conn.query(
          `UPDATE facturas_venta SET estado = 'Anulada' WHERE id_factura = ?`, [id_factura_ref]);
      }
    });

    await registrarSunatLog({ origen: 'NOTA', referenciaId: idNota, evento: 'sendBill',
      exito: aceptado, httpStatus: 200, detalle: `${cdr.responseCode} ${descripcion}`.slice(0, 4000),
      duracionMs: Date.now() - t0 });

    res.json({
      ok: aceptado, estado: estadoFinal, idNota, serie, numero,
      comprobante: `${serie}-${numero}`, tipo, responseCode: cdr.responseCode,
      afectaFacturaId: id_factura_ref, descripcion, totales, xmlUrl, cdrUrl
    });
  } catch (e) { next(e); }
}

// POST /api/sunat/comprobantes/baja  { id_factura, motivo }
// Comunicación de Baja (RA) — ÚNICO mecanismo de anulación de facturas (01) y notas (07/08),
// dentro de los 7 días calendario siguientes a la emisión. Pasado el plazo → Nota de Crédito.
export async function darDeBajaFactura(req, res, next) {
  const { id_factura } = req.body;
  const motivo = String(req.body.motivo || '').trim();
  const idEmpleado = req.user?.id_empleado || null;
  try {
    if (!id_factura) throw new AppError('Falta id_factura', 400);
    if (!motivo) throw new AppError('Falta motivo de la baja', 400);
    const { emision: fechaComunicacion, emisionDateTime: comunicacionDateTime } = fechaLima();

    // ── TX1: validar + reservar correlativo diario + INSERT sunat_bajas GENERADO ──
    const prep = await withTransaction(async (conn) => {
      // fecha_emision = IssueDate real del comprobante (lo que exige la regla de plazo);
      // COALESCE a sunat_fecha_envio solo para filas emitidas antes de persistir fecha_emision.
      // DATE_FORMAT → string 'YYYY-MM-DD' directo (evita reconvertir un Date del driver, que
      // volvería a introducir un corrimiento de zona horaria al pasar por toISOString()).
      const [[f]] = await conn.query(
        `SELECT id_factura, id_orden_venta, serie, numero, codigo_tipo_sunat, sunat_estado, estado, id_baja,
                DATE_FORMAT(COALESCE(fecha_emision, sunat_fecha_envio), '%Y-%m-%d') AS fecha_emision
           FROM facturas_venta WHERE id_factura = ? FOR UPDATE`, [id_factura]);
      if (!f) throw new AppError('Comprobante no existe', 404);
      if (f.sunat_estado !== 'ACEPTADO') throw new AppError('Solo se dan de baja comprobantes ACEPTADOS por SUNAT', 422);
      if (!['01', '07', '08'].includes(f.codigo_tipo_sunat))
        throw new AppError('Tipo de documento no admite Comunicación de Baja', 422);
      if (f.id_baja || f.estado === 'Anulada') throw new AppError('El comprobante ya está anulado/dado de baja', 409);
      if (!f.fecha_emision) throw new AppError('El comprobante no tiene fecha de emisión registrada', 422);

      const fechaReferencia = f.fecha_emision; // ya es 'YYYY-MM-DD' (DATE_FORMAT)
      const dias = diffDiasISO(fechaReferencia, fechaComunicacion);
      if (dias > 7) throw new AppError('Plazo de 7 días vencido: la anulación debe hacerse por Nota de Crédito (motivo 01)', 422);

      const correlativo = await obtenerCorrelativoDiario(conn, 'RA', fechaComunicacion);
      const ymd = fechaComunicacion.replace(/-/g, '');
      const corr5 = String(correlativo).padStart(5, '0');
      const identificador = `RA-${ymd}-${corr5}`;

      const [ins] = await conn.query(
        `INSERT INTO sunat_bajas
          (identificador, fecha_referencia, fecha_comunicacion, correlativo, estado, id_registrado_por, fecha_registro)
         VALUES (?, ?, ?, ?, 'GENERADO', ?, ?)`,
        [identificador, fechaReferencia, fechaComunicacion, correlativo, idEmpleado, comunicacionDateTime]);
      const idBaja = ins.insertId;
      await conn.query(
        `INSERT INTO sunat_bajas_detalle (id_baja, id_factura, tipo_documento, serie, numero, motivo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idBaja, f.id_factura, f.codigo_tipo_sunat, f.serie, f.numero, motivo.slice(0, 200)]);

      return { idBaja, identificador, fechaReferencia, corr5, ymd, factura: f };
    });

    const { idBaja, identificador, fechaReferencia, corr5, ymd, factura } = prep;
    const [[empresa]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');

    const ra = {
      identificador, fechaReferencia, fechaComunicacion, empresa,
      lineas: [{ lineId: 1, tipoDoc: factura.codigo_tipo_sunat, serie: factura.serie, numero: factura.numero, motivo }]
    };
    const xml = construirVoidedDocumentsXML(ra);
    const { xmlFirmado } = firmarXml(xml);
    const nombre = `${sunatConfig.ruc}-RA-${ymd}-${corr5}`;
    await copiaLocal(`${nombre}.xml`, xmlFirmado);

    // ── Envío asíncrono: sendSummary devuelve ticket ──
    const t0 = Date.now();
    let ticket;
    try {
      ticket = await sendSummary(`${nombre}.zip`, zipXml(`${nombre}.xml`, xmlFirmado));
    } catch (e) {
      await pool.query(
        `UPDATE sunat_bajas SET estado = 'ERROR', response_desc = ?, intentos = intentos + 1 WHERE id_baja = ?`,
        [`FAULT ${e.faultCode || ''}: ${e.message}`.slice(0, 4000), idBaja]);
      await registrarSunatLog({ origen: 'BAJA', referenciaId: idBaja, evento: 'sendSummary',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      return res.status(502).json({ ok: false, estado: 'ERROR', idBaja, identificador,
        faultCode: e.faultCode || null, error: e.message });
    }
    let xmlUrl = null;
    try { xmlUrl = await subirRaw(Buffer.from(xmlFirmado, 'utf8'), `sunat/xml/${nombre}.xml`); }
    catch (e) { console.warn('[SUNAT] subir XML baja falló:', e.message); }
    await pool.query(
      `UPDATE sunat_bajas SET estado = 'ENVIADO', sunat_ticket = ?, xml_url = ? WHERE id_baja = ?`,
      [ticket, xmlUrl ? JSON.stringify({ url: xmlUrl }) : null, idBaja]);
    console.log('[SUNAT] darDeBaja ->', JSON.stringify({ idBaja, identificador, ticket }));

    // ── Poll de getStatus (inline 3×15s; el job de la Fase 15 cierra los que queden en 98) ──
    for (let i = 0; i < 3; i++) {
      await sleep(15000);
      let st;
      try {
        st = await getStatus(ticket);
      } catch (e) {
        await registrarSunatLog({ origen: 'BAJA', referenciaId: idBaja, evento: 'getStatus',
          exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
        continue;
      }
      if (st.statusCode === '98') continue; // aún en proceso

      const cdr = st.cdrZip ? parsearCdr(st.cdrZip) : null;
      const aceptado = st.statusCode === '0' && cdr?.responseCode === '0';
      const descripcion = (cdr?.description || `statusCode ${st.statusCode}`) +
        (cdr?.notas?.length ? ' | OBS: ' + cdr.notas.join('; ') : '');
      let cdrUrl = null;
      if (st.cdrZip) {
        try { cdrUrl = await subirRaw(st.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
        catch (e) { console.warn('[SUNAT] subir CDR baja falló:', e.message); }
        await copiaLocal(`R-${nombre}.zip`, st.cdrZip);
      }

      await withTransaction(async (conn) => {
        await conn.query(
          `UPDATE sunat_bajas SET estado = ?, response_code = ?, response_desc = ?, cdr_url = ? WHERE id_baja = ?`,
          [aceptado ? 'ACEPTADO' : 'RECHAZADO', cdr?.responseCode ?? String(st.statusCode),
           descripcion.slice(0, 4000), cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, idBaja]);
        if (aceptado) {
          await conn.query(
            `UPDATE facturas_venta SET sunat_estado = 'BAJA', estado = 'Anulada', id_baja = ? WHERE id_factura = ?`,
            [idBaja, id_factura]);
          // Al anularse una FACTURA (01), liberar su OV para poder re-facturar sobre la misma
          // (caso error de digitación: cliente/dirección mal, cantidad correcta). El stock NO
          // se toca aquí a propósito (los ajustes de inventario son un proceso de negocio aparte).
          // En una NOTA (07/08) la factura original sigue vigente → la OV NO se libera.
          if (factura.codigo_tipo_sunat === '01' && factura.id_orden_venta) {
            await conn.query(
              `UPDATE ordenes_venta SET facturado_sunat = 0, fecha_facturacion_sunat = NULL,
                 numero_comprobante_sunat = NULL, id_facturador = NULL WHERE id_orden_venta = ?`,
              [factura.id_orden_venta]);
          }
        }
      });

      await registrarSunatLog({ origen: 'BAJA', referenciaId: idBaja, evento: 'getStatus',
        exito: aceptado, httpStatus: 200, detalle: `${st.statusCode} ${descripcion}`.slice(0, 4000),
        duracionMs: Date.now() - t0 });

      return res.json({
        ok: aceptado, estado: aceptado ? 'ACEPTADO' : 'RECHAZADO', idBaja, identificador,
        ticket, statusCode: st.statusCode, responseCode: cdr?.responseCode ?? null,
        descripcion, cdrUrl,
        nota: aceptado
          ? (factura.codigo_tipo_sunat === '01'
              ? 'Factura marcada BAJA/Anulada y OV liberada para re-facturar. Ajuste de stock NO automático (proceso de negocio aparte).'
              : 'Nota marcada BAJA/Anulada. La factura original sigue vigente; la OV no se libera.')
          : undefined
      });
    }

    // Sigue en 98 tras 3 intentos: queda ENVIADO con ticket para cierre posterior.
    return res.status(202).json({
      ok: null, estado: 'ENVIADO', idBaja, identificador, ticket,
      mensaje: 'RA en proceso (statusCode 98). Reintentar getStatus con el ticket más tarde.'
    });
  } catch (e) { next(e); }
}

// GET /api/sunat/comprobantes/:id/estado
// Reconciliación: devuelve el estado en BD. En PROD, si el comprobante quedó ENVIADO sin CDR
// resuelto, consulta getStatusCdr a SUNAT, actualiza la BD y devuelve el resultado en vivo.
// En BETA no hay consulta en vivo (billConsultService es solo producción): se devuelve la BD.
export async function verificarEstado(req, res, next) {
  const id = Number(req.params.id);
  try {
    if (!id) throw new AppError('id de comprobante inválido', 400);
    const [[f]] = await pool.query(
      `SELECT id_factura, numero_factura, serie, numero, codigo_tipo_sunat,
              sunat_estado, sunat_response_code, sunat_response_desc, cdr_url, xml_url
         FROM facturas_venta WHERE id_factura = ?`, [id]);
    if (!f) throw new AppError('Comprobante no existe', 404);

    const base = {
      idFactura: f.id_factura, comprobante: f.numero_factura, tipo: f.codigo_tipo_sunat,
      sunatEstado: f.sunat_estado, responseCode: f.sunat_response_code,
      descripcion: f.sunat_response_desc,
      xmlUrl: extraerUrl(f.xml_url), cdrUrl: extraerUrl(f.cdr_url)
    };

    // Solo se consulta en vivo un comprobante que quedó ENVIADO (sin estado final) y en PROD.
    const pendiente = f.sunat_estado === 'ENVIADO';
    if (!(sunatConfig.mode === 'PROD' && pendiente)) {
      return res.json({
        ...base,
        consultaEnVivo: false,
        aviso: sunatConfig.mode !== 'PROD'
          ? 'Consulta en vivo a SUNAT no disponible en BETA (billConsultService es solo producción); se devuelve el estado registrado en BD.'
          : 'El comprobante ya tiene estado final; no se consultó en vivo.'
      });
    }

    // PROD + ENVIADO → getStatusCdr y reconciliar.
    const t0 = Date.now();
    let cdrResp;
    try {
      cdrResp = await getStatusCdr(f.codigo_tipo_sunat, f.serie, f.numero);
    } catch (e) {
      await registrarSunatLog({ origen: 'CONSULTA', referenciaId: id, evento: 'getStatusCdr',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      throw e;
    }
    // Catálogo getStatusCdr → estado interno. 0004 (no existe) / 0098 (en proceso): sigue ENVIADO.
    const MAPA = { '0001': 'ACEPTADO', '0002': 'RECHAZADO', '0003': 'BAJA' };
    const nuevoEstado = MAPA[cdrResp.statusCode] || 'ENVIADO';
    let cdr = null, cdrUrl = extraerUrl(f.cdr_url);
    if (cdrResp.cdrZip) {
      cdr = parsearCdr(cdrResp.cdrZip);
      const nombre = `${sunatConfig.ruc}-${f.codigo_tipo_sunat}-${f.serie}-${f.numero}`;
      try { cdrUrl = await subirRaw(cdrResp.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
      catch (e) { console.warn('[SUNAT] subir CDR (consulta) falló:', e.message); }
    }
    if (nuevoEstado !== 'ENVIADO') {
      await pool.query(
        `UPDATE facturas_venta SET sunat_estado = ?, sunat_response_code = ?, sunat_response_desc = ?,
           cdr_url = COALESCE(?, cdr_url) WHERE id_factura = ?`,
        [nuevoEstado, cdr?.responseCode ?? cdrResp.statusCode,
         (cdr?.description || cdrResp.statusMessage || '').slice(0, 4000),
         cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, id]);
    }
    await registrarSunatLog({ origen: 'CONSULTA', referenciaId: id, evento: 'getStatusCdr',
      exito: nuevoEstado !== 'ENVIADO', httpStatus: 200,
      detalle: `${cdrResp.statusCode} ${cdrResp.statusMessage}`.slice(0, 4000), duracionMs: Date.now() - t0 });

    return res.json({
      idFactura: id, comprobante: f.numero_factura, tipo: f.codigo_tipo_sunat,
      consultaEnVivo: true, statusCode: cdrResp.statusCode, statusMessage: cdrResp.statusMessage,
      sunatEstado: nuevoEstado, responseCode: cdr?.responseCode ?? null,
      xmlUrl: extraerUrl(f.xml_url), cdrUrl
    });
  } catch (e) { next(e); }
}

// ── FASE 10: GRE Remitente (09) ─────────────────────────────────────────────
// Cierra el ticket de una GRE contra el CDR (o el mock BETA) y persiste el estado.
async function cerrarTicketGre(idGuia, nombre, ticket, st, t0) {
  const aceptado = st.codRespuesta === '0';
  const estadoFinal = aceptado ? 'ACEPTADO' : (st.codRespuesta === '99' ? 'RECHAZADO' : 'ENVIADO');
  let cdr = null, cdrUrl = null, qrUrl = null;
  if (st.cdrZip) {
    cdr = parsearCdr(st.cdrZip);
    try { cdrUrl = await subirRaw(st.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
    catch (e) { console.warn('[SUNAT] subir CDR GRE falló:', e.message); }
    await copiaLocal(`R-${nombre}.zip`, st.cdrZip);
  }
  const descripcion = aceptado
    ? (cdr?.description || (st.mock ? 'Guía aceptada (mock BETA, sin CDR real)' : 'Guía aceptada'))
    : (st.error ? `${st.error.numError || ''} ${st.error.desError || ''}`.trim() : `codRespuesta ${st.codRespuesta}`);
  await pool.query(
    `UPDATE guias_remision SET sunat_estado = ?, sunat_response_code = ?, sunat_response_desc = ?,
       cdr_url = COALESCE(?, cdr_url), sunat_qr_url = COALESCE(?, sunat_qr_url) WHERE id_guia = ?`,
    [estadoFinal, st.codRespuesta, String(descripcion).slice(0, 4000),
     cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, qrUrl, idGuia]);
  await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'consultarGuia',
    exito: aceptado, httpStatus: 200, detalle: `${st.codRespuesta} ${descripcion}`.slice(0, 4000),
    duracionMs: Date.now() - t0 });
  return { aceptado, estadoFinal, codRespuesta: st.codRespuesta, descripcion, cdrUrl, mock: st.mock || false };
}

// POST /api/sunat/guias/:id/emitir  → GRE Remitente (09) de una guias_remision existente.
export async function emitirGuiaRemision(req, res, next) {
  const idGuia = Number(req.params.id);
  const idEmpleado = req.user?.id_empleado || null;
  try {
    if (!idGuia) throw new AppError('id de guía inválido', 400);
    const tipo = '09', serie = 'TE01';
    const { emision, hora, emisionDateTime } = fechaLima();

    // ── TX1: validar + reservar correlativo + marcar ENVIADO ──
    const prep = await withTransaction(async (conn) => {
      const [[g]] = await conn.query('SELECT * FROM guias_remision WHERE id_guia = ? FOR UPDATE', [idGuia]);
      if (!g) throw new AppError('Guía no existe', 404);
      if (g.sunat_estado === 'ACEPTADO') throw new AppError('La guía ya fue aceptada por SUNAT', 409);
      if (!g.ubigeo_partida || !g.ubigeo_llegada) throw new AppError('Faltan ubigeos de partida/llegada (6 dígitos)', 422);
      if (!(Number(g.peso_bruto_kg) > 0)) throw new AppError('peso_bruto_kg debe ser > 0', 422);
      if (!g.motivo_traslado_cod) throw new AppError('Falta motivo_traslado_cod (catálogo 20)', 422);

      const [[cliente]] = await conn.query('SELECT * FROM clientes WHERE id_cliente = ?', [g.id_cliente]);
      if (!cliente) throw new AppError('Cliente de la guía no existe', 404);
      const [[empresa]] = await conn.query('SELECT * FROM empresa_config WHERE id = 1');
      const [[conductor]] = g.id_conductor
        ? await conn.query('SELECT id_empleado, dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor])
        : [[null]];
      // fecha_traslado como string 'YYYY-MM-DD' (sin corrimiento de zona).
      const [[ft]] = await conn.query("SELECT DATE_FORMAT(fecha_traslado, '%Y-%m-%d') AS f FROM guias_remision WHERE id_guia = ?", [idGuia]);
      const fechaTraslado = ft?.f || emision;

      const [detalle] = await conn.query(
        `SELECT d.id_detalle_orden, d.id_producto, d.cantidad, p.codigo, p.nombre, p.codigo_unidad_sunat
           FROM detalle_guia_remision d JOIN productos p ON p.id_producto = d.id_producto
          WHERE d.id_guia = ?`, [idGuia]);
      if (!detalle.length) throw new AppError('La guía no tiene detalle', 422);
      for (const d of detalle) {
        if (!d.codigo_unidad_sunat) throw new AppError(`Producto ${d.codigo} sin codigo_unidad_sunat`, 422);
      }

      // Modalidad: con conductor (DNI) → privado 02; sin conductor → público 01 (aún no soportado).
      const modalidad = conductor?.dni ? '02' : '01';
      if (modalidad === '01') {
        throw new AppError('Transporte público (transportista) aún no soportado; usa una guía con conductor (privado)', 422);
      }
      let placa = g.placa_vehiculo || g.placa || null; // guias_remision no tiene placa propia
      if (!placa) {
        if (sunatConfig.mode === 'PROD') throw new AppError('Falta la placa del vehículo para transporte privado', 422);
        placa = 'XXX-000'; // placeholder solo BETA/mock (no válido en PROD)
      }

      const numero = await obtenerCorrelativo(conn, tipo, serie);
      const datos = {
        tipo, serie, numero, empresa, cliente, guia: g, detalle,
        fecha: { emision, hora }, fechaTraslado, modalidad, conductor, placa
      };
      const { xml } = construirDespatchAdviceXML(datos);
      const { xmlFirmado, digestValue } = firmarXml(xml);
      const nombre = `${sunatConfig.ruc}-${tipo}-${serie}-${numero}`;

      await conn.query(
        `UPDATE guias_remision SET serie_sunat = ?, numero_sunat = ?, sunat_estado = 'ENVIADO',
           sunat_digest_value = ?, sunat_fecha_envio = ? WHERE id_guia = ?`,
        [serie, numero, digestValue, emisionDateTime, idGuia]);

      return { numero, nombre, xmlFirmado };
    });

    const { numero, nombre, xmlFirmado } = prep;
    await copiaLocal(`${nombre}.xml`, xmlFirmado);
    const zipBuf = zipXml(`${nombre}.xml`, xmlFirmado);

    // Token real (aun en BETA, para cubrir el checkpoint) — no fatal si el SOL no tiene permiso GRE.
    let tokenOk = false, tokenError = null;
    try { await obtenerTokenGre(); tokenOk = true; }
    catch (e) { tokenError = e.message; }

    const t0 = Date.now();
    let ticket;
    try {
      ticket = await enviarGuia(nombre, zipBuf);
    } catch (e) {
      await pool.query(
        `UPDATE guias_remision SET sunat_estado = 'ERROR', sunat_response_desc = ?, sunat_intentos = sunat_intentos + 1 WHERE id_guia = ?`,
        [String(e.message).slice(0, 4000), idGuia]);
      await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'enviarGuia',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      return res.status(502).json({ ok: false, estado: 'ERROR', idGuia, error: e.message, tokenOk, tokenError });
    }

    let xmlUrl = null;
    try { xmlUrl = await subirRaw(Buffer.from(xmlFirmado, 'utf8'), `sunat/xml/${nombre}.xml`); }
    catch (e) { console.warn('[SUNAT] subir XML GRE falló:', e.message); }
    await pool.query(
      `UPDATE guias_remision SET sunat_ticket = ?, xml_url = COALESCE(?, xml_url) WHERE id_guia = ?`,
      [ticket, xmlUrl ? JSON.stringify({ url: xmlUrl }) : null, idGuia]);
    console.log('[SUNAT] emitirGuia ->', JSON.stringify({ idGuia, comprobante: `${serie}-${numero}`, ticket }));

    // Poll consultarGuia (en BETA el mock resuelve al instante; en PROD 15s × 3).
    for (let i = 0; i < 3; i++) {
      if (sunatConfig.mode === 'PROD') await sleep(15000);
      let st;
      try { st = await consultarGuia(ticket); }
      catch (e) {
        await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'consultarGuia',
          exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
        continue;
      }
      if (st.codRespuesta === '98') continue;
      const r = await cerrarTicketGre(idGuia, nombre, ticket, st, t0);
      return res.json({
        ok: r.aceptado, estado: r.estadoFinal, idGuia, serie, numero, comprobante: `${serie}-${numero}`,
        ticket, codRespuesta: r.codRespuesta, descripcion: r.descripcion, xmlUrl, cdrUrl: r.cdrUrl,
        mock: r.mock, tokenOk, tokenError
      });
    }
    return res.status(202).json({
      ok: null, estado: 'ENVIADO', idGuia, serie, numero, comprobante: `${serie}-${numero}`, ticket,
      mensaje: 'GRE en proceso (codRespuesta 98). Reconsultar con GET /guias/:id/estado.', tokenOk, tokenError
    });
  } catch (e) { next(e); }
}

// GET /api/sunat/guias/:id/estado  → reconsulta el ticket de una GRE ENVIADA y reconcilia.
export async function verificarEstadoGuia(req, res, next) {
  const idGuia = Number(req.params.id);
  try {
    if (!idGuia) throw new AppError('id de guía inválido', 400);
    const [[g]] = await pool.query(
      `SELECT id_guia, numero_guia, serie_sunat, numero_sunat, sunat_estado, sunat_ticket,
              sunat_response_code, sunat_response_desc, xml_url, cdr_url, sunat_qr_url
         FROM guias_remision WHERE id_guia = ?`, [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);

    const base = {
      idGuia, numeroGuia: g.numero_guia,
      comprobante: g.serie_sunat && g.numero_sunat ? `${g.serie_sunat}-${g.numero_sunat}` : null,
      sunatEstado: g.sunat_estado, ticket: g.sunat_ticket,
      responseCode: g.sunat_response_code, descripcion: g.sunat_response_desc,
      xmlUrl: extraerUrl(g.xml_url), cdrUrl: extraerUrl(g.cdr_url), qrUrl: g.sunat_qr_url
    };
    if (g.sunat_estado !== 'ENVIADO' || !g.sunat_ticket) {
      return res.json({ ...base, consultaEnVivo: false });
    }

    const t0 = Date.now();
    const st = await consultarGuia(g.sunat_ticket);
    if (st.codRespuesta === '98') {
      return res.json({ ...base, consultaEnVivo: true, codRespuesta: '98', mensaje: 'Aún en proceso' });
    }
    const nombre = `${sunatConfig.ruc}-09-${g.serie_sunat}-${g.numero_sunat}`;
    const r = await cerrarTicketGre(idGuia, nombre, g.sunat_ticket, st, t0);
    return res.json({
      ...base, consultaEnVivo: true, sunatEstado: r.estadoFinal, codRespuesta: r.codRespuesta,
      descripcion: r.descripcion, cdrUrl: r.cdrUrl || base.cdrUrl, mock: r.mock
    });
  } catch (e) { next(e); }
}

// GET /api/sunat/gre/token/test → prueba AISLADA del token OAuth GRE (diagnóstico, sin emitir).
// Devuelve el body REAL de SUNAT en el fallo + chequeos de config (sin filtrar secretos).
export async function probarTokenGre(req, res, next) {
  try {
    const cid = String(sunatConfig.greClientId || '');
    const sec = String(sunatConfig.greClientSecret || '');
    const diag = {
      mode: sunatConfig.mode,
      tokenUrl: sunatConfig.urls.GRE_TOKEN.replace('{client_id}', cid ? `${cid.slice(0, 4)}…${cid.slice(-4)}` : '(vacío)'),
      username: `${sunatConfig.ruc}${sunatConfig.solUser}`,      // lo que va como username del password grant
      clientIdLen: cid.length,
      clientIdSinEspacios: cid === cid.trim(),
      clientSecretLen: sec.length,
      clientSecretSinEspacios: sec === sec.trim(),
      solPassLen: String(sunatConfig.solPass || '').length,
      // punto ciego histórico: la clave era el único valor sin trim; reportar si el env CRUDO traía whitespace
      solPassSinEspacios: String(process.env.SUNAT_SOL_PASS || '') === String(process.env.SUNAT_SOL_PASS || '').trim(),
      solPassLenCrudo: String(process.env.SUNAT_SOL_PASS || '').length
    };
    try {
      const token = await obtenerTokenGre();
      return res.json({ ok: true, tokenPreview: `${String(token).slice(0, 10)}…`, diag });
    } catch (e) {
      return res.status(502).json({
        ok: false, sunatStatus: e.sunatStatus ?? null, sunatBody: e.sunatBody ?? null,
        error: e.message, diag
      });
    }
  } catch (e) { next(e); }
}

// GET /api/sunat/comprobantes/:id/pdf → Representación impresa (RS 193-2020) de factura/NC/ND. FASE 13.
// Solo se genera si el comprobante fue ACEPTADO (o BAJA, para dejar constancia con marca "ANULADO").
export async function generarPdfComprobante(req, res, next) {
  const idFactura = Number(req.params.id);
  try {
    if (!idFactura) throw new AppError('id de comprobante inválido', 400);
    // fecha_emision_fmt como STRING dd/mm/yyyy (DATE_FORMAT evita que el driver la devuelva como
    // Date y se imprima en inglés / con corrimiento de zona horaria). Se trae la condición comercial
    // (tipo_venta Contado/Crédito + vencimiento) de la OV, que es la misma fuente del cac:PaymentTerms del XML.
    const [[f]] = await pool.query(
      "SELECT f.*, DATE_FORMAT(f.fecha_emision, '%d/%m/%Y') AS fecha_emision_fmt, " +
      "ov.tipo_venta, ov.dias_credito, DATE_FORMAT(ov.fecha_vencimiento, '%d/%m/%Y') AS fecha_vencimiento_fmt, " +
      "ov.observaciones, ov.orden_compra_cliente " +
      "FROM facturas_venta f LEFT JOIN ordenes_venta ov ON ov.id_orden_venta = f.id_orden_venta " +
      "WHERE f.id_factura = ?",
      [idFactura]);
    if (!f) throw new AppError('Comprobante no existe', 404);
    if (!['ACEPTADO', 'BAJA'].includes(f.sunat_estado)) {
      throw new AppError(`El PDF solo se genera para comprobantes ACEPTADOS (estado actual: ${f.sunat_estado || 'sin enviar'})`, 409);
    }

    const [[emisor]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');
    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [f.id_cliente]);
    // Detalle reconstruido desde la OV. Los TOTALES imprimibles salen de facturas_venta (autoritativos);
    // en notas parciales las líneas reflejan la OV completa pero los importes del recuadro son los de la nota.
    const [detalle] = await pool.query(
      'SELECT d.cantidad, d.precio_unitario, d.descuento_porcentaje, p.codigo, p.nombre, ' +
      'p.codigo_unidad_sunat AS unidad FROM detalle_orden_venta d JOIN productos p ON p.id_producto = d.id_producto ' +
      'WHERE d.id_orden_venta = ?', [f.id_orden_venta]);

    // Notas: documento afectado + descripción del motivo (catálogo 09/10).
    let docAfectado = null;
    if (f.id_factura_ref) {
      const [[ref]] = await pool.query('SELECT numero_factura FROM facturas_venta WHERE id_factura = ?', [f.id_factura_ref]);
      const motivos = motivosValidos(f.codigo_tipo_sunat);
      docAfectado = {
        comprobante: ref?.numero_factura || '-',
        motivo: `${f.motivo_nota_codigo} - ${motivos[f.motivo_nota_codigo] || 'MODIFICACIÓN'}`
      };
    }

    const qrBuffer = f.sunat_qr_data ? await qrPng(f.sunat_qr_data) : null;
    const pdf = await generarComprobanteSunatPDF({
      comprobante: {
        codigo_tipo_sunat: f.codigo_tipo_sunat, serie: f.serie, numero: f.numero,
        fecha_emision: f.fecha_emision_fmt, moneda: f.moneda,
        tipo_venta: f.tipo_venta, dias_credito: f.dias_credito, fecha_vencimiento: f.fecha_vencimiento_fmt,
        observaciones: f.observaciones, orden_compra: f.orden_compra_cliente,
        subtotal: f.subtotal, igv: f.igv, total: f.total,
        sunat_digest_value: f.sunat_digest_value, sunat_estado: f.sunat_estado, docAfectado
      },
      emisor, cliente, detalle, qrBuffer
    });

    // Subida best-effort a Cloudinary (no crítica).
    try {
      const url = await subirRaw(pdf, `sunat/pdf/${f.sunat_nombre_xml || `${f.serie}-${f.numero}`}.pdf`);
      await pool.query('UPDATE facturas_venta SET url_pdf = ? WHERE id_factura = ?', [url, idFactura]);
    } catch (e) { console.warn('[SUNAT] subir PDF comprobante falló:', e.message); }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${f.serie}-${f.numero}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
}

// GET /api/sunat/guias/:id/pdf → Representación impresa de la GRE Remitente (09). FASE 13.
// Requiere estado ACEPTADO y el QR-URL de SUNAT (solo existe en PROD; en BETA la GRE es mock sin QR).
export async function generarPdfGuia(req, res, next) {
  const idGuia = Number(req.params.id);
  try {
    if (!idGuia) throw new AppError('id de guía inválido', 400);
    const [[g]] = await pool.query(
      "SELECT *, DATE_FORMAT(COALESCE(fecha_emision, sunat_fecha_envio), '%d/%m/%Y') AS fecha_emision_fmt, " +
      "DATE_FORMAT(fecha_traslado, '%d/%m/%Y') AS fecha_traslado_fmt FROM guias_remision WHERE id_guia = ?",
      [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);
    if (g.sunat_estado !== 'ACEPTADO') {
      throw new AppError(`El PDF de la GRE solo se genera en estado ACEPTADO (estado actual: ${g.sunat_estado || 'sin enviar'})`, 409);
    }
    if (!g.sunat_qr_url) {
      throw new AppError('La GRE no tiene QR-URL de SUNAT: la representación impresa válida solo existe en PROD (Fase 16)', 409);
    }

    const [[emisor]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');
    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [g.id_cliente]);
    const [[conductor]] = g.id_conductor
      ? await pool.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor])
      : [[null]];
    const [detalle] = await pool.query(
      'SELECT d.cantidad, p.codigo, p.nombre, p.codigo_unidad_sunat FROM detalle_guia_remision d ' +
      'JOIN productos p ON p.id_producto = d.id_producto WHERE d.id_guia = ?', [idGuia]);

    const qrBuffer = await qrPng(g.sunat_qr_url);
    const pdf = await generarGuiaRemisionSunatPDF({
      guia: {
        serie_sunat: g.serie_sunat, numero_sunat: g.numero_sunat,
        fecha_emision: g.fecha_emision_fmt, fecha_traslado: g.fecha_traslado_fmt,
        motivo_traslado_cod: g.motivo_traslado_cod, peso_bruto_kg: g.peso_bruto_kg,
        ubigeo_partida: g.ubigeo_partida, direccion_partida: g.direccion_partida,
        ubigeo_llegada: g.ubigeo_llegada, direccion_llegada: g.direccion_llegada,
        sunat_estado: g.sunat_estado, sunat_digest_value: g.sunat_digest_value,
        placa: g.placa_vehiculo || g.placa || null
      },
      emisor, cliente, detalle, conductor, qrBuffer
    });

    try {
      const url = await subirRaw(pdf, `sunat/pdf/${sunatConfig.ruc}-09-${g.serie_sunat}-${g.numero_sunat}.pdf`);
      await pool.query('UPDATE guias_remision SET url_pdf = COALESCE(?, url_pdf) WHERE id_guia = ?', [url, idGuia]);
    } catch (e) { console.warn('[SUNAT] subir PDF GRE falló:', e.message); }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${g.serie_sunat}-${g.numero_sunat}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
}
