// services/sunat/gre-anulacion.service.js — FASE 12: dejar sin efecto / reemplazar GRE Remitente.
//
// Reglas SUNAT (GRE 2.0): NO existe "comunicación de baja" para guías. Por eso:
//  - anularGuiaRemision (dejar sin efecto): es un cambio de estado PURAMENTE INTERNO, sin llamada
//    a SUNAT (no existe ni existirá una baja GRE que mockear/enchufar en Fase 16).
//  - reemplazarGuiaRemision: se implementa aparte (emite una GRE nueva vía el core de emisión).
//
// Sincronización de estado (acordada): al dejar sin efecto se marca sunat_estado='ANULADA' Y el
// estado de negocio='Anulada'. La distinción anulada-vs-reemplazada vive en sunat_estado.
import { withTransaction } from '../../config/database.js';
import { registrarSunatLog } from './log.service.js';
import { emitirGuiaGre } from './gre-emision.service.js';
import { obtenerCorrelativo } from './numeracion.service.js';
import { ahoraLima } from './fecha.service.js';
import AppError from '../../utils/AppError.js';

/**
 * Deja sin efecto una GRE Remitente ACEPTADA cuyo traslado NO ha iniciado.
 * @param {number} idGuia
 * @param {object} opts
 * @param {string} opts.motivo       obligatorio
 * @param {number|null} opts.idEmpleado  auditoría (anulado_por)
 * @param {boolean} opts.esAdmin     permite forzar si el traslado ya inició (En Tránsito/Entregada)
 * @returns {Promise<object>} resumen de la anulación
 */
export async function anularGuiaRemision(idGuia, { motivo, idEmpleado = null, esAdmin = false } = {}) {
  if (!idGuia) throw new AppError('id de guía inválido', 400);
  const motivoLimpio = String(motivo || '').trim();
  if (!motivoLimpio) throw new AppError('Debe indicar el motivo para dejar sin efecto la guía', 400);

  const resultado = await withTransaction(async (conn) => {
    const [[g]] = await conn.query('SELECT * FROM guias_remision WHERE id_guia = ? FOR UPDATE', [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);

    // Ya invalidada.
    if (g.sunat_estado === 'ANULADA') throw new AppError('La guía ya está sin efecto (ANULADA)', 409);
    if (g.sunat_estado === 'REEMPLAZADA') throw new AppError('La guía ya fue reemplazada; no aplica dejar sin efecto', 409);

    // Solo una GRE ACEPTADA por SUNAT se deja sin efecto (si no llegó a aceptarse, no hay nada que anular).
    if (g.sunat_estado !== 'ACEPTADO') {
      throw new AppError(`Solo se puede dejar sin efecto una guía ACEPTADA por SUNAT (estado actual: ${g.sunat_estado})`, 422);
    }

    // Precondición de negocio: el traslado NO debe haber iniciado (estado 'Emitida').
    const forzado = g.estado !== 'Emitida';
    if (forzado) {
      if (g.estado === 'Anulada') throw new AppError('La guía ya está anulada', 409);
      // 'En Tránsito' / 'Entregada' → el traslado ya inició → corresponde GRE por Eventos (fuera de
      // alcance). Solo un Administrador puede forzar dejarla sin efecto.
      if (!esAdmin) {
        throw new AppError(
          `El traslado ya inició (estado "${g.estado}"): dejar sin efecto requiere autorización de un Administrador. ` +
          `Si el traslado realmente ocurrió, corresponde una GRE por Eventos desde el portal SUNAT.`, 403);
      }
    }

    const fecha = ahoraLima();
    await conn.query(
      `UPDATE guias_remision
         SET sunat_estado = 'ANULADA', estado = 'Anulada',
             motivo_anulacion = ?, anulado_por = ?, fecha_anulacion = ?
       WHERE id_guia = ?`,
      [motivoLimpio.slice(0, 500), idEmpleado, fecha, idGuia]);

    return {
      idGuia,
      numeroGuia: g.numero_guia,
      comprobante: g.serie_sunat && g.numero_sunat ? `${g.serie_sunat}-${g.numero_sunat}` : null,
      sunatEstado: 'ANULADA',
      estado: 'Anulada',
      estadoAnterior: g.estado,
      forzadoPorAdmin: forzado,
      motivo: motivoLimpio,
      fechaAnulacion: fecha
    };
  });

  await registrarSunatLog({
    origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'dejarSinEfecto',
    exito: true, httpStatus: 200,
    detalle: `SIN EFECTO (ANULADA)${resultado.forzadoPorAdmin ? ' [forzado por Admin]' : ''}. Motivo: ${resultado.motivo}`.slice(0, 4000),
    duracionMs: 0
  });
  return resultado;
}

/**
 * Reemplaza una GRE Remitente ACEPTADA por una NUEVA guía corregida (GRE 2.0 no tiene baja).
 * Flujo robusto ante interrupciones:
 *  - En la MISMA transacción que crea la guía nueva se marca la original con id_guia_reemplazo
 *    (+ anulado_por + motivo), pero sunat_estado/estado NO cambian: la original sigue VÁLIDA hasta
 *    que la nueva sea ACEPTADA. Así un crash entre creación y emisión deja la original detectable
 *    como "reemplazo en curso" (id_guia_reemplazo IS NOT NULL AND sunat_estado='ACEPTADO').
 *  - La emisión de la nueva pasa por emitirGuiaGre; cerrarTicketGre finaliza (ACEPTADA→original
 *    REEMPLAZADA) o aborta (RECHAZADA→original vuelve a quedar vigente) automáticamente. Un ticket
 *    202 pendiente se reconcilia por el mismo cerrarTicketGre vía verificarEstadoGuia o el job F15.
 * @param {number} idGuia  guía original
 * @param {object} opts { correcciones?, idEmpleado?, esAdmin? }
 * @returns {Promise<{httpStatus:number, body:object}>}
 */
export async function reemplazarGuiaRemision(idGuia, { correcciones = {}, idEmpleado = null, esAdmin = false } = {}) {
  if (!idGuia) throw new AppError('id de guía inválido', 400);

  // ── TX: validar original + crear guía nueva (clon + correcciones) + marca "reemplazo en curso" ──
  const { nuevaId, nuevoNumeroGuia } = await withTransaction(async (conn) => {
    const [[g]] = await conn.query('SELECT * FROM guias_remision WHERE id_guia = ? FOR UPDATE', [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);
    if (g.sunat_estado === 'REEMPLAZADA') throw new AppError('La guía ya fue reemplazada', 409);
    if (g.sunat_estado === 'ANULADA') throw new AppError('La guía está sin efecto; no aplica reemplazo', 409);
    if (g.sunat_estado !== 'ACEPTADO') {
      throw new AppError(`Solo se reemplaza una guía ACEPTADA por SUNAT (estado actual: ${g.sunat_estado})`, 422);
    }
    if (g.id_guia_reemplazo) throw new AppError('Ya hay un reemplazo en curso o completado para esta guía', 409);

    // Precondición de negocio: traslado no iniciado (o forzado por Admin).
    if (g.estado !== 'Emitida') {
      if (g.estado === 'Anulada') throw new AppError('La guía ya está anulada', 409);
      if (!esAdmin) {
        throw new AppError(
          `El traslado ya inició (estado "${g.estado}"): reemplazar requiere autorización de un Administrador.`, 403);
      }
    }

    // Numeración interna: correlativo atómico dedicado (fila 'GR'/'T001' en series_correlativos),
    // mismo patrón que createGuiaRemision. Ya estamos dentro de la TX de reemplazo, así que usamos
    // obtenerCorrelativo(conn, ...): el UPDATE toma el row-lock de la serie hasta el commit.
    const numeroSecuencia = await obtenerCorrelativo(conn, 'GR', 'T001');
    const nuevoNumeroGuia = `T001-${String(numeroSecuencia).padStart(8, '0')}`;

    // fecha_traslado como string (evita corrimiento de zona del driver al re-insertar el Date).
    const [[ftRow]] = await conn.query("SELECT DATE_FORMAT(fecha_traslado, '%Y-%m-%d') AS f FROM guias_remision WHERE id_guia = ?", [idGuia]);
    const c = correcciones || {};
    const val = (k, def) => (c[k] !== undefined && c[k] !== null ? c[k] : def);

    const [ins] = await conn.query(
      `INSERT INTO guias_remision
        (numero_guia, id_orden_venta, id_factura, id_cliente, id_conductor, id_vehiculo, fecha_traslado,
         punto_partida, punto_llegada, tipo_traslado, motivo_traslado, modalidad_transporte,
         direccion_partida, ubigeo_partida, direccion_llegada, ubigeo_llegada, ciudad_llegada,
         peso_bruto_kg, numero_bultos, observaciones, motivo_traslado_cod,
         doc_relacionado_tipo, doc_relacionado_num, estado, sunat_estado)
       VALUES (?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?, 'Emitida', 'PENDIENTE')`,
      [nuevoNumeroGuia, g.id_orden_venta, g.id_factura, g.id_cliente,
       val('id_conductor', g.id_conductor), val('id_vehiculo', g.id_vehiculo), val('fecha_traslado', ftRow?.f),
       g.punto_partida, g.punto_llegada, g.tipo_traslado, g.motivo_traslado, g.modalidad_transporte,
       val('direccion_partida', g.direccion_partida), val('ubigeo_partida', g.ubigeo_partida),
       val('direccion_llegada', g.direccion_llegada), val('ubigeo_llegada', g.ubigeo_llegada), val('ciudad_llegada', g.ciudad_llegada),
       val('peso_bruto_kg', g.peso_bruto_kg), val('numero_bultos', g.numero_bultos),
       val('observaciones', g.observaciones), val('motivo_traslado_cod', g.motivo_traslado_cod),
       g.doc_relacionado_tipo, g.doc_relacionado_num]);
    const nuevaId = ins.insertId;

    // Clonar el detalle de la guía original.
    await conn.query(
      `INSERT INTO detalle_guia_remision
         (id_guia, id_detalle_orden, id_producto, cantidad, unidad_medida, descripcion, peso_unitario_kg, peso_total_kg)
       SELECT ?, id_detalle_orden, id_producto, cantidad, unidad_medida, descripcion, peso_unitario_kg, peso_total_kg
         FROM detalle_guia_remision WHERE id_guia = ?`, [nuevaId, idGuia]);

    // MARCA TEMPRANA de "reemplazo en curso" (misma TX). No se toca sunat_estado/estado todavía.
    await conn.query(
      `UPDATE guias_remision SET id_guia_reemplazo = ?, anulado_por = ?, motivo_anulacion = ? WHERE id_guia = ?`,
      [nuevaId, idEmpleado, `Reemplazo en curso por la guía ${nuevoNumeroGuia}`.slice(0, 500), idGuia]);

    return { nuevaId, nuevoNumeroGuia };
  });

  await registrarSunatLog({
    origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'reemplazoIniciado', exito: true, httpStatus: 200,
    detalle: `Reemplazo en curso: guía original id ${idGuia} → nueva ${nuevoNumeroGuia} (id ${nuevaId})`, duracionMs: 0
  });

  // Fuera de TX: emitir la guía nueva por el MISMO pipeline SUNAT (mock BETA → real Fase 16).
  // cerrarTicketGre finaliza/aborta la original automáticamente al resolverse el ticket.
  const emision = await emitirGuiaGre(nuevaId, idEmpleado);

  const estadoNueva = emision.body?.estado;
  const estadoOriginal = estadoNueva === 'ACEPTADO' ? 'REEMPLAZADA'
    : estadoNueva === 'ENVIADO' ? 'REEMPLAZO_EN_CURSO'  // ticket 202: reconciliar con /guias/:idNueva/estado
    : 'VIGENTE';                                          // ERROR/RECHAZADO: original sigue vigente
  return {
    httpStatus: emision.httpStatus,
    body: {
      ...emision.body,
      reemplazo: { idGuiaOriginal: idGuia, idGuiaNueva: nuevaId, numeroGuiaNueva: nuevoNumeroGuia, estadoOriginal }
    }
  };
}
