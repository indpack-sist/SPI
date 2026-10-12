import { executeQuery } from '../config/database.js';
import { notificarPrecioFueraDeLista, notificarPrecioFueraDeListaCotizacion } from '../utils/notificacionesHelper.js';

const ESTADOS_CERRADOS = ['Despacho Parcial', 'Despachada', 'Entregada', 'Cancelada'];
const ESTADOS_COTIZACION_CERRADOS = ['Rechazada', 'Vencida', 'Convertida'];
const round4 = (n) => Math.round(parseFloat(n) * 10000) / 10000;

export async function revisarPreciosFueraDeLista(idOrden, { io = null, actorId = null } = {}) {
  try {
    const ordenRes = await executeQuery(
      `SELECT id_orden_venta, numero_orden, estado, id_comercial, id_verificador
         FROM ordenes_venta WHERE id_orden_venta = ?`,
      [idOrden]
    );
    if (!ordenRes.success || ordenRes.data.length === 0) return;
    const orden = ordenRes.data[0];
    if (ESTADOS_CERRADOS.includes(orden.estado)) return;

    const lineasRes = await executeQuery(
      `SELECT id_detalle, id_producto, es_producto_libre, precio_unitario,
              precio_lista_snapshot, id_lista_origen, precio_fuera_lista_notificado
         FROM detalle_orden_venta WHERE id_orden_venta = ?`,
      [idOrden]
    );
    if (!lineasRes.success) return;

    const nuevasDivergencias = [];
    const aMarcar = [];
    const aLimpiar = [];

    for (const linea of lineasRes.data) {
      if (linea.es_producto_libre) continue;
      if (!linea.id_lista_origen || linea.precio_lista_snapshot == null) continue;

      const snapshot = round4(linea.precio_lista_snapshot);
      const actual = round4(linea.precio_unitario);
      const divergente = actual !== snapshot;
      const yaNotificado = linea.precio_fuera_lista_notificado != null
        && round4(linea.precio_fuera_lista_notificado) === actual;

      if (divergente && !yaNotificado) {
        nuevasDivergencias.push(linea);
        aMarcar.push({ id_detalle: linea.id_detalle, precio: linea.precio_unitario });
      } else if (!divergente && linea.precio_fuera_lista_notificado != null) {
        aLimpiar.push(linea.id_detalle);
      }
    }

    if (aLimpiar.length > 0) {
      await executeQuery(
        `UPDATE detalle_orden_venta SET precio_fuera_lista_notificado = NULL
          WHERE id_detalle IN (${aLimpiar.map(() => '?').join(',')})`,
        aLimpiar
      );
    }

    if (nuevasDivergencias.length > 0) {
      const destinatarios = [orden.id_comercial, orden.id_verificador]
        .filter(d => d && Number(d) !== Number(actorId));
      if (destinatarios.length === 0) return;

      const resumen = `${nuevasDivergencias.length} producto(s) con precio distinto al de la lista utilizada.`;
      await notificarPrecioFueraDeLista(orden.id_orden_venta, orden.numero_orden, destinatarios, resumen, io);

      for (const marca of aMarcar) {
        await executeQuery(
          `UPDATE detalle_orden_venta SET precio_fuera_lista_notificado = ? WHERE id_detalle = ?`,
          [marca.precio, marca.id_detalle]
        );
      }
    }
  } catch (error) {
    console.error('Error en revisarPreciosFueraDeLista:', error.message);
  }
}

export async function revisarPreciosFueraDeListaCotizacion(idCotizacion, { io = null, actorId = null } = {}) {
  try {
    const cotRes = await executeQuery(
      `SELECT id_cotizacion, numero_cotizacion, estado, id_comercial, id_creado_por
         FROM cotizaciones WHERE id_cotizacion = ?`,
      [idCotizacion]
    );
    if (!cotRes.success || cotRes.data.length === 0) return;
    const cot = cotRes.data[0];
    if (ESTADOS_COTIZACION_CERRADOS.includes(cot.estado)) return;

    const lineasRes = await executeQuery(
      `SELECT id_detalle, id_producto, es_producto_libre, precio_unitario,
              precio_lista_snapshot, id_lista_origen, precio_fuera_lista_notificado
         FROM detalle_cotizacion WHERE id_cotizacion = ?`,
      [idCotizacion]
    );
    if (!lineasRes.success) return;

    const nuevasDivergencias = [];
    const aMarcar = [];
    const aLimpiar = [];

    for (const linea of lineasRes.data) {
      if (linea.es_producto_libre) continue;
      if (!linea.id_lista_origen || linea.precio_lista_snapshot == null) continue;

      const snapshot = round4(linea.precio_lista_snapshot);
      const actual = round4(linea.precio_unitario);
      const divergente = actual !== snapshot;
      const yaNotificado = linea.precio_fuera_lista_notificado != null
        && round4(linea.precio_fuera_lista_notificado) === actual;

      if (divergente && !yaNotificado) {
        nuevasDivergencias.push(linea);
        aMarcar.push({ id_detalle: linea.id_detalle, precio: linea.precio_unitario });
      } else if (!divergente && linea.precio_fuera_lista_notificado != null) {
        aLimpiar.push(linea.id_detalle);
      }
    }

    if (aLimpiar.length > 0) {
      await executeQuery(
        `UPDATE detalle_cotizacion SET precio_fuera_lista_notificado = NULL
          WHERE id_detalle IN (${aLimpiar.map(() => '?').join(',')})`,
        aLimpiar
      );
    }

    if (nuevasDivergencias.length > 0) {
      const destinatarios = [cot.id_comercial, cot.id_creado_por]
        .filter(d => d && Number(d) !== Number(actorId));
      if (destinatarios.length === 0) return;

      const resumen = `${nuevasDivergencias.length} producto(s) con precio distinto al de la lista utilizada.`;
      await notificarPrecioFueraDeListaCotizacion(cot.id_cotizacion, cot.numero_cotizacion, destinatarios, resumen, io);

      for (const marca of aMarcar) {
        await executeQuery(
          `UPDATE detalle_cotizacion SET precio_fuera_lista_notificado = ? WHERE id_detalle = ?`,
          [marca.precio, marca.id_detalle]
        );
      }
    }
  } catch (error) {
    console.error('Error en revisarPreciosFueraDeListaCotizacion:', error.message);
  }
}

export async function barrerPreciosFueraDeLista(io = null) {
  try {
    const candidatosRes = await executeQuery(
      `SELECT DISTINCT ov.id_orden_venta
         FROM detalle_orden_venta dov
         JOIN ordenes_venta ov ON ov.id_orden_venta = dov.id_orden_venta
        WHERE dov.id_lista_origen IS NOT NULL
          AND dov.precio_lista_snapshot IS NOT NULL
          AND dov.es_producto_libre = 0
          AND ROUND(dov.precio_unitario, 4) <> ROUND(dov.precio_lista_snapshot, 4)
          AND (dov.precio_fuera_lista_notificado IS NULL
               OR ROUND(dov.precio_fuera_lista_notificado, 4) <> ROUND(dov.precio_unitario, 4))
          AND ov.estado NOT IN ('Despacho Parcial', 'Despachada', 'Entregada', 'Cancelada')`
    );
    let revisados = 0;
    if (candidatosRes.success) {
      for (const row of candidatosRes.data) {
        await revisarPreciosFueraDeLista(row.id_orden_venta, { io });
        revisados++;
      }
    }

    const candidatosCotRes = await executeQuery(
      `SELECT DISTINCT c.id_cotizacion
         FROM detalle_cotizacion dc
         JOIN cotizaciones c ON c.id_cotizacion = dc.id_cotizacion
        WHERE dc.id_lista_origen IS NOT NULL
          AND dc.precio_lista_snapshot IS NOT NULL
          AND dc.es_producto_libre = 0
          AND ROUND(dc.precio_unitario, 4) <> ROUND(dc.precio_lista_snapshot, 4)
          AND (dc.precio_fuera_lista_notificado IS NULL
               OR ROUND(dc.precio_fuera_lista_notificado, 4) <> ROUND(dc.precio_unitario, 4))
          AND c.estado NOT IN ('Rechazada', 'Vencida', 'Convertida')`
    );

    let revisadosCot = 0;
    if (candidatosCotRes.success) {
      for (const row of candidatosCotRes.data) {
        await revisarPreciosFueraDeListaCotizacion(row.id_cotizacion, { io });
        revisadosCot++;
      }
    }

    return { revisados, revisadosCot };
  } catch (error) {
    console.error('Error en barrerPreciosFueraDeLista:', error.message);
    return { revisados: 0, revisadosCot: 0, error: error.message };
  }
}

export function registrarCronPreciosFueraDeLista(io = null) {
  if (String(process.env.PRECIOS_LISTA_CRON_ENABLED).toLowerCase() !== 'true') {
    console.log('[PRECIOS_LISTA] cron deshabilitado (PRECIOS_LISTA_CRON_ENABLED != true); detección en edición y al abrir la orden');
    return null;
  }
  return import('node-cron').then(({ default: cron }) => {
    const tarea = cron.schedule('*/15 * * * *', () => {
      barrerPreciosFueraDeLista(io).catch(e => console.error('[PRECIOS_LISTA] cron:', e.message));
    }, { timezone: 'America/Lima' });
    console.log('[PRECIOS_LISTA] cron activo (cada 15 min, America/Lima)');
    return tarea;
  }).catch(e => { console.error('[PRECIOS_LISTA] no se pudo iniciar node-cron:', e.message); return null; });
}
