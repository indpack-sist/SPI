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
import { sleep, copiaLocal, normalizarPlaca, componerObservacionGuia, placaValida, dniValido, ubigeoValido } from './util.service.js';
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
export async function emitirGuiaGre(idGuia, idEmpleado = null, observacionOverride = undefined) {
  if (!idGuia) throw new AppError('id de guía inválido', 400);
  const tipo = '09', serie = 'TE01';
  const { emision, hora, emisionDateTime } = fechaLima();

  // ── TX1: validar + reservar correlativo + marcar ENVIADO ──
  const prep = await withTransaction(async (conn) => {
    const [[g]] = await conn.query('SELECT * FROM guias_remision WHERE id_guia = ? FOR UPDATE', [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);
    if (g.sunat_estado === 'ACEPTADO') throw new AppError('La guía ya fue aceptada por SUNAT', 409);
    // Regla de negocio: la GRE se emite una vez que la orden ya fue despachada.
    const [[ov]] = await conn.query(
      `SELECT estado, orden_compra_cliente, tipo_entrega, transporte_registrar,
              transporte_placa, transporte_conductor, transporte_dni, transporte_licencia,
              transporte_dni2, transporte_conductor2, transporte_licencia2,
              transporte_tuc, transporte_autorizacion,
              transporte_placa2, transporte_tuc2, transporte_autorizacion2,
              transporte_ind_transbordo, transporte_ind_m1l, transporte_ind_retorno_vacio,
              DATE_FORMAT(transporte_fecha_entrega, '%Y-%m-%d') AS transporte_fecha_entrega
         FROM ordenes_venta WHERE id_orden_venta = ?`, [g.id_orden_venta]);
    if (!ov || ov.estado !== 'Despachada') {
      throw new AppError(`La orden debe estar en estado "Despachada" para emitir la GRE (estado actual: ${ov?.estado || 'desconocido'})`, 409);
    }
    if (!g.ubigeo_partida || !g.ubigeo_llegada) throw new AppError('Faltan ubigeos de partida/llegada (6 dígitos)', 422);
    if (!(Number(g.peso_bruto_kg) > 0)) throw new AppError('peso_bruto_kg debe ser > 0', 422);
    if (!g.motivo_traslado_cod) throw new AppError('Falta motivo_traslado_cod (catálogo 20)', 422);

    const [[cliente]] = await conn.query('SELECT * FROM clientes WHERE id_cliente = ?', [g.id_cliente]);
    if (!cliente) throw new AppError('Cliente de la guía no existe', 404);
    const [[empresa]] = await conn.query('SELECT * FROM empresa_config WHERE id = 1');

    // ── Transporte ─────────────────────────────────────────────────────────────
    //   · Tercero (g.id_transportista): modalidad 01 (público); CarrierParty (RUC+razón+MTC) del
    //     maestro; conductor + vehículos (hasta 2, cada uno con TUCE + autorización especial) +
    //     fecha de entrega al transportista salen del bloque de transporte de la OV.
    //   · Propio (Vehículo Empresa): modalidad 02 (privado); conductor de empleados y placa de la flota.
    const esTercero = !!g.id_transportista;
    // registrar: interruptor "registrar vehículos y conductores del transportista" (solo tercero).
    // default 1 (Caso 2/3); 0 = Caso 1 (solo transportista, él emite su GRE 31). No tercero → siempre true.
    let carrier = null, conductores = [], vehiculos = [], registrar = true;
    // Indicadores opcionales (SpecialInstructions) tomados de la OV.
    const indicadores = {
      transbordo: !!ov.transporte_ind_transbordo,
      m1l: !!ov.transporte_ind_m1l,
      retornoVacio: !!ov.transporte_ind_retorno_vacio,
    };

    if (esTercero) {
      const [[t]] = await conn.query(
        'SELECT ruc, razon_social, numero_mtc FROM transportistas WHERE id_transportista = ?', [g.id_transportista]);
      if (!t?.ruc || !t?.razon_social) throw new AppError('Falta el transportista (RUC y razón social)', 422);
      if (!/^\d{11}$/.test(String(t.ruc))) throw new AppError('RUC del transportista inválido (11 dígitos)', 422);
      carrier = { ruc: t.ruc, razon: t.razon_social, mtc: t.numero_mtc || null };
      registrar = ov.transporte_registrar !== 0; // default 1 (Caso 2/3)
      if (registrar) {
        // Caso 2/3: se declaran conductor(es) principal + secundario y vehículo(s).
        if (ov.transporte_dni) conductores.push({ dni: ov.transporte_dni, nombre: ov.transporte_conductor, licencia: ov.transporte_licencia });
        if (ov.transporte_dni2) conductores.push({ dni: ov.transporte_dni2, nombre: ov.transporte_conductor2, licencia: ov.transporte_licencia2 });
        // Vehículo principal + opcional secundario (carreta); cada uno TUCE (RegistrationNationalityID)
        // + autorización especial (ShipmentDocumentReference).
        vehiculos = [{
          placa: normalizarPlaca(ov.transporte_placa),
          tuce: ov.transporte_tuc || null,
          autorizacion: ov.transporte_autorizacion || null
        }];
        const placa2 = normalizarPlaca(ov.transporte_placa2);
        if (placa2) vehiculos.push({ placa: placa2, tuce: ov.transporte_tuc2 || null, autorizacion: ov.transporte_autorizacion2 || null });
      }
      // Caso 1 (registrar=false): conductores/vehiculos quedan vacíos → solo CarrierParty en el XML.
    } else if (g.transporte_modo === 'particular' || g.transporte_placa) {
      // Modalidad 02 (privado) con vehículo/conductor de TEXTO LIBRE: el cliente (o un particular
      // que NO es empresa de transporte) traslada con su propio carro/camioneta. Estructura idéntica
      // al vehículo propio (DriverPerson + TransportEquipment, SIN CarrierParty). Calcado del XML
      // aceptado docs/20550932297-09-EG07-256.xml.
      conductores = [{ dni: g.transporte_dni, nombre: g.transporte_conductor, licencia: g.transporte_licencia }];
      vehiculos = [{ placa: normalizarPlaca(g.transporte_placa), tuce: null, autorizacion: null }];
    } else {
      const [[cRow]] = g.id_conductor
        ? await conn.query('SELECT dni, nombre_completo, licencia_conducir FROM empleados WHERE id_empleado = ?', [g.id_conductor])
        : [[null]];
      const [[vRow]] = g.id_vehiculo
        ? await conn.query('SELECT placa FROM flota WHERE id_vehiculo = ?', [g.id_vehiculo])
        : [[null]];
      conductores = cRow ? [{ dni: cRow.dni, nombre: cRow.nombre_completo, licencia: cRow.licencia_conducir }] : [];
      vehiculos = vRow ? [{ placa: normalizarPlaca(vRow.placa), tuce: null, autorizacion: null }] : [];
    }
    // ¿Se declaran vehículos y conductores? No tercero siempre; tercero solo si registrar=true.
    const declararVC = !esTercero || registrar;
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

    // Modalidad de traslado (catálogo 18): 01 público para tercero, 02 privado para vehículo propio.
    const modalidad = esTercero ? '01' : '02';

    // Ubigeos de partida/llegada: 6 dígitos (catálogo INEI). Siempre obligatorios (independiente del modo).
    if (!ubigeoValido(g.ubigeo_partida)) throw new AppError(`Ubigeo de partida inválido: "${g.ubigeo_partida}" (6 dígitos)`, 422);
    if (!ubigeoValido(g.ubigeo_llegada)) throw new AppError(`Ubigeo de llegada inválido: "${g.ubigeo_llegada}" (6 dígitos)`, 422);

    if (declararVC) {
      // Caso 2/3 (o privado): conductor principal + placa obligatorios; secundario opcional.
      const c0 = conductores[0];
      if (!c0?.dni || !c0?.nombre || !c0?.licencia) {
        throw new AppError('Faltan datos del conductor (DNI, nombre y licencia de conducir)', 422);
      }
      // Validación de FORMATO de cada conductor (corre antes de reservar el correlativo → no lo quema).
      for (const c of conductores) {
        if (!dniValido(c.dni)) throw new AppError(`DNI del conductor inválido: "${c.dni}" (deben ser 8 dígitos)`, 422);
        if (!c.nombre || !c.licencia) throw new AppError('Conductor secundario incompleto (faltan nombre y/o licencia)', 422);
      }
      // Placa del vehículo principal normalizada. En PROD es obligatoria; en BETA se usa un
      // placeholder solo para el mock (no válido en PROD).
      if (!vehiculos[0]?.placa) {
        if (sunatConfig.mode === 'PROD') throw new AppError('Falta la placa del vehículo', 422);
        vehiculos = [{ placa: 'XXX000', tuce: null, autorizacion: null }];
      } else if (!placaValida(vehiculos[0].placa)) {
        throw new AppError(`Placa inválida: "${vehiculos[0].placa}" (6 a 8 caracteres alfanuméricos; el guion y los espacios se ignoran)`, 422);
      }
      // Placa del vehículo secundario (carreta) si viene: mismo formato.
      if (vehiculos[1]?.placa && !placaValida(vehiculos[1].placa)) {
        throw new AppError(`Placa del vehículo secundario inválida: "${vehiculos[1].placa}" (6 a 8 caracteres alfanuméricos)`, 422);
      }
    } else {
      // Caso 1 (tercero sin registrar veh/cond): no se declaran; basta el transportista (ya validado).
      conductores = []; vehiculos = [];
    }

    // Fecha de entrega de bienes al transportista (LoadingTransportEvent, solo tercero); si no se
    // capturó, se usa la fecha de traslado.
    const fechaEntregaTransportista = esTercero ? (ov.transporte_fecha_entrega || fechaTraslado) : null;

    // Observación → cbc:Note. Si el panel envía `observaciones` (editable, prellenado con la OC),
    // se usa TAL CUAL y se persiste en la guía (el PDF luego muestra lo persistido = lo enviado).
    // Si no viene (API antigua), se compone del texto libre de la guía + OC de la OV.
    const observacion = observacionOverride !== undefined
      ? String(observacionOverride).replace(/[\r\n]+/g, ' ').trim().slice(0, 250)
      : componerObservacionGuia(g.observaciones, ov?.orden_compra_cliente);
    if (observacionOverride !== undefined) {
      await conn.query('UPDATE guias_remision SET observaciones = ? WHERE id_guia = ?', [observacion, idGuia]);
    }

    const numero = await obtenerCorrelativo(conn, tipo, serie);
    const datos = {
      tipo, serie, numero, empresa, cliente, guia: g, detalle,
      fecha: { emision, hora }, fechaTraslado, modalidad,
      transportista: carrier, registrarTransportista: registrar, fechaEntregaTransportista,
      conductores, vehiculos, indicadores,
      observacion
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
