// jobs/sunat-reintentos.job.js — FASE 15: cola de reintentos / reconciliación SUNAT.
//
// Núcleo `ejecutarReintentosSunat()` reutilizable, invocable por DOS vías (sin lock-in de infra):
//   - node-cron en proceso (gateado por env SUNAT_CRON_ENABLED=true), y
//   - endpoint POST /api/sunat/jobs/tick (token interno) para un scheduler externo (Render Cron,
//     cron-job.org, GitHub Actions) — recomendado en Render free, donde el servicio se duerme.
//
// Reconcilia los 3 orígenes que pueden quedar ENVIADO/ticket-abierto tras un fault/timeout:
//   1) GRE (guias_remision): consultarGuia(ticket) → cerrarTicketGre  [reuso íntegro de Fase 10/12].
//   2) BAJA (sunat_bajas):   getStatus(ticket) → cierra RA + marca factura BAJA.
//   3) FACTURA (facturas_venta): getStatusCdr(tipo,serie,numero) → cierra ACEPTADO/RECHAZADO/BAJA.
//      getStatusCdr es SOLO PRODUCCIÓN (en BETA lanza 409): en BETA esta parte se omite sola.
//
// Backoff SEGURO (nunca martillea): elegibilidad por antigüedad desde sunat_fecha_envio, creciente
// con el nº de intentos (2, 7, 22, 52, 112, 232 min). Tope 6 intentos → ERROR + alerta (log).
// Toda acción escribe en sunat_log. Contingencia: un fault NO bloquea la logística; solo el RECHAZO.
import { pool, withTransaction } from '../config/database.js';
import { sunatConfig } from '../config/sunat.js';
import { getStatus, getStatusCdr } from '../services/sunat/soap.service.js';
import { consultarGuia } from '../services/sunat/gre.service.js';
import { cerrarTicketGre } from '../services/sunat/gre-emision.service.js';
import { parsearCdr } from '../services/sunat/cdr.service.js';
import { registrarSunatLog } from '../services/sunat/log.service.js';
import { subirRaw } from '../services/cloudinary.service.js';
import { ahoraLima } from '../services/sunat/fecha.service.js';
import { copiaLocal } from '../services/sunat/util.service.js';

const MAX_INTENTOS = 6;
// Minutos mínimos desde sunat_fecha_envio para el intento nº k (índice = intentos ya hechos).
const BACKOFF_MIN = [2, 7, 22, 52, 112, 232];

const minutosDesde = (fecha) => fecha ? (Date.now() - new Date(fecha).getTime()) / 60000 : Infinity;
const debido = (intentos, fechaEnvio) => minutosDesde(fechaEnvio) >= (BACKOFF_MIN[Math.min(intentos, BACKOFF_MIN.length - 1)] ?? 232);

// Alerta de reintentos agotados (6º fallo). Sin notificador genérico aún → log ERROR + consola.
async function alertarAgotado(origen, referenciaId, detalle) {
  console.error(`[SUNAT][REINTENTOS] AGOTADO ${origen} #${referenciaId}: ${detalle}`);
  await registrarSunatLog({ origen, referenciaId, evento: 'reintentoAgotado', exito: false,
    httpStatus: null, detalle: String(detalle).slice(0, 4000), duracionMs: 0 });
}

// ── 1) GRE con ticket abierto ────────────────────────────────────────────────
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
      await cerrarTicketGre(g.id_guia, nombre, g.sunat_ticket, st, t0); // reuso íntegro
      resumen.gre.cerrados++;
    } catch (e) {
      await registrarSunatLog({ origen: 'GRE_REMITENTE', referenciaId: g.id_guia, evento: 'reintentoConsultarGuia',
        exito: false, httpStatus: e.httpStatus || null, detalle: e.message, duracionMs: Date.now() - t0 });
      await marcarIntento('guias_remision', 'id_guia', g, resumen.gre);
    }
  }
}

// ── 2) BAJA (RA) con ticket abierto ──────────────────────────────────────────
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
    // RA no tiene sunat_fecha_envio: el backoff aquí es la propia cadencia del cron (cada corrida = 1
    // intento) acotada por el tope de `intentos`. Menos fino que el de factura/GRE, suficiente para RA.
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

    const cdr = st.cdrZip ? parsearCdr(st.cdrZip) : null;
    const aceptado = st.statusCode === '0' && cdr?.responseCode === '0';
    const descripcion = (cdr?.description || `statusCode ${st.statusCode}`) +
      (cdr?.notas?.length ? ' | OBS: ' + cdr.notas.join('; ') : '');
    let cdrUrl = null;
    if (st.cdrZip) {
      const nombre = `${sunatConfig.ruc}-${b.identificador}`;
      try { cdrUrl = await subirRaw(st.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
      catch (e) { console.warn('[SUNAT] subir CDR baja (job) falló:', e.message); }
      await copiaLocal(`R-${nombre}.zip`, st.cdrZip);
    }
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE sunat_bajas SET estado = ?, response_code = ?, response_desc = ?, cdr_url = ? WHERE id_baja = ?`,
        [aceptado ? 'ACEPTADO' : 'RECHAZADO', cdr?.responseCode ?? String(st.statusCode),
         descripcion.slice(0, 4000), cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, b.id_baja]);
      if (aceptado && b.id_factura) {
        await conn.query(
          `UPDATE facturas_venta SET sunat_estado = 'BAJA', estado = 'Anulada', id_baja = ? WHERE id_factura = ?`,
          [b.id_baja, b.id_factura]);
        if (b.codigo_tipo_sunat === '01' && b.id_orden_venta) {
          await conn.query(
            `UPDATE ordenes_venta SET facturado_sunat = 0, fecha_facturacion_sunat = NULL,
               numero_comprobante_sunat = NULL, id_facturador = NULL WHERE id_orden_venta = ?`,
            [b.id_orden_venta]);
        }
      }
    });
    await registrarSunatLog({ origen: 'BAJA', referenciaId: b.id_baja, evento: 'reintentoGetStatus',
      exito: aceptado, httpStatus: 200, detalle: `${st.statusCode} ${descripcion}`.slice(0, 4000), duracionMs: Date.now() - t0 });
    resumen.ra.cerrados++;
  }
}

// ── 3) FACTURA/NOTA ENVIADO (getStatusCdr, SOLO PROD) ────────────────────────
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
    const nombre = `${sunatConfig.ruc}-${f.codigo_tipo_sunat}-${f.serie}-${f.numero}`;
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
    // 0001 aceptado · 0002 rechazado · 0003 baja · 0004 no existe · 0098 en proceso
    if (st.statusCode === '0098' || st.statusCode === '0004') {
      await marcarIntento('facturas_venta', 'id_factura', { id_factura: f.id_factura, sunat_intentos: f.sunat_intentos }, resumen.factura, 'FACTURA', false);
      continue;
    }
    const cdr = st.cdrZip ? parsearCdr(st.cdrZip) : null;
    const aceptado = st.statusCode === '0001';
    const estadoFinal = aceptado ? 'ACEPTADO' : (st.statusCode === '0003' ? 'BAJA' : 'RECHAZADO');
    const descripcion = (cdr?.description || st.statusMessage || `statusCode ${st.statusCode}`) +
      (cdr?.notas?.length ? ' | OBS: ' + cdr.notas.join('; ') : '');
    let cdrUrl = null;
    if (st.cdrZip) {
      try { cdrUrl = await subirRaw(st.cdrZip, `sunat/cdr/R-${nombre}.zip`); }
      catch (e) { console.warn('[SUNAT] subir CDR factura (job) falló:', e.message); }
    }
    await withTransaction(async (conn) => {
      await conn.query(
        `UPDATE facturas_venta SET sunat_estado = ?, sunat_response_code = ?, sunat_response_desc = ?,
           cdr_url = COALESCE(?, cdr_url) WHERE id_factura = ?`,
        [estadoFinal, cdr?.responseCode ?? st.statusCode, descripcion.slice(0, 4000),
         cdrUrl ? JSON.stringify({ url: cdrUrl }) : null, f.id_factura]);
      if (aceptado && f.codigo_tipo_sunat === '01' && f.id_orden_venta) {
        await conn.query(
          `UPDATE ordenes_venta SET facturado_sunat = 1, fecha_facturacion_sunat = ?,
             numero_comprobante_sunat = ? WHERE id_orden_venta = ?`,
          [ahoraLima(), `${f.serie}-${f.numero}`, f.id_orden_venta]);
      }
    });
    await registrarSunatLog({ origen: 'FACTURA', referenciaId: f.id_factura, evento: 'reintentoGetStatusCdr',
      exito: aceptado, httpStatus: 200, detalle: `${st.statusCode} ${descripcion}`.slice(0, 4000), duracionMs: Date.now() - t0 });
    resumen.factura.cerrados++;
  }
}

// Incrementa intentos de una fila con columna sunat_intentos; al llegar al tope alerta. `setError`
// pone sunat_estado='ERROR' solo donde el ENUM lo admite (guias_remision sí; facturas_venta NO se
// arriesga → queda ENVIADO para revisión manual, con la descripción marcada).
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

// Idem para sunat_bajas (columna `intentos`, no `sunat_intentos`; estado ERROR propio del enum RA).
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

/**
 * Punto de entrada del job. Idempotente y seguro para correr en paralelo con la operación normal.
 * @returns {Promise<object>} resumen de lo revisado/cerrado por origen.
 */
export async function ejecutarReintentosSunat() {
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
  return resumen;
}

// Registro opcional del cron en proceso (gateado por env). Llamar una vez desde server.js.
export function registrarCronReintentos() {
  if (String(process.env.SUNAT_CRON_ENABLED).toLowerCase() !== 'true') {
    console.log('[SUNAT][REINTENTOS] node-cron deshabilitado (SUNAT_CRON_ENABLED != true); usar POST /api/sunat/jobs/tick');
    return null;
  }
  // Import perezoso: node-cron solo se carga si se habilita.
  return import('node-cron').then(({ default: cron }) => {
    const tarea = cron.schedule('*/5 * * * *', () => { ejecutarReintentosSunat().catch(e => console.error('[SUNAT][REINTENTOS] cron:', e.message)); },
      { timezone: 'America/Lima' });
    console.log('[SUNAT][REINTENTOS] node-cron activo (cada 5 min, America/Lima)');
    return tarea;
  }).catch(e => { console.error('[SUNAT][REINTENTOS] no se pudo iniciar node-cron:', e.message); return null; });
}
