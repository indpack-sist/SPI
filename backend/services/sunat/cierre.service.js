// services/sunat/cierre.service.js — FASE 15: helpers de CIERRE / reconciliación SUNAT (fuente única).
//
// Toda transición de un comprobante hacia su estado final (ACEPTADO/RECHAZADO/BAJA) y la marca
// correspondiente en su Orden de Venta pasa por AQUÍ, para que el flujo SÍNCRONO (controller:
// emitirComprobante / darDeBajaFactura / verificarEstado) y el ASÍNCRONO (job de reintentos) no
// puedan divergir. Es un requisito de cumplimiento SUNAT: una FACTURA (01) ACEPTADA SIEMPRE deja su
// OV marcada como facturada; una BAJA aceptada SIEMPRE anula la factura y libera la OV si era 01.
//
// Cada helper: (1) traduce la respuesta cruda de SUNAT a estado interno, (2) sube el CDR best-effort,
// (3) persiste en una transacción propia y (4) registra en sunat_log. Devuelve un resumen para que
// el llamador arme su respuesta HTTP o sus contadores, sin reimplementar la lógica.
import { withTransaction } from '../../config/database.js';
import { parsearCdr } from './cdr.service.js';
import { registrarSunatLog } from './log.service.js';
import { subirRaw } from '../cloudinary.service.js';
import { copiaLocal } from './util.service.js';
import { ahoraLima } from './fecha.service.js';
import { sunatConfig } from '../../config/sunat.js';

// ── Marcas en la Orden de Venta (definición única) ───────────────────────────

/**
 * Marca la OV como facturada electrónicamente (su FACTURA 01 fue ACEPTADA por SUNAT).
 * Debe llamarse dentro de una transacción (recibe `conn`).
 */
export async function marcarOrdenFacturada(conn, { idOrdenVenta, serie, numero, idEmpleado = null, fecha = null }) {
  if (!idOrdenVenta) return;
  await conn.query(
    `UPDATE ordenes_venta SET facturado_sunat = 1, fecha_facturacion_sunat = ?,
       numero_comprobante_sunat = ?, id_facturador = COALESCE(?, id_facturador) WHERE id_orden_venta = ?`,
    [fecha || ahoraLima(), `${serie}-${numero}`, idEmpleado, idOrdenVenta]);
}

/**
 * Libera la OV para re-facturar sobre la misma (su FACTURA 01 fue dada de BAJA por error de
 * digitación). El STOCK no se toca aquí a propósito: los ajustes de inventario son un proceso de
 * negocio aparte. Debe llamarse dentro de una transacción (recibe `conn`).
 */
export async function liberarOrdenFacturada(conn, idOrdenVenta) {
  if (!idOrdenVenta) return;
  await conn.query(
    `UPDATE ordenes_venta SET facturado_sunat = 0, fecha_facturacion_sunat = NULL,
       numero_comprobante_sunat = NULL, id_facturador = NULL WHERE id_orden_venta = ?`,
    [idOrdenVenta]);
}

// ── Cierre de Comunicación de Baja (RA) desde un getStatus(ticket) resuelto ───

/**
 * Cierra una RA a partir de un getStatus(ticket) YA resuelto (statusCode distinto de '98').
 * Persiste sunat_bajas y, si es aceptada, marca la factura BAJA/Anulada y libera la OV cuando el
 * comprobante era una FACTURA (01).
 * @param {{statusCode:string, cdrZip:Buffer|null}} st  respuesta de soap.getStatus.
 * @param {object} ctx  { idBaja, identificador, idFactura, codigoTipo, idOrdenVenta, evento?, duracionMs? }
 * @returns {Promise<{aceptado:boolean, estado:string, responseCode:string, descripcion:string, cdrUrl:string|null}>}
 */
export async function cerrarBajaDesdeStatus(st, ctx) {
  const { idBaja, identificador, idFactura, codigoTipo, idOrdenVenta,
          evento = 'getStatus', duracionMs = 0 } = ctx;
  const cdr = st.cdrZip ? parsearCdr(st.cdrZip) : null;
  const aceptado = st.statusCode === '0' && cdr?.responseCode === '0';
  const descripcion = (cdr?.description || `statusCode ${st.statusCode}`) +
    (cdr?.notas?.length ? ' | OBS: ' + cdr.notas.join('; ') : '');

  let cdrUrl = null;
  if (st.cdrZip) {
    const nombre = `${sunatConfig.ruc}-${identificador}`;
    try { cdrUrl = await subirRaw(st.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
    catch (e) { console.warn('[SUNAT] subir CDR baja falló:', e.message); }
    await copiaLocal(`R-${nombre}.zip`, st.cdrZip);
  }

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE sunat_bajas SET estado = ?, response_code = ?, response_desc = ?, cdr_url = ? WHERE id_baja = ?`,
      [aceptado ? 'ACEPTADO' : 'RECHAZADO', cdr?.responseCode ?? String(st.statusCode),
       descripcion.slice(0, 4000), cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, idBaja]);
    if (aceptado && idFactura) {
      await conn.query(
        `UPDATE facturas_venta SET sunat_estado = 'BAJA', estado = 'Anulada', id_baja = ? WHERE id_factura = ?`,
        [idBaja, idFactura]);
      // Solo una FACTURA (01) libera su OV; en una NOTA (07/08) la factura original sigue vigente.
      if (codigoTipo === '01') await liberarOrdenFacturada(conn, idOrdenVenta);
    }
  });

  await registrarSunatLog({ origen: 'BAJA', referenciaId: idBaja, evento,
    exito: aceptado, httpStatus: 200, detalle: `${st.statusCode} ${descripcion}`.slice(0, 4000), duracionMs });

  return { aceptado, estado: aceptado ? 'ACEPTADO' : 'RECHAZADO',
    responseCode: cdr?.responseCode ?? String(st.statusCode), descripcion, cdrUrl };
}

// ── Reconciliación de FACTURA/NOTA ENVIADO desde un getStatusCdr resuelto ─────

/**
 * Reconcilia una FACTURA/NOTA que quedó ENVIADO a partir de un getStatusCdr YA resuelto (statusCode
 * final: 0001 aceptado · 0002 rechazado · 0003 baja). El llamador debe descartar antes los estados
 * NO finales (0004 no existe · 0098 en proceso), que deben seguir ENVIADO sin reconciliar.
 * Persiste facturas_venta y —si resulta ACEPTADO y es FACTURA (01)— marca la OV como facturada.
 * @param {{statusCode:string, statusMessage?:string, cdrZip:Buffer|null}} st  respuesta de soap.getStatusCdr.
 * @param {object} ctx  { idFactura, codigoTipo, serie, numero, idOrdenVenta, idEmpleado?, evento?, origen?, duracionMs? }
 * @returns {Promise<{aceptado:boolean, estado:string, responseCode:string, descripcion:string, cdrUrl:string|null}>}
 */
export async function cerrarFacturaDesdeStatusCdr(st, ctx) {
  const { idFactura, codigoTipo, serie, numero, idOrdenVenta, idEmpleado = null,
          evento = 'getStatusCdr', origen = 'FACTURA', duracionMs = 0 } = ctx;
  const cdr = st.cdrZip ? parsearCdr(st.cdrZip) : null;
  const aceptado = st.statusCode === '0001';
  const estado = aceptado ? 'ACEPTADO' : (st.statusCode === '0003' ? 'BAJA' : 'RECHAZADO');
  const descripcion = (cdr?.description || st.statusMessage || `statusCode ${st.statusCode}`) +
    (cdr?.notas?.length ? ' | OBS: ' + cdr.notas.join('; ') : '');

  let cdrUrl = null;
  if (st.cdrZip) {
    const nombre = `${sunatConfig.ruc}-${codigoTipo}-${serie}-${numero}`;
    try { cdrUrl = await subirRaw(st.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
    catch (e) { console.warn('[SUNAT] subir CDR factura falló:', e.message); }
  }

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE facturas_venta SET sunat_estado = ?, sunat_response_code = ?, sunat_response_desc = ?,
         cdr_url = COALESCE(?, cdr_url) WHERE id_factura = ?`,
      [estado, cdr?.responseCode ?? st.statusCode, descripcion.slice(0, 4000),
       cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, idFactura]);
    if (aceptado && codigoTipo === '01') {
      await marcarOrdenFacturada(conn, { idOrdenVenta, serie, numero, idEmpleado });
    }
  });

  await registrarSunatLog({ origen, referenciaId: idFactura, evento,
    exito: aceptado, httpStatus: 200, detalle: `${st.statusCode} ${descripcion}`.slice(0, 4000), duracionMs });

  return { aceptado, estado, responseCode: cdr?.responseCode ?? st.statusCode, descripcion, cdrUrl };
}
