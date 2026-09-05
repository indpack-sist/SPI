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
import { sleep, copiaLocal, extraerUrl, normalizarPlaca, componerObservacion, componerObservacionGuia, placaValida, dniValido, ubigeoValido } from '../services/sunat/util.service.js';
import { firmarXml } from '../services/sunat/firma.service.js';
import { zipXml } from '../services/sunat/zip.service.js';
import { sendBill, sendSummary, getStatus, getStatusCdr } from '../services/sunat/soap.service.js';
import { parsearCdr } from '../services/sunat/cdr.service.js';
import { generarQr, qrPng } from '../services/sunat/qr.service.js';
import { generarComprobanteSunatPDF } from '../utils/pdfGenerators/comprobanteSunatPDF.js';
import { generarGuiaRemisionSunatPDF } from '../utils/pdfGenerators/guiaRemisionSunatPDF.js';
import { registrarSunatLog } from '../services/sunat/log.service.js';
import { subirRaw } from '../services/cloudinary.service.js';
import { marcarOrdenFacturada, liberarOrdenFacturada, cerrarBajaDesdeStatus, cerrarFacturaDesdeStatusCdr } from '../services/sunat/cierre.service.js';
import { ejecutarReintentosSunat } from '../jobs/sunat-reintentos.job.js';
import AppError from '../utils/AppError.js';

// Tipos de comprobante dentro de alcance (catálogo 01). Boletas (03) y otros: fuera de alcance.
const TIPOS_PERMITIDOS = ['01', '07', '08'];

// Normaliza y VALIDA la lista de guías de remisión relacionadas que el panel adjunta a una factura
// (buscador manual: las GRE se emiten directo en SUNAT y no hay registro local). Devuelve:
//   - null  → el request NO trae la clave `guias` (se usan las GRE del sistema, comportamiento previo);
//   - []    → el usuario limpió la lista a propósito (no se declara ninguna guía);
//   - [{ tipo_documento, serie, numero }] → lista saneada y deduplicada.
// Reglas de formato (para que SUNAT no observe/rechace el cac:DespatchDocumentReference):
//   tipo ∈ {09 Remitente, 31 Transportista}; serie = 4 alfanuméricos (p. ej. T001, EG01, 0001);
//   número = 1..8 dígitos. La serie se guarda en MAYÚSCULAS; el número, literal.
function normalizarGuiasFactura(input) {
  if (input === undefined || input === null) return null;
  if (!Array.isArray(input)) throw new AppError('guias debe ser una lista', 400);
  const vistos = new Set();
  const out = [];
  for (const raw of input) {
    const tipoDoc = String(raw?.tipo_documento ?? raw?.tipo ?? '09').trim();
    if (!['09', '31'].includes(tipoDoc)) {
      throw new AppError(`Tipo de guía inválido "${tipoDoc}" (solo 09 Remitente o 31 Transportista)`, 422);
    }
    const serie = String(raw?.serie ?? '').toUpperCase().trim();
    const numero = String(raw?.numero ?? '').trim();
    if (!/^[A-Z0-9]{4}$/.test(serie)) {
      throw new AppError(`Serie de guía inválida "${serie}" (4 caracteres alfanuméricos, p. ej. T001)`, 422);
    }
    if (!/^\d{1,8}$/.test(numero)) {
      throw new AppError(`Número de guía inválido "${numero}" (solo dígitos, hasta 8)`, 422);
    }
    const key = `${tipoDoc}|${serie}|${numero}`;
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push({ tipo_documento: tipoDoc, serie, numero });
  }
  return out;
}

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

// Valida/normaliza la fecha de emisión opcional (retro-fecha). Sin valor → hoy Lima.
// Regla: la fecha no puede ser futura y el beneficio de retro-fecha alcanza como máximo
// 2 días anteriores. La regla cronológica (no anterior a la última factura ya emitida de la
// serie) se valida aparte, contra la BD. Devuelve 'YYYY-MM-DD'.
function validarFechaEmision(solicitada, hoyISO) {
  const s = String(solicitada || '').trim();
  if (!s) return hoyISO;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new AppError('fecha_emision debe tener formato YYYY-MM-DD', 400);
  }
  const d = new Date(s + 'T00:00:00');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new AppError('fecha_emision no es una fecha válida', 400);
  }
  const dias = diffDiasISO(s, hoyISO); // >0 = pasado, <0 = futuro
  if (dias < 0) throw new AppError('La fecha de emisión no puede ser futura', 422);
  if (dias > 2) throw new AppError('La fecha de emisión solo puede retrocederse hasta 2 días anteriores', 422);
  return s;
}

// Última fecha de emisión (DATE 'YYYY-MM-DD') de la serie ya usada por un comprobante vivo
// (no rechazado). Sirve para la regla cronológica: no se puede emitir con fecha anterior a esta.
// `db` puede ser el pool o una conexión de transacción (ambos exponen .query).
// `tipo` (catálogo 01/07/08) acota a la serie del propio documento (factura vs nota).
async function ultimaFechaEmitidaSerie(db, serie, tipo = '01') {
  const [[row]] = await db.query(
    "SELECT DATE_FORMAT(MAX(fecha_emision), '%Y-%m-%d') AS ultima FROM facturas_venta " +
    "WHERE serie = ? AND codigo_tipo_sunat = ? AND sunat_estado IS NOT NULL AND sunat_estado <> 'RECHAZADO'",
    [serie, tipo]);
  return row?.ultima || null;
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
  // Guías relacionadas ingresadas en el buscador del panel (null = no vino la clave → usar GRE del
  // sistema). Se validan ACÁ para fallar temprano, antes de reservar correlativo.
  const guiasManual = normalizarGuiasFactura(req.body.guias);
  try {
    if (!id_orden_venta) throw new AppError('Falta id_orden_venta', 400);
    if (!TIPOS_PERMITIDOS.includes(tipo)) {
      throw new AppError(`Tipo de comprobante ${tipo} fuera de alcance (solo 01/07/08; boletas no se emiten)`, 400);
    }
    if (tipo !== '01') {
      throw new AppError('Las notas 07/08 se emiten desde el endpoint de notas (Fase 7)', 400);
    }

    const lima = fechaLima();
    const { hora } = lima;
    // Fecha de emisión: por defecto hoy (Lima); se permite retro-fechar dentro del plazo de
    // envío de SUNAT (≤ 3 días calendario). Nunca a futuro. La hora es siempre la real.
    const emision = validarFechaEmision(req.body.fecha_emision, lima.emision);
    const emisionDateTime = `${emision} ${hora}`;
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

      // Regla cronológica: no se puede retro-fechar por debajo de la última factura ya emitida
      // de la serie. Los días previos solo quedan "libres" mientras no se haya avanzado la
      // facturación (no exista aún un comprobante con fecha posterior). Solo aplica al retro-fechar.
      if (emision !== lima.emision) {
        const ultima = await ultimaFechaEmitidaSerie(conn, serie);
        if (ultima && diffDiasISO(emision, ultima) > 0) {
          throw new AppError(
            `No se puede emitir con fecha ${emision}: la serie ya tiene un comprobante con fecha ${ultima}. ` +
            'Solo se puede retro-fechar mientras no se haya emitido una factura con fecha posterior.', 422);
        }
      }

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

      // Guías de remisión electrónicas ya ACEPTADAS de esta OV: se declaran en la factura
      // (cac:DespatchDocumentReference) y, al aceptarse el comprobante, se les estampa id_factura
      // como liga interna. Solo las ACEPTADAS tienen serie_sunat/numero_sunat válidos.
      const [guias] = await conn.query(
        `SELECT id_guia, serie_sunat, numero_sunat FROM guias_remision
          WHERE id_orden_venta = ? AND sunat_estado = 'ACEPTADO'
            AND serie_sunat IS NOT NULL AND numero_sunat IS NOT NULL`, [id_orden_venta]);

      const numero = await obtenerCorrelativo(conn, tipo, serie);
      const fecha = {
        emision, hora,
        vencimiento: String(ov.tipo_venta || '').toLowerCase().startsWith('cr')
          ? addDiasISO(emision, ov.dias_credito) : null
      };

      // Orden de compra (cac:OrderReference): campo PROPIO, ya no se mezcla en las observaciones.
      // Si el panel la envía (editable), se usa y se persiste en la OV — que es la fuente que leen
      // tanto el XML (OrderReference) como el PDF; si no viene, se conserva la de la OV. Máx 30.
      if (req.body.orden_compra_cliente !== undefined) {
        ov.orden_compra_cliente = String(req.body.orden_compra_cliente || '').trim().slice(0, 30);
        await conn.query('UPDATE ordenes_venta SET orden_compra_cliente = ? WHERE id_orden_venta = ?',
          [ov.orden_compra_cliente || null, id_orden_venta]);
      }

      // Observaciones (cbc:Note, lo que SUNAT muestra como "Observaciones"). Texto LIBRE editable
      // desde el panel; ya NO se le inyecta la OC (esa viaja aparte en cac:OrderReference). Si el
      // cliente no envía la clave, se usa el texto de la OV tal cual. Se normaliza (sin saltos, ≤250)
      // para que lo PERSISTIDO coincida byte a byte con el cbc:Note del XML (y así el PDF).
      const observacionEnviada = (req.body.observaciones !== undefined
        ? String(req.body.observaciones)
        : String(ov.observaciones || '')
      ).replace(/[\r\n]+/g, ' ').trim().slice(0, 250);
      ov.observaciones = observacionEnviada;

      // Guías declaradas en la factura = UNIÓN de dos fuentes (nunca reemplazo, para no perder
      // las del sistema si el panel manda lista vacía):
      //  · sistema: las GRE de la OV ya ACEPTADAS (se les liga id_factura al aceptar);
      //  · manual: las del buscador del panel (GRE emitidas directo en SUNAT, sin registro local).
      // Se deduplica por tipo|serie|número para no declarar la misma guía dos veces.
      const guiasSistema = guias.map((g) => ({ tipo_documento: '09', serie: String(g.serie_sunat), numero: String(g.numero_sunat) }));
      const clavesSistema = new Set(guiasSistema.map((g) => `${g.tipo_documento}|${g.serie}|${g.numero}`));
      const guiasManualNuevas = (guiasManual || []).filter((g) => !clavesSistema.has(`${g.tipo_documento}|${g.serie}|${g.numero}`));
      const guiasDeclaradas = [...guiasSistema, ...guiasManualNuevas];

      const { xml, totales } = construirInvoiceXML({ serie, numero, ov, detalle, cliente, empresa, fecha, guias: guiasDeclaradas });
      const { xmlFirmado, digestValue } = firmarXml(xml);
      // El número del nombre de archivo debe coincidir EXACTO con cbc:ID (serie-numero),
      // SIN ceros a la izquierda: SUNAT (fault 1036) compara ambos sin normalizar el padding.
      const nombre = `${sunatConfig.ruc}-${tipo}-${serie}-${numero}`;

      const qr = generarQr({
        ruc: sunatConfig.ruc, tipo, serie, numero,
        igv: totales.igv, total: totales.total, fechaEmision: emision,
        tipoDocCliente: esExport ? '0' : '6', numDocCliente: cliente.ruc || '0',
        hash: digestValue
      });

      const [ins] = await conn.query(
        `INSERT INTO facturas_venta
          (numero_factura, id_orden_venta, id_cliente, tipo_comprobante, serie, numero,
           subtotal, igv, total, moneda, estado, codigo_tipo_sunat, tipo_operacion_sunat,
           fecha_emision, observaciones,
           sunat_estado, sunat_digest_value, sunat_qr_data, sunat_nombre_xml, hash_see,
           sunat_fecha_envio, id_registrado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, ?, ?, 'ENVIADO', ?,?,?,?, ?, ?)`,
        [`${serie}-${numero}`, id_orden_venta, ov.id_cliente, 'Factura', serie, numero,
         totales.subtotal, totales.igv, totales.total, ov.moneda || 'PEN', 'Emitida',
         tipo, esExport ? '0200' : (ov.tipo_operacion_sunat || '0101'),
         emisionDateTime, observacionEnviada,
         digestValue, qr.data, nombre, digestValue, emisionDateTime, idEmpleado]);

      return { idFactura: ins.insertId, numero, nombre, xmlFirmado, digestValue, totales,
        guiaIds: guias.map((g) => g.id_guia), guiasManualNuevas };
    });

    // ── Fuera de transacción: envío a SUNAT + subida de archivos ──
    const { idFactura, numero, nombre, xmlFirmado, totales, guiaIds, guiasManualNuevas } = prep;
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
      // Fault 1032: "el comprobante ya está informado y se encuentra anulado o rechazado". Es un
      // estado DEFINITIVO en SUNAT (ese serie-número quedó quemado): reintentar el MISMO número
      // nunca va a funcionar. Marcamos la fila RECHAZADO (estado final) para no dejarla colgada en
      // ENVIADO; hay que emitir con el SIGUIENTE correlativo. A diferencia del 1033 (ya ACEPTADO),
      // que sí queda ENVIADO para reconciliarse por getStatusCdr.
      if (String(e.faultCode) === '1032') {
        await pool.query(
          `UPDATE facturas_venta SET sunat_estado = 'RECHAZADO', sunat_response_code = '1032',
             sunat_response_desc = ?, sunat_intentos = sunat_intentos + 1 WHERE id_factura = ?`,
          [`El comprobante ya estaba informado en SUNAT (anulado/rechazado); debe emitirse con el siguiente correlativo. ${e.message}`.slice(0, 4000), idFactura]);
        await registrarSunatLog({ origen: 'FACTURA', referenciaId: idFactura, evento: 'sendBill',
          exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
        return res.status(409).json({
          ok: false, estado: 'RECHAZADO', idFactura, serie, numero, faultCode: '1032',
          error: 'Este número de comprobante ya fue informado a SUNAT (rechazado/anulado). Emítalo con el siguiente correlativo.',
          debug
        });
      }
      // Resto de faults (timeout, 1033, 0111, caída...): la fila queda ENVIADO para consulta/reintento.
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
        // Liga interna factura ↔ guías (solo si el comprobante fue aceptado por SUNAT). Ambos
        // caminos conviven (la declaración en el XML fue la UNIÓN de las dos fuentes):
        //  · sistema (GRE ACEPTADAS de la OV) → se les estampa id_factura como antes;
        //  · manual (buscador del panel, las NUEVAS ya deduplicadas) → se guardan en
        //    facturas_guias_referencia para dejar constancia y rotularlas en el PDF.
        if (guiaIds && guiaIds.length) {
          await conn.query(
            'UPDATE guias_remision SET id_factura = ? WHERE id_guia IN (?)', [idFactura, guiaIds]);
        }
        if (guiasManualNuevas && guiasManualNuevas.length) {
          await conn.query(
            'INSERT IGNORE INTO facturas_guias_referencia (id_factura, tipo_documento, serie, numero) VALUES ?',
            [guiasManualNuevas.map((g) => [idFactura, g.tipo_documento, g.serie, g.numero])]);
        }
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

    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [ov.id_cliente]);
    const [[empresa]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');

    // La OC viaja como campo propio (cac:OrderReference). Si las observaciones de la OV solo repiten
    // la OC (dato heredado de cuando se embebían en cbc:Note, p. ej. "OC: <número>"), no se sugieren
    // como observación para no duplicarla en SUNAT ni en el PDF.
    const ocRaw = String(ov.orden_compra_cliente || '').trim();
    let obsRaw = String(ov.observaciones || '').replace(/[\r\n]+/g, ' ').trim();
    if (ocRaw) {
      // Se quita el prefijo "OC"/"O/C"/"ORDEN DE COMPRA" a AMBOS lados: la OC puede venir con ese
      // prefijo dentro del propio campo (p. ej. "OC - 4600144796") y sin quitárselo tampoco a la OC
      // la observación no se detectaba como repetida y se prellenaba duplicando la OC.
      const strip = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(OC|ORDENDECOMPRA)+/, '');
      if (strip(obsRaw) === strip(ocRaw)) obsRaw = '';
    }

    // GRE del sistema ya ACEPTADAS de esta OV: se declararán automáticamente en la factura (además
    // de las que el usuario agregue en el buscador). El panel las muestra como "ya incluidas".
    const [guiasSistema] = await pool.query(
      `SELECT serie_sunat AS serie, numero_sunat AS numero FROM guias_remision
        WHERE id_orden_venta = ? AND sunat_estado = 'ACEPTADO'
          AND serie_sunat IS NOT NULL AND numero_sunat IS NOT NULL ORDER BY id_guia`, [id_orden_venta]);

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
      // Emisor (para el preliminar estilo SUNAT del panel), igual que previewNota.
      empresa: {
        razon_social: empresa?.razon_social || '',
        ruc: empresa?.ruc || sunatConfig.ruc,
        direccion: [empresa?.direccion, [empresa?.distrito, empresa?.provincia, empresa?.departamento].filter(Boolean).join(' - ')]
          .filter(Boolean).join(' ')
      },
      cliente: {
        razon_social: cliente?.razon_social || '',
        ruc: cliente?.ruc || '',
        tipo_documento: cliente?.tipo_documento || 'RUC',
        direccion: cliente?.direccion_despacho || ov.direccion_entrega || ''
      },
      // Observación SUGERIDA (cbc:Note): texto LIBRE de la OV, ya SIN la OC (esta viaja aparte).
      observacion: obsRaw.slice(0, 250),
      // Orden de compra (cac:OrderReference): campo propio, editable en el panel antes de emitir.
      ordenCompra: String(ov.orden_compra_cliente || '').trim().slice(0, 30),
      // GRE del sistema que se auto-declaran (el panel las muestra como ya incluidas, no editables).
      guiasSistema: guiasSistema.map((g) => ({ tipo_documento: '09', serie: String(g.serie), numero: String(g.numero) })),
      // Última fecha ya emitida en la serie: el panel no deja retro-fechar por debajo de ella (regla cronológica).
      ultimaFechaEmitida: await ultimaFechaEmitidaSerie(pool, 'FE01'),
      avisos
    });
  } catch (e) { next(e); }
}

// Serie fija por tipo de nota (asociadas a facturas FE01).
const SERIES_NOTA = { '07': 'FC01', '08': 'FD01' };

// Vista previa de una Nota (07/08) — MISMO cálculo (calcularComprobante) que la nota real, para que el
// panel muestre el "Preliminar de Nota" tal como se firmará y enviará. Solo lectura: no numera, no envía.
// POST /api/sunat/comprobantes/notas/preview  { id_factura_ref, tipo, motivo_codigo }
export async function previewNota(req, res, next) {
  try {
    const { id_factura_ref, motivo_codigo } = req.body;
    const tipo = String(req.body.tipo || '');
    if (!id_factura_ref) throw new AppError('Falta id_factura_ref', 400);
    if (!SERIES_NOTA[tipo]) throw new AppError('tipo de nota inválido (07 NC | 08 ND)', 400);

    const [[ref]] = await pool.query(
      "SELECT *, DATE_FORMAT(COALESCE(fecha_emision, sunat_fecha_envio), '%Y-%m-%d') AS fecha_emision_iso " +
      'FROM facturas_venta WHERE id_factura = ?', [id_factura_ref]);
    if (!ref) throw new AppError('Comprobante afectado no existe', 404);

    const [[ov]] = await pool.query('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [ref.id_orden_venta]);
    if (!ov) throw new AppError('Orden de venta del comprobante afectado no existe', 404);
    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [ref.id_cliente]);
    if (!cliente) throw new AppError('Cliente del comprobante afectado no existe', 404);
    const [[empresa]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');

    const motivos = motivosValidos(tipo);
    const motivoLabel = motivos[String(motivo_codigo)] || null;

    const [detalle] = await pool.query(
      'SELECT d.*, p.codigo, p.nombre, p.codigo_unidad_sunat ' +
      'FROM detalle_orden_venta d JOIN productos p ON p.id_producto = d.id_producto ' +
      'WHERE d.id_orden_venta = ?', [ref.id_orden_venta]);

    const calc = calcularComprobante({ ov, detalle });

    // Información del crédito (solo informativa en el preliminar; la nota total hereda el cronograma
    // de la factura afectada = una cuota a su vencimiento = fecha de emisión de la factura + días de crédito).
    const esCredito = String(ov.tipo_venta || '').toLowerCase().startsWith('cr');
    const baseVenc = ref.fecha_emision_iso || fechaLima().emision;
    const credito = esCredito
      ? { esCredito: true, montoPendiente: calc.total, totalCuotas: 1,
          cuotas: [{ n: 1, venc: addDiasISO(baseVenc, ov.dias_credito), monto: calc.total }] }
      : { esCredito: false, montoPendiente: 0, totalCuotas: 0, cuotas: [] };

    // Avisos que NO bloquean el preliminar pero sí la emisión real (mismos checks que emitirNota).
    const avisos = [];
    if (ref.codigo_tipo_sunat !== '01') avisos.push('Solo se emiten notas sobre facturas (01).');
    if (ref.sunat_estado !== 'ACEPTADO') avisos.push('El comprobante afectado no está ACEPTADO por SUNAT.');
    if (ref.estado === 'Anulada') avisos.push('El comprobante afectado ya está anulado.');
    if (!motivoLabel) avisos.push(`motivo_codigo ${motivo_codigo} inválido para el tipo ${tipo}.`);
    const sinUnidad = calc.lineas.filter((l) => !l.unidad).map((l) => l.codigo);
    if (sinUnidad.length) avisos.push(`Productos sin codigo_unidad_sunat: ${sinUnidad.join(', ')}.`);

    res.json({
      ok: true,
      mode: sunatConfig.mode,
      tipo,
      serie: SERIES_NOTA[tipo],
      tipoLabel: tipo === '08' ? 'NOTA DE DÉBITO ELECTRÓNICA' : 'NOTA DE CRÉDITO ELECTRÓNICA',
      docAfectado: { numero: ref.numero_factura, tipoLabel: 'Factura Electrónica' },
      empresa: {
        razon_social: empresa?.razon_social || '',
        ruc: empresa?.ruc || sunatConfig.ruc,
        direccion: [empresa?.direccion, [empresa?.distrito, empresa?.provincia, empresa?.departamento].filter(Boolean).join(' - ')]
          .filter(Boolean).join(' ')
      },
      cliente: {
        razon_social: cliente.razon_social || cliente.nombre || '',
        ruc: cliente.ruc || '',
        tipo_documento: cliente.tipo_documento || '',
        direccion: cliente.direccion_despacho || cliente.direccion || ''
      },
      motivo: { codigo: String(motivo_codigo || ''), label: motivoLabel },
      moneda: calc.moneda,
      monedaLabel: calc.moneda === 'USD' ? 'DOLAR AMERICANO' : 'SOLES',
      esExport: calc.esExport,
      lineas: calc.lineas.map(({ cfg, ...l }) => l),
      // Desglose al estilo del preliminar SUNAT (los conceptos no usados van en cero).
      totales: {
        subtotal: calc.subtotal, anticipos: 0, descuentos: 0, valorVenta: calc.subtotal,
        isc: 0, igv: calc.igv, otrosCargos: 0, otrosTributos: 0, redondeo: 0, total: calc.total
      },
      montoEnLetras: calc.montoEnLetras,
      credito,
      // Última fecha ya emitida en la serie de la NOTA: el panel no deja retro-fechar por debajo.
      ultimaFechaEmitida: await ultimaFechaEmitidaSerie(pool, SERIES_NOTA[tipo], tipo),
      avisos
    });
  } catch (e) { next(e); }
}

// POST /api/sunat/comprobantes/notas/emitir  { id_factura_ref, tipo, motivo_codigo, items? }
// Emite una Nota de Crédito (07) o Débito (08) sobre una FACTURA (01) ACEPTADA.
export async function emitirNota(req, res, next) {
  const { id_factura_ref, motivo_codigo } = req.body;
  const tipo = String(req.body.tipo || '');
  const items = Array.isArray(req.body.items) ? req.body.items : null;
  // Sustento libre del usuario (cbc:Description). Vacío → cae a la etiqueta del catálogo en el XML.
  const sustento = String(req.body.sustento || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 250);
  const idEmpleado = req.user?.id_empleado || null;
  try {
    if (!id_factura_ref) throw new AppError('Falta id_factura_ref', 400);
    if (!SERIES_NOTA[tipo]) throw new AppError('tipo de nota inválido (07 NC | 08 ND)', 400);
    if (!motivo_codigo) throw new AppError('Falta motivo_codigo', 400);
    const serie = SERIES_NOTA[tipo];
    // Fecha de emisión editable (mismas reglas que la factura): retro-fecha ≤2 días, nunca futura, y la
    // regla cronológica contra la serie de la nota se valida dentro de la transacción.
    const lima = fechaLima();
    const emision = validarFechaEmision(req.body.fecha_emision, lima.emision);
    const hora = lima.hora;
    const emisionDateTime = `${emision} ${hora}`;

    // ── TX1: validar doc afectado + reservar correlativo + INSERT nota ENVIADO ──
    const prep = await withTransaction(async (conn) => {
      const [[ref]] = await conn.query(
        "SELECT *, DATE_FORMAT(COALESCE(fecha_emision, sunat_fecha_envio), '%Y-%m-%d') AS fecha_emision_iso " +
        'FROM facturas_venta WHERE id_factura = ? FOR UPDATE', [id_factura_ref]);
      if (!ref) throw new AppError('Comprobante afectado no existe', 404);
      if (ref.codigo_tipo_sunat !== '01') throw new AppError('Solo se emiten notas sobre facturas (01)', 422);
      if (ref.sunat_estado !== 'ACEPTADO') throw new AppError('El comprobante afectado no está ACEPTADO por SUNAT', 409);
      if (ref.estado === 'Anulada') throw new AppError('El comprobante afectado ya está anulado', 409);
      // SUNAT rechaza una nota cuya fecha de emisión sea ANTERIOR a la de la factura que modifica.
      if (ref.fecha_emision_iso && diffDiasISO(emision, ref.fecha_emision_iso) > 0) {
        throw new AppError(
          `La nota no puede emitirse con fecha ${emision}: es anterior a la factura afectada (${ref.fecha_emision_iso}).`, 422);
      }

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

      // Regla cronológica: no retro-fechar por debajo de la última nota ya emitida de la MISMA serie.
      if (emision !== lima.emision) {
        const ultima = await ultimaFechaEmitidaSerie(conn, serie, tipo);
        if (ultima && diffDiasISO(emision, ultima) > 0) {
          throw new AppError(
            `No se puede emitir con fecha ${emision}: la serie ${serie} ya tiene una nota con fecha ${ultima}.`, 422);
        }
      }

      const numero = await obtenerCorrelativo(conn, tipo, serie);
      const fecha = { emision, hora };
      const docAfectado = { comprobante: ref.numero_factura, tipo: '01' };

      const { xml, totales } = construirNotaXML({
        tipo, serie, numero, motivoCodigo: String(motivo_codigo),
        docAfectado, ov, detalle, cliente, empresa, fecha, sustento
      });
      const { xmlFirmado, digestValue } = firmarXml(xml);
      const nombre = `${sunatConfig.ruc}-${tipo}-${serie}-${numero}`;

      const qr = generarQr({
        ruc: sunatConfig.ruc, tipo, serie, numero,
        igv: totales.igv, total: totales.total, fechaEmision: emision,
        tipoDocCliente: String(cliente.tipo_documento || '').toUpperCase() === 'RUC' ? '6' : '0',
        numDocCliente: cliente.ruc || '0',
        hash: digestValue
      });

      const [ins] = await conn.query(
        `INSERT INTO facturas_venta
          (numero_factura, id_orden_venta, id_cliente, tipo_comprobante, serie, numero,
           subtotal, igv, total, moneda, estado, codigo_tipo_sunat, tipo_operacion_sunat,
           id_factura_ref, motivo_nota_codigo, observaciones, fecha_emision,
           sunat_estado, sunat_digest_value, sunat_qr_data, sunat_nombre_xml, hash_see,
           sunat_fecha_envio, id_registrado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ENVIADO', ?,?,?,?, ?, ?)`,
        [`${serie}-${numero}`, ref.id_orden_venta, ref.id_cliente, 'Factura', serie, numero,
         totales.subtotal, totales.igv, totales.total, ref.moneda || 'PEN', 'Emitida',
         tipo, ov.tipo_operacion_sunat || '0101',
         id_factura_ref, String(motivo_codigo), sustento || null, emisionDateTime,
         digestValue, qr.data, nombre, digestValue, emisionDateTime, idEmpleado]);

      return { idNota: ins.insertId, numero, nombre, xmlFirmado, totales, idOrdenVenta: ref.id_orden_venta };
    });

    // ── Envío a SUNAT + CDR (mismo flujo que la factura) ──
    const { idNota, numero, nombre, xmlFirmado, totales, idOrdenVenta } = prep;
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
        // La anulación total reversa la operación: se libera la OV (facturado_sunat = 0) para poder
        // refacturar, igual que hace la Comunicación de Baja de una factura. El nuevo comprobante
        // tomará el siguiente correlativo (FE01-7 anulada queda como histórico junto a su NC).
        await liberarOrdenFacturada(conn, idOrdenVenta);
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
// Catálogo 20 (motivo de traslado) permitido por el wizard de emisión: domésticos (comercio exterior
// = No) y de comercio exterior (= Sí). Se valida contra esta lista para no mandar un código inválido.
const MOTIVOS_GRE_VALIDOS = ['01', '02', '04', '08', '09', '13', '14', '18'];

export async function emitirGuiaRemision(req, res, next) {
  try {
    const idGuia = Number(req.params.id);
    if (!idGuia) throw new AppError('id de guía inválido', 400);

    // El wizard de emisión (SUNAT-style) envía, además de `observaciones`, los campos editables que
    // el usuario pudo corregir antes de emitir. Se PERSISTEN en la guía ANTES de emitir para que lo
    // que ve = lo que se guarda = lo que viaja a SUNAT. La emisión (emitirGuiaGre) los relee y hace
    // la validación autoritativa antes de reservar el correlativo (un error NO lo quema).
    const b = req.body || {};

    // ── Punto de llegada (editable) ──────────────────────────────────────────────
    const sets = [];
    const vals = [];
    if (typeof b.direccion_llegada === 'string' && b.direccion_llegada.trim()) {
      sets.push('direccion_llegada = ?', 'punto_llegada = ?');
      vals.push(b.direccion_llegada.trim().slice(0, 250), b.direccion_llegada.trim().slice(0, 250));
    }
    if (b.ubigeo_llegada !== undefined && b.ubigeo_llegada !== null && String(b.ubigeo_llegada).trim() !== '') {
      const u = String(b.ubigeo_llegada).trim();
      if (!ubigeoValido(u)) throw new AppError(`Ubigeo de llegada inválido: "${u}" (6 dígitos)`, 400);
      sets.push('ubigeo_llegada = ?'); vals.push(u);
    }
    if (b.ciudad_llegada !== undefined) { sets.push('ciudad_llegada = ?'); vals.push(String(b.ciudad_llegada || '').slice(0, 120)); }

    // ── Carga ────────────────────────────────────────────────────────────────────
    if (b.peso_bruto_kg !== undefined && b.peso_bruto_kg !== null && String(b.peso_bruto_kg) !== '') {
      const peso = Number(b.peso_bruto_kg);
      if (!(peso > 0)) throw new AppError('El peso bruto debe ser mayor a 0', 400);
      sets.push('peso_bruto_kg = ?'); vals.push(peso);
    }

    // ── Motivo de traslado (catálogo 20) + comercio exterior ──────────────────────
    if (b.motivo_traslado_cod !== undefined && String(b.motivo_traslado_cod).trim() !== '') {
      const cod = String(b.motivo_traslado_cod).trim();
      if (!MOTIVOS_GRE_VALIDOS.includes(cod)) throw new AppError(`Motivo de traslado inválido: "${cod}"`, 400);
      sets.push('motivo_traslado_cod = ?'); vals.push(cod);
    }
    if (b.es_comercio_exterior !== undefined) {
      sets.push('es_comercio_exterior = ?'); vals.push(b.es_comercio_exterior ? 1 : 0);
    }

    // ── Transporte (modalidad + datos del vehículo/conductor) ─────────────────────
    // El wizard indica el modo: 'flota' (vehículo propio de la empresa), 'particular' (carro común del
    // cliente/tercero particular → texto libre) o 'tercero' (empresa de transporte, ya cableado por OV).
    if (b.transporte && typeof b.transporte === 'object') {
      const t = b.transporte;
      const modo = t.modo || null;
      if (modo === 'particular') {
        // Modalidad 02 con datos de TEXTO LIBRE. Validación de formato en el momento (evita persistir basura).
        const placaN = normalizarPlaca(t.placa);
        if (!placaValida(placaN)) throw new AppError(`Placa inválida: "${t.placa}" (6 a 8 caracteres alfanuméricos)`, 400);
        if (!dniValido(t.dni)) throw new AppError(`DNI del conductor inválido: "${t.dni}" (8 dígitos)`, 400);
        if (!String(t.conductor || '').trim()) throw new AppError('Falta el nombre del conductor', 400);
        if (!String(t.licencia || '').trim()) throw new AppError('Falta la licencia de conducir', 400);
        sets.push('transporte_modo = ?', 'transporte_placa = ?', 'transporte_dni = ?', 'transporte_conductor = ?', 'transporte_licencia = ?',
          'id_conductor = NULL', 'id_vehiculo = NULL', 'id_transportista = NULL');
        vals.push('particular', placaN, String(t.dni).trim(), String(t.conductor).trim().slice(0, 250), String(t.licencia).trim().slice(0, 30));
      } else if (modo === 'flota') {
        // Vehículo propio: conductor (empleados) + vehículo (flota). Limpia los de texto libre.
        if (t.id_conductor) { sets.push('id_conductor = ?'); vals.push(Number(t.id_conductor)); }
        if (t.id_vehiculo) { sets.push('id_vehiculo = ?'); vals.push(Number(t.id_vehiculo)); }
        // Conductor/vehículo secundarios opcionales (hasta 2). Se setean o limpian según venga el payload.
        sets.push('id_conductor2 = ?'); vals.push(t.id_conductor2 ? Number(t.id_conductor2) : null);
        sets.push('id_vehiculo2 = ?'); vals.push(t.id_vehiculo2 ? Number(t.id_vehiculo2) : null);
        sets.push('transporte_modo = ?', 'transporte_placa = NULL', 'transporte_dni = NULL', 'transporte_conductor = NULL', 'transporte_licencia = NULL', 'id_transportista = NULL');
        vals.push('flota');
      } else if (modo === 'tercero') {
        // La empresa de transporte + detalle veh/cond viven en la OV ("Transporte y Logística").
        // El wizard sí puede ajustar por-emisión el interruptor "registrar vehículos y conductores
        // del transportista" (Caso 1 ↔ 2/3) y los indicadores; se persisten en la OV (fuente única).
        const ovSets = [], ovVals = [];
        if (t.registrar !== undefined) { ovSets.push('transporte_registrar = ?'); ovVals.push(t.registrar ? 1 : 0); }
        if (t.indicadores && typeof t.indicadores === 'object') {
          ovSets.push('transporte_ind_transbordo = ?', 'transporte_ind_m1l = ?', 'transporte_ind_retorno_vacio = ?');
          ovVals.push(t.indicadores.transbordo ? 1 : 0, t.indicadores.m1l ? 1 : 0, t.indicadores.retornoVacio ? 1 : 0);
        }
        if (ovSets.length) {
          ovVals.push(idGuia);
          await pool.query(
            `UPDATE ordenes_venta ov JOIN guias_remision g ON g.id_orden_venta = ov.id_orden_venta
                SET ${ovSets.join(', ')} WHERE g.id_guia = ?`, ovVals);
        }
      }
    }

    if (sets.length) {
      vals.push(idGuia);
      await pool.query(`UPDATE guias_remision SET ${sets.join(', ')} WHERE id_guia = ?`, vals);
    }

    // Si el panel envía `observaciones` (editable, prellenado con la OC) se usa tal cual como
    // cbc:Note; si no viene (undefined), el core compone del texto de la guía + OC de la OV.
    const observacion = b.observaciones !== undefined ? String(b.observaciones) : undefined;
    const r = await emitirGuiaGre(idGuia, req.user?.id_empleado || null, observacion);
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
      // Vencimiento = fecha de emisión + días de crédito (MISMO cálculo que el XML: addDiasISO(emision,
      // dias)). Antes se imprimía ov.fecha_vencimiento (calculada desde la fecha de la orden), lo que
      // podía diferir de lo declarado a SUNAT cuando la emisión no coincidía con la fecha de la orden.
      "ov.tipo_venta, ov.dias_credito, DATE_FORMAT(DATE_ADD(f.fecha_emision, INTERVAL ov.dias_credito DAY), '%d/%m/%Y') AS fecha_vencimiento_fmt, " +
      // ov.observaciones se alía para NO pisar f.observaciones (misma clave). El PDF muestra lo
      // PERSISTIDO en la factura (== cbc:Note enviado); ov_observaciones solo es fallback histórico.
      "ov.observaciones AS ov_observaciones, ov.orden_compra_cliente, ov.direccion_entrega, ov.tipo_impuesto, ov.es_exportacion " +
      "FROM facturas_venta f LEFT JOIN ordenes_venta ov ON ov.id_orden_venta = f.id_orden_venta " +
      "WHERE f.id_factura = ?",
      [idFactura]);
    if (!f) throw new AppError('Comprobante no existe', 404);
    // ACEPTADO (válido), BAJA (anulado con constancia) y RECHAZADO (sin validez, pero se imprime
    // con marca de agua + motivo en rojo para dejar constancia del intento y su correlativo).
    if (!['ACEPTADO', 'BAJA', 'RECHAZADO'].includes(f.sunat_estado)) {
      throw new AppError(`El PDF solo se genera para comprobantes ACEPTADOS, dados de BAJA o RECHAZADOS (estado actual: ${f.sunat_estado || 'sin enviar'})`, 409);
    }

    const [[emisor]] = await pool.query('SELECT * FROM empresa_config WHERE id = 1');
    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [f.id_cliente]);
    // Detalle reconstruido desde la OV. Los TOTALES imprimibles salen de facturas_venta (autoritativos);
    // en notas parciales las líneas reflejan la OV completa pero los importes del recuadro son los de la nota.
    const [detalle] = await pool.query(
      'SELECT d.cantidad, d.precio_unitario, d.descuento_porcentaje, p.codigo, p.nombre, ' +
      'p.codigo_unidad_sunat AS unidad FROM detalle_orden_venta d JOIN productos p ON p.id_producto = d.id_producto ' +
      'WHERE d.id_orden_venta = ?', [f.id_orden_venta]);

    // Guías de remisión que ampara esta factura (las mismas que se declararon en el XML como
    // cac:DespatchDocumentReference). Se rotulan en el PDF para dejar constancia impresa. Dos
    // fuentes: GRE del sistema (guias_remision) y las ingresadas a mano en el buscador del panel
    // (facturas_guias_referencia; tabla opcional → si aún no existe, se ignora sin romper el PDF).
    const [guiasRef] = await pool.query(
      `SELECT serie_sunat AS serie, numero_sunat AS numero FROM guias_remision
        WHERE id_factura = ? AND serie_sunat IS NOT NULL AND numero_sunat IS NOT NULL
        ORDER BY id_guia`, [idFactura]);
    let guiasManualRef = [];
    try {
      const [gm] = await pool.query(
        'SELECT serie, numero FROM facturas_guias_referencia WHERE id_factura = ? ORDER BY id', [idFactura]);
      guiasManualRef = gm;
    } catch { /* tabla opcional aún no creada */ }
    const guiasTexto = [...guiasRef, ...guiasManualRef].map((g) => `${g.serie}-${g.numero}`).join(', ');

    // Notas: documento afectado + descripción del motivo (catálogo 09/10).
    let docAfectado = null;
    if (f.id_factura_ref) {
      const [[ref]] = await pool.query('SELECT numero_factura FROM facturas_venta WHERE id_factura = ?', [f.id_factura_ref]);
      const motivos = motivosValidos(f.codigo_tipo_sunat);
      docAfectado = {
        comprobante: ref?.numero_factura || '-',
        motivo: `${f.motivo_nota_codigo} - ${motivos[f.motivo_nota_codigo] || 'MODIFICACIÓN'}`,
        // Sustento libre que escribió el usuario (lo mismo que viajó en el cbc:Description a SUNAT).
        sustento: String(f.observaciones || '').replace(/[\r\n]+/g, ' ').trim() || null
      };
    }

    // Afectación del comprobante (catálogo 07) derivada del MISMO tratamiento que se emitió
    // (ov.tipo_impuesto / es_exportacion), para rotular la operación en el PDF sin ambigüedad:
    // Gravada / Exonerada / Inafecta / Exportación (no un "IGV 18%" fijo).
    const afectacion = afectacionLinea({ tipo_impuesto: f.tipo_impuesto, es_exportacion: f.es_exportacion }, {});

    // Motivo a rotular EN ROJO cuando el comprobante no es válido:
    //  - RECHAZADO: la descripción del CDR/fault guardada en la propia factura.
    //  - BAJA: el motivo de la Comunicación de Baja (sunat_bajas_detalle, la más reciente).
    let motivoEstado = null;
    if (f.sunat_estado === 'RECHAZADO') {
      motivoEstado = f.sunat_response_desc
        ? (f.sunat_response_code ? `(${f.sunat_response_code}) ${f.sunat_response_desc}` : f.sunat_response_desc)
        : null;
    } else if (f.sunat_estado === 'BAJA') {
      const [[b]] = await pool.query(
        'SELECT motivo FROM sunat_bajas_detalle WHERE id_factura = ? ORDER BY id_baja DESC LIMIT 1', [idFactura]);
      motivoEstado = b?.motivo || null;
    } else if (f.estado === 'Anulada') {
      // Anulada por Nota de Crédito de anulación (motivo 01): se rotula qué NC la dejó sin efecto.
      const [[nc]] = await pool.query(
        "SELECT numero_factura FROM facturas_venta WHERE id_factura_ref = ? AND codigo_tipo_sunat = '07' " +
        "AND motivo_nota_codigo = '01' AND sunat_estado = 'ACEPTADO' ORDER BY id_factura DESC LIMIT 1", [idFactura]);
      motivoEstado = nc
        ? `Anulada por Nota de Crédito ${nc.numero_factura} (Anulación de la operación).`
        : 'Operación anulada mediante Nota de Crédito.';
    }

    const qrBuffer = f.sunat_qr_data ? await qrPng(f.sunat_qr_data) : null;
    const pdf = await generarComprobanteSunatPDF({
      comprobante: {
        codigo_tipo_sunat: f.codigo_tipo_sunat, serie: f.serie, numero: f.numero,
        fecha_emision: f.fecha_emision_fmt, moneda: f.moneda,
        tipo_venta: f.tipo_venta, dias_credito: f.dias_credito, fecha_vencimiento: f.fecha_vencimiento_fmt,
        // "Observaciones" del PDF = lo enviado a SUNAT (cbc:Note) persistido en la factura. Para filas
        // viejas (sin persistir) se compone del texto de la OV + OC. La OC ya viaja DENTRO de este
        // texto, así que no se imprime aparte (paridad exacta con lo que muestra SUNAT).
        observaciones: (f.observaciones != null && f.observaciones !== '')
          ? f.observaciones
          : componerObservacion(f.ov_observaciones, f.orden_compra_cliente),
        // OC = campo PROPIO del PDF (ya no embebida en las observaciones). Se rotula en la cabecera.
        orden_compra: f.orden_compra_cliente || null,
        direccion_entrega: f.direccion_entrega,
        subtotal: f.subtotal, igv: f.igv, total: f.total, afectacion,
        guias: guiasTexto,
        sunat_digest_value: f.sunat_digest_value, sunat_estado: f.sunat_estado, estado: f.estado, motivoEstado, docAfectado
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
      "SELECT g.*, DATE_FORMAT(COALESCE(g.sunat_fecha_envio, g.fecha_emision), '%d/%m/%Y %H:%i:%s') AS fecha_emision_fmt, " +
      "DATE_FORMAT(g.fecha_traslado, '%d/%m/%Y') AS fecha_traslado_fmt, ov.orden_compra_cliente, " +
      "ov.transporte_placa AS ov_transporte_placa, ov.transporte_conductor AS ov_transporte_conductor, " +
      "ov.transporte_dni AS ov_transporte_dni, ov.transporte_licencia AS ov_transporte_licencia, " +
      "ov.transporte_dni2 AS ov_transporte_dni2, ov.transporte_conductor2 AS ov_transporte_conductor2, ov.transporte_licencia2 AS ov_transporte_licencia2, " +
      "ov.transporte_tuc AS ov_transporte_tuc, ov.transporte_autorizacion AS ov_transporte_autorizacion, " +
      "ov.transporte_placa2 AS ov_transporte_placa2, ov.transporte_tuc2 AS ov_transporte_tuc2, ov.transporte_autorizacion2 AS ov_transporte_autorizacion2, " +
      "ov.transporte_registrar AS ov_transporte_registrar, " +
      "ov.transporte_ind_transbordo AS ov_ind_transbordo, ov.transporte_ind_m1l AS ov_ind_m1l, ov.transporte_ind_retorno_vacio AS ov_ind_retorno_vacio, " +
      "DATE_FORMAT(ov.transporte_fecha_entrega, '%d/%m/%Y') AS ov_transporte_fecha_entrega, " +
      "t.razon_social AS transportista_razon, t.ruc AS transportista_ruc, t.numero_mtc AS transportista_mtc, " +
      "pr.razon_social AS proveedor_razon, pr.ruc AS proveedor_ruc, " +
      "oc.serie_documento AS oc_serie_doc, oc.numero_documento AS oc_numero_doc " +
      "FROM guias_remision g LEFT JOIN ordenes_venta ov ON ov.id_orden_venta = g.id_orden_venta " +
      "LEFT JOIN transportistas t ON t.id_transportista = g.id_transportista " +
      "LEFT JOIN proveedores pr ON pr.id_proveedor = g.id_proveedor " +
      "LEFT JOIN ordenes_compra oc ON oc.id_orden_compra = g.id_orden_compra WHERE g.id_guia = ?",
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
    const [[cliente]] = g.id_cliente
      ? await pool.query('SELECT * FROM clientes WHERE id_cliente = ?', [g.id_cliente])
      : [[null]];

    // Guía de COMPRA: el destinatario impreso es la propia empresa (SPI recibe su mercadería),
    // el proveedor va como bloque aparte y la factura como documento relacionado. Espeja el XML
    // (DeliveryCustomerParty = emisor, SellerSupplierParty = proveedor, AdditionalDocumentReference).
    const esCompra = g.tipo_origen === 'Compra';
    const destinatarioPdf = esCompra
      ? { razon_social: emisor.razon_social, ruc: emisor.ruc, direccion: emisor.direccion }
      : cliente;
    const proveedorPdf = (esCompra && g.proveedor_ruc)
      ? { razon_social: g.proveedor_razon, ruc: g.proveedor_ruc } : null;
    const docRelacionadoPdf = (esCompra && g.oc_serie_doc && g.oc_numero_doc)
      ? { tipo_desc: 'Factura', serie: g.oc_serie_doc, numero: g.oc_numero_doc } : null;

    // Transporte según el MODO con que se emitió, para que el PDF muestre EXACTAMENTE lo enviado:
    //   · particular → texto libre de la guía · tercero → datos de la OV + maestro transportistas
    //   · flota → empleados/flota. Se arman conductores[] y vehiculos[] (1-2) + indicadores + registrar.
    let transportistaPdf = null, conductores = [], vehiculosPdf = [], indicadoresPdf = {};
    let registrarPdf = true, modalidadPdf = null, fechaEntregaPdf = null;
    if (g.transporte_modo === 'particular' || g.transporte_placa) {
      modalidadPdf = '02';
      conductores = g.transporte_dni ? [{ dni: g.transporte_dni, nombre_completo: g.transporte_conductor, licencia_conducir: g.transporte_licencia }] : [];
      vehiculosPdf = g.transporte_placa ? [{ placa: normalizarPlaca(g.transporte_placa) }] : [];
    } else if (g.id_transportista) {
      modalidadPdf = '01';
      transportistaPdf = { razon: g.transportista_razon, ruc: g.transportista_ruc, mtc: g.transportista_mtc };
      registrarPdf = g.ov_transporte_registrar !== 0;
      indicadoresPdf = { transbordo: !!g.ov_ind_transbordo, m1l: !!g.ov_ind_m1l, retornoVacio: !!g.ov_ind_retorno_vacio };
      fechaEntregaPdf = g.ov_transporte_fecha_entrega || null;
      if (registrarPdf) {
        if (g.ov_transporte_dni) conductores.push({ dni: g.ov_transporte_dni, nombre_completo: g.ov_transporte_conductor, licencia_conducir: g.ov_transporte_licencia });
        if (g.ov_transporte_dni2) conductores.push({ dni: g.ov_transporte_dni2, nombre_completo: g.ov_transporte_conductor2, licencia_conducir: g.ov_transporte_licencia2 });
        const p1 = normalizarPlaca(g.ov_transporte_placa);
        if (p1) vehiculosPdf.push({ placa: p1, tuce: g.ov_transporte_tuc || null, autorizacion: g.ov_transporte_autorizacion || null });
        const p2 = normalizarPlaca(g.ov_transporte_placa2);
        if (p2) vehiculosPdf.push({ placa: p2, tuce: g.ov_transporte_tuc2 || null, autorizacion: g.ov_transporte_autorizacion2 || null });
      }
    } else {
      modalidadPdf = '02';
      const [[cRow]] = g.id_conductor
        ? await pool.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor])
        : [[null]];
      const [[vRow]] = g.id_vehiculo
        ? await pool.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo])
        : [[null]];
      conductores = cRow ? [cRow] : [];
      vehiculosPdf = vRow?.placa ? [{ placa: normalizarPlaca(vRow.placa) }] : [];
      // Conductor/vehículo secundarios opcionales (flota admite hasta 2).
      if (g.id_conductor2) {
        const [[c2]] = await pool.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor2]);
        if (c2) conductores.push(c2);
      }
      if (g.id_vehiculo2) {
        const [[v2]] = await pool.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo2]);
        if (v2?.placa) vehiculosPdf.push({ placa: normalizarPlaca(v2.placa) });
      }
    }
    const [detalle] = await pool.query(
      'SELECT d.cantidad, p.codigo, p.nombre, p.codigo_unidad_sunat FROM detalle_guia_remision d ' +
      'JOIN productos p ON p.id_producto = d.id_producto WHERE d.id_guia = ?', [idGuia]);

    // Comercio exterior (exportación): documentos relacionados (DAM) + contenedores/precintos, en el
    // MISMO orden de inserción con que se emitió el XML (sin ORDER BY, igual que gre-emision.service.js
    // → la numeración "contenedor 1/2" del PDF coincide con el cac:Package del XML). El destinatario
    // impreso es el operador de puerto/depósito (g.destinatario_*), no el cliente de la OV.
    let comexPdf = null;
    if (Number(g.es_comercio_exterior) === 1) {
      const [docsRel] = await pool.query(
        'SELECT tipo_desc, serie, numero FROM guias_remision_doc_relacionado WHERE id_guia = ?', [idGuia]);
      const [contenedores] = await pool.query(
        'SELECT numero_contenedor, numero_precinto FROM guias_remision_contenedor WHERE id_guia = ?', [idGuia]);
      comexPdf = {
        destinatario: g.destinatario_razon ? { razon_social: g.destinatario_razon, ruc: g.destinatario_ruc } : null,
        docsRelacionados: docsRel,
        contenedores,
        trasladoTotalDam: Number(g.traslado_total_dam) !== 0,
        unidadPeso: 'KGM'
      };
    }

    const qrBuffer = await qrPng(g.sunat_qr_url);
    const pdf = await generarGuiaRemisionSunatPDF({
      guia: {
        serie_sunat: g.serie_sunat, numero_sunat: g.numero_sunat,
        fecha_emision: g.fecha_emision_fmt, fecha_traslado: g.fecha_traslado_fmt,
        motivo_traslado_cod: g.motivo_traslado_cod, peso_bruto_kg: g.peso_bruto_kg,
        ubigeo_partida: g.ubigeo_partida, direccion_partida: g.direccion_partida,
        ubigeo_llegada: g.ubigeo_llegada, direccion_llegada: g.direccion_llegada,
        sunat_estado: g.sunat_estado, sunat_digest_value: g.sunat_digest_value,
        // Muestra lo PERSISTIDO (== cbc:Note enviado) si la guía ya lo tiene; si no, compone con la OC.
        observaciones: (g.observaciones != null && g.observaciones !== '')
          ? g.observaciones
          : componerObservacionGuia(g.observaciones, g.orden_compra_cliente),
        motivo_anulacion: g.motivo_anulacion, reemplazo_ref: reemplazoRef
      },
      emisor, cliente: destinatarioPdf, detalle,
      proveedor: proveedorPdf, docRelacionado: docRelacionadoPdf,
      transportista: transportistaPdf, conductores, vehiculos: vehiculosPdf,
      indicadores: indicadoresPdf, registrar: registrarPdf, modalidad: modalidadPdf, fechaEntrega: fechaEntregaPdf,
      comex: comexPdf,
      qrBuffer
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
