import { withTransaction } from '../../config/database.js';
import { parsearCdr } from './cdr.service.js';
import { registrarSunatLog } from './log.service.js';
import { subirRaw } from '../cloudinary.service.js';
import { copiaLocal } from './util.service.js';
import { ahoraLima } from './fecha.service.js';
import { sunatConfig } from '../../config/sunat.js';

export async function marcarOrdenFacturada(conn, { idOrdenVenta, serie, numero, idEmpleado = null, fecha = null }) {
  if (!idOrdenVenta) return;
  await conn.query(
    `UPDATE ordenes_venta SET facturado_sunat = 1, fecha_facturacion_sunat = ?,
       numero_comprobante_sunat = ?, id_facturador = COALESCE(?, id_facturador) WHERE id_orden_venta = ?`,
    [fecha || ahoraLima(), `${serie}-${numero}`, idEmpleado, idOrdenVenta]);
}

export async function liberarOrdenFacturada(conn, idOrdenVenta) {
  if (!idOrdenVenta) return;
  await conn.query(
    `UPDATE ordenes_venta SET facturado_sunat = 0, fecha_facturacion_sunat = NULL,
       numero_comprobante_sunat = NULL, id_facturador = NULL WHERE id_orden_venta = ?`,
    [idOrdenVenta]);
}

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
      if (codigoTipo === '01') await liberarOrdenFacturada(conn, idOrdenVenta);
    }
  });

  await registrarSunatLog({ origen: 'BAJA', referenciaId: idBaja, evento,
    exito: aceptado, httpStatus: 200, detalle: `${st.statusCode} ${descripcion}`.slice(0, 4000), duracionMs });

  return { aceptado, estado: aceptado ? 'ACEPTADO' : 'RECHAZADO',
    responseCode: cdr?.responseCode ?? String(st.statusCode), descripcion, cdrUrl };
}

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
