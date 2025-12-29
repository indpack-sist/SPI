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
    const tipoCambio = obtenerTipoCambioCache();
    
    const productosActivosResult = await executeQuery(
      'SELECT COUNT(*) AS total_productos FROM productos WHERE estado = ?',
      ['Activo']
    );

    const productosConStockResult = await executeQuery(
      'SELECT COUNT(*) AS productos_con_stock FROM productos WHERE estado = ? AND stock_actual > 0',
      ['Activo']
    );

    const empleadosResult = await executeQuery(
      'SELECT COUNT(*) AS total_empleados FROM empleados WHERE estado = ?',
      ['Activo']
    );

    const proveedoresResult = await executeQuery(
      'SELECT COUNT(*) AS total_proveedores FROM proveedores WHERE estado = ?',
      ['Activo']
    );

    const clientesResult = await executeQuery(
      'SELECT COUNT(*) AS total_clientes FROM clientes WHERE estado = ?',
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

    // 🔧 QUERY MEJORADO: Calcula CUP desde recetas para Productos Terminados
    const valoracionPorTipoResult = await executeQuery(
      `SELECT 
        ti.id_tipo_inventario,
        ti.nombre AS tipo_inventario,
        COUNT(p.id_producto) AS total_productos,
        COALESCE(SUM(p.stock_actual), 0) AS stock_total,
        
        -- VALOR DE PRODUCCIÓN (COSTO REAL)
        COALESCE(
          SUM(
            p.stock_actual * COALESCE(
              /* PRIORIDAD 1: Promedio Ponderado Real (Órdenes Finalizadas con costo > 0) */
              (
                SELECT SUM(op.costo_materiales) / SUM(op.cantidad_producida)
                FROM ordenes_produccion op
                WHERE op.id_producto_terminado = p.id_producto 
                AND op.estado = 'Finalizada' 
                AND op.cantidad_producida > 0 
                AND op.costo_materiales > 0
              ),
              /* PRIORIDAD 2: Costo Teórico de Receta */
              (
                SELECT SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / MAX(rp.rendimiento_unidades)
                FROM recetas_productos rp
                INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
                INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
                WHERE rp.id_producto_terminado = p.id_producto 
                AND rp.es_principal = 1 
                AND rp.es_activa = 1
                GROUP BY rp.id_producto_terminado
              ),
              /* PRIORIDAD 3: Costo manual de la tabla */
              p.costo_unitario_promedio,
              0
            )
          ), 
          0
        ) AS valor_produccion,
        
        -- VALOR DE VENTA (PT y Reventa)
        COALESCE(
          SUM(
            CASE 
              WHEN ti.nombre IN ('Productos Terminados', 'Productos de Reventa') 
                   AND p.precio_venta > 0 
              THEN p.stock_actual * p.precio_venta
              ELSE 0
            END
          ),
          0
        ) AS valor_venta
       FROM tipos_inventario ti
       LEFT JOIN productos p ON ti.id_tipo_inventario = p.id_tipo_inventario 
         AND p.estado = 'Activo'
       WHERE ti.estado = 'Activo'
       GROUP BY ti.id_tipo_inventario, ti.nombre
       ORDER BY ti.nombre ASC`
    );

    const valor_total_produccion_pen = valoracionPorTipoResult.data.reduce((sum, tipo) => {
      return sum + parseFloat(tipo.valor_produccion || 0);
    }, 0);

    const valor_total_venta_pen = valoracionPorTipoResult.data.reduce((sum, tipo) => {
      return sum + parseFloat(tipo.valor_venta || 0);
    }, 0);

    const valor_total_produccion_usd = tipoCambio.valido 
      ? convertirPENaUSD(valor_total_produccion_pen, tipoCambio)
      : valor_total_produccion_pen / 3.765;

    const valor_total_venta_usd = tipoCambio.valido 
      ? convertirPENaUSD(valor_total_venta_pen, tipoCambio)
      : valor_total_venta_pen / 3.765;

    res.json({
      total_productos: productosActivosResult.data[0].total_productos,
      productos_con_stock: productosConStockResult.data[0].productos_con_stock,
      total_empleados: empleadosResult.data[0].total_empleados,
      total_proveedores: proveedoresResult.data[0].total_proveedores,
      total_clientes: clientesResult.data[0].total_clientes,
      ordenes_activas: ordenesResult.data[0].ordenes_activas,
      productos_stock_bajo: stockBajoResult.data[0].productos_stock_bajo,
      
      valoracion_por_tipo: valoracionPorTipoResult.data.map(tipo => ({
        ...tipo,
        total_productos: parseInt(tipo.total_productos),
        stock_total: parseFloat(tipo.stock_total),
        valor_produccion_pen: parseFloat(tipo.valor_produccion),
        valor_produccion_usd: tipoCambio.valido 
          ? convertirPENaUSD(parseFloat(tipo.valor_produccion), tipoCambio)
          : parseFloat(tipo.valor_produccion) / 3.765,
        valor_venta_pen: parseFloat(tipo.valor_venta),
        valor_venta_usd: tipoCambio.valido 
          ? convertirPENaUSD(parseFloat(tipo.valor_venta), tipoCambio)
          : parseFloat(tipo.valor_venta) / 3.765
      })),
      
      valor_total_produccion_pen: parseFloat(valor_total_produccion_pen.toFixed(2)),
      valor_total_produccion_usd: parseFloat(valor_total_produccion_usd.toFixed(2)),
      valor_total_venta_pen: parseFloat(valor_total_venta_pen.toFixed(2)),
      valor_total_venta_usd: parseFloat(valor_total_venta_usd.toFixed(2)),
      
      tipo_cambio: tipoCambio.valido ? {
        compra: tipoCambio.compra,
        venta: tipoCambio.venta,
        promedio: tipoCambio.promedio,
        fecha: tipoCambio.fecha,
        desde_cache: tipoCambio.desde_cache || false,
        es_default: tipoCambio.es_default || false,
        advertencia: tipoCambio.advertencia || null
      } : null
    });

  } catch (error) {
    console.error('Error al obtener resumen general:', error);
    res.status(500).json({
      error: 'Error al obtener resumen del dashboard',
      details: error.message
    });
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
            SELECT (SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / 
                   MAX(rp.rendimiento_unidades))
            FROM recetas_productos rp
            INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
            INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
            WHERE rp.id_producto_terminado = p.id_producto 
            AND rp.es_principal = 1 
            AND rp.es_activa = 1
          ), 0)
          WHEN p.precio_venta > 0 THEN p.precio_venta
          ELSE 0
        END AS costo_efectivo,
        (p.stock_actual * 
          CASE 
            WHEN p.costo_unitario_promedio > 0 THEN p.costo_unitario_promedio
            WHEN p.requiere_receta = 1 THEN COALESCE((
              SELECT (SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / 
                     MAX(rp.rendimiento_unidades))
              FROM recetas_productos rp
              INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
              INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
              WHERE rp.id_producto_terminado = p.id_producto 
              AND rp.es_principal = 1 
              AND rp.es_activa = 1
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
                SELECT (SUM(rd.cantidad_requerida * insumo.costo_unitario_promedio) / 
                       MAX(rp.rendimiento_unidades))
                FROM recetas_productos rp
                INNER JOIN recetas_detalle rd ON rp.id_receta_producto = rd.id_receta_producto
                INNER JOIN productos insumo ON rd.id_insumo = insumo.id_producto
                WHERE rp.id_producto_terminado = p.id_producto 
                AND rp.es_principal = 1 
                AND rp.es_activa = 1
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
      `SELECT COUNT(*) AS total_entradas, COALESCE(SUM(total_costo), 0) AS valor_total_entradas,
       COUNT(DISTINCT DATE(fecha_movimiento)) AS dias_con_movimiento
       FROM entradas ${whereClause} AND estado = 'Activo'`, params
    );

    const salidasResult = await executeQuery(
      `SELECT COUNT(*) AS total_salidas, COALESCE(SUM(total_precio), 0) AS valor_total_salidas,
       COUNT(DISTINCT DATE(fecha_movimiento)) AS dias_con_movimiento
       FROM salidas ${whereClause} AND estado = 'Activo'`, params
    );

    const entradasMensualesResult = await executeQuery(
      `SELECT DATE_FORMAT(fecha_movimiento, '%Y-%m') AS mes,
       DATE_FORMAT(fecha_movimiento, '%b %Y') AS mes_nombre,
       COALESCE(SUM(total_costo), 0) AS valor_entradas
       FROM entradas WHERE fecha_movimiento >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND estado = 'Activo'
       GROUP BY DATE_FORMAT(fecha_movimiento, '%Y-%m'), DATE_FORMAT(fecha_movimiento, '%b %Y')
       ORDER BY mes DESC`
    );

    const salidasMensualesResult = await executeQuery(
      `SELECT DATE_FORMAT(fecha_movimiento, '%Y-%m') AS mes,
       DATE_FORMAT(fecha_movimiento, '%b %Y') AS mes_nombre,
       COALESCE(SUM(total_precio), 0) AS valor_salidas
       FROM salidas WHERE fecha_movimiento >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND estado = 'Activo'
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
          salidas_pen: 0 
        };
      }
      movimientosPorMes[row.mes].entradas_pen = parseFloat(row.valor_entradas || 0);
    });

    salidasMensualesResult.data.forEach(row => {
      if (!movimientosPorMes[row.mes]) {
        movimientosPorMes[row.mes] = { 
          mes: row.mes, 
          mes_nombre: row.mes_nombre, 
          entradas_pen: 0, 
          salidas_pen: 0 
        };
      }
      movimientosPorMes[row.mes].salidas_pen = parseFloat(row.valor_salidas || 0);
    });

    const movimientosMensuales = Object.values(movimientosPorMes)
      .map(m => ({
        mes: m.mes, 
        mes_nombre: m.mes_nombre,
        entradas_pen: m.entradas_pen, 
        salidas_pen: m.salidas_pen,
        entradas_usd: tipoCambio.valido 
          ? convertirPENaUSD(m.entradas_pen, tipoCambio) 
          : m.entradas_pen / 3.765,
        salidas_usd: tipoCambio.valido 
          ? convertirPENaUSD(m.salidas_pen, tipoCambio) 
          : m.salidas_pen / 3.765
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6);

    const valor_total_entradas_pen = parseFloat(entradasResult.data[0].valor_total_entradas);
    const valor_total_salidas_pen = parseFloat(salidasResult.data[0].valor_total_salidas);

    res.json({
      entradas: {
        total: entradasResult.data[0].total_entradas,
        valor_total_pen: valor_total_entradas_pen,
        valor_total_usd: tipoCambio.valido 
          ? convertirPENaUSD(valor_total_entradas_pen, tipoCambio) 
          : valor_total_entradas_pen / 3.765,
        dias_activos: entradasResult.data[0].dias_con_movimiento
      },
      salidas: {
        total: salidasResult.data[0].total_salidas,
        valor_total_pen: valor_total_salidas_pen,
        valor_total_usd: tipoCambio.valido 
          ? convertirPENaUSD(valor_total_salidas_pen, tipoCambio) 
          : valor_total_salidas_pen / 3.765,
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