// services/sunat/gre-emision.service.js — FASE 10: core de emisión de GRE Remitente (09).
// Extraído del controller (move fiel) para que emitirGuiaRemision Y reemplazarGuiaRemision (Fase 12)
// compartan exactamente el mismo pipeline SUNAT (mock en BETA → real en Fase 16).
import { pool, withTransaction } from '../../config/database.js';
import { sunatConfig } from '../../config/sunat.js';
import { obtenerCorrelativo } from './numeracion.service.js';
import { construirDespatchAdviceXML } from './ubl-gre.service.js';
import { firmarXml } from './firma.service.js';
import { zipXml } from './zip.service.js';
import { obtenerTokenGre, enviarGuia, consultarGuia } from './gre.service.js';
import { parsearCdr } from './cdr.service.js';
import { registrarSunatLog } from './log.service.js';
import { subirRaw } from '../cloudinary.service.js';
import { fechaLima, ahoraLima } from './fecha.service.js';
import { sleep, copiaLocal } from './util.service.js';
import AppError from '../../utils/AppError.js';

// ── FASE 12: reconciliación de reemplazo ────────────────────────────────────
// Punto único: cuando una guía se cierra (ACEPTADA/RECHAZADA), si es el blanco de un reemplazo
// en curso (otra guía la referencia en id_guia_reemplazo y sigue ACEPTADA), finaliza o aborta el
// reemplazo. Como cerrarTicketGre lo llaman la emisión inline, verificarEstadoGuia y el job de
// Fase 15, la reconciliación de un ticket 202 pendiente sale gratis por este mismo camino.
async function finalizarReemplazoSiAplica(idGuiaCerrada, aceptado) {
  const [[orig]] = await pool.query(
    "SELECT id_guia, numero_guia FROM guias_remision WHERE id_guia_reemplazo = ? AND sunat_estado = 'ACEPTADO'",
    [idGuiaCerrada]);
  if (!orig) return; // la guía cerrada no es un reemplazo en curso: emisión normal.

  if (aceptado) {
    // La guía nueva quedó ACEPTADA → la original pasa a REEMPLAZADA + Anulada (negocio).
    await pool.query(
      `UPDATE guias_remision
         SET sunat_estado = 'REEMPLAZADA', estado = 'Anulada',
             motivo_anulacion = ?, fecha_anulacion = ?
       WHERE id_guia = ?`,
      [`Reemplazada por la guía id ${idGuiaCerrada}`.slice(0, 500), ahoraLima(), orig.id_guia]);
    await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: orig.id_guia, evento: 'reemplazoFinalizado',
      exito: true, httpStatus: 200, detalle: `Original ${orig.numero_guia} → REEMPLAZADA por guía id ${idGuiaCerrada}` });
  } else {
    // La guía nueva fue RECHAZADA → aborta el reemplazo: la original vuelve a quedar intacta (ACEPTADO).
    await pool.query(
      `UPDATE guias_remision
         SET id_guia_reemplazo = NULL, anulado_por = NULL, motivo_anulacion = NULL, fecha_anulacion = NULL
       WHERE id_guia = ?`, [orig.id_guia]);
    await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: orig.id_guia, evento: 'reemplazoAbortado',
      exito: false, httpStatus: 200, detalle: `Reemplazo abortado: guía nueva id ${idGuiaCerrada} rechazada; original ${orig.numero_guia} sigue vigente` });
  }
}

// Cierra el ticket de una GRE contra el CDR (o el mock BETA) y persiste el estado.
export async function cerrarTicketGre(idGuia, nombre, ticket, st, t0) {
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
  // Fase 12: si esta guía era el reemplazo de otra, finaliza/aborta la original.
  if (estadoFinal === 'ACEPTADO' || estadoFinal === 'RECHAZADO') {
    await finalizarReemplazoSiAplica(idGuia, aceptado);
  }
  return { aceptado, estadoFinal, codRespuesta: st.codRespuesta, descripcion, cdrUrl, mock: st.mock || false };
}

/**
 * Core de emisión de GRE Remitente (09) de una guias_remision existente.
 * @returns {Promise<{httpStatus:number, body:object}>}  (lanza AppError en validaciones)
 */
export async function emitirGuiaGre(idGuia, idEmpleado = null) {
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
    return { httpStatus: 502, body: { ok: false, estado: 'ERROR', idGuia, error: e.message, tokenOk, tokenError } };
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
    return { httpStatus: 200, body: {
      ok: r.aceptado, estado: r.estadoFinal, idGuia, serie, numero, comprobante: `${serie}-${numero}`,
      ticket, codRespuesta: r.codRespuesta, descripcion: r.descripcion, xmlUrl, cdrUrl: r.cdrUrl,
      mock: r.mock, tokenOk, tokenError
    } };
  }
  return { httpStatus: 202, body: {
    ok: null, estado: 'ENVIADO', idGuia, serie, numero, comprobante: `${serie}-${numero}`, ticket,
    mensaje: 'GRE en proceso (codRespuesta 98). Reconsultar con GET /guias/:id/estado.', tokenOk, tokenError
  } };
}
