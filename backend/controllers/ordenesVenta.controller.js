import pool, { executeQuery, executeTransaction } from '../config/database.js';
import { parseSunatInvoice } from '../services/sunat-parser.service.js';
import { generarOrdenVentaPDF } from '../utils/pdfGenerators/ordenVentaPDF.js';
import { generarNotaVentaPDF } from '../utils/pdfGenerators/NotaVentaPDF.js';
import { generarPedidoVentaPDF } from '../utils/pdfGenerators/pedidoVentaPDF.js';
import { generarPDFSalida } from '../utils/pdf-generator.js';
import { subirArchivoACloudinary } from '../services/cloudinary.service.js';
import { clientePermitido } from '../utils/asignacionClientes.js';
import { anularGuiaRemision } from '../services/sunat/gre-anulacion.service.js';
import { 
  verificarOrdenAprobada, 
  esVerificador, 
  puedeEditarOrdenRechazada 
} from '../middleware/verificacionOrden.js';
import { 
  notificarNuevaOrdenPendiente,
  notificarOrdenAprobada,
  notificarOrdenRechazada,
  notificarOrdenReenviada,
  notificarPendienteMarcarSunat,
  notificarComercialDefinirComprobante,
  notificarNuevaOP
} from '../utils/notificacionesHelper.js';

const getIO = (req) => req.app.get('socketio');
function getFechaPeru() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
}

function getFechaISOPeru() {
    const peruDate = getFechaPeru();
    const year = peruDate.getFullYear();
    const month = String(peruDate.getMonth() + 1).padStart(2, '0');
    const day = String(peruDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function getAllOrdenesVenta(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, estado_verificacion, tipo_comprobante, estado_pago, estado_sunat, vendedor, filtro_moneda, search } = req.query;
    const requestedPage = Number.parseInt(req.query.page, 10);
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const paginated = Number.isInteger(requestedPage) && Number.isInteger(requestedLimit);
    const page = paginated ? Math.max(requestedPage, 1) : 1;
    const limit = paginated ? Math.min(Math.max(requestedLimit, 1), 100) : null;
    
    let sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.tipo_comprobante,
        ov.numero_comprobante,
        ov.fecha_emision,
        ov.fecha_entrega_estimada,
        ov.fecha_entrega_real,
        ov.fecha_vencimiento,
        ov.tipo_venta,
        ov.tipo_impuesto,
        ov.porcentaje_impuesto,
        ov.dias_credito,
        ov.estado,
        ov.estado_verificacion,
        ov.prioridad,
        ov.subtotal,
        ov.igv,
        ov.total,
        ov.moneda,
        ov.tipo_cambio,
        ov.monto_pagado,
        ov.estado_pago,
        ov.id_cotizacion,
        ov.stock_reservado,
        ov.orden_compra_cliente,
        ov.facturado_sunat,
        ov.fecha_facturacion_sunat,
        ov.numero_comprobante_sunat,
        ov.comprobante_sunat_url,
        ov.id_vehiculo,
        ov.id_conductor,
        ov.tipo_entrega,
        ov.transporte_nombre,
        ov.transporte_placa,
        ov.transporte_conductor,
        ov.transporte_dni,
        ov.fecha_verificacion,
        ov.motivo_rechazo,
        c.numero_cotizacion,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e_comercial.nombre_completo AS comercial,
        e_registrado.nombre_completo AS registrado_por,
        e_verificador.nombre_completo AS verificado_por,
        e_conductor.nombre_completo AS conductor,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        ov.id_comercial,
        ov.id_registrado_por,
        ov.id_verificador,
        COALESCE(dov_stats.total_items, 0) AS total_items,
        COALESCE(s_stats.total_despachos, 0) AS total_despachos,
        COALESCE(fv_stats.total_facturas, 0) AS total_facturas,
        COALESCE(fv_stats.total_facturado, 0) AS total_facturado
      FROM ordenes_venta ov
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN empleados e_verificador ON ov.id_verificador = e_verificador.id_empleado
      LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
      LEFT JOIN (
        SELECT id_orden_venta, COUNT(*) AS total_items
        FROM detalle_orden_venta
        GROUP BY id_orden_venta
      ) dov_stats ON dov_stats.id_orden_venta = ov.id_orden_venta
      LEFT JOIN (
        SELECT id_orden_venta, COUNT(*) AS total_despachos
        FROM salidas
        WHERE estado = 'Activo' AND id_orden_venta IS NOT NULL
        GROUP BY id_orden_venta
      ) s_stats ON s_stats.id_orden_venta = ov.id_orden_venta
      LEFT JOIN (
        SELECT id_orden_venta, COUNT(*) AS total_facturas, COALESCE(SUM(total), 0) AS total_facturado
        FROM facturas_venta
        WHERE estado = 'Emitida'
          AND (codigo_tipo_sunat IS NULL OR codigo_tipo_sunat NOT IN ('07','08'))
          AND (sunat_estado IS NULL OR sunat_estado = 'ACEPTADO')
        GROUP BY id_orden_venta
      ) fv_stats ON fv_stats.id_orden_venta = ov.id_orden_venta
      WHERE 1=1
    `;

    let countSql = `
      SELECT COUNT(*) AS total
      FROM ordenes_venta ov
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      const estados = estado.split(',');
      sql += ` AND ov.estado IN (${estados.map(() => '?').join(',')})`;
      params.push(...estados);
    }

    if (estado_pago) {
      const estadosPago = estado_pago.split(',');
      sql += ` AND ov.estado_pago IN (${estadosPago.map(() => '?').join(',')})`;
      params.push(...estadosPago);
    }

    if (filtro_moneda) {
      const monedas = filtro_moneda.split(',').map(m => m.trim().toUpperCase());
      sql += ` AND ov.moneda IN (${monedas.map(() => '?').join(',')})`;
      params.push(...monedas);
    }
    
    if (tipo_comprobante) {
      const tipos = tipo_comprobante.split(',');
      const tieneSinComprobante = tipos.includes('Sin Comprobante');
      const otrosTipos = tipos.filter(t => t !== 'Sin Comprobante');
      
      sql += ' AND (';
      let conditions = [];
      
      if (tieneSinComprobante) {
        conditions.push("(ov.tipo_comprobante IS NULL OR ov.tipo_comprobante = '')");
      }
      
      if (otrosTipos.length > 0) {
        conditions.push(`ov.tipo_comprobante IN (${otrosTipos.map(() => '?').join(',')})`);
        params.push(...otrosTipos);
      }
      
      sql += conditions.join(' OR ') + ')';
    }

    if (vendedor) {
      const vendedores = vendedor.split(',');
      sql += ` AND ov.id_comercial IN (${vendedores.map(() => '?').join(',')})`;
      params.push(...vendedores);
    }

    if (estado_sunat) {
      const estadosSunat = estado_sunat.split(',');
      const tieneFacturado = estadosSunat.includes('Facturado');
      const tienePendiente = estadosSunat.includes('Pendiente');
      const tieneNoAmerita = estadosSunat.includes('No Amerita');

      sql += ' AND (';
      let sunatConditions = [];

      if (tieneFacturado) {
        sunatConditions.push("(ov.facturado_sunat = 1)");
      }
      if (tienePendiente) {
        sunatConditions.push("(ov.tipo_comprobante = 'Factura' AND (ov.facturado_sunat IS NULL OR ov.facturado_sunat = 0))");
      }
      if (tieneNoAmerita) {
        sunatConditions.push("(ov.tipo_comprobante = 'Nota de Venta' OR ov.tipo_comprobante IS NULL OR ov.tipo_comprobante = '')");
      }

      sql += sunatConditions.join(' OR ') + ')';
    }
    
    if (fecha_inicio) {
      sql += ` AND ov.fecha_emision >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND ov.fecha_emision < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(fecha_fin);
    }

    if (estado_verificacion) {
      const estadosVerif = estado_verificacion.split(',');
      sql += ` AND ov.estado_verificacion IN (${estadosVerif.map(() => '?').join(',')})`;
      params.push(...estadosVerif);
    }

    if (search) {
      sql += ` AND (ov.numero_orden LIKE ? OR ov.numero_comprobante LIKE ? OR ov.numero_comprobante_sunat LIKE ? OR c.numero_cotizacion LIKE ? OR cl.razon_social LIKE ? OR cl.ruc LIKE ? OR e_comercial.nombre_completo LIKE ? OR e_registrado.nombre_completo LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term, term, term);
    }

    const whereStart = sql.indexOf('      WHERE 1=1');
    const orderStart = sql.indexOf(' ORDER BY ', whereStart);
    const filtersSql = sql.slice(whereStart + '      WHERE 1=1'.length, orderStart === -1 ? sql.length : orderStart);
    countSql += filtersSql;
    const summarySql = countSql.replace(
      'SELECT COUNT(*) AS total',
      `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN ov.estado != 'Cancelada' AND ov.estado_verificacion = 'Aprobada' AND ov.moneda = 'PEN' AND ov.tipo_comprobante = 'Factura' AND (ov.tipo_impuesto NOT IN ('INA','EXO','INAFECTO','EXONERADO','0','LIBRE') OR ov.numero_orden IN ('OV-2026-0380','OV-2026-0277','OV-2026-0162','OV-2026-0093')) THEN ov.total ELSE 0 END), 0) AS facturas_pen,
        COALESCE(SUM(CASE WHEN ov.estado != 'Cancelada' AND ov.estado_verificacion = 'Aprobada' AND ov.moneda = 'USD' AND ov.tipo_comprobante = 'Factura' AND (ov.tipo_impuesto NOT IN ('INA','EXO','INAFECTO','EXONERADO','0','LIBRE') OR ov.numero_orden IN ('OV-2026-0380','OV-2026-0277','OV-2026-0162','OV-2026-0093')) THEN ov.total ELSE 0 END), 0) AS facturas_usd,
        COALESCE(SUM(CASE WHEN ov.estado != 'Cancelada' AND ov.estado_verificacion = 'Aprobada' AND ov.moneda = 'PEN' AND (ov.tipo_comprobante = 'Nota de Venta' OR (ov.tipo_comprobante = 'Factura' AND ov.tipo_impuesto IN ('INA','EXO','INAFECTO','EXONERADO','0','LIBRE') AND ov.numero_orden NOT IN ('OV-2026-0380','OV-2026-0277','OV-2026-0162','OV-2026-0093'))) THEN COALESCE(ov.subtotal, ov.total) ELSE 0 END), 0) AS notas_venta_pen,
        COALESCE(SUM(CASE WHEN ov.estado != 'Cancelada' AND ov.estado_verificacion = 'Aprobada' AND ov.moneda = 'USD' AND (ov.tipo_comprobante = 'Nota de Venta' OR (ov.tipo_comprobante = 'Factura' AND ov.tipo_impuesto IN ('INA','EXO','INAFECTO','EXONERADO','0','LIBRE') AND ov.numero_orden NOT IN ('OV-2026-0380','OV-2026-0277','OV-2026-0162','OV-2026-0093'))) THEN COALESCE(ov.subtotal, ov.total) ELSE 0 END), 0) AS notas_venta_usd,
        COALESCE(SUM(CASE WHEN ov.estado != 'Cancelada' AND ov.estado_verificacion = 'Aprobada' AND ov.moneda = 'PEN' AND (ov.tipo_comprobante IS NULL OR ov.tipo_comprobante = '' OR ov.tipo_comprobante = 'Sin Comprobante') THEN COALESCE(ov.subtotal, ov.total) ELSE 0 END), 0) AS sin_comprobante_pen,
        COALESCE(SUM(CASE WHEN ov.estado != 'Cancelada' AND ov.estado_verificacion = 'Aprobada' AND ov.moneda = 'USD' AND (ov.tipo_comprobante IS NULL OR ov.tipo_comprobante = '' OR ov.tipo_comprobante = 'Sin Comprobante') THEN COALESCE(ov.subtotal, ov.total) ELSE 0 END), 0) AS sin_comprobante_usd,
        DATE_FORMAT(MIN(CASE WHEN ov.estado != 'Cancelada' THEN ov.fecha_emision END), '%Y-%m-%d') AS fecha_minima,
        DATE_FORMAT(MAX(CASE WHEN ov.estado != 'Cancelada' THEN ov.fecha_emision END), '%Y-%m-%d') AS fecha_maxima`
    );
    
    sql += ` ORDER BY ov.fecha_emision DESC, ov.id_orden_venta DESC`;
    if (paginated) {
      sql += ` LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    }

    const dataParams = params;
    const [result, countResult, summaryResult] = await Promise.all([
      executeQuery(sql, dataParams),
      paginated ? executeQuery(countSql, params) : Promise.resolve(null),
      paginated ? executeQuery(summarySql, params) : Promise.resolve(null)
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    if (paginated && (!countResult?.success || !summaryResult?.success)) {
      return res.status(500).json({ success: false, error: countResult?.error || summaryResult?.error });
    }
    
    res.json({
      success: true,
      data: result.data,
      summary: paginated ? summaryResult.data[0] : undefined,
      pagination: paginated ? {
        page,
        limit,
        total: Number(countResult?.data?.[0]?.total || 0),
        totalPages: Math.ceil(Number(countResult?.data?.[0]?.total || 0) / limit)
      } : undefined
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getOrdenVentaById(req, res) {
  try {
    const { id } = req.params;

    const ordenPromise = executeQuery(`
  SELECT 
    ov.*,
    cl.razon_social AS cliente,
    cl.ruc AS ruc_cliente,
    cl.direccion_despacho AS direccion_cliente,
    cl.telefono AS telefono_cliente,
    e.nombre_completo AS comercial,
    e_conductor.nombre_completo AS conductor_nombre,
    e_verificador.nombre_completo AS verificado_por,
    e_facturador.nombre_completo AS facturado_por,
    f.placa AS vehiculo_placa_interna,
    f.marca_modelo AS vehiculo_modelo,
    f.capacidad_kg AS vehiculo_capacidad_kg,
    c.numero_cotizacion
  FROM ordenes_venta ov
  LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
  LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
  LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
  LEFT JOIN empleados e_verificador ON ov.id_verificador = e_verificador.id_empleado
  LEFT JOIN empleados e_facturador ON ov.id_facturador = e_facturador.id_empleado
  LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
  LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
  WHERE ov.id_orden_venta = ?
`, [id]);

    const detallePromise = executeQuery(`
      SELECT 
        dov.*,
        dov.cantidad_despachada,
        (dov.cantidad - dov.cantidad_despachada) AS cantidad_pendiente,
        dov.subtotal AS valor_venta,
        CASE
            WHEN dov.precio_base > 0 THEN
                ROUND(((dov.precio_unitario - dov.precio_base) / dov.precio_base) * 100, 2)
            ELSE 0.00
        END AS margen_visual_porcentaje,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.requiere_receta,
        p.stock_actual AS stock_disponible,
        p.peso_unitario,
        ti.nombre AS tipo_inventario_nombre,
        (SELECT COUNT(*) FROM ordenes_produccion WHERE id_orden_venta_origen = ? AND id_producto_terminado = dov.id_producto AND estado != 'Cancelada') AS tiene_op
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id, id]);

    const [ordenResult, detalleResult] = await Promise.all([ordenPromise, detallePromise]);

    if (!ordenResult.success) {
      return res.status(500).json({
        success: false,
        error: ordenResult.error
      });
    }

    if (ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    const estadosConDespacho = ['Despacho Parcial', 'Despachada', 'Entregada'];
    const mostrarAlertaStock = !estadosConDespacho.includes(orden.estado);

    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: detalleResult.error
      });
    }

    orden.detalle = detalleResult.data;
    orden.mostrar_alerta_stock = mostrarAlertaStock;

    res.json({
      success: true,
      data: orden
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function reservarStockOrden(req, res) {
  try {
    const { id } = req.params;

    const detalleResult = await executeQuery(`
      SELECT 
        dov.id_detalle, 
        dov.id_producto, 
        dov.cantidad, 
        COALESCE(dov.cantidad_reservada, 0) AS cantidad_reservada_actual,
        dov.stock_reservado AS estado_reserva_item,
        p.stock_actual, 
        p.nombre, 
        p.requiere_receta 
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
    `, [id]);

    if (!detalleResult.success || detalleResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada o sin detalles' });
    }

    const detalles = detalleResult.data;
    const productosParaReservar = [];

    for (const item of detalles) {
      const stockEnAlmacen = parseFloat(item.stock_actual || 0);
      const cantidadRequerida = parseFloat(item.cantidad);
      const yaReservado = parseFloat(item.cantidad_reservada_actual);

      const stockTotalDisponibleParaLinea = stockEnAlmacen + yaReservado;

      let estadoSugerido = 'sin_stock';
      let cantidadSugerida = yaReservado;

      if (yaReservado >= cantidadRequerida - 0.001) {
        estadoSugerido = 'completo';
      } else if (yaReservado > 0) {
        estadoSugerido = 'parcial';
      } else {
        if (stockEnAlmacen >= cantidadRequerida) {
             cantidadSugerida = cantidadRequerida;
             estadoSugerido = 'completo'; 
        } else if (stockEnAlmacen > 0) {
             cantidadSugerida = stockEnAlmacen; 
             estadoSugerido = 'parcial';
        } else {
             cantidadSugerida = 0;
             estadoSugerido = item.requiere_receta === 1 ? 'requiere_produccion' : 'sin_stock';
        }
      }

      productosParaReservar.push({
        id_producto: item.id_producto,
        id_detalle: item.id_detalle,
        nombre: item.nombre,
        cantidad_requerida: cantidadRequerida,
        stock_maximo_disponible: stockTotalDisponibleParaLinea, 
        cantidad_ya_reservada: yaReservado,
        cantidad_reservable: cantidadSugerida, 
        estado_reserva: estadoSugerido
      });
    }

    const resumen = {
      total_items: productosParaReservar.length,
      con_stock_completo: productosParaReservar.filter(p => p.estado_reserva === 'completo').length,
      con_stock_parcial: productosParaReservar.filter(p => p.estado_reserva === 'parcial').length,
      sin_stock: productosParaReservar.filter(p => p.estado_reserva === 'sin_stock').length,
      requieren_produccion: productosParaReservar.filter(p => p.estado_reserva === 'requiere_produccion').length
    };

    res.json({
      success: true,
      data: {
        productos: productosParaReservar,
        resumen: resumen
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function ejecutarReservaStock(req, res) {
  try {
    const { id } = req.params;
    const { productos_a_reservar } = req.body;

    const ordenCheck = await executeQuery('SELECT estado, estado_verificacion FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const orden = ordenCheck.data[0];

    if (orden.estado === 'Cancelada') {
       return res.status(400).json({ error: 'No se puede modificar reservas de una orden cancelada' });
    }

    if (orden.estado_verificacion !== 'Aprobada') {
      return res.status(400).json({ 
        success: false, 
        error: 'Solo se puede reservar stock en órdenes aprobadas' 
      });
    }

    if (!productos_a_reservar || productos_a_reservar.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay datos para procesar' });
    }

    const queries = [];
    
    const estadoActualResult = await executeQuery(
      'SELECT id_detalle, id_producto, cantidad, COALESCE(cantidad_reservada, 0) as reservado_bd FROM detalle_orden_venta WHERE id_orden_venta = ?',
      [id]
    );
    
    const mapaActual = {};
    if (estadoActualResult.success) {
        estadoActualResult.data.forEach(row => {
            mapaActual[row.id_detalle] = {
                id_producto: row.id_producto,
                reservado: parseFloat(row.reservado_bd),
                requerido: parseFloat(row.cantidad)
            };
        });
    }

    for (const item of productos_a_reservar) {
      const infoActual = mapaActual[item.id_detalle];
      if (!infoActual) continue;

      const nuevaCantidad = parseFloat(item.nueva_cantidad_reserva);
      const cantidadAnterior = infoActual.reservado;
      const diferencia = nuevaCantidad - cantidadAnterior;

      if (diferencia !== 0) {
        if (diferencia > 0) {
             const stockCheck = await executeQuery('SELECT stock_actual FROM productos WHERE id_producto = ?', [infoActual.id_producto]);
             if (stockCheck.success && stockCheck.data.length > 0) {
                 if (parseFloat(stockCheck.data[0].stock_actual) < diferencia) {
                     return res.status(400).json({ error: `Stock insuficiente para aumentar la reserva (Faltan ${diferencia - parseFloat(stockCheck.data[0].stock_actual)})` });
                 }
             }
        }
        queries.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
          params: [diferencia, item.id_producto]
        });
      }

      let nuevoEstadoItem = 0; 
      if (nuevaCantidad >= infoActual.requerido - 0.001 && nuevaCantidad > 0) {
          nuevoEstadoItem = 1; 
      } else if (nuevaCantidad > 0) {
          nuevoEstadoItem = 2; 
      }

      queries.push({
        sql: 'UPDATE detalle_orden_venta SET stock_reservado = ?, cantidad_reservada = ? WHERE id_detalle = ?',
        params: [nuevoEstadoItem, nuevaCantidad, item.id_detalle]
      });
    }

    await executeTransaction(queries);

    await executeQuery(`
        UPDATE ordenes_venta 
        SET stock_reservado = CASE 
            WHEN (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ? AND stock_reservado != 1) = 0 THEN 1 
            WHEN (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ? AND stock_reservado > 0) > 0 THEN 2 
            ELSE 0 
        END
        WHERE id_orden_venta = ?
    `, [id, id, id]);

    res.json({
      success: true,
      message: 'Reserva actualizada correctamente'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
 

export async function createOrdenVenta(req, res) {
  try {
    let {
      tipo_comprobante,
      id_cliente,
      id_cotizacion,
      fecha_emision,
      fecha_entrega_estimada,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_venta,
      dias_credito,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      id_vehiculo,
      id_conductor,
      tipo_entrega,
      transporte_nombre,
      transporte_placa,
      transporte_conductor,
      transporte_dni,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial,
      detalle,
      estado_verificacion_oc,
      es_exportacion
    } = req.body;

    if (typeof detalle === 'string') {
      try {
        detalle = JSON.parse(detalle);
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Formato de detalle inválido' });
      }
    }

    const id_registrado_por = req.user?.id_empleado || null;
    const nombre_registrador = req.user?.nombre_completo || 'Desconocido';

    let ordenCompraUrl = null;
    let comprobanteUrl = null;

    if (req.files) {
      const [ordenesCompra, comprobantes] = await Promise.all([
        Promise.all((req.files.orden_compra || []).map(file => subirArchivoACloudinary(file, 'indpack_ventas/ordenes_compra'))),
        Promise.all((req.files.comprobante || []).map(file => subirArchivoACloudinary(file, 'indpack_ventas/comprobantes')))
      ]);
      if (ordenesCompra.length > 0) ordenCompraUrl = JSON.stringify(ordenesCompra.map(resultado => resultado.secure_url));
      if (comprobantes.length > 0) comprobanteUrl = JSON.stringify(comprobantes.map(resultado => resultado.secure_url));
    }

    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({ success: false, error: 'Cliente y detalle son obligatorios' });
    }

    if (!id_registrado_por) {
      return res.status(400).json({ success: false, error: 'Usuario no autenticado' });
    }

    const [permitido, resultDoble] = await Promise.all([
      clientePermitido(id_registrado_por, id_cliente),
      executeQuery(`
        SELECT id_orden_venta FROM ordenes_venta
        WHERE id_cliente = ?
        AND id_registrado_por = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 10 SECOND)
      `, [id_cliente, id_registrado_por])
    ]);

    if (!permitido) {
      return res.status(403).json({ success: false, error: 'Este cliente no forma parte de tu cartera asignada. Contacta al administrador para que te lo asigne.' });
    }

    if (resultDoble.success && resultDoble.data.length > 0) {
      return res.status(429).json({ success: false, error: 'Se detectó una creación duplicada. Por favor espere unos segundos.' });
    }

    let idVehiculoFinal = null;
    let idConductorFinal = null;
    let transNombreFinal = null;
    let transPlacaFinal = null;
    let transCondFinal = null;
    let transDniFinal = null;

    if (tipo_entrega === 'Vehiculo Empresa') {
      idVehiculoFinal = id_vehiculo || null;
      idConductorFinal = id_conductor || null;

      const [vehiculoResult, conductorResult] = await Promise.all([
        idVehiculoFinal ? executeQuery(
          'SELECT * FROM flota WHERE id_vehiculo = ? AND estado IN ("Disponible", "En Uso")',
          [idVehiculoFinal]
        ) : Promise.resolve(null),
        idConductorFinal ? executeQuery(
          'SELECT * FROM empleados WHERE id_empleado = ? AND rol = "Conductor" AND estado = "Activo"',
          [idConductorFinal]
        ) : Promise.resolve(null)
      ]);

      if (idVehiculoFinal) {
        if (!vehiculoResult.success || vehiculoResult.data.length === 0) {
          return res.status(404).json({ success: false, error: 'Vehículo no encontrado o no disponible' });
        }
      }

      if (idConductorFinal) {
        if (!conductorResult.success || conductorResult.data.length === 0) {
          return res.status(404).json({ success: false, error: 'Conductor no encontrado o no activo' });
        }
      }
    } else if (tipo_entrega === 'Transporte Privado') {
      transNombreFinal = transporte_nombre || null;
      transPlacaFinal = transporte_placa || null;
      transCondFinal = transporte_conductor || null;
      transDniFinal = transporte_dni || null;
    }

    const tipoImpuestoFinal = (tipo_impuesto || 'IGV').toUpperCase().trim();
    let porcentaje = 18.00;
    if (['INAFECTO', 'EXONERADO'].includes(tipoImpuestoFinal)) {
      porcentaje = 0.00;
    } else if (tipoImpuestoFinal === 'IGV') {
      porcentaje = 18.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }

    const esNotaVenta = (typeof tipo_comprobante !== 'undefined' ? tipo_comprobante : (typeof ordenActual !== 'undefined' ? ordenActual.tipo_comprobante : '')) === 'Nota de Venta';
    // Exportación (SUNAT 0200): IGV 0%, se calcula igual que una Nota de Venta. La emisión SEE deriva
    // la afectación de es_exportacion; aquí solo cuadramos los totales de la OV con ese 0%.
    const esExport = Number((typeof es_exportacion !== 'undefined' && es_exportacion !== null) ? es_exportacion : (typeof ordenActual !== 'undefined' ? ordenActual.es_exportacion : 0)) === 1;
    const sinIgv = esNotaVenta || esExport;
    if (esExport) porcentaje = 0;

    // Totales con redondeo POR LÍNEA, igual que la factura electrónica (ver ubl.service.js
    // calcularComprobante), para que el detalle de la OV cuadre con el comprobante emitido.
    let subtotal = 0;
    let impuesto = 0;
    for (const item of detalle) {
      const cantidad = parseFloat(item.cantidad || 0);
      const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0);
      const valorVenta = cantidad * precioVenta;
      if (isNaN(valorVenta)) continue;
      const lineBase = Math.round(valorVenta * 100) / 100;             // base de la línea (2 dec)
      subtotal += lineBase;
      if (!sinIgv) impuesto += Math.round(lineBase * (porcentaje / 100) * 100) / 100;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    impuesto = Math.round(impuesto * 100) / 100;
    const total = Math.round((subtotal + impuesto) * 100) / 100;
    const ultimaOrdenPromise = executeQuery(`
      SELECT numero_orden FROM ordenes_venta ORDER BY id_orden_venta DESC LIMIT 1
    `);

    if (plazo_pago !== 'Contado') {
      const clienteInfo = await executeQuery(
        `SELECT
          cl.usar_limite_credito,
          COALESCE(cl.limite_credito_pen, 0) AS limite_pen,
          COALESCE(cl.limite_credito_usd, 0) AS limite_usd,
          COALESCE(SUM(ov.total - ov.monto_pagado), 0) AS deuda_actual
        FROM clientes cl
        LEFT JOIN ordenes_venta ov
          ON ov.id_cliente = cl.id_cliente
          AND ov.moneda = ?
          AND ov.estado != 'Cancelada'
          AND ov.estado_pago != 'Pagado'
        WHERE cl.id_cliente = ?
        GROUP BY cl.id_cliente`,
        [moneda, id_cliente]
      );
      if (clienteInfo.success && clienteInfo.data.length > 0) {
        const cliente = clienteInfo.data[0];
        if (cliente.usar_limite_credito == 1) {
          const limiteAsignado = moneda === 'USD' ? parseFloat(cliente.limite_usd) : parseFloat(cliente.limite_pen);
          const deudaActual = parseFloat(cliente.deuda_actual || 0);
          const nuevaDeudaTotal = deudaActual + total;
          
          if (nuevaDeudaTotal > limiteAsignado) {
            const disponible = Math.max(0, limiteAsignado - deudaActual);
            return res.status(400).json({
              success: false,
              error: `La orden no puede ser procesada por exceso de crédito. El cliente tiene un límite de ${moneda} ${limiteAsignado.toLocaleString('es-PE', {minimumFractionDigits: 2})}, de los cuales ya ha utilizado ${moneda} ${deudaActual.toLocaleString('es-PE', {minimumFractionDigits: 2})}. El crédito disponible actual es de ${moneda} ${disponible.toLocaleString('es-PE', {minimumFractionDigits: 2})}, pero esta orden requiere ${moneda} ${total.toLocaleString('es-PE', {minimumFractionDigits: 2})}.`
            });
          }
        }
      }
    }

    const ultimaResult = await ultimaOrdenPromise;

    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) numeroSecuencia = parseInt(match[1]) + 1;
    }

    const numeroOrden = `OV-${getFechaPeru().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;

    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal && fecha_emision) {
      const fechaBase = new Date(fecha_emision + 'T12:00:00');
      fechaBase.setDate(fechaBase.getDate() + (parseInt(dias_credito) || 0));
      fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }

    const detalleValues = detalle.map(item => {
      const cantidad = parseFloat(item.cantidad || 0);
      const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0);
      const precioBase = parseFloat(item.precio_base || 0);
      return [item.id_producto, cantidad, precioVenta, precioBase, 0, 0];
    });

    const connection = await pool.getConnection();
    let idOrden;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(`
        INSERT INTO ordenes_venta (
          numero_orden, tipo_comprobante, numero_comprobante, id_cliente, id_cotizacion,
          fecha_emision, fecha_entrega_estimada, fecha_vencimiento, prioridad, moneda,
          tipo_cambio, tipo_impuesto, porcentaje_impuesto, tipo_venta, dias_credito,
          plazo_pago, forma_pago, orden_compra_cliente, orden_compra_url, comprobante_url,
          id_vehiculo, id_conductor, tipo_entrega, transporte_nombre, transporte_placa,
          transporte_conductor, transporte_dni, direccion_entrega, lugar_entrega, ciudad_entrega,
          contacto_entrega, telefono_entrega, observaciones, id_comercial, id_registrado_por,
          subtotal, igv, total, estado, estado_verificacion, stock_reservado,
          estado_verificacion_oc, verificado_oc_por, fecha_verificacion_oc, es_exportacion
        ) VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'En Espera', 'Pendiente', 0, ?, ?, ?, ?)
      `, [
        numeroOrden, id_cliente, id_cotizacion || null,
        fecha_emision, fecha_entrega_estimada || null, fechaVencimientoFinal, prioridad || 'Media', moneda,
        parseFloat(tipo_cambio || 1.0000), tipoImpuestoFinal, porcentaje, tipo_venta || 'Contado', parseInt(dias_credito || 0),
        plazo_pago, forma_pago, orden_compra_cliente || null, ordenCompraUrl, comprobanteUrl,
        idVehiculoFinal, idConductorFinal, tipo_entrega || 'Vehiculo Empresa', transNombreFinal, transPlacaFinal,
        transCondFinal, transDniFinal, direccion_entrega, lugar_entrega, ciudad_entrega,
        contacto_entrega, telefono_entrega, observaciones, id_comercial || null, id_registrado_por,
        subtotal, impuesto, total,
        estado_verificacion_oc || 'Sin verificar',
        estado_verificacion_oc === 'Verificado' ? (id_registrado_por || null) : null,
        estado_verificacion_oc === 'Verificado' ? getFechaPeru() : null,
        esExport ? 1 : 0
      ]);
      idOrden = result.insertId;
      await connection.query(
        `INSERT INTO detalle_orden_venta (
          id_orden_venta, id_producto, cantidad, precio_unitario, precio_base,
          descuento_porcentaje, stock_reservado
        ) VALUES ?`,
        [detalleValues.map(values => [idOrden, ...values])]
      );
      if (id_cotizacion) {
        await connection.execute(`
          UPDATE cotizaciones SET estado = 'Convertida', convertida_venta = 1, id_orden_venta = ?
          WHERE id_cotizacion = ?
        `, [idOrden, id_cotizacion]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    notificarNuevaOrdenPendiente(idOrden, numeroOrden, nombre_registrador, getIO(req)).catch(error => {
      console.error('Error al notificar nueva orden:', error.message);
    });

    res.status(201).json({
      success: true,
      data: {
        id_orden_venta: idOrden,
        numero_orden: numeroOrden,
        tipo_comprobante: 'Factura',
        numero_comprobante: null,
        orden_compra_url: ordenCompraUrl,
        comprobante_url: comprobanteUrl,
        estado_verificacion: 'Pendiente',
        stock_reservado: 0
      },
      message: 'Orden de venta creada exitosamente. Pendiente de verificación administrativa.'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
export async function updateOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    let {
      id_cliente,
      fecha_emision,
      fecha_entrega_estimada,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_venta,
      dias_credito,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      id_vehiculo,
      id_conductor,
      tipo_entrega,
      transporte_nombre,
      transporte_placa,
      transporte_conductor,
      transporte_dni,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial,
      detalle,
      estado_verificacion_oc,
      es_exportacion
    } = req.body;

    if (typeof detalle === 'string') {
      try {
        detalle = JSON.parse(detalle);
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Formato de detalle inválido' });
      }
    }

    const ordenExistente = await executeQuery(`
      SELECT estado, stock_reservado, id_cotizacion, orden_compra_url, comprobante_url, tipo_comprobante
      FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    if (!ordenExistente.success || ordenExistente.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const ordenActual = ordenExistente.data[0];

    if (ordenActual.estado === 'Cancelada') {
      return res.status(400).json({ success: false, error: 'No se puede editar una orden Cancelada' });
    }

    let nuevaOrdenCompraUrl = ordenActual.orden_compra_url;
    let nuevoComprobanteUrl = ordenActual.comprobante_url;

    // The frontend sends the remaining URLs stringified if some were deleted. 
    // If it's explicitly null string from frontend, we clear it.
    if (req.body.orden_compra_url !== undefined) {
      if (req.body.orden_compra_url === 'null' || req.body.orden_compra_url === '') {
        nuevaOrdenCompraUrl = null;
      } else {
        nuevaOrdenCompraUrl = req.body.orden_compra_url;
      }
    }
    
    if (req.body.comprobante_url !== undefined) {
      if (req.body.comprobante_url === 'null' || req.body.comprobante_url === '') {
        nuevoComprobanteUrl = null;
      } else {
        nuevoComprobanteUrl = req.body.comprobante_url;
      }
    }

    if (req.body.limpiar_oc === 'true') {
      nuevaOrdenCompraUrl = null;
    }
    if (req.body.limpiar_comprobante === 'true') {
      nuevoComprobanteUrl = null;
    }

    // Helper para concatenar URLs nuevas a un JSON existente de forma segura
    const appendUrls = (existingJson, newUrls) => {
      if (!newUrls || newUrls.length === 0) return existingJson;
      let existingArray = [];
      if (existingJson) {
         try {
           const parsed = JSON.parse(existingJson);
           existingArray = Array.isArray(parsed) ? parsed : [parsed];
         } catch(e) {
           existingArray = [existingJson]; 
         }
      }
      return JSON.stringify([...existingArray, ...newUrls]);
    };

    if (req.files) {
      const [ordenesCompra, comprobantes] = await Promise.all([
        Promise.all((req.files.orden_compra || []).map(file => subirArchivoACloudinary(file, 'indpack_ventas/ordenes_compra'))),
        Promise.all((req.files.comprobante || []).map(file => subirArchivoACloudinary(file, 'indpack_ventas/comprobantes')))
      ]);
      if (ordenesCompra.length > 0) nuevaOrdenCompraUrl = appendUrls(ordenActual.orden_compra_url, ordenesCompra.map(resultado => resultado.secure_url));
      if (comprobantes.length > 0) nuevoComprobanteUrl = appendUrls(ordenActual.comprobante_url, comprobantes.map(resultado => resultado.secure_url));
    }

    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({ success: false, error: 'Cliente y detalle son obligatorios' });
    }

    const stockReservado = ordenActual.stock_reservado === 1;
    const detalleAnteriorResult = await executeQuery(
      'SELECT id_producto, cantidad, cantidad_despachada, cantidad_reservada FROM detalle_orden_venta WHERE id_orden_venta = ?',
      [id]
    );
    const detalleAnterior = detalleAnteriorResult.success ? detalleAnteriorResult.data : [];

    const mapaDespachos = {};
    detalleAnterior.forEach(row => {
      mapaDespachos[row.id_producto] = {
        cantidad_despachada: parseFloat(row.cantidad_despachada || 0),
        cantidad_reservada: parseFloat(row.cantidad_reservada || 0)
      };
    });

    const tipoImpuestoFinal = (tipo_impuesto || 'IGV').toUpperCase().trim();
    let porcentaje = 18.00;

    if (['EXO', 'INA', 'INAFECTO', 'EXONERADO', '0', 'LIBRE'].includes(tipoImpuestoFinal)) {
      porcentaje = 0.00;
    } else if (porcentaje_impuesto !== null && porcentaje_impuesto !== undefined) {
      porcentaje = parseFloat(porcentaje_impuesto);
    }

    const esNotaVenta = (typeof tipo_comprobante !== 'undefined' ? tipo_comprobante : (typeof ordenActual !== 'undefined' ? ordenActual.tipo_comprobante : '')) === 'Nota de Venta';
    // Exportación (SUNAT 0200): IGV 0%, se calcula igual que una Nota de Venta. La emisión SEE deriva
    // la afectación de es_exportacion; aquí solo cuadramos los totales de la OV con ese 0%.
    const esExport = Number((typeof es_exportacion !== 'undefined' && es_exportacion !== null) ? es_exportacion : (typeof ordenActual !== 'undefined' ? ordenActual.es_exportacion : 0)) === 1;
    const sinIgv = esNotaVenta || esExport;
    if (esExport) porcentaje = 0;

    // Totales con redondeo POR LÍNEA, igual que la factura electrónica (ver ubl.service.js
    // calcularComprobante), para que el detalle de la OV cuadre con el comprobante emitido.
    let subtotal = 0;
    let impuesto = 0;
    let totalComision = 0;
    let sumaComisionPorcentual = 0;

    for (const item of detalle) {
      const cantidad = parseFloat(item.cantidad || 0);
      const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0);
      const valorVenta = cantidad * precioVenta;
      if (!isNaN(valorVenta)) {
        const lineBase = Math.round(valorVenta * 100) / 100;           // base de la línea (2 dec)
        subtotal += lineBase;
        if (!sinIgv) impuesto += Math.round(lineBase * (porcentaje / 100) * 100) / 100;
      }

      const precioBase = parseFloat(item.precio_base || 0);
      const pctComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (pctComision / 100);
      totalComision += montoComision * cantidad;
      sumaComisionPorcentual += pctComision;
    }

    const porcentajeComisionPromedio = detalle.length > 0 ? sumaComisionPorcentual / detalle.length : 0;

    subtotal = Math.round(subtotal * 100) / 100;
    impuesto = Math.round(impuesto * 100) / 100;
    const total = Math.round((subtotal + impuesto) * 100) / 100;

    if (plazo_pago !== 'Contado') {
      const clienteInfo = await executeQuery(
        `SELECT
          cl.usar_limite_credito,
          COALESCE(cl.limite_credito_pen, 0) AS limite_pen,
          COALESCE(cl.limite_credito_usd, 0) AS limite_usd,
          COALESCE(current_ov.monto_pagado, 0) AS monto_pagado,
          COALESCE(SUM(other_ov.total - other_ov.monto_pagado), 0) AS deuda_otras
        FROM clientes cl
        LEFT JOIN ordenes_venta current_ov ON current_ov.id_orden_venta = ?
        LEFT JOIN ordenes_venta other_ov
          ON other_ov.id_cliente = cl.id_cliente
          AND other_ov.moneda = ?
          AND other_ov.estado != 'Cancelada'
          AND other_ov.estado_pago != 'Pagado'
          AND other_ov.id_orden_venta != ?
        WHERE cl.id_cliente = ?
        GROUP BY cl.id_cliente, current_ov.monto_pagado`,
        [id, moneda, id, id_cliente]
      );

      if (clienteInfo.success && clienteInfo.data.length > 0) {
        const cliente = clienteInfo.data[0];

        if (cliente.usar_limite_credito == 1) {
          const montoPagadoActual = parseFloat(cliente.monto_pagado || 0);

          const limiteAsignado = moneda === 'USD' ? parseFloat(cliente.limite_usd) : parseFloat(cliente.limite_pen);
          const deudaOtrasOrdenes = parseFloat(cliente.deuda_otras || 0);
          const deudaEstaOrden = Math.max(0, total - montoPagadoActual);
          const nuevaDeudaTotal = deudaOtrasOrdenes + deudaEstaOrden;

          if (nuevaDeudaTotal > limiteAsignado) {
            const disponibleParaEstaOrden = Math.max(0, limiteAsignado - deudaOtrasOrdenes);
            return res.status(400).json({
              success: false,
              error: `Actualización bloqueada por exceso de crédito. El cliente tiene un límite de ${moneda} ${limiteAsignado.toLocaleString('es-PE', {minimumFractionDigits: 2})}. Considerando otras deudas (${moneda} ${deudaOtrasOrdenes.toLocaleString('es-PE', {minimumFractionDigits: 2})}), el crédito disponible para esta orden es de ${moneda} ${disponibleParaEstaOrden.toLocaleString('es-PE', {minimumFractionDigits: 2})}, pero se requieren ${moneda} ${deudaEstaOrden.toLocaleString('es-PE', {minimumFractionDigits: 2})} de saldo pendiente.`
            });
          }
        }
      }
    }

    let fechaVencimientoFinal = fecha_vencimiento;
    if (!fechaVencimientoFinal && fecha_emision) {
      const fechaBase = new Date(fecha_emision + 'T12:00:00');
      fechaBase.setDate(fechaBase.getDate() + (parseInt(dias_credito) || 0));
      fechaVencimientoFinal = fechaBase.toISOString().split('T')[0];
    }

    const tipoEntregaFinal = tipo_entrega || 'Vehiculo Empresa';

    let idVehiculoFinal = null;
    let idConductorFinal = null;
    let transporteNombreFinal = null;
    let transportePlacaFinal = null;
    let transporteConductorFinal = null;
    let transporteDniFinal = null;

    if (tipoEntregaFinal === 'Vehiculo Empresa') {
      idVehiculoFinal = id_vehiculo || null;
      idConductorFinal = id_conductor || null;
    } else if (tipoEntregaFinal === 'Transporte Privado') {
      transporteNombreFinal = transporte_nombre || null;
      transportePlacaFinal = transporte_placa || null;
      transporteConductorFinal = transporte_conductor || null;
      transporteDniFinal = transporte_dni || null;
    }

    const nuevoEstadoVerifOC = estado_verificacion_oc || 'Sin verificar';
    const idUsuarioActual = req.user?.id_empleado || null;

    const queriesNuevoDetalle = [{
      sql: `UPDATE ordenes_venta
        SET
          id_cliente = ?, fecha_emision = ?, fecha_entrega_estimada = ?, fecha_vencimiento = ?,
          prioridad = ?, moneda = ?, tipo_cambio = ?, tipo_impuesto = ?, porcentaje_impuesto = ?,
          tipo_venta = ?, dias_credito = ?, plazo_pago = ?, forma_pago = ?, orden_compra_cliente = ?,
          orden_compra_url = ?, comprobante_url = ?, id_vehiculo = ?, id_conductor = ?, tipo_entrega = ?,
          transporte_nombre = ?, transporte_placa = ?, transporte_conductor = ?, transporte_dni = ?,
          direccion_entrega = ?, lugar_entrega = ?, ciudad_entrega = ?, contacto_entrega = ?,
          telefono_entrega = ?, observaciones = ?, id_comercial = ?, subtotal = ?, igv = ?, total = ?,
          total_comision = ?, porcentaje_comision_promedio = ?, estado_verificacion_oc = ?,
          verificado_oc_por = ?, fecha_verificacion_oc = ?, es_exportacion = ?
        WHERE id_orden_venta = ?`,
      params: [
        id_cliente, fecha_emision, fecha_entrega_estimada || null, fechaVencimientoFinal,
        prioridad || 'Media', moneda, parseFloat(tipo_cambio || 1.0000), tipoImpuestoFinal, porcentaje,
        tipo_venta || 'Contado', parseInt(dias_credito || 0), plazo_pago, forma_pago || null,
        orden_compra_cliente || null, nuevaOrdenCompraUrl, nuevoComprobanteUrl, idVehiculoFinal,
        idConductorFinal, tipoEntregaFinal, transporteNombreFinal, transportePlacaFinal,
        transporteConductorFinal, transporteDniFinal, direccion_entrega, lugar_entrega, ciudad_entrega,
        contacto_entrega, telefono_entrega, observaciones, id_comercial || null, subtotal, impuesto,
        total, totalComision, porcentajeComisionPromedio, nuevoEstadoVerifOC,
        nuevoEstadoVerifOC === 'Verificado' ? idUsuarioActual : null,
        nuevoEstadoVerifOC === 'Verificado' ? getFechaPeru() : null,
        esExport ? 1 : 0, id
      ]
    }, {
      sql: 'DELETE FROM detalle_orden_venta WHERE id_orden_venta = ?',
      params: [id]
    }];

    const detalleOrdenValues = detalle.map(item => {
      const cantidad = parseFloat(item.cantidad || 0);
      const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0);
      const precioBase = parseFloat(item.precio_base || 0);
      const pctComision = parseFloat(item.porcentaje_comision || 0);
      const montoComision = precioBase * (pctComision / 100);
      const infoDespacho = mapaDespachos[item.id_producto] || { cantidad_despachada: 0, cantidad_reservada: 0 };
      return [
        id, item.id_producto, cantidad, precioVenta, precioBase,
        pctComision, montoComision, 0, stockReservado ? 1 : 0,
        infoDespacho.cantidad_despachada, infoDespacho.cantidad_reservada
      ];
    });

    queriesNuevoDetalle.push({
      sql: `INSERT INTO detalle_orden_venta (
        id_orden_venta, id_producto, cantidad, precio_unitario, precio_base,
        porcentaje_comision, monto_comision, descuento_porcentaje, stock_reservado,
        cantidad_despachada, cantidad_reservada
      ) VALUES ${detalleOrdenValues.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      params: detalleOrdenValues.flat()
    });

    if (stockReservado) {
      const productIds = [...new Set([
        ...detalleAnterior.map(item => item.id_producto),
        ...detalle.map(item => item.id_producto)
      ].filter(Boolean))];
      if (productIds.length > 0) {
        const productosResult = await executeQuery(
          `SELECT id_producto FROM productos WHERE requiere_receta = 0 AND id_producto IN (${productIds.map(() => '?').join(', ')})`,
          productIds
        );
        const productosSinReceta = new Set(productosResult.data.map(item => Number(item.id_producto)));
        const variaciones = new Map();
        for (const item of detalleAnterior) {
          const productId = Number(item.id_producto);
          if (productosSinReceta.has(productId)) {
            variaciones.set(productId, (variaciones.get(productId) || 0) + parseFloat(item.cantidad || 0));
          }
        }
        for (const item of detalle) {
          const productId = Number(item.id_producto);
          if (productosSinReceta.has(productId)) {
            variaciones.set(productId, (variaciones.get(productId) || 0) - parseFloat(item.cantidad || 0));
          }
        }
        const ajustes = [...variaciones.entries()].filter(([, cantidad]) => cantidad !== 0);
        if (ajustes.length > 0) {
          queriesNuevoDetalle.push({
            sql: `UPDATE productos SET stock_actual = stock_actual + CASE id_producto ${ajustes.map(() => 'WHEN ? THEN ?').join(' ')} ELSE 0 END WHERE id_producto IN (${ajustes.map(() => '?').join(', ')})`,
            params: [...ajustes.flatMap(([productId, cantidad]) => [productId, cantidad]), ...ajustes.map(([productId]) => productId)]
          });
        }
      }
    }

    if (ordenActual.id_cotizacion) {
      queriesNuevoDetalle.push({
        sql: 'DELETE FROM detalle_cotizacion WHERE id_cotizacion = ?',
        params: [ordenActual.id_cotizacion]
      });

      const detalleCotizacionValues = detalle.map((item, i) => {
        const cantidad = parseFloat(item.cantidad || 0);
        const precioVenta = parseFloat(item.precio_venta || item.precio_unitario || 0);
        const precioBase = parseFloat(item.precio_base || 0);
        return [ordenActual.id_cotizacion, item.id_producto, cantidad, precioVenta, precioBase, 0, i + 1];
      });

      queriesNuevoDetalle.push({
        sql: `INSERT INTO detalle_cotizacion (
          id_cotizacion, id_producto, cantidad, precio_unitario, precio_base,
          descuento_porcentaje, orden
        ) VALUES ${detalleCotizacionValues.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        params: detalleCotizacionValues.flat()
      });

      queriesNuevoDetalle.push({
        sql: `UPDATE cotizaciones 
              SET subtotal = ?, igv = ?, total = ?, 
                  total_comision = ?, porcentaje_comision_promedio = ?,
                  observaciones = ?, moneda = ?, tipo_cambio = ?
              WHERE id_cotizacion = ?`,
        params: [
          subtotal, impuesto, total,
          totalComision, porcentajeComisionPromedio,
          observaciones, moneda, parseFloat(tipo_cambio || 1.0000),
          ordenActual.id_cotizacion
        ]
      });
    }

    const resultUpdate = await executeTransaction(queriesNuevoDetalle);
    if (!resultUpdate.success) {
      return res.status(500).json({ success: false, error: resultUpdate.error });
    }

    res.json({ success: true, message: 'Orden de venta actualizada exitosamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function crearOrdenProduccionDesdeVenta(req, res) {
  try {
    const { id } = req.params;
    const { id_producto, cantidad } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    if (!id_usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    if (!id_producto || !cantidad || cantidad <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Producto y cantidad son requeridos'
      });
    }
    
    const ordenVentaResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenVentaResult.success || ordenVentaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const ordenVenta = ordenVentaResult.data[0];

    if (['Cancelada', 'Despachada', 'Entregada'].includes(ordenVenta.estado)) {
        return res.status(400).json({
          success: false,
          error: `No se puede crear una orden de producción para una orden ${ordenVenta.estado}`
        });
    }
    
    const productoResult = await executeQuery(`
      SELECT * FROM productos WHERE id_producto = ? AND requiere_receta = 1
    `, [id_producto]);
    
    if (!productoResult.success || productoResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado o no requiere producción'
      });
    }
    
    const yaExisteOPResult = await executeQuery(`
      SELECT * FROM ordenes_produccion 
      WHERE id_orden_venta_origen = ? 
      AND id_producto_terminado = ?
      AND estado != 'Cancelada'
    `, [id, id_producto]);
    
    if (yaExisteOPResult.success && yaExisteOPResult.data.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una orden de producción para este producto en esta orden de venta'
      });
    }
    
    const ultimaOPResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_produccion 
      ORDER BY id_orden DESC 
      LIMIT 1
    `);
    
    let numeroSecuenciaOP = 1;
    if (ultimaOPResult.success && ultimaOPResult.data.length > 0) {
      const match = ultimaOPResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuenciaOP = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrdenProduccion = `OP-${getFechaPeru().getFullYear()}-${String(numeroSecuenciaOP).padStart(4, '0')}`;
    
    const opResult = await executeQuery(`
      INSERT INTO ordenes_produccion (
        numero_orden,
        id_producto_terminado,
        cantidad_planificada,
        costo_materiales,
        estado,
        observaciones,
        id_orden_venta_origen,
        origen_tipo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      numeroOrdenProduccion,
      id_producto,
      cantidad,
      0,
      'Pendiente Asignación',
      `Generada desde Orden de Venta ${ordenVenta.numero_orden}`,
      id,
      'Orden de Venta'
    ]);
    
    if (!opResult.success) {
      return res.status(500).json({
        success: false,
        error: opResult.error
      });
    }
    
    const updateOVResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET estado = 'En Espera'
      WHERE id_orden_venta = ?
    `, [id]);
    
    if (!updateOVResult.success) {
      return res.status(500).json({
        success: false,
        error: updateOVResult.error
      });
    }

    const nombreProducto = productoResult.data[0].nombre;
    const rolesProduccion = ['Supervisor', 'Jefe de Planta', 'Jefe de Producción'];
    const origenInfo = `Origen: Ventas ${ordenVenta.numero_orden}. Producto: ${nombreProducto}. Cant: ${cantidad} Kg`;

    await notificarNuevaOP(opResult.data.insertId, numeroOrdenProduccion, origenInfo, rolesProduccion, getIO(req));
    
    res.status(201).json({
      success: true,
      data: {
        id_orden_produccion: opResult.data.insertId,
        numero_orden_produccion: numeroOrdenProduccion,
        estado_orden_venta: 'En Espera'
      },
      message: 'Orden de producción creada exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function registrarDespacho(req, res) {
  try {
    const { id } = req.params;
    const { detalles_despacho, fecha_despacho } = req.body;
    const id_usuario = req.user?.id_empleado || null;

    if (!detalles_despacho || detalles_despacho.length === 0) {
      return res.status(400).json({ success: false, error: 'No se han indicado productos para despachar' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });
    const orden = ordenResult.data[0];

    if (orden.estado === 'Cancelada') {
      return res.status(400).json({ error: 'No se puede despachar una orden cancelada' });
    }
    if (orden.estado === 'Entregada') {
      return res.status(400).json({ error: 'Esta orden ya fue entregada completamente' });
    }

    const itemsOrden = await executeQuery('SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?', [id]);

    let totalCosto = 0;
    let totalPrecio = 0;
    const itemsProcesados = [];

    for (const itemDespacho of detalles_despacho) {
      const itemDb = itemsOrden.data.find(i => i.id_producto === itemDespacho.id_producto);

      if (!itemDb) {
        return res.status(400).json({ 
          error: `El producto con ID ${itemDespacho.id_producto} no pertenece a esta orden de venta.` 
        });
      }

      const pendiente = parseFloat(itemDb.cantidad) - parseFloat(itemDb.cantidad_despachada || 0);
      const cantidadADespachar = parseFloat(itemDespacho.cantidad);

      if (cantidadADespachar > pendiente + 0.0001) {
        return res.status(400).json({ 
          error: `Cantidad excedida para el producto "${itemDespacho.nombre || itemDespacho.id_producto}". El saldo pendiente es de ${pendiente}, pero intentó despachar ${cantidadADespachar}.` 
        });
      }

      const productoStock = await executeQuery(
        'SELECT stock_actual, costo_unitario_promedio, nombre FROM productos WHERE id_producto = ?',
        [itemDespacho.id_producto]
      );

      if (productoStock.data.length === 0) {
        return res.status(404).json({ 
          error: `El producto "${itemDespacho.nombre || itemDespacho.id_producto}" no fue encontrado en el inventario.` 
        });
      }

      const infoProducto = productoStock.data[0];
      const estabaReservado = parseInt(itemDb.stock_reservado) === 1 || parseInt(itemDb.stock_reservado) === 2;

      if (!estabaReservado) {
        if (parseFloat(infoProducto.stock_actual) < cantidadADespachar - 0.0001) {
          return res.status(400).json({
            error: `Stock insuficiente en almacén para "${infoProducto.nombre}". Solo hay ${infoProducto.stock_actual} disponibles y se requiere despachar ${cantidadADespachar}.`
          });
        }
      }

      const costoUnitario = parseFloat(infoProducto.costo_unitario_promedio || 0);
      const precioUnitario = parseFloat(itemDb.precio_unitario || 0);

      totalCosto += cantidadADespachar * costoUnitario;
      totalPrecio += cantidadADespachar * precioUnitario;

      itemsProcesados.push({
        ...itemDespacho,
        cantidad: cantidadADespachar,
        costo_unitario: costoUnitario,
        precio_unitario: precioUnitario,
        estaba_reservado: estabaReservado
      });
    }

    // Ya no generamos el correlativo aquí, ahora es manual
    const resultCabecera = await executeTransaction([{
      sql: `INSERT INTO salidas (
        id_tipo_inventario, tipo_movimiento, id_cliente, id_orden_venta, total_costo,
        total_precio, moneda, id_registrado_por, observaciones, estado, fecha_movimiento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        3, 'Venta', orden.id_cliente, id, totalCosto, totalPrecio,
        orden.moneda, id_usuario,
        `Despacho Orden ${orden.numero_orden}`,
        'Activo', fecha_despacho || getFechaPeru()
      ]
    }]);

    if (!resultCabecera.success) return res.status(500).json({ error: resultCabecera.error });

    const idSalida = resultCabecera.data[0].insertId;
    const queriesDetalle = [];

    for (const item of itemsProcesados) {
      queriesDetalle.push({
        sql: `INSERT INTO detalle_salidas (id_salida, id_producto, cantidad, costo_unitario, precio_unitario, fue_reservado)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [idSalida, item.id_producto, item.cantidad, item.costo_unitario, item.precio_unitario, item.estaba_reservado ? 1 : 0]
      });

      if (!item.estaba_reservado) {
        queriesDetalle.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
          params: [item.cantidad, item.id_producto]
        });
      }

      if (item.estaba_reservado) {
        queriesDetalle.push({
          sql: `UPDATE detalle_orden_venta SET stock_reservado = 0, cantidad_reservada = 0
                WHERE id_orden_venta = ? AND id_producto = ?`,
          params: [id, item.id_producto]
        });
      }

      queriesDetalle.push({
        sql: `UPDATE detalle_orden_venta SET cantidad_despachada = cantidad_despachada + ?
              WHERE id_orden_venta = ? AND id_producto = ?`,
        params: [item.cantidad, id, item.id_producto]
      });
    }

    const resultDetalle = await executeTransaction(queriesDetalle);
    if (!resultDetalle.success) return res.status(500).json({ error: resultDetalle.error });

    await executeQuery('UPDATE ordenes_venta SET id_salida = ? WHERE id_orden_venta = ?', [idSalida, id]);

    const verificacion = await executeQuery(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN cantidad = cantidad_despachada THEN 1 ELSE 0 END) as items_completados
      FROM detalle_orden_venta WHERE id_orden_venta = ?
    `, [id]);

    const { total_items, items_completados } = verificacion.data[0];
    const nuevoEstado = parseInt(total_items) === parseInt(items_completados) ? 'Despachada' : 'Despacho Parcial';

    await executeQuery('UPDATE ordenes_venta SET estado = ? WHERE id_orden_venta = ?', [nuevoEstado, id]);

    if (orden.tipo_comprobante === 'Factura' && ['En espera', 'Despacho Parcial', 'Despachada', 'Entregada'].includes(nuevoEstado)) {
      await notificarPendienteMarcarSunat(id, orden.numero_orden, nuevoEstado, getIO(req));
    }

    if (orden.id_cotizacion) {
      const estadoCotizacion = nuevoEstado === 'Despachada' ? 'Despachado desde OV' : 'Despachado parcial desde OV';
      await executeQuery('UPDATE cotizaciones SET estado = ? WHERE id_cotizacion = ?', [estadoCotizacion, orden.id_cotizacion]);
    }

    res.json({
      success: true,
      message: `Despacho registrado correctamente. Orden pasó a estado: ${nuevoEstado}`,
      data: { id_salida: idSalida, nuevo_estado: nuevoEstado }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function anularDespacho(req, res) {
  try {
    const { id, idSalida } = req.params;
    const id_usuario = req.user?.id_empleado || null;
    // El usuario puede pedir anular también la guía de remisión asociada a este despacho.
    const anularGuia = req.body?.anular_guia === true || req.body?.anular_guia === 'true';
    const motivoGuia = (req.body?.motivo_guia || '').trim();
    const esAdmin = String(req.user?.rol || '').trim().toLowerCase() === 'administrador';

    if (!id_usuario) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de venta no encontrada' });
    }
    const orden = ordenResult.data[0];

    // Vinculación por FK real (id_orden_venta) con fallback por texto para salidas viejas
    // (mismo criterio que getSalidasOrden). Antes solo hacía LIKE '%numero_orden%', lo que dejaba
    // fuera las salidas de guía (su observación lleva el id de OV, no el numero_orden).
    const salidaResult = await executeQuery(
      `SELECT * FROM salidas
        WHERE id_salida = ?
          AND (id_orden_venta = ? OR observaciones LIKE ?)`,
      [idSalida, id, `%${orden.numero_orden}%`]
    );

    if (salidaResult.data.length === 0) {
      return res.status(404).json({ error: 'Salida no encontrada o no pertenece a esta orden' });
    }

    if (salidaResult.data[0].estado !== 'Activo') {
      return res.status(400).json({ error: 'Esta salida ya fue anulada' });
    }

    // ¿Este despacho proviene de una guía de remisión? El vínculo es por el texto de la
    // observación ("Despacho Guía <numero_guia> - Orden <id>"). Si el usuario pidió anular
    // también la guía, la resolvemos y validamos precondiciones ANTES de tocar el stock.
    const salida = salidaResult.data[0];
    let guiaVinculada = null;
    const mGuia = /Despacho Gu[ií]a\s+(\S+)/i.exec(salida.observaciones || '');
    if (mGuia) {
      const grRes = await executeQuery(
        'SELECT id_guia, numero_guia, estado, sunat_estado FROM guias_remision WHERE numero_guia = ? LIMIT 1',
        [mGuia[1]]
      );
      if (grRes.success && grRes.data.length > 0) guiaVinculada = grRes.data[0];
    }

    if (anularGuia) {
      if (!guiaVinculada) {
        return res.status(400).json({ error: 'No se encontró una guía de remisión asociada a este despacho.' });
      }
      if (guiaVinculada.estado === 'Anulada') {
        return res.status(400).json({ error: `La guía ${guiaVinculada.numero_guia} ya está anulada.` });
      }
      // Si la GRE fue aceptada por SUNAT, "dejar sin efecto" exige un motivo.
      if (guiaVinculada.sunat_estado === 'ACEPTADO' && !motivoGuia) {
        return res.status(400).json({ error: 'Indica el motivo para dejar sin efecto la GRE aceptada por SUNAT.' });
      }
    }

    const detalleSalida = await executeQuery(
      'SELECT * FROM detalle_salidas WHERE id_salida = ?',
      [idSalida]
    );

    const queriesReversion = [];

    for (const item of detalleSalida.data) {
      if (!item.fue_reservado) {
        queriesReversion.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [item.cantidad, item.id_producto]
        });
      } else {
        queriesReversion.push({
          sql: `UPDATE detalle_orden_venta SET stock_reservado = 1, cantidad_reservada = ?
                WHERE id_orden_venta = ? AND id_producto = ?`,
          params: [item.cantidad, id, item.id_producto]
        });
        queriesReversion.push({
          sql: 'UPDATE ordenes_venta SET stock_reservado = 1 WHERE id_orden_venta = ?',
          params: [id]
        });
      }

      queriesReversion.push({
        sql: `UPDATE detalle_orden_venta SET cantidad_despachada = GREATEST(0, cantidad_despachada - ?)
              WHERE id_orden_venta = ? AND id_producto = ?`,
        params: [item.cantidad, id, item.id_producto]
      });
    }

    queriesReversion.push({
      sql: 'UPDATE salidas SET estado = ?, observaciones = CONCAT(observaciones, " - ANULADA") WHERE id_salida = ?',
      params: ['Anulado', idSalida]
    });

    const resultReversion = await executeTransaction(queriesReversion);
    if (!resultReversion.success) return res.status(500).json({ error: resultReversion.error });

    const verificacion = await executeQuery(`
      SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN cantidad_despachada > 0 THEN 1 ELSE 0 END) as items_con_despachos,
        SUM(CASE WHEN cantidad = cantidad_despachada THEN 1 ELSE 0 END) as items_completados
      FROM detalle_orden_venta WHERE id_orden_venta = ?
    `, [id]);

    const { total_items, items_con_despachos, items_completados } = verificacion.data[0];

    let nuevoEstado = 'En Espera';
    if (parseInt(items_completados) === parseInt(total_items) && parseInt(total_items) > 0) {
      nuevoEstado = 'Despachada';
    } else if (parseInt(items_con_despachos) > 0) {
      nuevoEstado = 'Despacho Parcial';
    }

    await executeQuery('UPDATE ordenes_venta SET estado = ? WHERE id_orden_venta = ?', [nuevoEstado, id]);

    if (orden.tipo_comprobante === 'Factura' && ['En espera', 'Despacho Parcial', 'Despachada', 'Entregada'].includes(nuevoEstado)) {
      await notificarPendienteMarcarSunat(id, orden.numero_orden, nuevoEstado, getIO(req));
    }

    if (orden.id_cotizacion) {
      let estadoCotizacion = 'Convertida';
      if (nuevoEstado === 'Despacho Parcial') estadoCotizacion = 'Despachado parcial desde OV';
      else if (nuevoEstado === 'Despachada') estadoCotizacion = 'Despachado desde OV';
      await executeQuery('UPDATE cotizaciones SET estado = ? WHERE id_cotizacion = ?', [estadoCotizacion, orden.id_cotizacion]);
    }

    // Anular la guía asociada si el usuario lo pidió. Va DESPUÉS de revertir el stock/estado de
    // la OV: si la GRE estaba aceptada, "dejar sin efecto" (cambio interno, sin llamada a SUNAT)
    // exige la guía en 'Emitida', así que primero deshacemos el traslado ('En Tránsito' → 'Emitida').
    let guiaAnulada = null;
    if (anularGuia && guiaVinculada) {
      try {
        if (guiaVinculada.sunat_estado === 'ACEPTADO') {
          if (guiaVinculada.estado !== 'Emitida') {
            await executeQuery(`UPDATE guias_remision SET estado = 'Emitida' WHERE id_guia = ?`, [guiaVinculada.id_guia]);
          }
          await anularGuiaRemision(guiaVinculada.id_guia, { motivo: motivoGuia, idEmpleado: id_usuario, esAdmin });
          guiaAnulada = { numero_guia: guiaVinculada.numero_guia, sin_efecto_sunat: true };
        } else {
          // GRE no emitida/no aceptada: anulación puramente interna.
          await executeQuery(`UPDATE guias_remision SET estado = 'Anulada' WHERE id_guia = ?`, [guiaVinculada.id_guia]);
          guiaAnulada = { numero_guia: guiaVinculada.numero_guia, sin_efecto_sunat: false };
        }
      } catch (e) {
        // El despacho ya se revirtió; informamos que la guía no pudo anularse para que el usuario
        // la gestione desde su panel (p. ej. reglas de SUNAT/autorización de Administrador).
        return res.json({
          success: true,
          message: `Despacho anulado. La guía ${guiaVinculada.numero_guia} NO se pudo anular: ${e?.message || 'error'}. Gestiónala desde su panel SEE.`,
          data: { id_salida_anulada: idSalida, nuevo_estado: nuevoEstado, guia_anulada: null, guia_error: e?.message || 'error' }
        });
      }
    }

    const msgGuia = guiaAnulada
      ? ` Guía ${guiaAnulada.numero_guia} ${guiaAnulada.sin_efecto_sunat ? 'dejada SIN EFECTO en SUNAT' : 'anulada'}.`
      : '';

    res.json({
      success: true,
      message: `Despacho anulado correctamente. Orden pasó a estado: ${nuevoEstado}.${msgGuia}`,
      data: { id_salida_anulada: idSalida, nuevo_estado: nuevoEstado, guia_anulada: guiaAnulada }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function anularOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { motivo_anulacion } = req.body;
    const id_usuario = req.user?.id_empleado || null;

    if (!id_usuario) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de venta no encontrada' });
    }
    const orden = ordenResult.data[0];

    if (['Cancelada', 'Entregada'].includes(orden.estado)) {
      return res.status(400).json({ error: `No se puede anular una orden en estado ${orden.estado}` });
    }

    if (orden.estado_verificacion !== 'Aprobada') {
      return res.status(400).json({ success: false, error: 'Solo se pueden anular órdenes aprobadas' });
    }

    const queriesAnulacion = [];

    const detalleOrden = await executeQuery(
      `SELECT id_producto, cantidad, cantidad_reservada, cantidad_despachada, stock_reservado
       FROM detalle_orden_venta WHERE id_orden_venta = ?`,
      [id]
    );

    for (const item of detalleOrden.data) {
      const reservada = parseFloat(item.cantidad_reservada || 0);
      if (reservada > 0) {
        queriesAnulacion.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [reservada, item.id_producto]
        });
        queriesAnulacion.push({
          sql: 'UPDATE detalle_orden_venta SET stock_reservado = 0, cantidad_reservada = 0 WHERE id_orden_venta = ? AND id_producto = ?',
          params: [id, item.id_producto]
        });
      }
    }

    const salidasResult = await executeQuery(
      'SELECT * FROM salidas WHERE observaciones LIKE ? AND estado = ?',
      [`%${orden.numero_orden}%`, 'Activo']
    );

    for (const salida of salidasResult.data) {
      const detalleSalida = await executeQuery(
        'SELECT * FROM detalle_salidas WHERE id_salida = ?',
        [salida.id_salida]
      );

      for (const item of detalleSalida.data) {
        if (!item.fue_reservado) {
          queriesAnulacion.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            params: [item.cantidad, item.id_producto]
          });
        }
      }

      queriesAnulacion.push({
        sql: 'UPDATE salidas SET estado = ?, observaciones = CONCAT(observaciones, " - ANULADA POR CANCELACIÓN OV") WHERE id_salida = ?',
        params: ['Anulado', salida.id_salida]
      });
    }

    queriesAnulacion.push({
      sql: 'UPDATE detalle_orden_venta SET cantidad_despachada = 0 WHERE id_orden_venta = ?',
      params: [id]
    });

    const motivoFinal = motivo_anulacion || 'Sin motivo especificado';

    queriesAnulacion.push({
      sql: 'UPDATE ordenes_venta SET estado = ?, stock_reservado = 0, observaciones = CONCAT(COALESCE(observaciones, ""), " - ANULADA: ", ?) WHERE id_orden_venta = ?',
      params: ['Cancelada', motivoFinal, id]
    });

    if (orden.id_cotizacion) {
      queriesAnulacion.push({
        sql: "UPDATE cotizaciones SET estado = 'Rechazada', convertida_venta = 0, id_orden_venta = NULL WHERE id_cotizacion = ?",
        params: [orden.id_cotizacion]
      });
    }

    queriesAnulacion.push({
      sql: `UPDATE ordenes_produccion 
            SET estado = 'Cancelada',
                observaciones = CONCAT(COALESCE(observaciones, ''), ' - Cancelada autom. por anulación de OV')
            WHERE id_orden_venta_origen = ?
            AND estado NOT IN ('Cancelada', 'Terminada')`,
      params: [id]
    });

    const resultAnulacion = await executeTransaction(queriesAnulacion);
    if (!resultAnulacion.success) return res.status(500).json({ error: resultAnulacion.error });

    res.json({
      success: true,
      message: 'Orden de venta anulada correctamente y stock retornado',
      data: {
        salidas_anuladas: salidasResult.data.length,
        motivo: motivoFinal,
        produccion_anulada: true
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function actualizarEstadoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega_real } = req.body;

    const estadosValidos = ['En Espera', 'En Proceso', 'Atendido por Producción', 'Despacho Parcial', 'Despachada', 'Entregada', 'Cancelada'];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }

    const ordenResult = await executeQuery(`
      SELECT ov.*, cl.razon_social AS cliente
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }

    const orden = ordenResult.data[0];
    const estadoAnterior = orden.estado;
    let updateResult;

    if (estado === 'Entregada' && (estadoAnterior === 'Despacho Parcial' || estadoAnterior === 'Despachada')) {
      updateResult = await executeQuery(`
        UPDATE ordenes_venta 
        SET estado = ?,
            fecha_entrega_real = ?
        WHERE id_orden_venta = ?
      `, [estado, fecha_entrega_real || getFechaISOPeru(), id]);
    } else {
      updateResult = await executeQuery(`
        UPDATE ordenes_venta 
        SET estado = ?,
            fecha_entrega_real = ?
        WHERE id_orden_venta = ?
      `, [estado, fecha_entrega_real || null, id]);
    }

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

    if (orden.id_cotizacion) {
      let estadoCotizacion = null;

      if (estado === 'Despacho Parcial') estadoCotizacion = 'Despachado parcial desde OV';
      else if (estado === 'Despachada') estadoCotizacion = 'Despachado desde OV';
      else if (estado === 'Entregada') estadoCotizacion = 'Entregado desde OV';

      if (estadoCotizacion) {
        await executeQuery(
          'UPDATE cotizaciones SET estado = ? WHERE id_cotizacion = ?',
          [estadoCotizacion, orden.id_cotizacion]
        );
      }
    }

    res.json({
      success: true,
      message: `Estado actualizado a ${estado}`,
      data: { nuevo_estado: estado }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarPrioridadOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { prioridad } = req.body;
    
    const prioridadesValidas = ['Baja', 'Media', 'Alta', 'Urgente'];
    
    if (!prioridadesValidas.includes(prioridad)) {
      return res.status(400).json({
        success: false,
        error: 'Prioridad no válida. Debe ser: Baja, Media, Alta o Urgente'
      });
    }
    
    const ordenCheck = await executeQuery(`
      SELECT id_orden_venta, estado FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }

    if (ordenCheck.data[0].estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede modificar una orden Cancelada' });
    }
    
    const result = await executeQuery(`
      UPDATE ordenes_venta 
      SET prioridad = ?
      WHERE id_orden_venta = ?
    `, [prioridad, id]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: `Prioridad actualizada a ${prioridad}`,
      data: {
        prioridad
      }
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasOrdenesVenta(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN moneda = 'PEN' AND tipo_comprobante = 'Factura' AND numero_comprobante_sunat IS NOT NULL AND numero_comprobante_sunat != '' THEN total ELSE 0 END) AS facturas_pen,
        SUM(CASE WHEN moneda = 'USD' AND tipo_comprobante = 'Factura' AND numero_comprobante_sunat IS NOT NULL AND numero_comprobante_sunat != '' THEN total ELSE 0 END) AS facturas_usd,
        SUM(CASE WHEN moneda = 'PEN' AND tipo_comprobante = 'Nota de Venta' THEN total ELSE 0 END) AS notas_venta_pen,
        SUM(CASE WHEN moneda = 'USD' AND tipo_comprobante = 'Nota de Venta' THEN total ELSE 0 END) AS notas_venta_usd
      FROM ordenes_venta
      WHERE estado != 'Cancelada' AND estado_verificacion = 'Aprobada'
    `);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      data: result.data[0]
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function descargarPDFGuiaInternaSalida(req, res) {
  try {
    const { id, idSalida } = req.params;

    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente_base,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        e_conductor.nombre_completo AS conductor_nombre,
        e_conductor.dni AS conductor_dni,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const orden = ordenResult.data[0];

    const salidaResult = await executeQuery(`
      SELECT * FROM salidas 
      WHERE id_salida = ? AND observaciones LIKE ?
    `, [idSalida, `%${orden.numero_orden}%`]);

    if (!salidaResult.success || salidaResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Despacho no encontrado' });
    }

    const salida = salidaResult.data[0];

    // Extraer el correlativo GI de las observaciones
    const matchGI = salida.observaciones.match(/GI-\d{4}-\d+/);
    const numeroGuiaInterna = matchGI ? matchGI[0] : 'GI-PROV';

    const detalleResult = await executeQuery(`
      SELECT 
        ds.cantidad,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_salidas ds
      INNER JOIN productos p ON ds.id_producto = p.id_producto
      WHERE ds.id_salida = ?
      ORDER BY p.codigo
    `, [idSalida]);

    if (!detalleResult.success) {
      return res.status(500).json({ success: false, error: 'Error al obtener detalle del despacho' });
    }

    // Preparar el objeto orden simulado con los datos de la salida para el generador
    const datosOrdenParaPDF = {
      ...orden,
      fecha_emision: salida.fecha_movimiento, // Usamos la fecha del despacho
      detalle: detalleResult.data,
      direccion_entrega: orden.direccion_entrega || orden.direccion_cliente_base,
      observaciones: salida.observaciones
    };

    const { generarPDFGuiaInterna } = await import('../utils/pdfGenerators/guiaInternaPDF.js');
    const pdfBuffer = await generarPDFGuiaInterna(datosOrdenParaPDF, numeroGuiaInterna);
    
    const filename = `GuiaInterna-${numeroGuiaInterna}-${orden.numero_orden}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error en descargarPDFGuiaInternaSalida:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function descargarPDFOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { tipo } = req.query; // 'orden' o 'comprobante'

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente_base,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const orden = ordenResult.data[0];

    const detalleResult = await executeQuery(`
      SELECT 
        dov.id_detalle,
        dov.id_producto,
        dov.cantidad,
        dov.precio_unitario,
        dov.descuento_porcentaje,
        p.codigo AS codigo_producto, 
        p.nombre AS producto, 
        p.unidad_medida,
        p.peso_unitario
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.orden ASC
    `, [id]);

    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener detalle de la orden' 
      });
    }

    orden.detalle = detalleResult.data || [];

    const direccionFinal = orden.direccion_entrega && orden.direccion_entrega.trim() !== '' 
      ? orden.direccion_entrega 
      : orden.direccion_cliente_base;

    orden.direccion_entrega = direccionFinal;

    let pdfBuffer;
    let nombreArchivo;

    // 2. LÓGICA PARA SELECCIONAR EL GENERADOR CORRECTO
    // Si el frontend solicita específicamente el "comprobante" Y es una Nota de Venta
    if (tipo === 'pedido') {
        pdfBuffer = await generarPedidoVentaPDF(orden);
        nombreArchivo = `Pedido-${orden.numero_orden}.pdf`;
    }
    else if (tipo === 'comprobante' && orden.tipo_comprobante === 'Nota de Venta') {
        pdfBuffer = await generarNotaVentaPDF(orden);
        const correlativo = orden.numero_comprobante || orden.numero_orden;
        nombreArchivo = `NotaVenta-${correlativo}.pdf`;
    }
    // Si tienes un generador de Factura, agrégalo aquí con un else if
    // else if (tipo === 'comprobante' && orden.tipo_comprobante === 'Factura') { ... }
    else {
        // Por defecto o si piden tipo 'orden', genera la Orden Interna
        pdfBuffer = await generarOrdenVentaPDF(orden);
        nombreArchivo = `Orden-${orden.numero_orden}.pdf`;
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function descargarPDFDespacho(req, res) {
  try {
    const { id, idSalida } = req.params;
    // Variante valorizada (uso interno): ?valores=1 muestra precios y valor del despacho.
    const incluirValores = req.query.valores === '1' || req.query.valores === 'true';

    const ordenResult = await executeQuery(`
      SELECT 
        ov.numero_orden,
        ov.orden_compra_cliente,
        ov.direccion_entrega,
        ov.estado,
        ov.moneda,
        ov.id_cliente,
        ov.tipo_comprobante,
        ov.tipo_impuesto,
        ov.porcentaje_impuesto,
        ov.tipo_entrega,
        ov.transporte_nombre,
        ov.transporte_placa,
        ov.transporte_conductor,
        ov.transporte_dni,
        ov.transporte_licencia,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        c.numero_cotizacion,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        e_cond.nombre_completo AS conductor_nombre,
        e_cond.dni AS conductor_dni
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo 
      LEFT JOIN empleados e_cond ON ov.id_conductor = e_cond.id_empleado
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    const salidaResult = await executeQuery(`
      SELECT * FROM salidas 
      WHERE id_salida = ? AND observaciones LIKE ?
    `, [idSalida, `%${orden.numero_orden}%`]);

    if (!salidaResult.success || salidaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Salida no encontrada para esta orden'
      });
    }

    const salida = salidaResult.data[0];

    // El precio unitario se toma de detalle_orden_venta (precisión completa, hasta 6
    // decimales), no de detalle_salidas (que puede estar truncado a 2). Fallback a ds.
    const detalleResult = await executeQuery(`
      SELECT
        ds.cantidad,
        ds.costo_unitario,
        COALESCE(dov.precio_unitario, ds.precio_unitario) AS precio_unitario,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.peso_unitario
      FROM detalle_salidas ds
      INNER JOIN productos p ON ds.id_producto = p.id_producto
      LEFT JOIN detalle_orden_venta dov
        ON dov.id_orden_venta = ? AND dov.id_producto = ds.id_producto
      WHERE ds.id_salida = ?
      ORDER BY p.codigo
    `, [id, idSalida]);

    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la salida'
      });
    }

    const datosPDF = {
      id_salida: salida.id_salida,
      fecha_movimiento: salida.fecha_movimiento,
      tipo_movimiento: salida.tipo_movimiento,
      estado: salida.estado,
      observaciones: salida.observaciones,
      tipo_inventario: 'Venta',
      numero_orden: orden.numero_orden,
      oc_cliente: orden.orden_compra_cliente,
      numero_cotizacion: orden.numero_cotizacion,
      moneda: orden.moneda,
      cliente: orden.cliente,
      ruc_cliente: orden.ruc_cliente,
      direccion_despacho: orden.direccion_entrega,
      tipo_entrega: orden.tipo_entrega,
      conductor: orden.conductor_nombre,
      conductor_dni: orden.conductor_dni,
      vehiculo_placa: orden.vehiculo_placa,
      vehiculo_modelo: orden.vehiculo_modelo,
      transporte_privado_nombre: orden.transporte_nombre,
      transporte_privado_placa: orden.transporte_placa,
      transporte_privado_conductor: orden.transporte_conductor,
      transporte_privado_dni: orden.transporte_dni,
      transporte_licencia: orden.transporte_licencia,
      detalles: detalleResult.data,
      incluir_valores: incluirValores,
      tipo_impuesto: orden.tipo_impuesto,
      porcentaje_impuesto: orden.porcentaje_impuesto
    };

    const pdfBuffer = await generarPDFSalida(datosPDF);
    const filename = `GuiaRemision-${orden.numero_orden}-Despacho-${salida.id_salida}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error en descargarPDFDespacho:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
export async function registrarPagoOrden(req, res) {
  try {
    const { id } = req.params;
    const {
      fecha_pago,
      monto_pagado,
      metodo_pago,
      numero_operacion,
      banco,
      observaciones,
      id_cuenta_destino
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_registrado_por) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    const ordenCheck = await executeQuery('SELECT estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length > 0 && ordenCheck.data[0].estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede registrar pagos en una orden Cancelada' });
    }

    if (!fecha_pago || !monto_pagado || monto_pagado <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Fecha de pago y monto son obligatorios'
      });
    }

    if (id_cuenta_destino) {
      const cuentaResult = await executeQuery(
        'SELECT * FROM cuentas_pago WHERE id_cuenta = ? AND estado = "Activo"',
        [id_cuenta_destino]
      );
      
      if (!cuentaResult.success || cuentaResult.data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cuenta no encontrada o inactiva'
        });
      }
    }
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    // DETERMINAR MONTO REAL A COBRAR (Subtotal para Nota de Venta, Total para Factura)
    const esNotaVenta = orden.tipo_comprobante === 'Nota de Venta';
    const totalOrden = esNotaVenta 
        ? Math.round(parseFloat(orden.subtotal) * 100) / 100 
        : Math.round(parseFloat(orden.total) * 100) / 100;

    const montoPagadoActual = Math.round(parseFloat(orden.monto_pagado || 0) * 100) / 100;
    const montoNuevoPago = Math.round(parseFloat(monto_pagado) * 100) / 100;
    
    if (Math.round((montoPagadoActual + montoNuevoPago) * 100) / 100 > totalOrden + 0.01) {
      return res.status(400).json({
        success: false,
        error: `El monto a pagar (${montoNuevoPago.toFixed(2)}) excede el saldo pendiente (${(totalOrden - montoPagadoActual).toFixed(2)})`
      });
    }
    
    const ultimoPagoResult = await executeQuery(`
      SELECT numero_pago 
      FROM pagos_ordenes_venta 
      WHERE id_orden_venta = ?
      ORDER BY id_pago_orden DESC 
      LIMIT 1
    `, [id]);
    
    let numeroSecuencia = 1;
    if (ultimoPagoResult.success && ultimoPagoResult.data.length > 0) {
      const match = ultimoPagoResult.data[0].numero_pago.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroPago = `${orden.numero_orden}-P${String(numeroSecuencia).padStart(2, '0')}`;
    
    const queries = [
      {
        sql: `INSERT INTO pagos_ordenes_venta (
          id_orden_venta,
          numero_pago,
          fecha_pago,
          monto_pagado,
          metodo_pago,
          numero_operacion,
          banco,
          id_cuenta_destino,
          observaciones,
          id_registrado_por,
          fecha_registro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR))`,
        params: [
          id,
          numeroPago,
          fecha_pago,
          montoNuevoPago,
          metodo_pago || 'Transferencia',
          numero_operacion || null,
          banco || null,
          id_cuenta_destino || null,
          observaciones || null,
          id_registrado_por
        ]
      }
    ];

    const nuevoMontoPagado = Math.round((montoPagadoActual + montoNuevoPago) * 100) / 100;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado === 0) {
      estadoPago = 'Pendiente';
    }

    queries.push({
      sql: `UPDATE ordenes_venta 
            SET monto_pagado = ?,
                estado_pago = ?
            WHERE id_orden_venta = ?`,
      params: [nuevoMontoPagado, estadoPago, id]
    });

    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    const idPagoOrden = result.data[0].insertId;

    if (id_cuenta_destino) {
      await executeQuery(`
        INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          moneda,
          monto,
          concepto,
          referencia,
          id_pago_orden_venta,
          id_registrado_por,
          fecha_movimiento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_cuenta_destino,
          'Ingreso',
          orden.moneda,
          montoNuevoPago,
          `Cobranza Orden ${orden.numero_orden}`,
          numeroPago,
          idPagoOrden,
          id_registrado_por,
          fecha_pago
        ]
      );
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_pago_orden: idPagoOrden,
        numero_pago: numeroPago,
        monto_pagado: montoNuevoPago,
        nuevo_monto_total_pagado: nuevoMontoPagado,
        saldo_pendiente: totalOrden - nuevoMontoPagado,
        estado_pago: estadoPago,
        cuenta_actualizada: !!id_cuenta_destino
      },
      message: 'Pago registrado exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenCheck = await executeQuery(`
      SELECT id_orden_venta FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const result = await executeQuery(`
      SELECT 
        p.*,
        e.nombre_completo AS registrado_por,
        cp.nombre as nombre_cuenta,
        cp.tipo as tipo_cuenta
      FROM pagos_ordenes_venta p
      LEFT JOIN empleados e ON p.id_registrado_por = e.id_empleado
      LEFT JOIN cuentas_pago cp ON p.id_cuenta_destino = cp.id_cuenta
      WHERE p.id_orden_venta = ?
      ORDER BY p.fecha_registro DESC, p.id_pago_orden DESC
    `, [id]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function anularPagoOrden(req, res) {
  try {
    const { id, idPago } = req.params;
    const id_usuario = req.user?.id_empleado || null;
    
    if (!id_usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const ordenCheck = await executeQuery('SELECT estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length > 0 && ordenCheck.data[0].estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede modificar pagos en una orden Cancelada' });
    }
    
    const pagoResult = await executeQuery(`
      SELECT p.*, o.numero_orden, o.moneda
      FROM pagos_ordenes_venta p
      INNER JOIN ordenes_venta o ON p.id_orden_venta = o.id_orden_venta
      WHERE p.id_pago_orden = ? AND p.id_orden_venta = ?
    `, [idPago, id]);
    
    if (!pagoResult.success || pagoResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }
    
    const pago = pagoResult.data[0];
    const montoPago = parseFloat(pago.monto_pagado);
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const montoPagadoActual = parseFloat(orden.monto_pagado || 0);
    
    // DETERMINAR MONTO REAL A COBRAR (Subtotal para Nota de Venta, Total para Factura)
    const esNotaVenta = orden.tipo_comprobante === 'Nota de Venta';
    const totalOrden = esNotaVenta ? parseFloat(orden.subtotal) : parseFloat(orden.total);

    const queries = [];

    queries.push({
      sql: 'DELETE FROM pagos_ordenes_venta WHERE id_pago_orden = ?',
      params: [idPago]
    });
    
    const nuevoMontoPagado = montoPagadoActual - montoPago;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden - 0.1) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado <= 0.1) {
      estadoPago = 'Pendiente';
    }
    
    queries.push({
      sql: `UPDATE ordenes_venta 
            SET monto_pagado = ?,
                estado_pago = ?
            WHERE id_orden_venta = ?`,
      params: [nuevoMontoPagado, estadoPago, id]
    });

    if (pago.id_cuenta_destino) {
      queries.push({
        sql: `INSERT INTO movimientos_cuentas (
          id_cuenta,
          tipo_movimiento,
          moneda,
          monto,
          concepto,
          referencia,
          id_pago_orden_venta,
          id_registrado_por,
          fecha_movimiento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        params: [
          pago.id_cuenta_destino,
          'Egreso',
          pago.moneda,
          montoPago,
          `Anulación pago ${pago.numero_pago} - Orden ${pago.numero_orden}`,
          pago.numero_pago,
          null,
          id_usuario
        ]
      });
    }

    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: {
        monto_anulado: montoPago,
        nuevo_monto_total_pagado: nuevoMontoPagado,
        saldo_pendiente: totalOrden - nuevoMontoPagado,
        estado_pago: estadoPago
      },
      message: 'Pago anulado exitosamente'
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getResumenPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        numero_orden,
        total,
        monto_pagado,
        estado_pago,
        moneda
      FROM ordenes_venta 
      WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    // DETERMINAR MONTO REAL A COBRAR (Subtotal para Nota de Venta, Total para Factura)
    const esNotaVenta = orden.tipo_comprobante === 'Nota de Venta';
    const totalOrden = esNotaVenta ? parseFloat(orden.subtotal) : parseFloat(orden.total);
    
    const montoPagado = parseFloat(orden.monto_pagado || 0);
    
    const pagosResult = await executeQuery(`
      SELECT COUNT(*) as total_pagos
      FROM pagos_ordenes_venta
      WHERE id_orden_venta = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        numero_orden: orden.numero_orden,
        total_orden: totalOrden,
        monto_pagado: montoPagado,
        saldo_pendiente: totalOrden - montoPagado,
        porcentaje_pagado: totalOrden > 0 ? ((montoPagado / totalOrden) * 100).toFixed(2) : 0,
        estado_pago: orden.estado_pago,
        moneda: orden.moneda,
        total_pagos: pagosResult.data[0].total_pagos
      }
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getSalidasOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenRes = await executeQuery('SELECT numero_orden FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    
    if (ordenRes.data.length === 0) {
      return res.json({ success: true, data: [] });
    }
    
    const numeroOrden = ordenRes.data[0].numero_orden;

    // Vinculación por FK real (id_orden_venta) con fallback por texto para
    // salidas viejas que no alcanzaron el backfill de la migración.
    const sql = `
      SELECT
        s.id_salida,
        s.id_salida as numero_salida,
        s.fecha_movimiento as fecha_salida,
        s.observaciones,
        s.estado,
        s.total_costo,
        s.total_precio,
        (SELECT COUNT(*) FROM detalle_salidas WHERE id_salida = s.id_salida) as total_items
      FROM salidas s
      WHERE s.id_orden_venta = ?
         OR (s.id_orden_venta IS NULL AND s.tipo_movimiento = 'Venta' AND s.observaciones LIKE ?)
      ORDER BY s.fecha_movimiento DESC
    `;

    const result = await executeQuery(sql, [id, `%${numeroOrden}%`]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const salidas = result.data;
    const ids = salidas.map(s => s.id_salida);

    // Anidar factura (1 por despacho) y documentos adicionales de cada despacho.
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');

      const facturasRes = await executeQuery(`
        SELECT id_factura, id_salida, numero_factura, total, moneda, estado, url_pdf, fecha_emision
        FROM facturas_venta
        WHERE id_salida IN (${placeholders}) AND estado = 'Emitida'
        ORDER BY fecha_emision ASC, id_factura ASC
      `, ids);

      const docsRes = await executeQuery(`
        SELECT d.id_documento, d.id_salida, d.tipo_documento, d.correlativo, d.archivos_url, d.created_at,
               e.nombre_completo AS registrado_por
        FROM ordenes_venta_documentos d
        LEFT JOIN empleados e ON d.id_registrado_por = e.id_empleado
        WHERE d.id_salida IN (${placeholders}) AND d.deleted_at IS NULL
        ORDER BY d.created_at DESC
      `, ids);

      const facturasPorSalida = {};
      (facturasRes.success ? facturasRes.data : []).forEach(f => {
        f.url_pdf = extraerUrlPdf(f.url_pdf);
        (facturasPorSalida[f.id_salida] = facturasPorSalida[f.id_salida] || []).push(f);
      });

      const docsPorSalida = {};
      (docsRes.success ? docsRes.data : []).forEach(d => {
        (docsPorSalida[d.id_salida] = docsPorSalida[d.id_salida] || []).push(d);
      });

      // Productos despachados por cada salida (sin datos de precio/costo).
      const detalleRes = await executeQuery(`
        SELECT
          ds.id_salida,
          ds.id_producto,
          ds.cantidad,
          p.codigo AS codigo_producto,
          p.nombre AS producto,
          p.unidad_medida
        FROM detalle_salidas ds
        LEFT JOIN productos p ON ds.id_producto = p.id_producto
        WHERE ds.id_salida IN (${placeholders})
        ORDER BY p.nombre
      `, ids);

      const productosPorSalida = {};
      (detalleRes.success ? detalleRes.data : []).forEach(it => {
        (productosPorSalida[it.id_salida] = productosPorSalida[it.id_salida] || []).push(it);
      });

      salidas.forEach(s => {
        const fs = facturasPorSalida[s.id_salida] || [];
        s.factura = fs[0] || null;                    // 1 factura por despacho
        s.documentos = docsPorSalida[s.id_salida] || [];
        s.productos = productosPorSalida[s.id_salida] || [];
      });
    }

    res.json({ success: true, data: salidas });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function actualizarTipoComprobante(req, res) {
  try {
    const { id } = req.params;
    const { tipo_comprobante } = req.body;

    if (!tipo_comprobante || !['Factura', 'Nota de Venta'].includes(tipo_comprobante)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de comprobante inválido. Debe ser "Factura" o "Nota de Venta"'
      });
    }

    const ordenResult = await executeQuery(
      'SELECT comprobante_editado, estado, tipo_comprobante, numero_comprobante FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.comprobante_editado === 1) {
      return res.status(400).json({
        success: false,
        error: 'El tipo de comprobante ya fue editado anteriormente. Solo se permite un cambio.'
      });
    }

    if (orden.estado === 'Cancelada') {
      return res.status(400).json({
        success: false,
        error: 'No se puede editar el comprobante de una orden cancelada'
      });
    }

    let numeroComprobante = null;

    if (tipo_comprobante === 'Factura') {
      const ultimaFactura = await executeQuery(`
        SELECT numero_comprobante
        FROM ordenes_venta
        WHERE tipo_comprobante = 'Factura'
          AND numero_comprobante IS NOT NULL
          AND numero_comprobante REGEXP '^F[0-9]{3}-[0-9]+$'
        ORDER BY CAST(SUBSTRING_INDEX(numero_comprobante, '-', -1) AS UNSIGNED) DESC
        LIMIT 1
      `);

      let numeroSecuenciaFactura = 1;
      if (ultimaFactura.success && ultimaFactura.data.length > 0 && ultimaFactura.data[0].numero_comprobante) {
        const match = ultimaFactura.data[0].numero_comprobante.match(/F\d{3}-(\d+)$/);
        if (match) numeroSecuenciaFactura = parseInt(match[1]) + 1;
      }

      numeroComprobante = `F001-${String(numeroSecuenciaFactura).padStart(8, '0')}`;

    } else if (tipo_comprobante === 'Nota de Venta') {
      const ultimaNota = await executeQuery(`
        SELECT numero_comprobante
        FROM ordenes_venta
        WHERE tipo_comprobante = 'Nota de Venta'
          AND numero_comprobante IS NOT NULL
          AND numero_comprobante REGEXP '^NV[0-9]{3}-[0-9]+$'
        ORDER BY CAST(SUBSTRING_INDEX(numero_comprobante, '-', -1) AS UNSIGNED) DESC
        LIMIT 1
      `);

      let numeroSecuenciaNota = 1;
      if (ultimaNota.success && ultimaNota.data.length > 0 && ultimaNota.data[0].numero_comprobante) {
        const match = ultimaNota.data[0].numero_comprobante.match(/NV\d{3}-(\d+)$/);
        if (match) numeroSecuenciaNota = parseInt(match[1]) + 1;
      }

      numeroComprobante = `NV001-${String(numeroSecuenciaNota).padStart(8, '0')}`;
    }

    const updateResult = await executeQuery(
      `UPDATE ordenes_venta
       SET tipo_comprobante = ?,
           numero_comprobante = ?,
           comprobante_editado = 1,
           fecha_actualizacion = NOW()
       WHERE id_orden_venta = ?`,
      [tipo_comprobante, numeroComprobante, id]
    );

    if (!updateResult.success) {
      return res.status(500).json({ success: false, error: updateResult.error });
    }

    // Notificación SUNAT si el nuevo tipo es Factura y ya está en estados relevantes
    if (tipo_comprobante === 'Factura' && ['En espera', 'Despacho Parcial', 'Despachada', 'Entregada'].includes(orden.estado)) {
      await notificarPendienteMarcarSunat(id, orden.numero_orden, orden.estado, getIO(req));
    }

    res.json({
      success: true,
      message: 'Tipo de comprobante actualizado exitosamente',
      data: {
        tipo_comprobante,
        numero_comprobante: numeroComprobante
      }
    });

  } catch (error) {
    console.error('Error al actualizar tipo de comprobante:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function actualizarDatosTransporte(req, res) {
  try {
    const { id } = req.params;
    const {
      tipo_entrega,
      id_vehiculo,
      id_conductor,
      transporte_nombre,
      transporte_placa,
      transporte_conductor,
      transporte_dni,
      transporte_licencia,
      transporte_ruc,
      transporte_mtc,
      transporte_tuc,
      transporte_autorizacion,
      transporte_placa2,
      transporte_tuc2,
      transporte_autorizacion2,
      transporte_fecha_entrega,
      transporte_registrar,
      transporte_dni2,
      transporte_conductor2,
      transporte_licencia2,
      transporte_ind_transbordo,
      transporte_ind_m1l,
      transporte_ind_retorno_vacio,
      fecha_entrega_estimada
    } = req.body;

    const ordenCheck = await executeQuery('SELECT estado FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenCheck.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }
    
    if (ordenCheck.data[0].estado === 'Cancelada') {
      return res.status(400).json({ 
        success: false, 
        error: 'No se pueden modificar datos de transporte en una orden Cancelada' 
      });
    }

    // ✅ Preparar valores según tipo de entrega
    let idVehiculoFinal = null;
    let idConductorFinal = null;
    let transNombreFinal = null;
    let transPlacaFinal = null;
    let transCondFinal = null;
    let transDniFinal = null;

    if (tipo_entrega === 'Vehiculo Empresa') {
      idVehiculoFinal = id_vehiculo || null;
      idConductorFinal = id_conductor || null;
      
      // Validar que el vehículo exista si se proporcionó
      if (idVehiculoFinal) {
        const vCheck = await executeQuery('SELECT id_vehiculo FROM flota WHERE id_vehiculo = ?', [idVehiculoFinal]);
        if (!vCheck.success || vCheck.data.length === 0) {
          return res.status(400).json({ success: false, error: 'Vehículo no válido' });
        }
      }
      
      // Validar que el conductor exista si se proporcionó
      if (idConductorFinal) {
        const cCheck = await executeQuery('SELECT id_empleado FROM empleados WHERE id_empleado = ?', [idConductorFinal]);
        if (!cCheck.success || cCheck.data.length === 0) {
          return res.status(400).json({ success: false, error: 'Conductor no válido' });
        }
      }
      
    } else if (tipo_entrega === 'Transporte Privado' || tipo_entrega === 'Vehiculo Particular') {
      // 'Transporte Privado'  = empresa de transporte tercero (modalidad 01 pública, requiere RUC).
      // 'Vehiculo Particular' = carro común del cliente SIN RUC (modalidad 02 privada, texto libre):
      //   solo conductor + DNI + licencia + placa; no lleva RUC/MTC/TUC/autorización/2º vehículo.
      transNombreFinal = transporte_nombre || null;
      transPlacaFinal = transporte_placa || null;
      transCondFinal = transporte_conductor || null;
      transDniFinal = transporte_dni || null;
    }
    // Si es 'Recojo Tienda', todos quedan null

    // Datos del transportista tercero: solo aplican en 'Transporte Privado' (público SUNAT).
    // El RUC + razón social + placa + conductor + licencia van al XML de la GRE; el MTC (empresa)
    // en cbc:CompanyID y el TUC (certificado del vehículo) en RegistrationNationalityID.
    const esTercero = tipo_entrega === 'Transporte Privado';
    const esParticular = tipo_entrega === 'Vehiculo Particular';
    const transRucFinal = esTercero ? (transporte_ruc || null) : null;
    const transMtcFinal = esTercero ? (transporte_mtc || null) : null;
    const transTucFinal = esTercero ? (transporte_tuc || null) : null;
    // La licencia aplica tanto al tercero como al carro particular del cliente.
    const transLicFinal = (esTercero || esParticular) ? (transporte_licencia || null) : null;
    const transAutFinal = esTercero ? (transporte_autorizacion || null) : null;
    const transPlaca2Final = esTercero ? (transporte_placa2 || null) : null;
    const transTuc2Final = esTercero ? (transporte_tuc2 || null) : null;
    const transAut2Final = esTercero ? (transporte_autorizacion2 || null) : null;
    const transFechaEntregaFinal = esTercero ? (transporte_fecha_entrega || null) : null;
    // Interruptor "registrar veh/cond del transportista" (solo tercero; default 1 = Caso 2/3).
    const transRegistrarFinal = esTercero ? (transporte_registrar === false ? 0 : 1) : 1;
    // Conductor secundario (solo tercero).
    const transDni2Final = esTercero ? (transporte_dni2 || null) : null;
    const transCond2Final = esTercero ? (transporte_conductor2 || null) : null;
    const transLic2Final = esTercero ? (transporte_licencia2 || null) : null;
    // Indicadores SUNAT (opcionales; se persisten según el payload del form).
    const transIndTransbordoFinal = transporte_ind_transbordo ? 1 : 0;
    const transIndM1lFinal = transporte_ind_m1l ? 1 : 0;
    const transIndRetVacioFinal = transporte_ind_retorno_vacio ? 1 : 0;

    const result = await executeQuery(`
      UPDATE ordenes_venta
      SET
        tipo_entrega = ?,
        id_vehiculo = ?,
        id_conductor = ?,
        transporte_nombre = ?,
        transporte_placa = ?,
        transporte_conductor = ?,
        transporte_dni = ?,
        transporte_licencia = ?,
        transporte_ruc = ?,
        transporte_mtc = ?,
        transporte_tuc = ?,
        transporte_autorizacion = ?,
        transporte_placa2 = ?,
        transporte_tuc2 = ?,
        transporte_autorizacion2 = ?,
        transporte_fecha_entrega = ?,
        transporte_registrar = ?,
        transporte_dni2 = ?,
        transporte_conductor2 = ?,
        transporte_licencia2 = ?,
        transporte_ind_transbordo = ?,
        transporte_ind_m1l = ?,
        transporte_ind_retorno_vacio = ?,
        fecha_entrega_estimada = COALESCE(?, fecha_entrega_estimada)
      WHERE id_orden_venta = ?
    `, [
      tipo_entrega,
      idVehiculoFinal,
      idConductorFinal,
      transNombreFinal,
      transPlacaFinal,
      transCondFinal,
      transDniFinal,
      transLicFinal,
      transRucFinal,
      transMtcFinal,
      transTucFinal,
      transAutFinal,
      transPlaca2Final,
      transTuc2Final,
      transAut2Final,
      transFechaEntregaFinal,
      transRegistrarFinal,
      transDni2Final,
      transCond2Final,
      transLic2Final,
      transIndTransbordoFinal,
      transIndM1lFinal,
      transIndRetVacioFinal,
      fecha_entrega_estimada || null,
      id
    ]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ 
      success: true, 
      message: 'Datos de transporte actualizados correctamente',
      data: {
        tipo_entrega,
        id_vehiculo: idVehiculoFinal,
        id_conductor: idConductorFinal,
        transporte_nombre: transNombreFinal,
        transporte_placa: transPlacaFinal
      }
    });

  } catch (error) {
    console.error('Error en actualizarDatosTransporte:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function agregarDireccionClienteDesdeOrden(req, res) {
  try {
    const { id_cliente, direccion, referencia } = req.body;

    if (!id_cliente) {
      return res.status(400).json({ 
        success: false, 
        error: 'El ID del cliente es obligatorio' 
      });
    }

    if (!direccion || direccion.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'La dirección es requerida' 
      });
    }

    const clienteCheck = await executeQuery(
      'SELECT id_cliente FROM clientes WHERE id_cliente = ?',
      [id_cliente]
    );

    if (clienteCheck.data.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cliente no encontrado' 
      });
    }

    const result = await executeQuery(
      `INSERT INTO clientes_direcciones (
        id_cliente, 
        direccion, 
        referencia, 
        es_principal, 
        estado
      ) VALUES (?, ?, ?, 0, 'Activo')`,
      [id_cliente, direccion, referencia || null]
    );

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.status(201).json({
      success: true,
      message: 'Dirección agregada exitosamente',
      data: {
        id_direccion: result.data.insertId,
        id_cliente: id_cliente,
        direccion: direccion,
        referencia: referencia || null
      }
    });

  } catch (error) {
    console.error('Error al agregar dirección desde orden:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

export async function rectificarCantidadProducto(req, res) {
  try {
    const { id } = req.params;
    const { id_producto, nueva_cantidad, motivo } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;

    if (!id_registrado_por) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    if (!id_producto || nueva_cantidad === undefined || nueva_cantidad < 0) {
      return res.status(400).json({ success: false, error: 'Producto y cantidad válida requeridos' });
    }

    const ordenResult = await executeQuery('SELECT * FROM ordenes_venta WHERE id_orden_venta = ?', [id]);
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }
    const orden = ordenResult.data[0];

    if (orden.estado === 'Cancelada') {
        return res.status(400).json({ success: false, error: 'No se puede rectificar una orden Cancelada' });
    }

    const detalleResult = await executeQuery(
      'SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ? AND id_producto = ?', 
      [id, id_producto]
    );

    if (detalleResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado en esta orden' });
    }

    const itemDetalle = detalleResult.data[0];
    const cantidadAnterior = parseFloat(itemDetalle.cantidad);
    const cantidadNueva = parseFloat(nueva_cantidad);
    const diferencia = cantidadNueva - cantidadAnterior;

    if (diferencia === 0) {
      return res.json({ success: true, message: 'No hay cambios en la cantidad' });
    }

    const queries = [];

    if (diferencia > 0) {
      const productoCheck = await executeQuery('SELECT stock_actual, requiere_receta FROM productos WHERE id_producto = ?', [id_producto]);
      if (productoCheck.data.length > 0) {
        const prod = productoCheck.data[0];
        if (prod.requiere_receta === 0) {
          if (parseFloat(prod.stock_actual) < diferencia) {
            return res.status(400).json({ success: false, error: 'Stock insuficiente para el incremento en la rectificación' });
          }
          queries.push({
            sql: 'UPDATE productos SET stock_actual = stock_actual - ? WHERE id_producto = ?',
            params: [diferencia, id_producto]
          });
        }
      }
    } else {
      const productoCheck = await executeQuery('SELECT requiere_receta FROM productos WHERE id_producto = ?', [id_producto]);
      if (productoCheck.data.length > 0 && productoCheck.data[0].requiere_receta === 0) {
        queries.push({
          sql: 'UPDATE productos SET stock_actual = stock_actual + ? WHERE id_producto = ?',
          params: [Math.abs(diferencia), id_producto]
        });
      }
    }

    let sqlUpdateDetalle = 'UPDATE detalle_orden_venta SET cantidad = ? WHERE id_detalle = ?';
    let paramsUpdateDetalle = [cantidadNueva, itemDetalle.id_detalle];

    if (['Despachada', 'Entregada'].includes(orden.estado)) {
        sqlUpdateDetalle = 'UPDATE detalle_orden_venta SET cantidad = ?, cantidad_despachada = ? WHERE id_detalle = ?';
        paramsUpdateDetalle = [cantidadNueva, cantidadNueva, itemDetalle.id_detalle];
    } else if (orden.estado === 'Despacho Parcial') {
        sqlUpdateDetalle = 'UPDATE detalle_orden_venta SET cantidad = ?, cantidad_despachada = IF(cantidad_despachada > 0, ?, cantidad_despachada) WHERE id_detalle = ?';
        paramsUpdateDetalle = [cantidadNueva, cantidadNueva, itemDetalle.id_detalle];
    }

    queries.push({
      sql: sqlUpdateDetalle,
      params: paramsUpdateDetalle
    });

    const ordenCompletaDetalle = await executeQuery('SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?', [id]);
    let nuevoSubtotalOrden = 0;
    
    ordenCompletaDetalle.data.forEach(d => {
      const cant = (d.id_producto == id_producto) ? cantidadNueva : parseFloat(d.cantidad);
      nuevoSubtotalOrden += (cant * parseFloat(d.precio_unitario)) * (1 - parseFloat(d.descuento_porcentaje || 0) / 100);
    });

    const esSinImpuesto = ['EXO', 'INA', 'EXONERADO', 'INAFECTO'].includes(String(orden.tipo_impuesto || '').toUpperCase());
    const porcentajeImpuesto = esSinImpuesto ? 0 : ((orden.porcentaje_impuesto !== null && orden.porcentaje_impuesto !== undefined) 
      ? parseFloat(orden.porcentaje_impuesto) 
      : 18);
    const nuevoImpuesto = nuevoSubtotalOrden * (porcentajeImpuesto / 100);
    const nuevoTotal = nuevoSubtotalOrden + nuevoImpuesto;

    queries.push({
      sql: 'UPDATE ordenes_venta SET subtotal = ?, igv = ?, total = ?, observaciones = CONCAT(COALESCE(observaciones, ""), " [Rect: ", ? ) WHERE id_orden_venta = ?',
      params: [nuevoSubtotalOrden, nuevoImpuesto, nuevoTotal, `Prod ${id_producto}: ${cantidadAnterior}->${cantidadNueva}. ${motivo || ''}`, id]
    });

    if (['Despachada', 'Entregada', 'Despacho Parcial'].includes(orden.estado)) {
      const salidaResult = await executeQuery(
        'SELECT id_salida FROM salidas WHERE observaciones LIKE ? AND estado = "Activo" ORDER BY id_salida DESC LIMIT 1', 
        [`%${orden.numero_orden}%`]
      );

      if (salidaResult.data.length > 0) {
        const idSalida = salidaResult.data[0].id_salida;
        const detalleSalidaCheck = await executeQuery('SELECT * FROM detalle_salidas WHERE id_salida = ? AND id_producto = ?', [idSalida, id_producto]);
        
        if (detalleSalidaCheck.data.length > 0) {
          if (cantidadNueva <= 0) {
             queries.push({ sql: 'DELETE FROM detalle_salidas WHERE id_salida = ? AND id_producto = ?', params: [idSalida, id_producto] });
          } else {
             queries.push({ sql: 'UPDATE detalle_salidas SET cantidad = ? WHERE id_salida = ? AND id_producto = ?', params: [cantidadNueva, idSalida, id_producto] });
          }
        } else if (cantidadNueva > 0) {
           const infoProd = await executeQuery('SELECT costo_unitario_promedio FROM productos WHERE id_producto = ?', [id_producto]);
           const costo = infoProd.data[0]?.costo_unitario_promedio || 0;
           const precioUnitario = parseFloat(itemDetalle.precio_unitario);
           queries.push({ sql: 'INSERT INTO detalle_salidas (id_salida, id_producto, cantidad, costo_unitario, precio_unitario) VALUES (?, ?, ?, ?, ?)', params: [idSalida, id_producto, cantidadNueva, costo, precioUnitario] });
        }
        
        queries.push({
            sql: `UPDATE salidas s SET 
                    total_costo = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM detalle_salidas WHERE id_salida = s.id_salida),
                    total_precio = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0) FROM detalle_salidas WHERE id_salida = s.id_salida)
                  WHERE s.id_salida = ?`,
            params: [idSalida]
        });
      }
    }

    if (orden.id_cotizacion) {
        queries.push({
            sql: 'UPDATE detalle_cotizacion SET cantidad = ? WHERE id_cotizacion = ? AND id_producto = ?',
            params: [cantidadNueva, orden.id_cotizacion, id_producto]
        });

        queries.push({
            sql: `UPDATE cotizaciones c
                  SET 
                    subtotal = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion),
                    igv = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) * 
                          (CASE WHEN tipo_impuesto IN ('EXO', 'INA', 'EXONERADO', 'INAFECTO') THEN 0 ELSE (COALESCE(porcentaje_impuesto,18)/100) END),
                    total = (SELECT SUM(cantidad * precio_unitario * (1 - COALESCE(descuento_porcentaje,0)/100)) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) * 
                            (CASE WHEN tipo_impuesto IN ('EXO', 'INA', 'EXONERADO', 'INAFECTO') THEN 1 ELSE (1 + COALESCE(porcentaje_impuesto,18)/100) END)
                  WHERE c.id_cotizacion = ?`,
            params: [orden.id_cotizacion]
        });
    }

    await executeTransaction(queries);

    res.json({
      success: true,
      message: 'Cantidad rectificada en Orden y Cotización correctamente',
      data: {
        cantidad_anterior: cantidadAnterior,
        cantidad_nueva: cantidadNueva,
        diferencia: diferencia
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
export async function descargarPDFGuiaInterna(req, res) {
  try {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente_base,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial,
        e_conductor.nombre_completo AS conductor_nombre,
        e_conductor.dni AS conductor_dni,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.tipo_comprobante !== 'Nota de Venta') {
      return res.status(400).json({ 
        success: false, 
        error: 'La Guía Interna solo está disponible para Notas de Venta' 
      });
    }

    let numeroGuiaInterna = orden.numero_guia_interna;

    // Si no tiene guía global, buscamos si tiene algún despacho registrado para usar ese correlativo
    if (!numeroGuiaInterna) {
        const despachoResult = await executeQuery(`
            SELECT observaciones FROM salidas 
            WHERE observaciones LIKE ? AND estado = 'Activo'
            ORDER BY id_salida DESC LIMIT 1
        `, [`%${orden.numero_orden}%`]);

        if (despachoResult.success && despachoResult.data.length > 0) {
            const match = despachoResult.data[0].observaciones.match(/GI-\d{4}-\d+/);
            if (match) numeroGuiaInterna = match[0];
        }
    }

    if (!numeroGuiaInterna) {
      return res.status(400).json({ 
        success: false, 
        error: 'No se puede descargar la guía global. Por favor, registre un despacho primero para generar el correlativo.' 
      });
    }

    const detalleResult = await executeQuery(`
      SELECT 
        dov.id_detalle,
        dov.id_producto,
        dov.cantidad,
        dov.precio_unitario,
        dov.descuento_porcentaje,
        p.codigo AS codigo_producto, 
        p.nombre AS producto, 
        p.unidad_medida
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.orden ASC
    `, [id]);

    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error al obtener detalle de la orden' 
      });
    }

    orden.detalle = detalleResult.data || [];

    const direccionFinal = orden.direccion_entrega && orden.direccion_entrega.trim() !== '' 
      ? orden.direccion_entrega 
      : orden.direccion_cliente_base;

    orden.direccion_entrega = direccionFinal;

    const { generarPDFGuiaInterna } = await import('../utils/pdfGenerators/guiaInternaPDF.js');
    const pdfBuffer = await generarPDFGuiaInterna(orden, numeroGuiaInterna);
    
    const nombreArchivo = `Guia-Interna-${numeroGuiaInterna}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
export async function getOrdenesPendientesVerificacion(req, res) {
  try {
    const { rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para acceder a este módulo'
      });
    }

    const { fecha_inicio, fecha_fin } = req.query;

    let sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.tipo_comprobante,
        ov.numero_comprobante,
        ov.fecha_emision,
        ov.fecha_entrega_estimada,
        ov.estado,
        ov.estado_verificacion,
        ov.prioridad,
        ov.subtotal,
        ov.igv,
        ov.total,
        ov.tipo_impuesto,
        ov.porcentaje_impuesto,
        ov.moneda,
        ov.tipo_venta,
        ov.plazo_pago,
        ov.dias_credito,
        ov.orden_compra_cliente,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e_comercial.nombre_completo AS comercial,
        e_registrado.nombre_completo AS registrado_por,
        ov.id_comercial,
        ov.id_registrado_por,
        (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) AS total_items
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      WHERE ov.estado_verificacion = 'Pendiente'
    `;

    const params = [];

    if (fecha_inicio) {
      sql += ` AND DATE(ov.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += ` AND DATE(ov.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }

    sql += ` ORDER BY ov.prioridad DESC, ov.fecha_emision ASC, ov.id_orden_venta ASC`;

    const result = await executeQuery(sql, params);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });

  } catch (error) {
    console.error('Error en getOrdenesPendientesVerificacion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getDatosVerificacionOrden(req, res) {
  try {
    const { id } = req.params;
    const { rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para verificar órdenes'
      });
    }

    // 1. DATOS DE LA ORDEN
    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        cl.email AS email_cliente,
        cl.usar_limite_credito,
        cl.limite_credito_pen,
        cl.limite_credito_usd,
        e_comercial.nombre_completo AS comercial,
        e_comercial.email AS email_comercial,
        e_registrado.nombre_completo AS registrado_por,
        e_conductor.nombre_completo AS conductor,
        f.placa AS vehiculo_placa,
        f.marca_modelo AS vehiculo_modelo,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN empleados e_conductor ON ov.id_conductor = e_conductor.id_empleado
      LEFT JOIN flota f ON ov.id_vehiculo = f.id_vehiculo
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    // 2. DETALLE DE LA ORDEN
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.orden ASC
    `, [id]);

    orden.detalle = detalleResult.data || [];

    // 3. HISTORIAL DE ÓRDENES DEL CLIENTE (últimas 10)
    const historialResult = await executeQuery(`
      SELECT 
        id_orden_venta,
        numero_orden,
        fecha_emision,
        fecha_vencimiento,
        total,
        monto_pagado,
        estado_pago,
        estado,
        moneda,
        tipo_venta,
        DATEDIFF(
          COALESCE(
            CASE 
              WHEN estado_pago = 'Pagado' THEN (
                SELECT MAX(fecha_pago) 
                FROM pagos_ordenes_venta 
                WHERE id_orden_venta = ordenes_venta.id_orden_venta
              )
              ELSE CURDATE()
            END,
            fecha_vencimiento
          ),
          fecha_vencimiento
        ) AS dias_retraso
      FROM ordenes_venta
      WHERE id_cliente = ?
        AND id_orden_venta != ?
        AND estado != 'Cancelada'
      ORDER BY fecha_emision DESC
      LIMIT 10
    `, [orden.id_cliente, id]);

    const historial = historialResult.data || [];

    // 4. CALCULAR DEUDA ACTUAL DEL CLIENTE
    const deudaResult = await executeQuery(`
      SELECT 
        COALESCE(SUM(CASE WHEN moneda = 'PEN' THEN (total - monto_pagado) ELSE 0 END), 0) AS deuda_pen,
        COALESCE(SUM(CASE WHEN moneda = 'USD' THEN (total - monto_pagado) ELSE 0 END), 0) AS deuda_usd,
        COUNT(*) AS total_ordenes_pendientes
      FROM ordenes_venta
      WHERE id_cliente = ?
        AND estado != 'Cancelada'
        AND estado_pago != 'Pagado'
    `, [orden.id_cliente]);

    const deuda = deudaResult.data[0] || { deuda_pen: 0, deuda_usd: 0, total_ordenes_pendientes: 0 };

    // 5. ÓRDENES VENCIDAS DEL CLIENTE
    const vencidasResult = await executeQuery(`
      SELECT 
        numero_orden,
        fecha_vencimiento,
        total,
        monto_pagado,
        (total - monto_pagado) AS saldo_pendiente,
        moneda,
        DATEDIFF(CURDATE(), fecha_vencimiento) AS dias_vencido
      FROM ordenes_venta
      WHERE id_cliente = ?
        AND estado != 'Cancelada'
        AND estado_pago != 'Pagado'
        AND fecha_vencimiento < CURDATE()
      ORDER BY fecha_vencimiento ASC
    `, [orden.id_cliente]);

    const ordenes_vencidas = vencidasResult.data || [];

    // 6. ESTADÍSTICAS DE PAGO DEL CLIENTE
    const estadisticasResult = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado_pago = 'Pagado' THEN 1 ELSE 0 END) AS ordenes_pagadas,
        SUM(CASE WHEN estado_pago = 'Pendiente' THEN 1 ELSE 0 END) AS ordenes_pendientes,
        SUM(CASE WHEN estado_pago = 'Parcial' THEN 1 ELSE 0 END) AS ordenes_parciales,
        AVG(
          CASE 
            WHEN estado_pago = 'Pagado' THEN
              DATEDIFF(
                (SELECT MAX(fecha_pago) FROM pagos_ordenes_venta WHERE id_orden_venta = ordenes_venta.id_orden_venta),
                fecha_vencimiento
              )
            ELSE NULL
          END
        ) AS promedio_dias_retraso
      FROM ordenes_venta
      WHERE id_cliente = ?
        AND estado != 'Cancelada'
        AND fecha_emision >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    `, [orden.id_cliente]);

    const estadisticas = estadisticasResult.data[0] || {
      total_ordenes: 0,
      ordenes_pagadas: 0,
      ordenes_pendientes: 0,
      ordenes_parciales: 0,
      promedio_dias_retraso: 0
    };

    // 7. ANÁLISIS DE CRÉDITO
    let analisis_credito = null;

    if (orden.plazo_pago !== 'Contado' && orden.usar_limite_credito) {
      const limiteAsignado = orden.moneda === 'USD' 
        ? parseFloat(orden.limite_credito_usd || 0) 
        : parseFloat(orden.limite_credito_pen || 0);

      const deudaActual = orden.moneda === 'USD' 
        ? parseFloat(deuda.deuda_usd) 
        : parseFloat(deuda.deuda_pen);

      const disponible = limiteAsignado - deudaActual;
      const disponibleDespuesOrden = disponible - parseFloat(orden.total);

      analisis_credito = {
        limite_asignado: limiteAsignado,
        deuda_actual: deudaActual,
        disponible: disponible,
        monto_orden: parseFloat(orden.total),
        disponible_despues_orden: disponibleDespuesOrden,
        excede_limite: disponibleDespuesOrden < 0,
        porcentaje_uso_actual: limiteAsignado > 0 ? ((deudaActual / limiteAsignado) * 100).toFixed(2) : 0,
        porcentaje_uso_despues: limiteAsignado > 0 ? (((deudaActual + parseFloat(orden.total)) / limiteAsignado) * 100).toFixed(2) : 0
      };
    }

    // 8. RESPUESTA COMPLETA
    res.json({
      success: true,
      data: {
        orden: orden,
        historial_cliente: historial,
        deuda_actual: deuda,
        ordenes_vencidas: ordenes_vencidas,
        estadisticas_pago: estadisticas,
        analisis_credito: analisis_credito,
        alertas: {
          tiene_ordenes_vencidas: ordenes_vencidas.length > 0,
          excede_limite_credito: analisis_credito?.excede_limite || false,
          promedio_retraso_alto: parseFloat(estadisticas.promedio_dias_retraso || 0) > 7,
          tasa_pago_baja: estadisticas.total_ordenes > 0 && 
            ((estadisticas.ordenes_pagadas / estadisticas.total_ordenes) * 100) < 70
        }
      }
    });

  } catch (error) {
    console.error('Error en getDatosVerificacionOrden:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function aprobarOrdenVerificacion(req, res) {
  try {
    const { id } = req.params;
    const { observaciones_verificador } = req.body;
    const { id_empleado, nombre_completo, rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para aprobar órdenes'
      });
    }

    const ordenResult = await executeQuery(
      'SELECT * FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    if (orden.estado_verificacion !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        error: `Esta orden ya fue ${orden.estado_verificacion.toLowerCase()}`
      });
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET 
        estado_verificacion = 'Aprobada',
        id_verificador = ?,
        fecha_verificacion = NOW(),
        observaciones_verificador = ?,
        motivo_rechazo = NULL
      WHERE id_orden_venta = ?
    `, [id_empleado, observaciones_verificador || null, id]);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

    await notificarOrdenAprobada(id, orden.numero_orden, orden.id_registrado_por, nombre_completo, getIO(req));
    await notificarComercialDefinirComprobante(id, orden.numero_orden, orden.id_comercial, getIO(req));

    if (orden.tipo_comprobante === 'Factura') {
      await notificarPendienteMarcarSunat(id, orden.numero_orden, 'Aprobada', getIO(req));
    }


    res.json({
      success: true,
      message: 'Orden aprobada exitosamente',
      data: {
        id_orden_venta: id,
        numero_orden: orden.numero_orden,
        estado_verificacion: 'Aprobada',
        verificado_por: nombre_completo,
        fecha_verificacion: new Date()
      }
    });

  } catch (error) {
    console.error('Error en aprobarOrdenVerificacion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function rechazarOrdenVerificacion(req, res) {
  try {
    const { id } = req.params;
    const { motivo_rechazo, observaciones_verificador } = req.body;
    const { id_empleado, nombre_completo, rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para rechazar órdenes'
      });
    }

    if (!motivo_rechazo || motivo_rechazo.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El motivo de rechazo es obligatorio'
      });
    }

    const ordenResult = await executeQuery(
      'SELECT * FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    if (orden.estado_verificacion !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        error: `Esta orden ya fue ${orden.estado_verificacion.toLowerCase()}`
      });
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET 
        estado_verificacion = 'Rechazada',
        id_verificador = ?,
        fecha_verificacion = NOW(),
        motivo_rechazo = ?,
        observaciones_verificador = ?
      WHERE id_orden_venta = ?
    `, [id_empleado, motivo_rechazo.trim(), observaciones_verificador || null, id]);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

    await notificarOrdenRechazada(id, orden.numero_orden, orden.id_registrado_por, nombre_completo, motivo_rechazo.trim(), getIO(req));


    res.json({
      success: true,
      message: 'Orden rechazada exitosamente',
      data: {
        id_orden_venta: id,
        numero_orden: orden.numero_orden,
        estado_verificacion: 'Rechazada',
        verificado_por: nombre_completo,
        fecha_verificacion: new Date(),
        motivo_rechazo: motivo_rechazo.trim()
      }
    });

  } catch (error) {
    console.error('Error en rechazarOrdenVerificacion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function reenviarOrdenVerificacion(req, res) {
  try {
    const { id } = req.params;
    const { id_empleado, nombre_completo, rol } = req.user;

    const ordenResult = await executeQuery(
      'SELECT * FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden no encontrada'
      });
    }

    const orden = ordenResult.data[0];

    if (orden.estado_verificacion !== 'Rechazada') {
      return res.status(400).json({
        success: false,
        error: 'Solo puedes reenviar órdenes que fueron rechazadas'
      });
    }

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      if (orden.id_registrado_por !== id_empleado) {
        return res.status(403).json({
          success: false,
          error: 'Solo puedes reenviar órdenes que tú creaste'
        });
      }
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET 
        estado_verificacion = 'Pendiente',
        id_verificador = NULL,
        fecha_verificacion = NULL,
        motivo_rechazo = NULL,
        observaciones_verificador = NULL
      WHERE id_orden_venta = ?
    `, [id]);

    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: updateResult.error
      });
    }

    await notificarOrdenReenviada(id, orden.numero_orden, nombre_completo, getIO(req));


    res.json({
      success: true,
      message: 'Orden reenviada para verificación exitosamente',
      data: {
        id_orden_venta: id,
        numero_orden: orden.numero_orden,
        estado_verificacion: 'Pendiente'
      }
    });

  } catch (error) {
    console.error('Error en reenviarOrdenVerificacion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
export async function marcarFacturadoSunat(req, res) {
  try {
    const { id } = req.params;
    const { numero_comprobante_sunat } = req.body;
    const { id_empleado, rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para marcar la facturación SUNAT' });
    }

    const ordenResult = await executeQuery(
      'SELECT id_orden_venta, numero_orden, estado, tipo_comprobante FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.estado === 'Cancelada') {
      return res.status(400).json({ success: false, error: 'No se puede facturar una orden cancelada' });
    }

    if (numero_comprobante_sunat && numero_comprobante_sunat.trim() !== '') {
      const duplicadoResult = await executeQuery(
        'SELECT id_orden_venta FROM ordenes_venta WHERE numero_comprobante_sunat = ? AND id_orden_venta != ?',
        [numero_comprobante_sunat.trim(), id]
      );
      if (duplicadoResult.success && duplicadoResult.data.length > 0) {
        return res.status(400).json({ success: false, error: 'Ese número de comprobante SUNAT ya está registrado en otra orden' });
      }
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_venta 
      SET 
        facturado_sunat = 1,
        fecha_facturacion_sunat = ?,
        numero_comprobante_sunat = ?,
        id_facturador = ?
      WHERE id_orden_venta = ?
    `, [getFechaPeru(), numero_comprobante_sunat?.trim() || null, id_empleado, id]);

    if (!updateResult.success) {
      return res.status(500).json({ success: false, error: updateResult.error });
    }

    const facturadorResult = await executeQuery(
      'SELECT nombre_completo FROM empleados WHERE id_empleado = ?',
      [id_empleado]
    );

    res.json({
      success: true,
      message: 'Orden marcada como facturada en SUNAT',
      data: {
        id_orden_venta: parseInt(id),
        numero_orden: orden.numero_orden,
        facturado_sunat: true,
        fecha_facturacion_sunat: new Date(),
        numero_comprobante_sunat: numero_comprobante_sunat?.trim() || null,
        facturado_por: facturadorResult.data[0]?.nombre_completo || null
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function desmarcarFacturadoSunat(req, res) {
  try {
    const { id } = req.params;
    const { id_empleado, rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para desmarcar la facturación SUNAT' });
    }

    const ordenResult = await executeQuery(
      'SELECT id_orden_venta, numero_orden, estado, facturado_sunat FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.facturado_sunat !== 1) {
      return res.status(400).json({ success: false, error: 'Esta orden no está marcada como facturada en SUNAT' });
    }

    const updateResult = await executeQuery(`
      UPDATE ordenes_venta
      SET
        facturado_sunat = 0,
        fecha_facturacion_sunat = NULL,
        numero_comprobante_sunat = NULL,
        comprobante_sunat_url = NULL,
        id_facturador = NULL
      WHERE id_orden_venta = ?
    `, [id]);
    if (!updateResult.success) {
      return res.status(500).json({ success: false, error: updateResult.error });
    }

    res.json({
      success: true,
      message: 'Facturación SUNAT desmarcada correctamente',
      data: {
        id_orden_venta: parseInt(id),
        numero_orden: orden.numero_orden,
        facturado_sunat: false
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /:id/facturas/:idFactura/anular — anula una factura específica de la orden.
export async function anularFacturaSunat(req, res) {
  try {
    const { id, idFactura } = req.params;
    const { motivo_anulacion } = req.body;
    const { id_empleado, rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para anular la facturación SUNAT' });
    }

    if (!motivo_anulacion || motivo_anulacion.trim() === '') {
      return res.status(400).json({ success: false, error: 'El motivo de anulación es obligatorio' });
    }

    const facRes = await executeQuery(
      'SELECT id_factura, numero_factura, estado FROM facturas_venta WHERE id_factura = ? AND id_orden_venta = ?',
      [idFactura, id]
    );

    if (!facRes.success || facRes.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Factura no encontrada para esta orden' });
    }

    if (facRes.data[0].estado === 'Anulada') {
      return res.status(400).json({ success: false, error: 'Esta factura ya está anulada' });
    }

    const upd = await executeQuery(
      `UPDATE facturas_venta
          SET estado = 'Anulada', motivo_anulacion = ?, fecha_anulacion = ?, id_anulado_por = ?
        WHERE id_factura = ?`,
      [motivo_anulacion.trim(), getFechaPeru(), id_empleado, idFactura]
    );

    if (!upd.success) {
      return res.status(500).json({ success: false, error: upd.error });
    }

    await sincronizarResumenFacturacion(id);

    res.json({
      success: true,
      message: 'Factura anulada correctamente.',
      data: {
        id_factura: parseInt(idFactura),
        numero_comprobante_sunat: facRes.data[0].numero_factura
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// DELETE /:id/facturas/:idFactura — elimina (soft) una factura por confusión/error
// de sistema (documento equivocado, mal vinculada, etc.). Distinto de "Anular"
// (que es una anulación formal hecha en el portal de SUNAT).
export async function eliminarFacturaVenta(req, res) {
  try {
    const { id, idFactura } = req.params;
    const { motivo_eliminacion } = req.body;
    const { id_empleado, rol } = req.user;

    if (!['Administrador', 'Gerencia', 'Administrativo'].includes(rol)) {
      return res.status(403).json({ success: false, error: 'No tienes permisos para eliminar facturas' });
    }

    if (!motivo_eliminacion || motivo_eliminacion.trim() === '') {
      return res.status(400).json({ success: false, error: 'El motivo de eliminación es obligatorio' });
    }

    const facRes = await executeQuery(
      'SELECT id_factura, numero_factura, estado FROM facturas_venta WHERE id_factura = ? AND id_orden_venta = ?',
      [idFactura, id]
    );

    if (!facRes.success || facRes.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Factura no encontrada para esta orden' });
    }

    if (facRes.data[0].estado === 'Eliminada') {
      return res.status(400).json({ success: false, error: 'Esta factura ya fue eliminada' });
    }

    // Libera el numero_factura del índice UNIQUE renombrándolo con un sufijo único.
    // El número legible queda igual en las columnas serie/numero para auditoría, y
    // como las 'Eliminada' nunca se muestran, el sufijo no afecta la vista.
    const upd = await executeQuery(
      `UPDATE facturas_venta
          SET estado = 'Eliminada', motivo_eliminacion = ?, fecha_eliminacion = ?, id_eliminado_por = ?,
              numero_factura = CONCAT(numero_factura, '#ELIM', id_factura)
        WHERE id_factura = ?`,
      [motivo_eliminacion.trim(), getFechaPeru(), id_empleado, idFactura]
    );

    if (!upd.success) {
      return res.status(500).json({ success: false, error: upd.error });
    }

    // Recalcula el resumen: al no contar 'Emitida', libera saldo y despacho.
    await sincronizarResumenFacturacion(id);

    res.json({
      success: true,
      message: 'Factura eliminada correctamente.',
      data: { id_factura: parseInt(idFactura), numero_factura: facRes.data[0].numero_factura }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getHistorialFacturasAnuladas(req, res) {
  try {
    const { id } = req.params;

    const result = await executeQuery(`
      SELECT
        fv.id_factura                              AS id_anulacion,
        fv.numero_factura                          AS numero_comprobante_sunat,
        fv.url_pdf                                 AS comprobante_sunat_url,
        fv.motivo_anulacion,
        COALESCE(fv.fecha_anulacion, fv.fecha_emision) AS fecha_anulacion,
        e.nombre_completo                          AS usuario_anulacion
      FROM facturas_venta fv
      LEFT JOIN empleados e ON fv.id_anulado_por = e.id_empleado
      WHERE fv.id_orden_venta = ? AND fv.estado = 'Anulada'
      ORDER BY COALESCE(fv.fecha_anulacion, fv.fecha_emision) DESC, fv.id_factura DESC
    `, [id]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const data = result.data.map(item => ({
      ...item,
      comprobante_sunat_url: extraerUrlPdf(item.comprobante_sunat_url)
    }));

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function asignarGuiaInternaASalida(req, res) {
  try {
    const { id, idSalida } = req.params;

    // 1. Verificar existencia de la orden y que sea Nota de Venta
    const ordenResult = await executeQuery(
      'SELECT id_orden_venta, numero_orden, tipo_comprobante, numero_guia_interna FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );

    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden de venta no encontrada' });
    }

    const orden = ordenResult.data[0];

    if (orden.tipo_comprobante !== 'Nota de Venta') {
      return res.status(400).json({ 
        success: false, 
        error: 'La Guía Interna solo se puede generar para Notas de Venta.' 
      });
    }

    // 2. Verificar existencia del despacho
    const salidaResult = await executeQuery(
      'SELECT id_salida, observaciones FROM salidas WHERE id_salida = ?',
      [idSalida]
    );

    if (!salidaResult.success || salidaResult.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Despacho no encontrado' });
    }

    const salida = salidaResult.data[0];

    // 3. Verificar si ya tiene una guía asignada
    const matchExistente = salida.observaciones.match(/GI-\d{4}-\d+/);
    if (matchExistente) {
      return res.status(400).json({ 
        success: false, 
        error: `Este despacho ya tiene asignada la guía ${matchExistente[0]}` 
      });
    }

    // 4. Búsqueda Inteligente Doble del Correlativo (Lógica MAX + 1)
    const year = new Date().getFullYear();
    
    // Buscar en Salidas
    const ultimaGuiaSalida = await executeQuery(`
        SELECT observaciones 
        FROM salidas 
        WHERE observaciones LIKE ? 
        ORDER BY id_salida DESC LIMIT 1
    `, [`GI-${year}-%`]);

    // Buscar en Ordenes de Venta
    const ultimaGuiaOV = await executeQuery(`
        SELECT numero_guia_interna
        FROM ordenes_venta
        WHERE numero_guia_interna LIKE ?
        ORDER BY id_orden_venta DESC LIMIT 1
    `, [`GI-${year}-%`]);

    let secSalida = 0;
    let secOV = 0;

    if (ultimaGuiaSalida.success && ultimaGuiaSalida.data.length > 0) {
        const match = ultimaGuiaSalida.data[0].observaciones.match(/GI-\d{4}-(\d+)/);
        if (match) secSalida = parseInt(match[1]);
    }

    if (ultimaGuiaOV.success && ultimaGuiaOV.data.length > 0) {
        const match = ultimaGuiaOV.data[0].numero_guia_interna.match(/GI-\d{4}-(\d+)/);
        if (match) secOV = parseInt(match[1]);
    }

    const secuenciaFinal = Math.max(secSalida, secOV) + 1;
    const numeroGuiaInterna = `GI-${year}-${String(secuenciaFinal).padStart(4, '0')}`;

    // 5. Actualizar despacho y orden
    // Si la observación original es 'Despacho Orden OV-XXXX', ahora será 'GI-2026-0025 - Despacho Orden OV-XXXX'
    const nuevaObservacion = `${numeroGuiaInterna} - ${salida.observaciones}`;
    
    const queries = [
      {
        sql: 'UPDATE salidas SET observaciones = ? WHERE id_salida = ?',
        params: [nuevaObservacion, idSalida]
      },
      {
        sql: 'UPDATE ordenes_venta SET numero_guia_interna = ? WHERE id_orden_venta = ?',
        params: [numeroGuiaInterna, id]
      }
    ];

    const resultUpdate = await executeTransaction(queries);

    if (!resultUpdate.success) {
      return res.status(500).json({ success: false, error: resultUpdate.error });
    }

    res.json({
      success: true,
      message: `Guía Interna ${numeroGuiaInterna} generada exitosamente`,
      data: {
        numero_guia_interna: numeroGuiaInterna
      }
    });

  } catch (error) {
    console.error('Error en asignarGuiaInternaASalida:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function parsearFacturaSunat(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se subió ningún archivo PDF.' });
    }
    
    // El archivo está en memoria gracias a multer.memoryStorage()
    const parsedData = await parseSunatInvoice(req.file.buffer);
    
    res.json({
      success: true,
      message: 'PDF parseado correctamente',
      data: parsedData
    });
  } catch (error) {
    console.error('Error en parsearFacturaSunat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getDocumentosAdicionales(req, res) {
  try {
    const { id } = req.params;
    const result = await executeQuery(`
      SELECT
        d.id_documento, d.id_salida, d.tipo_documento, d.correlativo, d.archivos_url, d.created_at,
        d.deleted_at, d.deleted_by,
        e.nombre_completo AS registrado_por,
        e2.nombre_completo AS eliminado_por
      FROM ordenes_venta_documentos d
      LEFT JOIN empleados e  ON d.id_registrado_por = e.id_empleado
      LEFT JOIN empleados e2 ON d.deleted_by = e2.id_empleado
      WHERE d.id_orden_venta = ?
      ORDER BY d.deleted_at IS NULL DESC, d.created_at DESC
    `, [id]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getDocumentosAdicionales:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function agregarDocumentoAdicional(req, res) {
  try {
    const { id } = req.params;
    const { tipo_documento, correlativo } = req.body;
    const id_registrado_por = req.user?.id_empleado || null;
    // id_salida opcional: cuando el documento (guía, etc.) se adjunta a un despacho concreto.
    const idSalida = req.body.id_salida ? parseInt(req.body.id_salida, 10) : null;

    if (!tipo_documento) {
      return res.status(400).json({ success: false, error: 'El tipo de documento es obligatorio' });
    }

    let archivosUrl = null;
    if (req.files && req.files.documentos_adicionales && req.files.documentos_adicionales.length > 0) {
      const urls = [];
      for (const file of req.files.documentos_adicionales) {
        const resultado = await subirArchivoACloudinary(file, 'indpack_ventas/documentos_adicionales');
        urls.push(resultado.secure_url);
      }
      archivosUrl = JSON.stringify(urls);
    }

    const result = await executeQuery(`
      INSERT INTO ordenes_venta_documentos (id_orden_venta, id_salida, tipo_documento, correlativo, archivos_url, id_registrado_por, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, idSalida, tipo_documento, correlativo || null, archivosUrl, id_registrado_por, getFechaPeru()]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const nuevo = await executeQuery(`
      SELECT d.*, e.nombre_completo AS registrado_por
      FROM ordenes_venta_documentos d
      LEFT JOIN empleados e ON d.id_registrado_por = e.id_empleado
      WHERE d.id_documento = ?
    `, [result.data.insertId]);

    res.status(201).json({ success: true, data: nuevo.data[0] });
  } catch (error) {
    console.error('Error en agregarDocumentoAdicional:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function eliminarDocumentoAdicional(req, res) {
  try {
    const { id, idDoc } = req.params;
    const id_usuario = req.user?.id_empleado || null;

    const existe = await executeQuery(
      'SELECT id_documento, deleted_at FROM ordenes_venta_documentos WHERE id_documento = ? AND id_orden_venta = ?',
      [idDoc, id]
    );
    if (!existe.success || existe.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Documento no encontrado' });
    }
    if (existe.data[0].deleted_at) {
      return res.status(400).json({ success: false, error: 'El documento ya fue eliminado' });
    }

    const result = await executeQuery(
      'UPDATE ordenes_venta_documentos SET deleted_at = ?, deleted_by = ? WHERE id_documento = ?',
      [getFechaPeru(), id_usuario, idDoc]
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    const actualizado = await executeQuery(`
      SELECT d.*, e.nombre_completo AS registrado_por, e2.nombre_completo AS eliminado_por
      FROM ordenes_venta_documentos d
      LEFT JOIN empleados e  ON d.id_registrado_por = e.id_empleado
      LEFT JOIN empleados e2 ON d.deleted_by = e2.id_empleado
      WHERE d.id_documento = ?
    `, [idDoc]);

    res.json({ success: true, data: actualizado.data[0] });
  } catch (error) {
    console.error('Error en eliminarDocumentoAdicional:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function verificarOC(req, res) {
  try {
    const { id } = req.params;
    const { verificado } = req.body;
    const id_usuario = req.user?.id_empleado || null;

    const estado = verificado ? 'Verificado' : 'Omitida';

    const result = await executeQuery(`
      UPDATE ordenes_venta
      SET
        estado_verificacion_oc = ?,
        verificado_oc_por = ?,
        fecha_verificacion_oc = ?
      WHERE id_orden_venta = ?
    `, [
      estado,
      verificado ? id_usuario : null,
      verificado ? getFechaPeru() : null,
      id
    ]);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: { estado_verificacion_oc: estado } });
  } catch (error) {
    console.error('Error en verificarOC:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ==========================================================================
// FACTURACIÓN SUNAT (multi-factura por orden — tabla facturas_venta)
// ==========================================================================

// Normaliza el valor de url_pdf (JSON en BD) a una URL string simple.
function extraerUrlPdf(v) {
  if (!v) return null;
  let val = v;
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.startsWith('[') || s.startsWith('{')) {
      try { val = JSON.parse(s); } catch { return s; }
    } else {
      return s;
    }
  }
  if (Array.isArray(val)) return val[0] || null;
  if (typeof val === 'object' && val !== null) return val.url || null;
  return null;
}

// Deriva subtotal e IGV a partir del importe total y la config de impuesto de la orden.
function derivarMontosFactura(total, orden) {
  const t = parseFloat(total) || 0;
  const pct = parseFloat(orden?.porcentaje_impuesto || 0);
  const tipo = String(orden?.tipo_impuesto || '').toUpperCase();
  const sinIgv = pct <= 0 || ['EXO', 'EXONERADO', 'INA', 'INAFECTO', 'INAFECTA'].includes(tipo);
  if (sinIgv) {
    return { subtotal: +t.toFixed(4), igv: 0, total: +t.toFixed(4) };
  }
  const subtotal = +(t / (1 + pct / 100)).toFixed(4);
  const igv = +(t - subtotal).toFixed(4);
  return { subtotal, igv, total: +t.toFixed(4) };
}

// Recalcula los campos resumen de facturación en ordenes_venta desde facturas_venta.
// Mantiene compatibilidad con el listado y las vistas que leen ov.facturado_sunat, etc.
async function sincronizarResumenFacturacion(idOrden) {
  const emitidas = await executeQuery(
    `SELECT id_factura, numero_factura, url_pdf, fecha_emision, id_registrado_por
       FROM facturas_venta
      WHERE id_orden_venta = ? AND estado = 'Emitida'
        AND (codigo_tipo_sunat IS NULL OR codigo_tipo_sunat NOT IN ('07','08'))
        AND (sunat_estado IS NULL OR sunat_estado = 'ACEPTADO')
      ORDER BY fecha_emision ASC, id_factura ASC`,
    [idOrden]
  );
  const rows = emitidas.success ? emitidas.data : [];
  const count = rows.length;

  let facturado = 0, numero = null, fecha = null, url = null, facturador = null;
  if (count > 0) {
    const ultima = rows[rows.length - 1];
    facturado = 1;
    numero = count === 1 ? rows[0].numero_factura : `${count} facturas`;
    fecha = ultima.fecha_emision;
    const urlUltima = extraerUrlPdf(ultima.url_pdf);
    url = urlUltima ? JSON.stringify([urlUltima]) : null;
    facturador = ultima.id_registrado_por || null;
  }

  await executeQuery(
    `UPDATE ordenes_venta
        SET facturado_sunat = ?, numero_comprobante_sunat = ?, fecha_facturacion_sunat = ?,
            comprobante_sunat_url = ?, id_facturador = ?
      WHERE id_orden_venta = ?`,
    [facturado, numero, fecha, url, facturador, idOrden]
  );
}

// GET /:id/facturas — todas las facturas (Emitidas y Anuladas) + resumen de saldo.
export async function getFacturasOrden(req, res) {
  try {
    const { id } = req.params;

    const ordenRes = await executeQuery(
      'SELECT total, moneda FROM ordenes_venta WHERE id_orden_venta = ?',
      [id]
    );
    if (!ordenRes.success || ordenRes.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }

    const facturasRes = await executeQuery(`
      SELECT
        fv.id_factura, fv.numero_factura, fv.serie, fv.numero, fv.tipo_comprobante,
        fv.fecha_emision, fv.subtotal, fv.igv, fv.total, fv.moneda, fv.estado,
        fv.url_pdf, fv.motivo_anulacion, fv.fecha_anulacion, fv.id_salida,
        fv.sunat_estado, fv.codigo_tipo_sunat, fv.sunat_ticket,
        fv.sunat_response_code, fv.sunat_response_desc,
        fv.xml_url, fv.cdr_url, fv.id_factura_ref, fv.motivo_nota_codigo,
        e.nombre_completo  AS registrado_por,
        e2.nombre_completo AS anulado_por
      FROM facturas_venta fv
      LEFT JOIN empleados e  ON fv.id_registrado_por = e.id_empleado
      LEFT JOIN empleados e2 ON fv.id_anulado_por = e2.id_empleado
      WHERE fv.id_orden_venta = ? AND fv.estado != 'Eliminada'
      ORDER BY (fv.estado = 'Anulada'), fv.fecha_emision ASC, fv.id_factura ASC
    `, [id]);

    if (!facturasRes.success) {
      return res.status(500).json({ success: false, error: facturasRes.error });
    }

    const facturas = facturasRes.data.map(f => ({
      ...f,
      url_pdf: extraerUrlPdf(f.url_pdf),
      xml_url: extraerUrlPdf(f.xml_url),
      cdr_url: extraerUrlPdf(f.cdr_url)
    }));
    // Solo suman al facturado las facturas realmente vigentes: FACTURAS (01) o manuales, en estado
    // 'Emitida' y aceptadas por SUNAT. Se EXCLUYEN: notas de crédito/débito (07/08 — no facturan la OV,
    // solo ajustan/anulan), rechazadas/enviadas/error, y las dadas de baja (BAJA). Así el total facturado
    // y el saldo no se inflan con la NC ni con documentos sin efecto.
    const emitidas = facturas.filter(f =>
      f.estado === 'Emitida' &&
      f.codigo_tipo_sunat !== '07' && f.codigo_tipo_sunat !== '08' &&
      (!f.sunat_estado || f.sunat_estado === 'ACEPTADO'));
    const totalOrden = parseFloat(ordenRes.data[0].total || 0);
    const totalFacturado = emitidas.reduce((s, f) => s + parseFloat(f.total || 0), 0);
    const saldoPendiente = +(totalOrden - totalFacturado).toFixed(2);

    res.json({
      success: true,
      data: {
        facturas,
        resumen: {
          total_orden: +totalOrden.toFixed(2),
          total_facturado: +totalFacturado.toFixed(2),
          saldo_pendiente: saldoPendiente,
          count_emitidas: emitidas.length,
          moneda: ordenRes.data[0].moneda || 'PEN'
        }
      }
    });
  } catch (error) {
    console.error('Error en getFacturasOrden:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function vincularFacturaSunat(req, res) {
  try {
    const { id } = req.params;
    let { numero_comprobante_sunat, fecha_facturacion_sunat, importe_total, comprobante_url, forzar } = req.body;
    const id_empleado = req.user?.id_empleado || null;
    // id_salida opcional: cuando la factura se sube desde un despacho concreto.
    const idSalida = req.body.id_salida ? parseInt(req.body.id_salida, 10) : null;
    const forzarBool = forzar === true || forzar === 'true' || forzar === 1 || forzar === '1';

    if (!numero_comprobante_sunat || !numero_comprobante_sunat.trim()) {
      return res.status(400).json({ success: false, error: 'El número de comprobante es obligatorio.' });
    }
    if (!req.file && !comprobante_url) {
      return res.status(400).json({ success: false, error: 'Se requiere el archivo PDF de la factura.' });
    }

    const numero = numero_comprobante_sunat.trim();

    const ordenRes = await executeQuery(
      `SELECT id_orden_venta, numero_orden, id_cliente, total, moneda, porcentaje_impuesto, tipo_impuesto
         FROM ordenes_venta WHERE id_orden_venta = ?`,
      [id]
    );
    if (!ordenRes.success || ordenRes.data.length === 0) {
      return res.status(404).json({ success: false, error: 'Orden no encontrada' });
    }
    const orden = ordenRes.data[0];

    // Si viene id_salida: validar que el despacho pertenece a esta orden y
    // aplicar la regla blanda "1 factura por despacho" (avisa, permite forzar).
    // Guardamos el valor del despacho para validar el monto de la factura más abajo.
    let totalDespacho = null;      // salidas.total_precio del despacho
    let yaFacturadoDespacho = 0;   // suma facturas Emitidas ya vinculadas a este despacho
    if (idSalida) {
      const salidaRes = await executeQuery(
        `SELECT id_salida, total_precio FROM salidas
          WHERE id_salida = ?
            AND (id_orden_venta = ? OR (id_orden_venta IS NULL AND observaciones LIKE ?))`,
        [idSalida, id, `%${orden.numero_orden}%`]
      );
      if (!salidaRes.success || salidaRes.data.length === 0) {
        return res.status(400).json({ success: false, error: 'El despacho indicado no pertenece a esta orden.' });
      }
      totalDespacho = parseFloat(salidaRes.data[0].total_precio || 0);

      const yaFactSalida = await executeQuery(
        `SELECT COALESCE(SUM(total), 0) AS suma,
                (SELECT numero_factura FROM facturas_venta WHERE id_salida = ? AND estado = 'Emitida' LIMIT 1) AS primera
           FROM facturas_venta WHERE id_salida = ? AND estado = 'Emitida'`,
        [idSalida, idSalida]
      );
      yaFacturadoDespacho = parseFloat(yaFactSalida.data?.[0]?.suma || 0);
      const primeraFactura = yaFactSalida.data?.[0]?.primera || null;

      if (primeraFactura && !forzarBool) {
        return res.status(409).json({
          success: false,
          code: 'DESPACHO_YA_FACTURADO',
          error: `Este despacho ya tiene una factura vinculada (${primeraFactura}). ¿Deseas vincular otra de todas formas?`
        });
      }
    }

    // Duplicado: numero_factura es UNIQUE global. Las 'Eliminada' (error de sistema)
    // se ignoran para permitir volver a registrar incluso el mismo número.
    const dup = await executeQuery(
      "SELECT id_factura, id_orden_venta FROM facturas_venta WHERE numero_factura = ? AND estado != 'Eliminada'",
      [numero]
    );
    if (dup.success && dup.data.length > 0) {
      return res.status(400).json({ success: false, error: `El comprobante ${numero} ya está registrado en el sistema.` });
    }

    // Validación de saldo pendiente
    const totalNuevo = parseFloat(String(importe_total ?? '').replace(/,/g, '')) || parseFloat(orden.total) || 0;
    const totalOrden = parseFloat(orden.total || 0);
    const sumaRes = await executeQuery(
      `SELECT COALESCE(SUM(total), 0) AS suma FROM facturas_venta WHERE id_orden_venta = ? AND estado = 'Emitida'`,
      [id]
    );
    const yaFacturado = parseFloat(sumaRes.data?.[0]?.suma || 0);
    const tolerancia = 1;

    if ((yaFacturado + totalNuevo) > (totalOrden + tolerancia) && !forzarBool) {
      const saldo = +(totalOrden - yaFacturado).toFixed(2);
      return res.status(409).json({
        success: false,
        code: 'EXCEDE_SALDO',
        error: `El total de esta factura (${totalNuevo.toFixed(2)}) excede el saldo pendiente de facturar (${saldo.toFixed(2)}) de la orden.`,
        data: { saldo_pendiente: saldo, total_facturado: +yaFacturado.toFixed(2), total_orden: totalOrden }
      });
    }

    // Validación por despacho: la factura (incluye IGV) no debe exceder el valor
    // del despacho CON IGV. El total_precio de la salida es neto (sin IGV), así que
    // lo llevamos a bruto con la config de impuesto de la orden.
    if (idSalida && totalDespacho > 0) {
      const pctImp = parseFloat(orden.porcentaje_impuesto || 0);
      const tipoImp = String(orden.tipo_impuesto || '').toUpperCase();
      const sinIgv = pctImp <= 0 || ['EXO', 'EXONERADO', 'INA', 'INAFECTO', 'INAFECTA'].includes(tipoImp);
      const totalDespachoConIgv = sinIgv ? totalDespacho : totalDespacho * (1 + pctImp / 100);

      if ((yaFacturadoDespacho + totalNuevo) > (totalDespachoConIgv + tolerancia) && !forzarBool) {
        const saldoDespacho = +(totalDespachoConIgv - yaFacturadoDespacho).toFixed(2);
        return res.status(409).json({
          success: false,
          code: 'EXCEDE_DESPACHO',
          error: `El total de esta factura (${totalNuevo.toFixed(2)}) excede el valor pendiente de facturar de este despacho (${saldoDespacho.toFixed(2)}, valor del despacho c/IGV: ${totalDespachoConIgv.toFixed(2)}).`,
          data: { saldo_despacho: saldoDespacho, total_facturado_despacho: +yaFacturadoDespacho.toFixed(2), total_despacho: +totalDespachoConIgv.toFixed(2) }
        });
      }
    }

    // Subir PDF a Cloudinary
    if (req.file) {
      const resultCloudinary = await subirArchivoACloudinary(req.file, 'indpack_ventas/facturas_sunat');
      comprobante_url = resultCloudinary.secure_url;
    }
    const urlJSON = comprobante_url ? JSON.stringify([comprobante_url]) : null;

    const serie = numero.includes('-') ? numero.split('-')[0] : (numero.slice(0, 4) || 'F001');
    const correlativo = numero.includes('-') ? (parseInt(numero.split('-').pop(), 10) || 0) : 0;
    const montos = derivarMontosFactura(totalNuevo, orden);

    const insert = await executeQuery(
      `INSERT INTO facturas_venta
         (numero_factura, id_orden_venta, id_salida, id_cliente, fecha_emision, tipo_comprobante,
          serie, numero, subtotal, igv, total, moneda, estado, url_pdf, id_registrado_por)
       VALUES (?, ?, ?, ?, ?, 'Factura', ?, ?, ?, ?, ?, ?, 'Emitida', ?, ?)`,
      [
        numero, id, idSalida, orden.id_cliente, fecha_facturacion_sunat || getFechaPeru(),
        serie, correlativo, montos.subtotal, montos.igv, montos.total,
        orden.moneda || 'PEN', urlJSON, id_empleado
      ]
    );
    if (!insert.success) {
      return res.status(500).json({ success: false, error: 'Error al registrar la factura', details: insert.error });
    }

    await sincronizarResumenFacturacion(id);

    res.json({
      success: true,
      message: 'Factura registrada y vinculada exitosamente',
      data: {
        id_factura: insert.data.insertId,
        numero_comprobante_sunat: numero,
        comprobante_url
      }
    });
  } catch (error) {
    console.error('Error en vincularFacturaSunat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
