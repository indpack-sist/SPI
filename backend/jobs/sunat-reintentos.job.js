import { pool } from '../config/database.js';
import { sunatConfig } from '../config/sunat.js';
import { getStatus, getStatusCdr } from '../services/sunat/soap.service.js';
import { consultarGuia } from '../services/sunat/gre.service.js';
import { cerrarTicketGre } from '../services/sunat/gre-emision.service.js';
import { cerrarBajaDesdeStatus, cerrarFacturaDesdeStatusCdr } from '../services/sunat/cierre.service.js';
import { registrarSunatLog } from '../services/sunat/log.service.js';

const MAX_INTENTOS = 6;
const BACKOFF_MIN = [2, 7, 22, 52, 112, 232];

const minutosDesde = (fecha) => fecha ? (Date.now() - new Date(fecha).getTime()) / 60000 : Infinity;
const debido = (intentos, fechaEnvio) => minutosDesde(fechaEnvio) >= (BACKOFF_MIN[Math.min(intentos, BACKOFF_MIN.length - 1)] ?? 232);

async function alertarAgotado(origen, referenciaId, detalle) {
  console.error(`[SUNAT][REINTENTOS] AGOTADO ${origen} #${referenciaId}: ${detalle}`);
  await registrarSunatLog({ origen, referenciaId, evento: 'reintentoAgotado', exito: false,
    httpStatus: null, detalle: String(detalle).slice(0, 4000), duracionMs: 0 });
}

async function reconciliarGuias(resumen) {
  const [filas] = await pool.query(
    `SELECT id_guia, serie_sunat, numero_sunat, sunat_ticket, sunat_intentos, sunat_fecha_envio
       FROM guias_remision
      WHERE sunat_estado = 'ENVIADO' AND sunat_ticket IS NOT NULL AND sunat_intentos < ?`,
    [MAX_INTENTOS]);
  for (const g of filas) {
    if (!debido(g.sunat_intentos, g.sunat_fecha_envio)) continue;
    resumen.gre.revisados++;
    const nombre = `${sunatConfig.ruc}-09-${g.serie_sunat}-${g.numero_sunat}`;
    const t0 = Date.now();
    try {
      const st = await consultarGuia(g.sunat_ticket);
      if (st.codRespuesta === '98') { await marcarIntento('guias_remision', 'id_guia', g, resumen.gre); continue; }
      await cerrarTicketGre(g.id_guia, nombre, g.sunat_ticket, st, t0);
      resumen.gre.cerrados++;
    } catch (e) {
      await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: g.id_guia, evento: 'reintentoConsultarGuia',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      await marcarIntento('guias_remision', 'id_guia', g, resumen.gre);
    }
  }
}

async function reconciliarBajas(resumen) {
  const [filas] = await pool.query(
    `SELECT b.id_baja, b.identificador, b.sunat_ticket, b.intentos,
            d.id_factura, f.codigo_tipo_sunat, f.id_orden_venta
       FROM sunat_bajas b
       LEFT JOIN sunat_bajas_detalle d ON d.id_baja = b.id_baja
       LEFT JOIN facturas_venta f ON f.id_factura = d.id_factura
      WHERE b.estado = 'ENVIADO' AND b.sunat_ticket IS NOT NULL AND b.intentos < ?`,
    [MAX_INTENTOS]);
  for (const b of filas) {
    resumen.ra.revisados++;
    const t0 = Date.now();
    let st;
    try {
      st = await getStatus(b.sunat_ticket);
    } catch (e) {
      await registrarSunatLog({ origen: 'BAJA', referenciaId: b.id_baja, evento: 'reintentoGetStatus',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      await marcarIntentoBaja(b, resumen.ra);
      continue;
    }
    if (st.statusCode === '98') { await marcarIntentoBaja(b, resumen.ra); continue; }

    await cerrarBajaDesdeStatus(st, {
      idBaja: b.id_baja, identificador: b.identificador, idFactura: b.id_factura,
      codigoTipo: b.codigo_tipo_sunat, idOrdenVenta: b.id_orden_venta,
      evento: 'reintentoGetStatus', duracionMs: Date.now() - t0 });
    resumen.ra.cerrados++;
  }
}

async function reconciliarFacturas(resumen) {
  if (!sunatConfig.urls.CONSULTA_CDR) { resumen.factura.omitido = 'getStatusCdr no disponible en BETA'; return; }
  const [filas] = await pool.query(
    `SELECT id_factura, id_orden_venta, serie, numero, codigo_tipo_sunat, sunat_intentos, sunat_fecha_envio
       FROM facturas_venta
      WHERE sunat_estado = 'ENVIADO' AND sunat_intentos < ?`,
    [MAX_INTENTOS]);
  for (const f of filas) {
    if (!debido(f.sunat_intentos, f.sunat_fecha_envio)) continue;
    resumen.factura.revisados++;
    const t0 = Date.now();
    let st;
    try {
      st = await getStatusCdr(f.codigo_tipo_sunat, f.serie, f.numero);
    } catch (e) {
      await registrarSunatLog({ origen: 'FACTURA', referenciaId: f.id_factura, evento: 'reintentoGetStatusCdr',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      await marcarIntento('facturas_venta', 'id_factura', { id_factura: f.id_factura, sunat_intentos: f.sunat_intentos }, resumen.factura, 'FACTURA', false);
      continue;
    }
    if (st.statusCode === '0098' || st.statusCode === '0004') {
      await marcarIntento('facturas_venta', 'id_factura', { id_factura: f.id_factura, sunat_intentos: f.sunat_intentos }, resumen.factura, 'FACTURA', false);
      continue;
    }
    await cerrarFacturaDesdeStatusCdr(st, {
      idFactura: f.id_factura, codigoTipo: f.codigo_tipo_sunat, serie: f.serie, numero: f.numero,
      idOrdenVenta: f.id_orden_venta, evento: 'reintentoGetStatusCdr', origen: 'FACTURA',
      duracionMs: Date.now() - t0 });
    resumen.factura.cerrados++;
  }
}

async function marcarIntento(tabla, pk, fila, contador, origenLog = 'GRE_REMITENTE', setError = true) {
  const nuevos = (fila.sunat_intentos || 0) + 1;
  if (nuevos >= MAX_INTENTOS) {
    if (setError) {
      await pool.query(`UPDATE ${tabla} SET sunat_estado = 'ERROR', sunat_intentos = ? WHERE ${pk} = ?`, [nuevos, fila[pk]]);
    } else {
      await pool.query(`UPDATE ${tabla} SET sunat_intentos = ?, sunat_response_desc = 'Reintentos agotados: sin CDR tras varios intentos (revisión manual)' WHERE ${pk} = ?`, [nuevos, fila[pk]]);
    }
    contador.errores++;
    await alertarAgotado(origenLog, fila[pk], `${nuevos} intentos sin cerrar${setError ? '; marcado ERROR' : '; queda ENVIADO para revisión manual'}`);
  } else {
    await pool.query(`UPDATE ${tabla} SET sunat_intentos = ? WHERE ${pk} = ?`, [nuevos, fila[pk]]);
    contador.pendientes++;
  }
}

async function marcarIntentoBaja(b, contador) {
  const nuevos = (b.intentos || 0) + 1;
  if (nuevos >= MAX_INTENTOS) {
    await pool.query(`UPDATE sunat_bajas SET estado = 'ERROR', intentos = ? WHERE id_baja = ?`, [nuevos, b.id_baja]);
    contador.errores++;
    await alertarAgotado('BAJA', b.id_baja, `${nuevos} intentos sin cerrar; marcado ERROR`);
  } else {
    await pool.query(`UPDATE sunat_bajas SET intentos = ? WHERE id_baja = ?`, [nuevos, b.id_baja]);
    contador.pendientes++;
  }
}

function huboCambios(resumen) {
  const suma = (o) => (o?.cerrados || 0) + (o?.errores || 0);
  return suma(resumen.gre) + suma(resumen.ra) + suma(resumen.factura) > 0;
}

export async function ejecutarReintentosSunat(io = null) {
  const resumen = {
    mode: sunatConfig.mode,
    gre: { revisados: 0, cerrados: 0, pendientes: 0, errores: 0 },
    ra: { revisados: 0, cerrados: 0, pendientes: 0, errores: 0 },
    factura: { revisados: 0, cerrados: 0, pendientes: 0, errores: 0, omitido: null }
  };
  const t0 = Date.now();
  try { await reconciliarGuias(resumen); } catch (e) { console.error('[SUNAT][REINTENTOS] GRE:', e.message); }
  try { await reconciliarBajas(resumen); } catch (e) { console.error('[SUNAT][REINTENTOS] RA:', e.message); }
  try { await reconciliarFacturas(resumen); } catch (e) { console.error('[SUNAT][REINTENTOS] FACTURA:', e.message); }
  resumen.duracionMs = Date.now() - t0;
  console.log('[SUNAT][REINTENTOS] tick', JSON.stringify(resumen));
  if (io && huboCambios(resumen)) {
    try { io.emit('sunat:cambio', { origen: 'job', resumen }); } catch {}
  }
  return resumen;
}

export function registrarCronReintentos(io = null) {
  if (String(process.env.SUNAT_CRON_ENABLED).toLowerCase() !== 'true') {
    console.log('[SUNAT][REINTENTOS] node-cron deshabilitado (SUNAT_CRON_ENABLED != true); usar POST /api/sunat/jobs/tick');
    return null;
  }
  return import('node-cron').then(({ default: cron }) => {
    const tarea = cron.schedule('*/5 * * * *', () => { ejecutarReintentosSunat(io).catch(e => console.error('[SUNAT][REINTENTOS] cron:', e.message)); },
      { timezone: 'America/Lima' });
    console.log('[SUNAT][REINTENTOS] node-cron activo (cada 5 min, America/Lima)');
    return tarea;
  }).catch(e => { console.error('[SUNAT][REINTENTOS] no se pudo iniciar node-cron:', e.message); return null; });
}
