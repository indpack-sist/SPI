// services/sunat/gre-anulacion.service.js — baja y sincronización de GRE Remitente.
//
// Reglas SUNAT (GRE 2.0): la baja de una GRE se realiza en SUNAT Operaciones en Línea (SOL),
// no mediante el API REST usado para emitir/consultar tickets. Por eso:
//  - anularGuiaRemision registra en SPI una baja que el usuario confirma haber completado en SOL;
//    nunca debe presentarse como una llamada automática de SPI a SUNAT.
// Sincronización de estado: al confirmar la baja se marca sunat_estado='ANULADA' y el estado de
// negocio='Anulada', conservando los archivos y la fila para el historial de la OV.
import { withTransaction } from '../../config/database.js';
import { registrarSunatLog } from './log.service.js';
import { ahoraLima } from './fecha.service.js';
import AppError from '../../utils/AppError.js';

function esFechaISOValida(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/**
 * Registra y audita en SPI una baja de GRE completada previamente en SUNAT SOL.
 * @param {number} idGuia
 * @param {object} opts
 * @param {string} opts.motivo       obligatorio
 * @param {number|null} opts.idEmpleado  auditoría (anulado_por)
 * @param {boolean} opts.confirmacionSol confirmación expresa de que la baja ya se ejecutó en SOL
 * @param {string} opts.causal       TRASLADO_NO_INICIADO | CAMBIO_DESTINATARIO
 * @param {string|null} opts.fechaBajaSunat YYYY-MM-DD, fecha informada por el usuario
 * @param {string|null} opts.evidenciaUrl URL opcional de la constancia/captura
 * @returns {Promise<object>} resumen de la anulación
 */
export async function anularGuiaRemision(idGuia, {
  motivo,
  idEmpleado = null,
  confirmacionSol = false,
  causal,
  fechaBajaSunat = null,
  evidenciaUrl = null,
  origen = 'SOL_MANUAL'
} = {}) {
  if (!idGuia) throw new AppError('id de guía inválido', 400);
  if (confirmacionSol !== true) {
    throw new AppError(
      'La baja de una GRE debe realizarse primero en SUNAT SOL. Confirma expresamente que ya fue completada para sincronizarla en SPI.',
      422
    );
  }
  const causalesPermitidas = ['TRASLADO_NO_INICIADO', 'CAMBIO_DESTINATARIO'];
  if (!causalesPermitidas.includes(causal)) {
    throw new AppError('Selecciona una causal SUNAT válida para la baja de la GRE', 400);
  }
  const motivoLimpio = String(motivo || '').trim();
  if (!motivoLimpio) throw new AppError('Debe indicar el motivo para dejar sin efecto la guía', 400);
  const fechaBaja = fechaBajaSunat ? String(fechaBajaSunat).trim() : ahoraLima().slice(0, 10);
  if (!esFechaISOValida(fechaBaja)) {
    throw new AppError('La fecha de baja SUNAT no es una fecha válida (YYYY-MM-DD)', 400);
  }
  const hoyLima = ahoraLima().slice(0, 10);
  if (fechaBaja > hoyLima) throw new AppError('La fecha de baja SUNAT no puede ser futura', 400);
  const origenLimpio = origen === 'SOL_PREVIA' ? 'SOL_PREVIA' : 'SOL_MANUAL';
  const evidencia = String(evidenciaUrl || '').trim() || null;
  if (evidencia?.length > 500) throw new AppError('La URL de evidencia no puede superar 500 caracteres', 400);
  if (evidencia) {
    let evidenciaParseada;
    try { evidenciaParseada = new URL(evidencia); }
    catch { throw new AppError('La evidencia debe ser una URL HTTP/HTTPS válida', 400); }
    if (!['http:', 'https:'].includes(evidenciaParseada.protocol)) {
      throw new AppError('La evidencia debe ser una URL HTTP/HTTPS válida', 400);
    }
  }

  const resultado = await withTransaction(async (conn) => {
    const [[g]] = await conn.query(
      "SELECT *, DATE_FORMAT(COALESCE(sunat_fecha_envio, fecha_emision), '%Y-%m-%d') AS fecha_emision_iso " +
      'FROM guias_remision WHERE id_guia = ? FOR UPDATE', [idGuia]);
    if (!g) throw new AppError('Guía no existe', 404);

    // Una fila ANULADA por el flujo antiguo puede todavía confirmarse/migrarse como baja SOL.
    if (g.sunat_estado === 'ANULADA' && Number(g.baja_sunat_confirmada) === 1) {
      throw new AppError('La baja SUNAT de esta guía ya fue confirmada en SPI', 409);
    }
    if (g.sunat_estado === 'REEMPLAZADA') throw new AppError('La guía ya fue reemplazada; no aplica dejar sin efecto', 409);

    // Solo una GRE aceptada (o una anulada por el flujo local anterior) puede sincronizarse.
    if (!['ACEPTADO', 'ANULADA'].includes(g.sunat_estado)) {
      throw new AppError(`Solo se puede dejar sin efecto una guía ACEPTADA por SUNAT (estado actual: ${g.sunat_estado})`, 422);
    }
    if (g.fecha_emision_iso && fechaBaja < g.fecha_emision_iso) {
      throw new AppError(`La fecha de baja no puede ser anterior a la emisión de la GRE (${g.fecha_emision_iso})`, 400);
    }

    const fecha = ahoraLima();
    await conn.query(
      `UPDATE guias_remision
         SET sunat_estado = 'ANULADA', estado = 'Anulada',
             motivo_anulacion = ?, anulado_por = ?, fecha_anulacion = ?,
             baja_sunat_confirmada = 1, baja_sunat_fecha = ?,
             baja_sunat_origen = ?, baja_sunat_evidencia_url = ?
       WHERE id_guia = ?`,
      [motivoLimpio.slice(0, 500), idEmpleado, fecha,
       `${fechaBaja} 00:00:00`, origenLimpio, evidencia, idGuia]);

    await conn.query(
      `INSERT INTO guias_remision_historial
         (id_guia, id_orden_venta, evento, estado_anterior, estado_nuevo,
          motivo, origen, id_usuario, evidencia_url, fecha)
       VALUES (?, ?, 'BAJA_SOL_CONFIRMADA', ?, 'ANULADA', ?, ?, ?, ?, ?)`,
      [idGuia, g.id_orden_venta || null, g.sunat_estado,
       `[${causal}] ${motivoLimpio}`.slice(0, 500), origenLimpio,
       idEmpleado, evidencia, fecha]);

    return {
      idGuia,
      numeroGuia: g.numero_guia,
      comprobante: g.serie_sunat && g.numero_sunat ? `${g.serie_sunat}-${g.numero_sunat}` : null,
      sunatEstado: 'ANULADA',
      estado: 'Anulada',
      estadoAnterior: g.estado,
      causal,
      bajaSunatConfirmada: true,
      fechaBajaSunat: fechaBaja,
      origen: origenLimpio,
      motivo: motivoLimpio,
      fechaAnulacion: fecha
    };
  });

  await registrarSunatLog({
    origen: 'GRE_REMITENTE', referenciaId: idGuia, evento: 'dejarSinEfecto',
    exito: true, httpStatus: 200,
    detalle: `BAJA SOL CONFIRMADA [${resultado.causal}]. Motivo: ${resultado.motivo}`.slice(0, 4000),
    duracionMs: 0
  });
  return resultado;
}

/**
 * Compatibilidad para llamadas internas antiguas. Emitir una nueva GRE no causa por sí solo la
 * baja de la anterior en SUNAT, por lo que este flujo queda cerrado para evitar estados ficticios.
 */
export async function reemplazarGuiaRemision() {
  throw new AppError(
    'El reemplazo automático de GRE está deshabilitado. Da de baja la original en SUNAT SOL, sincronízala en SPI y emite luego una nueva guía.',
    422
  );
}
