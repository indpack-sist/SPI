// controllers/sunat.controller.js
// Orquestación del módulo SUNAT.
import { sunatConfig } from '../config/sunat.js';
import { pool, withTransaction } from '../config/database.js';
import { obtenerCorrelativo, obtenerCorrelativoDiario } from '../services/sunat/numeracion.service.js';
import { construirInvoiceXML, calcularComprobante, afectacionLinea } from '../services/sunat/ubl.service.js';
import { construirNotaXML, motivosValidos } from '../services/sunat/ubl-nota.service.js';
import { construirVoidedDocumentsXML } from '../services/sunat/ubl-baja.service.js';
import { construirDespatchAdviceXML } from '../services/sunat/ubl-gre.service.js';
import { obtenerTokenGre, enviarGuia, consultarGuia } from '../services/sunat/gre.service.js';
import { anularGuiaRemision, reemplazarGuiaRemision } from '../services/sunat/gre-anulacion.service.js';
import { emitirGuiaGre, cerrarTicketGre } from '../services/sunat/gre-emision.service.js';
import { fechaLima } from '../services/sunat/fecha.service.js';
import { sleep, copiaLocal, extraerUrl, normalizarPlaca, componerObservacionGuia } from '../services/sunat/util.service.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { zipXml } from '../services/sunat/zip.service.js';
import { sendBill, sendSummary, getStatus, getStatusCdr } from '../services/sunat/soap.service.js';
import { parsearCdr } from '../services/sunat/cdr.service.js';
import { generarQr, qrPng } from '../services/sunat/qr.service.js';
import { generarComprobanteSunatPDF } from '../utils/pdfGenerators/comprobanteSunatPDF.js';
import { generarGuiaRemisionSunatPDF } from '../utils/pdfGenerators/guiaRemisionSunatPDF.js';
import { registrarSunatLog } from '../services/sunat/log.service.js';
import { subirRaw } from '../services/cloudinary.service.js';
import { marcarOrdenFacturada, cerrarBajaDesdeStatus, cerrarFacturaDesdeStatusCdr } from '../services/sunat/cierre.service.js';
import { ejecutarReintentosSunat } from '../jobs/sunat-reintentos.job.js';
import AppError from '../utils/AppError.js';

// Tipos de comprobante dentro de alcance (catálogo 01). Boletas (03) y otros: fuera de alcance.
const TIPOS_PERMITIDOS = ['01', '07', '08'];

// fechaLima() → services/sunat/fecha.service.js · sleep/copiaLocal/extraerUrl → util.service.js
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
      if (String(ov.tipo_comprobante || '').trim() !== 'Factura') {
        throw new AppError('La orden no es de tipo Factura; las Notas de Venta (inafecto) no se emiten a SUNAT', 422);
      }
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
        await marcarOrdenFacturada(conn, { idOrdenVenta: id_orden_venta, serie, numero,
          idEmpleado, fecha: emisionDateTime });
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

// POST /api/sunat/comprobantes/preview  { id_orden_venta }
// Vista previa de emisión: usa el MISMO cálculo (calcularComprobante) que el UBL builder, para que el
// frontend muestre EXACTAMENTE lo que se firmará y enviará. Solo lectura: no numera, no inserta, no envía.
export async function previewComprobante(req, res, next) {
  try {
    const { id_orden_venta } = req.body;
    if (!id_orden_venta) throw new AppError('Falta id_orden_venta', 400);

    const [[ov]] = await pool.query('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id_orden_venta]);
    if (!ov) throw new AppError('Orden de venta no existe', 404);

    const [detalle] = await pool.query(
      'SELECT d.*, p.codigo, p.nombre, p.codigo_unidad_sunat ' +
      'FROM detalle_orden_venta d JOIN productos p ON p.id_producto = d.id_producto ' +
      'WHERE d.id_orden_venta = ?', [id_orden_venta]);

    const calc = calcularComprobante({ ov, detalle });

    // Avisos que NO bloquean la previsualización, pero sí la emisión real (mismos checks que emitirComprobante).
    const avisos = [];
    if (String(ov.tipo_comprobante || '').trim() !== 'Factura') {
      avisos.push('La orden no es de tipo Factura (una Nota de Venta / inafecto no se emite a SUNAT).');
    }
    if (ov.facturado_sunat) avisos.push('La orden ya fue facturada.');
    if (ov.estado_verificacion !== 'Aprobada') avisos.push('La orden debe estar Aprobada para emitir.');
    const sinUnidad = calc.lineas.filter((l) => !l.unidad).map((l) => l.codigo);
    if (sinUnidad.length) avisos.push(`Productos sin codigo_unidad_sunat: ${sinUnidad.join(', ')}.`);

    res.json({
      ok: true,
      mode: sunatConfig.mode,
      serie: 'FE01',
      moneda: calc.moneda,
      esExport: calc.esExport,
      // Se omite `cfg` (detalle interno del catálogo) del payload.
      lineas: calc.lineas.map(({ cfg, ...l }) => l),
      subtotal: calc.subtotal,
      igv: calc.igv,
      total: calc.total,
      montoEnLetras: calc.montoEnLetras,
      avisos
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

      // Cierre en el helper compartido (mismo camino que el job de reintentos).
      const r = await cerrarBajaDesdeStatus(st, {
        idBaja, identificador, idFactura: id_factura, codigoTipo: factura.codigo_tipo_sunat,
        idOrdenVenta: factura.id_orden_venta, evento: 'getStatus', duracionMs: Date.now() - t0 });

      return res.json({
        ok: r.aceptado, estado: r.estado, idBaja, identificador,
        ticket, statusCode: st.statusCode, responseCode: r.responseCode,
        descripcion: r.descripcion, cdrUrl: r.cdrUrl,
        nota: r.aceptado
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
      `SELECT id_factura, numero_factura, serie, numero, codigo_tipo_sunat, id_orden_venta,
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
    // 0004 (no existe) / 0098 (en proceso) NO son finales: la factura sigue ENVIADO, no se reconcilia.
    if (!['0001', '0002', '0003'].includes(cdrResp.statusCode)) {
      await registrarSunatLog({ origen: 'CONSULTA', referenciaId: id, evento: 'getStatusCdr',
        exito: false, httpStatus: 200,
        detalle: `${cdrResp.statusCode} ${cdrResp.statusMessage}`.slice(0, 4000), duracionMs: Date.now() - t0 });
      return res.json({
        idFactura: id, comprobante: f.numero_factura, tipo: f.codigo_tipo_sunat,
        consultaEnVivo: true, statusCode: cdrResp.statusCode, statusMessage: cdrResp.statusMessage,
        sunatEstado: 'ENVIADO', responseCode: null,
        xmlUrl: extraerUrl(f.xml_url), cdrUrl: extraerUrl(f.cdr_url)
      });
    }

    // Estado final → cierre en el helper compartido (persiste factura + marca OV como en el job).
    const r = await cerrarFacturaDesdeStatusCdr(cdrResp, {
      idFactura: id, codigoTipo: f.codigo_tipo_sunat, serie: f.serie, numero: f.numero,
      idOrdenVenta: f.id_orden_venta, idEmpleado: req.user?.id_empleado || null,
      evento: 'getStatusCdr', origen: 'CONSULTA', duracionMs: Date.now() - t0 });

    return res.json({
      idFactura: id, comprobante: f.numero_factura, tipo: f.codigo_tipo_sunat,
      consultaEnVivo: true, statusCode: cdrResp.statusCode, statusMessage: cdrResp.statusMessage,
      sunatEstado: r.estado, responseCode: r.responseCode,
      xmlUrl: extraerUrl(f.xml_url), cdrUrl: r.cdrUrl
    });
  } catch (e) { next(e); }
}

// ── FASE 10: GRE Remitente (09) ─────────────────────────────────────────────
// El core (cerrarTicketGre + emitirGuiaGre) vive en services/sunat/gre-emision.service.js para que
// la emisión y el reemplazo (Fase 12) compartan exactamente el mismo pipeline.

// POST /api/sunat/guias/:id/emitir  → GRE Remitente (09) de una guias_remision existente.
export async function emitirGuiaRemision(req, res, next) {
  try {
    const r = await emitirGuiaGre(Number(req.params.id), req.user?.id_empleado || null);
    res.status(r.httpStatus).json(r.body);
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

// POST /api/sunat/guias/:id/sin-efecto  { motivo }  → FASE 12: deja sin efecto una GRE ACEPTADA.
// GRE 2.0 no tiene baja por API: es un cambio de estado interno (sin llamada a SUNAT). El override
// de Administrador permite forzar cuando el traslado ya inició (En Tránsito/Entregada).
export async function dejarSinEfectoGuia(req, res, next) {
  try {
    const idGuia = Number(req.params.id);
    const esAdmin = String(req.user?.rol || '').trim().toLowerCase() === 'administrador';
    const r = await anularGuiaRemision(idGuia, {
      motivo: req.body?.motivo,
      idEmpleado: req.user?.id_empleado || null,
      esAdmin
    });
    res.json({ ok: true, mensaje: 'Guía dejada sin efecto (SIN EFECTO)', ...r });
  } catch (e) { next(e); }
}

// POST /api/sunat/guias/:id/reemplazar  { correcciones? }  → FASE 12: emite una GRE nueva corregida
// y, si es ACEPTADA, marca la original como REEMPLAZADA (la finalización la hace cerrarTicketGre).
export async function reemplazarGuia(req, res, next) {
  try {
    const idGuia = Number(req.params.id);
    const esAdmin = String(req.user?.rol || '').trim().toLowerCase() === 'administrador';
    const r = await reemplazarGuiaRemision(idGuia, {
      correcciones: req.body?.correcciones || {},
      idEmpleado: req.user?.id_empleado || null,
      esAdmin
    });
    res.status(r.httpStatus).json(r.body);
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
      "ov.observaciones, ov.orden_compra_cliente, ov.direccion_entrega, ov.tipo_impuesto, ov.es_exportacion " +
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

    // Afectación del comprobante (catálogo 07) derivada del MISMO tratamiento que se emitió
    // (ov.tipo_impuesto / es_exportacion), para rotular la operación en el PDF sin ambigüedad:
    // Gravada / Exonerada / Inafecta / Exportación (no un "IGV 18%" fijo).
    const afectacion = afectacionLinea({ tipo_impuesto: f.tipo_impuesto, es_exportacion: f.es_exportacion }, {});

    const qrBuffer = f.sunat_qr_data ? await qrPng(f.sunat_qr_data) : null;
    const pdf = await generarComprobanteSunatPDF({
      comprobante: {
        codigo_tipo_sunat: f.codigo_tipo_sunat, serie: f.serie, numero: f.numero,
        fecha_emision: f.fecha_emision_fmt, moneda: f.moneda,
        tipo_venta: f.tipo_venta, dias_credito: f.dias_credito, fecha_vencimiento: f.fecha_vencimiento_fmt,
        observaciones: f.observaciones, orden_compra: f.orden_compra_cliente,
        direccion_entrega: f.direccion_entrega,
        subtotal: f.subtotal, igv: f.igv, total: f.total, afectacion,
        sunat_digest_value: f.sunat_digest_value, sunat_estado: f.sunat_estado, docAfectado
      },
      emisor, cliente, detalle, qrBuffer
    });

    // Subida best-effort a Cloudinary (no crítica). SUNAT_PDF_SKIP_UPLOAD=1 la desactiva
    // (modo solo-lectura para validar el endpoint sin escribir en producción).
    if (process.env.SUNAT_PDF_SKIP_UPLOAD !== '1') {
      try {
        const url = await subirRaw(pdf, `sunat/pdf/${f.sunat_nombre_xml || `${f.serie}-${f.numero}`}.pdf`);
        await pool.query('UPDATE facturas_venta SET url_pdf = ? WHERE id_factura = ?', [url, idFactura]);
      } catch (e) { console.warn('[SUNAT] subir PDF comprobante falló:', e.message); }
    }

    // Nombre estilo SUNAT (RUC-TIPO-SERIE-NUMERO.pdf), igual que el XML/CDR, para que la pestaña
    // y la descarga usen un nombre reconocible en vez del UUID del blob.
    const nombrePdf = `${f.sunat_nombre_xml || `${f.serie}-${f.numero}`}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombrePdf}"`);
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
      "SELECT g.*, DATE_FORMAT(COALESCE(g.fecha_emision, g.sunat_fecha_envio), '%d/%m/%Y') AS fecha_emision_fmt, " +
      "DATE_FORMAT(g.fecha_traslado, '%d/%m/%Y') AS fecha_traslado_fmt, ov.orden_compra_cliente " +
      "FROM guias_remision g LEFT JOIN ordenes_venta ov ON ov.id_orden_venta = g.id_orden_venta WHERE g.id_guia = ?",
      [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);
    // Se imprime la GRE ACEPTADA y también las invalidadas (ANULADA/REEMPLAZADA), estas últimas
    // con marca de agua (SIN EFECTO / REEMPLAZADA) para dejar constancia — nunca PENDIENTE/ENVIADO.
    if (!['ACEPTADO', 'ANULADA', 'REEMPLAZADA'].includes(g.sunat_estado)) {
      throw new AppError(`El PDF de la GRE solo se genera desde estado ACEPTADO (estado actual: ${g.sunat_estado || 'sin enviar'})`, 409);
    }
    if (!g.sunat_qr_url) {
      throw new AppError('La GRE no tiene QR-URL de SUNAT: la representación impresa válida solo existe en PROD (Fase 16)', 409);
    }

    // Si fue reemplazada, resolver el serie-número de la guía de reemplazo para el pie del PDF.
    let reemplazoRef = null;
    if (g.id_guia_reemplazo) {
      const [[gr]] = await pool.query('SELECT serie_sunat, numero_sunat FROM guias_remision WHERE id_guia = ?', [g.id_guia_reemplazo]);
      if (gr?.serie_sunat && gr?.numero_sunat) reemplazoRef = `${gr.serie_sunat}-${gr.numero_sunat}`;
    }

    const [[emisor]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');
    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [g.id_cliente]);
    const [[conductor]] = g.id_conductor
      ? await pool.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor])
      : [[null]];
    // Placa: se resuelve desde la flota (id_vehiculo) y se normaliza igual que en la emisión, para
    // que el PDF muestre exactamente la placa enviada a SUNAT (fallback a columnas legacy).
    const [[vehiculo]] = g.id_vehiculo
      ? await pool.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo])
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
        placa: normalizarPlaca(vehiculo?.placa || g.placa_vehiculo || g.placa),
        observaciones: componerObservacionGuia(g.observaciones, g.orden_compra_cliente),
        motivo_anulacion: g.motivo_anulacion, reemplazo_ref: reemplazoRef
      },
      emisor, cliente, detalle, conductor, qrBuffer
    });

    if (process.env.SUNAT_PDF_SKIP_UPLOAD !== '1') {
      try {
        const url = await subirRaw(pdf, `sunat/pdf/${sunatConfig.ruc}-09-${g.serie_sunat}-${g.numero_sunat}.pdf`);
        await pool.query('UPDATE guias_remision SET url_pdf = COALESCE(?, url_pdf) WHERE id_guia = ?', [url, idGuia]);
      } catch (e) { console.warn('[SUNAT] subir PDF GRE falló:', e.message); }
    }

    // Nombre estilo SUNAT (RUC-09-SERIE-NUMERO.pdf), igual que el XML/CDR de la GRE.
    const nombrePdf = `${sunatConfig.ruc}-09-${g.serie_sunat}-${g.numero_sunat}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombrePdf}"`);
    res.send(pdf);
  } catch (e) { next(e); }
}

// POST /api/sunat/jobs/tick — FASE 15: dispara la reconciliación de reintentos. Protegido por un
// TOKEN INTERNO (header x-jobs-token), NO por JWT: pensado para un scheduler externo (Render Cron,
// cron-job.org, GitHub Actions). Si SUNAT_JOBS_TOKEN no está seteado, el endpoint queda cerrado.
export async function jobTick(req, res, next) {
  try {
    const token = process.env.SUNAT_JOBS_TOKEN;
    if (!token || req.get('x-jobs-token') !== token) {
      return res.status(401).json({ ok: false, error: 'token de job inválido o no configurado' });
    }
    const resumen = await ejecutarReintentosSunat(req.app.get('socketio'));
    res.json({ ok: true, resumen });
  } catch (e) { next(e); }
}

// GET /api/sunat/monitor — FASE 15: datos del panel "Monitor SUNAT" (solo lectura, gated facturacion).
export async function monitorSunat(req, res, next) {
  try {
    const [comprobantes] = await pool.query(
      "SELECT sunat_estado AS estado, COUNT(*) AS n FROM facturas_venta WHERE sunat_estado IS NOT NULL GROUP BY sunat_estado");
    const [guias] = await pool.query(
      "SELECT sunat_estado AS estado, COUNT(*) AS n FROM guias_remision GROUP BY sunat_estado");
    const [bajas] = await pool.query(
      "SELECT estado, COUNT(*) AS n FROM sunat_bajas GROUP BY estado");
    const [ultimosRechazos] = await pool.query(
      `SELECT 'FACTURA' AS origen, id_factura AS id, CONCAT(serie,'-',numero) AS comprobante,
              sunat_estado AS estado, sunat_response_code AS codigo, sunat_response_desc AS detalle
         FROM facturas_venta WHERE sunat_estado IN ('RECHAZADO','ERROR')
        ORDER BY id_factura DESC LIMIT 10`);
    // fecha_ms: epoch en milisegundos vía UNIX_TIMESTAMP (independiente de la zona de sesión y
    // del `timezone` del pool). Evita que mysql2 reinterprete el TIMESTAMP UTC como -05:00 y lo
    // desfase +5h. El frontend lo formatea con timeZone America/Lima.
    const [erroresLog] = await pool.query(
      `SELECT origen, referencia_id, evento, http_status, detalle,
              UNIX_TIMESTAMP(fecha) * 1000 AS fecha_ms
         FROM sunat_log WHERE exito = 0 ORDER BY id_log DESC LIMIT 20`);
    const abiertos = (rows) => rows.filter(r => r.estado === 'ENVIADO').reduce((s, r) => s + Number(r.n), 0);
    res.json({
      mode: sunatConfig.mode,
      comprobantes, guias, bajas,
      ticketsAbiertos: {
        comprobantes: abiertos(comprobantes),
        guias: abiertos(guias),
        bajas: abiertos(bajas)
      },
      ultimosRechazos, erroresLog
    });
  } catch (e) { next(e); }
}
