import { executeQuery } from '../config/database.js';
import { 
  obtenerTipoCambioCache,
  actualizarTipoCambio,
  convertirPENaUSD 
} from '../services/tipo-cambio.service.js';

export const obtenerTipoCambioActual = async (req, res) => {
  try {
    const tipoCambio = obtenerTipoCambioCache();
    
    res.json({ 
      success: true, 
      data: tipoCambio 
    });
  } catch (error) {
    console.error('Error al obtener tipo de cambio:', error);
    res.status(500).json({ 
      error: 'Error al obtener tipo de cambio', 
      details: error.message 
    });
  }
};

export const actualizarTipoCambioManual = async (req, res) => {
  try {
    console.log('🔴 CONSUMIENDO API DE TIPO DE CAMBIO - ACCIÓN MANUAL');
    
    const { currency = 'USD', date = null } = req.query;
    
    const tipoCambio = await actualizarTipoCambio(currency, date);

    if (tipoCambio.valido) {
      res.json({
        success: true,
        data: tipoCambio,
        message: 'Tipo de cambio actualizado correctamente'
      });
    } else {
      res.status(400).json({
        success: false,
        error: tipoCambio.error || 'No se pudo obtener el tipo de cambio'
      });
    }

  } catch (error) {
    console.error('Error al actualizar tipo de cambio:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar tipo de cambio'
    });
  }
};

export const obtenerResumenGeneral = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const tipoCambio = obtenerTipoCambioCache();
    
    let whereDateOV = '';
    let whereDateEntradas = '';
    let whereDateSalidas = '';
    let paramsDate = [];

    if (fecha_inicio && fecha_fin) {
      whereDateOV = ' AND ov.fecha_emision BETWEEN ? AND ?';
      whereDateEntradas = ' AND fecha_movimiento BETWEEN ? AND ?';
      whereDateSalidas = ' AND fecha_movimiento BETWEEN ? AND ?';
      paramsDate = [fecha_inicio, fecha_fin];
    }

    // KPIs DE VENTAS REALES EN EL PERIODO (No valorización de stock)
    const ventasPeriodoResult = await executeQuery(
      `SELECT 
        SUM(CASE WHEN moneda = 'PEN' THEN total ELSE 0 END) AS ventas_pen,
        SUM(CASE WHEN moneda = 'USD' THEN total ELSE 0 END) AS ventas_usd,
        COUNT(*) AS total_ordenes
       FROM ordenes_venta ov
       WHERE estado != 'Anulado' ${whereDateOV}`,
      paramsDate
    );

    // COSTOS DE SALIDAS (COSTO DE VENTAS/CONSUMO) EN EL PERIODO
    const costosPeriodoResult = await executeQuery(
      `SELECT 
        SUM(CASE WHEN moneda = 'PEN' THEN total_precio ELSE 0 END) AS costos_pen,
        SUM(CASE WHEN moneda = 'USD' THEN total_precio ELSE 0 END) AS costos_usd
       FROM salidas s
       WHERE estado = 'Activo' ${whereDateSalidas}`,
      paramsDate
    );

    const productosActivosResult = await executeQuery(
      'SELECT COUNT(*) AS total_productos FROM productos WHERE estado = ?',
      ['Activo']
    );

    const empleadosResult = await executeQuery(
      'SELECT COUNT(*) AS total_empleados FROM empleados WHERE estado = ?',
      ['Activo']
    );

    const ordenesResult = await executeQuery(
      `SELECT COUNT(*) AS ordenes_activas 
       FROM ordenes_produccion 
       WHERE estado IN ('Pendiente', 'En Proceso', 'En Pausa')`
    );

    const stockBajoResult = await executeQuery(
      `SELECT COUNT(*) AS productos_stock_bajo 
       FROM productos 
       WHERE estado = 'Activo' 
       AND stock_actual > 0 
       AND stock_actual <= stock_minimo`
    );

    // TOP 10 PRODUCTOS MAS VENDIDOS/SALIDOS
    const topProductosResult = await executeQuery(
      `SELECT 
        p.id_producto,
        p.nombre,
        p.codigo,
        ti.nombre AS tipo_inventario,
        SUM(ds.cantidad) AS total_cantidad,
        SUM(CASE WHEN s.moneda = 'PEN' THEN ds.cantidad * ds.precio_unitario ELSE 0 END) AS valor_pen,
        SUM(CASE WHEN s.moneda = 'USD' THEN ds.cantidad * ds.precio_unitario ELSE 0 END) AS valor_usd
       FROM detalle_salidas ds
       INNER JOIN salidas s ON ds.id_salida = s.id_salida
       INNER JOIN productos p ON ds.id_producto = p.id_producto
       INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
       WHERE s.estado = 'Activo' ${whereDateSalidas}
       GROUP BY p.id_producto
       ORDER BY total_cantidad DESC
       LIMIT 10`,
      paramsDate
    );

    // TOP 10 CLIENTES
    const topClientesResult = await executeQuery(
      `SELECT 
        c.id_cliente,
        c.razon_social,
        COUNT(ov.id_orden_venta) AS total_ordenes,
        SUM(CASE WHEN ov.moneda = 'PEN' THEN ov.total ELSE 0 END) AS monto_pen,
        SUM(CASE WHEN ov.moneda = 'USD' THEN ov.total ELSE 0 END) AS monto_usd
       FROM ordenes_venta ov
       INNER JOIN clientes c ON ov.id_cliente = c.id_cliente
       WHERE ov.estado != 'Anulado' ${whereDateOV}
       GROUP BY c.id_cliente
       ORDER BY monto_pen DESC, monto_usd DESC
       LIMIT 10`,
      paramsDate
    );

    const valoracionPorTipoResult = await executeQuery(
      `SELECT 
        ti.id_tipo_inventario,
        ti.nombre AS tipo_inventario,
        COUNT(p.id_producto) AS total_productos,
        COALESCE(SUM(p.stock_actual), 0) AS stock_total,
        COALESCE(SUM(p.stock_actual * p.costo_unitario_promedio), 0) AS valor_almacen_pen
       FROM tipos_inventario ti
       LEFT JOIN productos p ON ti.id_tipo_inventario = p.id_tipo_inventario AND p.estado = 'Activo'
       WHERE ti.estado = 'Activo'
       GROUP BY ti.id_tipo_inventario, ti.nombre
       ORDER BY ti.nombre ASC`
    );

    res.json({
      success: true,
      periodo: { inicio: fecha_inicio, fin: fecha_fin },
      
      // KPIs Resumen Periodo
      resumen_ventas: {
        pen: parseFloat(ventasPeriodoResult.data?.[0]?.ventas_pen || 0),
        usd: parseFloat(ventasPeriodoResult.data?.[0]?.ventas_usd || 0),
        cantidad: ventasPeriodoResult.data?.[0]?.total_ordenes || 0
      },
      resumen_costos: {
        pen: parseFloat(costosPeriodoResult.data?.[0]?.costos_pen || 0),
        usd: parseFloat(costosPeriodoResult.data?.[0]?.costos_usd || 0)
      },

      // Stats Generales
      total_productos: productosActivosResult.data?.[0]?.total_productos || 0,
      total_empleados: empleadosResult.data?.[0]?.total_empleados || 0,
      ordenes_activas: ordenesResult.data?.[0]?.ordenes_activas || 0,
      productos_stock_bajo: stockBajoResult.data?.[0]?.productos_stock_bajo || 0,
      
      // Rankings
      top_productos: (topProductosResult.data || []).map(p => ({
        ...p,
        total_cantidad: parseFloat(p.total_cantidad || 0),
        valor_pen: parseFloat(p.valor_pen || 0),
        valor_usd: parseFloat(p.valor_usd || 0)
      })),

      top_clientes: (topClientesResult.data || []).map(c => ({
        ...c,
        monto_pen: parseFloat(c.monto_pen || 0),
        monto_usd: parseFloat(c.monto_usd || 0)
      })),

      // Valorización Actual (Independiente del periodo de tiempo)
      valoracion_stock: (valoracionPorTipoResult.data || []).map(tipo => ({
        ...tipo,
        stock_total: parseFloat(tipo.stock_total || 0),
        valor_pen: parseFloat(tipo.valor_almacen_pen || 0)
      })),
      
      tipo_cambio: tipoCambio.valido ? tipoCambio : null
    });

  } catch (error) {
    console.error('Error al obtener resumen general:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const obtenerInventarioValorizado = async (req, res) => {
  try {
    const { id_tipo_inventario, stock_bajo } = req.query;

    let query = `
      SELECT 
        p.id_producto,
        p.codigo,
        p.nombre,
        ti.nombre AS tipo_inventario,
        p.unidad_medida,
        p.stock_actual,
        p.stock_minimo,
        p.stock_maximo,
        p.costo_unitario_promedio,
        p.precio_venta,
        p.requiere_receta,
        CASE 
          WHEN p.costo_unitario_promedio > 0 THEN p.costo_unitario_promedio
          WHEN p.requiere_receta = 1 THEN COALESCE((
            SELECT SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / NULLIF(MAX(rp.rendimiento_unidades), 0)
            FROM recetas_productos rp
            INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
            INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
            WHERE rp.id_producto_terminado = p.id_producto 
            AND rp.es_principal = 1 
            AND rp.es_activa = 1
            GROUP BY rp.id_receta_producto
          ), 0)
          WHEN p.precio_venta > 0 THEN p.precio_venta
          ELSE 0
        END AS costo_efectivo,
        (p.stock_actual * CASE 
            WHEN p.costo_unitario_promedio > 0 THEN p.costo_unitario_promedio
            WHEN p.requiere_receta = 1 THEN COALESCE((
              SELECT SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / NULLIF(MAX(rp.rendimiento_unidades), 0)
              FROM recetas_productos rp
              INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
              INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
              WHERE rp.id_producto_terminado = p.id_producto 
              AND rp.es_principal = 1 
              AND rp.es_activa = 1
              GROUP BY rp.id_receta_producto
            ), 0)
            WHEN p.precio_venta > 0 THEN p.precio_venta
            ELSE 0
          END
        ) AS valor_inventario,
        CASE
          WHEN p.stock_actual = 0 THEN 'Sin Stock'
          WHEN p.stock_actual <= p.stock_minimo THEN 'Stock Bajo'
          WHEN p.stock_actual >= p.stock_maximo THEN 'Stock Excedido'
          ELSE 'Normal'
        END AS estado_stock,
        CASE 
          WHEN ti.nombre IN ('Productos Terminados', 'Productos de Reventa') AND p.precio_venta > 0 
          THEN (p.precio_venta - 
            CASE 
              WHEN p.costo_unitario_promedio > 0 THEN p.costo_unitario_promedio
              WHEN p.requiere_receta = 1 THEN COALESCE((
                SELECT SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / NULLIF(MAX(rp.rendimiento_unidades), 0)
                FROM recetas_productos rp
                INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
                INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
                WHERE rp.id_producto_terminado = p.id_producto 
                AND rp.es_principal = 1 
                AND rp.es_activa = 1
                GROUP BY rp.id_receta_producto
              ), 0)
              ELSE p.precio_venta
            END
          )
          ELSE NULL
        END AS margen_unitario
      FROM productos p
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE p.estado = 'Activo'
    `;

    const params = [];

    if (id_tipo_inventario) {
      query += ' AND p.id_tipo_inventario = ?';
      params.push(id_tipo_inventario);
    }

    if (stock_bajo === 'true') {
      query += ' AND p.stock_actual <= p.stock_minimo AND p.stock_actual > 0';
    }

    query += ' ORDER BY ti.nombre, p.nombre';

    const result = await executeQuery(query, params);

    res.json({
      productos: result.data.map(p => ({
        ...p,
        stock_actual: parseFloat(p.stock_actual),
        costo_unitario_promedio: parseFloat(p.costo_unitario_promedio),
        precio_venta: parseFloat(p.precio_venta || 0),
        costo_efectivo: parseFloat(p.costo_efectivo),
        valor_inventario: parseFloat(p.valor_inventario),
        margen_unitario: p.margen_unitario ? parseFloat(p.margen_unitario) : null
      })),
      total: result.data.length
    });

  } catch (error) {
    console.error('Error al obtener inventario valorizado:', error);
    res.status(500).json({ 
      error: 'Error al obtener inventario valorizado', 
      details: error.message 
    });
  }
};

export const obtenerProductosConCosto = async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id_producto, p.codigo, p.nombre,
        ti.nombre AS tipo_inventario, p.unidad_medida,
        p.stock_actual, p.stock_minimo, p.stock_maximo,
        p.costo_unitario_promedio,
        p.costo_unitario_promedio AS costo_efectivo,
        (p.stock_actual * p.costo_unitario_promedio) AS valor_inventario,
        CASE
          WHEN p.stock_actual = 0 THEN 'Sin Stock'
          WHEN p.stock_actual <= p.stock_minimo THEN 'Stock Bajo'
          WHEN p.stock_actual >= p.stock_maximo THEN 'Stock Excedido'
          ELSE 'Normal'
        END AS estado_stock
      FROM productos p
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE p.estado = 'Activo'
    `;
    const result = await executeQuery(query);

    res.json({
      productos: result.data.map(p => ({
        ...p,
        stock_actual: parseFloat(p.stock_actual),
        costo_unitario_promedio: parseFloat(p.costo_unitario_promedio),
        precio_venta: parseFloat(p.precio_venta || 0),
        margen_unitario: parseFloat(p.margen_unitario || 0),
        margen_porcentaje: parseFloat(p.margen_porcentaje || 0),
        tiene_receta: p.tiene_receta === 1
      })),
      total: result.data.length
    });
  } catch (error) {
    console.error('Error al obtener productos con costo:', error);
    res.status(500).json({ 
      error: 'Error al obtener productos con costo', 
      details: error.message 
    });
  }
};

export const obtenerEstadisticasMovimientos = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    const tipoCambio = obtenerTipoCambioCache();

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (fecha_inicio) {
      whereClause += ' AND DATE(fecha_movimiento) >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereClause += ' AND DATE(fecha_movimiento) <= ?';
      params.push(fecha_fin);
    }

    const entradasResult = await executeQuery(
      `SELECT 
        COUNT(*) AS total_entradas,
        COALESCE(SUM(CASE WHEN moneda = 'PEN' THEN total_costo ELSE 0 END), 0) AS valor_entradas_pen,
        COALESCE(SUM(CASE WHEN moneda = 'USD' THEN total_costo ELSE 0 END), 0) AS valor_entradas_usd,
        COUNT(DISTINCT DATE(fecha_movimiento)) AS dias_con_movimiento
       FROM entradas ${whereClause} AND estado = 'Activo'`, 
      params
    );

    const salidasResult = await executeQuery(
      `SELECT 
        COUNT(*) AS total_salidas,
        COALESCE(SUM(CASE WHEN moneda = 'PEN' THEN total_precio ELSE 0 END), 0) AS valor_salidas_pen,
        COALESCE(SUM(CASE WHEN moneda = 'USD' THEN total_precio ELSE 0 END), 0) AS valor_salidas_usd,
        COUNT(DISTINCT DATE(fecha_movimiento)) AS dias_con_movimiento
       FROM salidas ${whereClause} AND estado = 'Activo'`, 
      params
    );

    const entradasMensualesResult = await executeQuery(
      `SELECT 
        DATE_FORMAT(fecha_movimiento, '%Y-%m') AS mes,
        DATE_FORMAT(fecha_movimiento, '%b %Y') AS mes_nombre,
        COALESCE(SUM(CASE WHEN moneda = 'PEN' THEN total_costo ELSE 0 END), 0) AS valor_entradas_pen,
        COALESCE(SUM(CASE WHEN moneda = 'USD' THEN total_costo ELSE 0 END), 0) AS valor_entradas_usd
       FROM entradas 
       WHERE fecha_movimiento >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND estado = 'Activo'
       GROUP BY DATE_FORMAT(fecha_movimiento, '%Y-%m'), DATE_FORMAT(fecha_movimiento, '%b %Y')
       ORDER BY mes DESC`
    );

    const salidasMensualesResult = await executeQuery(
      `SELECT 
        DATE_FORMAT(fecha_movimiento, '%Y-%m') AS mes,
        DATE_FORMAT(fecha_movimiento, '%b %Y') AS mes_nombre,
        COALESCE(SUM(CASE WHEN moneda = 'PEN' THEN total_precio ELSE 0 END), 0) AS valor_salidas_pen,
        COALESCE(SUM(CASE WHEN moneda = 'USD' THEN total_precio ELSE 0 END), 0) AS valor_salidas_usd
       FROM salidas 
       WHERE fecha_movimiento >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND estado = 'Activo'
       GROUP BY DATE_FORMAT(fecha_movimiento, '%Y-%m'), DATE_FORMAT(fecha_movimiento, '%b %Y')
       ORDER BY mes DESC`
    );

    const movimientosPorMes = {};
    
    entradasMensualesResult.data.forEach(row => {
      if (!movimientosPorMes[row.mes]) {
        movimientosPorMes[row.mes] = { 
          mes: row.mes, 
          mes_nombre: row.mes_nombre, 
          entradas_pen: 0,
          entradas_usd: 0,
          salidas_pen: 0,
          salidas_usd: 0
        };
      }
      movimientosPorMes[row.mes].entradas_pen = parseFloat(row.valor_entradas_pen || 0);
      movimientosPorMes[row.mes].entradas_usd = parseFloat(row.valor_entradas_usd || 0);
    });

    salidasMensualesResult.data.forEach(row => {
      if (!movimientosPorMes[row.mes]) {
        movimientosPorMes[row.mes] = { 
          mes: row.mes, 
          mes_nombre: row.mes_nombre, 
          entradas_pen: 0,
          entradas_usd: 0,
          salidas_pen: 0,
          salidas_usd: 0
        };
      }
      movimientosPorMes[row.mes].salidas_pen = parseFloat(row.valor_salidas_pen || 0);
      movimientosPorMes[row.mes].salidas_usd = parseFloat(row.valor_salidas_usd || 0);
    });

    const movimientosMensuales = Object.values(movimientosPorMes)
      .map(m => ({
        mes: m.mes, 
        mes_nombre: m.mes_nombre,
        entradas_pen: m.entradas_pen,
        entradas_usd: m.entradas_usd,
        salidas_pen: m.salidas_pen,
        salidas_usd: m.salidas_usd,
        entradas_pen_total: m.entradas_pen + (tipoCambio.valido ? m.entradas_usd * tipoCambio.venta : m.entradas_usd * 3.80),
        salidas_pen_total: m.salidas_pen + (tipoCambio.valido ? m.salidas_usd * tipoCambio.venta : m.salidas_usd * 3.80),
        entradas_usd_total: (tipoCambio.valido ? convertirPENaUSD(m.entradas_pen, tipoCambio) : m.entradas_pen / 3.80) + m.entradas_usd,
        salidas_usd_total: (tipoCambio.valido ? convertirPENaUSD(m.salidas_pen, tipoCambio) : m.salidas_pen / 3.80) + m.salidas_usd
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6);

    const valor_entradas_pen = parseFloat(entradasResult.data[0].valor_entradas_pen);
    const valor_entradas_usd = parseFloat(entradasResult.data[0].valor_entradas_usd);
    const valor_salidas_pen = parseFloat(salidasResult.data[0].valor_salidas_pen);
    const valor_salidas_usd = parseFloat(salidasResult.data[0].valor_salidas_usd);

    const total_entradas_pen = valor_entradas_pen + (tipoCambio.valido ? valor_entradas_usd * tipoCambio.venta : valor_entradas_usd * 3.80);
    const total_salidas_pen = valor_salidas_pen + (tipoCambio.valido ? valor_salidas_usd * tipoCambio.venta : valor_salidas_usd * 3.80);

    const total_entradas_usd = (tipoCambio.valido ? convertirPENaUSD(valor_entradas_pen, tipoCambio) : valor_entradas_pen / 3.80) + valor_entradas_usd;
    const total_salidas_usd = (tipoCambio.valido ? convertirPENaUSD(valor_salidas_pen, tipoCambio) : valor_salidas_pen / 3.80) + valor_salidas_usd;

    res.json({
      entradas: {
        total: entradasResult.data[0].total_entradas,
        valor_pen: valor_entradas_pen,
        valor_usd: valor_entradas_usd,
        valor_total_pen: total_entradas_pen,
        valor_total_usd: total_entradas_usd,
        dias_activos: entradasResult.data[0].dias_con_movimiento
      },
      salidas: {
        total: salidasResult.data[0].total_salidas,
        valor_pen: valor_salidas_pen,
        valor_usd: valor_salidas_usd,
        valor_total_pen: total_salidas_pen,
        valor_total_usd: total_salidas_usd,
        dias_activos: salidasResult.data[0].dias_con_movimiento
      },
      movimientos_mensuales: movimientosMensuales,
      tipo_cambio: tipoCambio.valido ? {
        compra: tipoCambio.compra, 
        venta: tipoCambio.venta,
        promedio: tipoCambio.promedio, 
        fecha: tipoCambio.fecha
      } : null
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de movimientos:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas', 
      details: error.message 
    });
  }
};

export const obtenerTopProductos = async (req, res) => {
  try {
    const { tipo = 'valor', limit = 10 } = req.query;

    let orderBy = 'valor_inventario DESC';
    if (tipo === 'cantidad') orderBy = 'stock_actual DESC';
    else if (tipo === 'rotacion') orderBy = 'fecha_registro DESC';

    const query = `
      SELECT p.codigo, p.nombre, ti.nombre AS tipo_inventario,
      p.stock_actual, p.costo_unitario_promedio,
      (p.stock_actual * p.costo_unitario_promedio) AS valor_inventario, 
      p.fecha_registro
      FROM productos p
      INNER JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE p.estado = 'Activo' AND p.stock_actual > 0
      ORDER BY ${orderBy} LIMIT ?
    `;

    const result = await executeQuery(query, [parseInt(limit)]);

    res.json({
      productos: result.data.map(p => ({
        ...p,
        stock_actual: parseFloat(p.stock_actual),
        costo_unitario_promedio: parseFloat(p.costo_unitario_promedio),
        valor_inventario: parseFloat(p.valor_inventario)
      })),
      total: result.data.length
    });
    } catch (error) {
    console.error('Error al obtener top productos:', error);
    res.status(500).json({
      error: 'Error al obtener top productos',
      details: error.message
    });
    }
    };

    export const obtenerProduccionFinalizada = async (req, res) => {
    try {
    const { fecha_inicio, fecha_fin, limit = 10 } = req.query;

    let whereDate = '';
    let params = [];

    if (fecha_inicio && fecha_fin) {
      whereDate = ' AND op.fecha_inicio BETWEEN ? AND ?';
      params = [fecha_inicio, fecha_fin];
    }

    const query = `
      SELECT 
          producto,
          codigo_interno,
          SUM(ordenes_supervisor) as total_ordenes,
          SUM(cantidad_supervisor) as cantidad_total,
          GROUP_CONCAT(CONCAT(ordenes_supervisor, ' ', supervisor) SEPARATOR ' / ') as desglose_supervisores
      FROM (
          SELECT 
              p.nombre as producto,
              p.codigo_interno,
              e.nombre_completo as supervisor,
              COUNT(op.id_orden) as ordenes_supervisor,
              SUM(op.cantidad_producida) as cantidad_supervisor,
              p.id_producto
          FROM ordenes_produccion op
          JOIN productos p ON op.id_producto_terminado = p.id_producto
          JOIN empleados e ON op.id_supervisor = e.id_empleado
          WHERE op.estado = 'Finalizada' ${whereDate}
          GROUP BY p.id_producto, e.id_empleado
      ) as sub
      GROUP BY id_producto
      ORDER BY total_ordenes DESC
      LIMIT ?
    `;

    params.push(parseInt(limit));
    const result = await executeQuery(query, params);

    res.json({
      success: true,
      data: result.data.map(item => ({
        ...item,
        total_ordenes: parseInt(item.total_ordenes),
        cantidad_total: parseFloat(item.cantidad_total)
      }))
    });
    } catch (error) {
    console.error('Error al obtener producción finalizada:', error);
    res.status(500).json({
      error: 'Error al obtener reporte de producción',
      details: error.message
    });
    }
    };