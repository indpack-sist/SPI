// controllers/sunat.controller.js
// Orquestación del módulo SUNAT.
import { promises as fs } from 'fs';
import { sunatConfig } from '../config/sunat.js';
import { pool, withTransaction } from '../config/database.js';
import { obtenerCorrelativo } from '../services/sunat/numeracion.service.js';
import { construirInvoiceXML } from '../services/sunat/ubl.service.js';
import { construirNotaXML } from '../services/sunat/ubl-nota.service.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { zipXml } from '../services/sunat/zip.service.js';
import { sendBill } from '../services/sunat/soap.service.js';
import { parsearCdr } from '../services/sunat/cdr.service.js';
import { generarQr } from '../services/sunat/qr.service.js';
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
  return { emision, hora };
}
function addDiasISO(iso, dias) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
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

    const { emision, hora } = fechaLima();
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
           sunat_estado, sunat_digest_value, sunat_qr_data, sunat_nombre_xml, hash_see,
           sunat_fecha_envio, id_registrado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'ENVIADO', ?,?,?,?, NOW(), ?)`,
        [`${serie}-${numero}`, id_orden_venta, ov.id_cliente, 'Factura', serie, numero,
         totales.subtotal, totales.igv, totales.total, ov.moneda || 'PEN', 'Emitida',
         tipo, esExport ? '0200' : (ov.tipo_operacion_sunat || '0101'),
         digestValue, qr.data, nombre, digestValue, idEmpleado]);

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
          `UPDATE ordenes_venta SET facturado_sunat = 1, fecha_facturacion_sunat = NOW(),
             numero_comprobante_sunat = ?, id_facturador = ? WHERE id_orden_venta = ?`,
          [`${serie}-${numero}`, idEmpleado, id_orden_venta]);
      }
    });

    await registrarSunatLog({ origen: 'FACTURA', referenciaId: idFactura, evento: 'sendBill',
      exito: aceptado, httpStatus: 200, detalle: `${cdr.responseCode} ${descripcion}`.slice(0, 4000),
      duracionMs: Date.now() - t0 });

    res.json({
      ok: aceptado, estado: estadoFinal, idFactura, serie, numero,
      comprobante: `${serie}-${numero}`, responseCode: cdr.responseCode,
      descripcion, totales, xmlUrl, cdrUrl, debug
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
    const { emision, hora } = fechaLima();

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
           id_factura_ref, motivo_nota_codigo,
           sunat_estado, sunat_digest_value, sunat_qr_data, sunat_nombre_xml, hash_see,
           sunat_fecha_envio, id_registrado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ENVIADO', ?,?,?,?, NOW(), ?)`,
        [`${serie}-${numero}`, ref.id_orden_venta, ref.id_cliente, 'Factura', serie, numero,
         totales.subtotal, totales.igv, totales.total, ref.moneda || 'PEN', 'Emitida',
         tipo, ov.tipo_operacion_sunat || '0101',
         id_factura_ref, String(motivo_codigo),
         digestValue, qr.data, nombre, digestValue, idEmpleado]);

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
      afectaFacturaId: id_factura_ref, descripcion, totales, xmlUrl, cdrUrl, debug
    });
  } catch (e) { next(e); }
}
