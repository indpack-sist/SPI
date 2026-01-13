import pool from '../config/database.js';

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const getResumenPagosCobranzas = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND DATE(fecha_pago) >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND DATE(fecha_pago) <= ?';
      params.push(fecha_fin);
    }
    
    const [pagosEntradas] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN e.moneda = 'PEN' THEN pe.monto_pagado ELSE 0 END), 0) as total_pen,
        COALESCE(SUM(CASE WHEN e.moneda = 'USD' THEN pe.monto_pagado ELSE 0 END), 0) as total_usd,
        COUNT(*) as total_pagos
      FROM pagos_entradas pe
      INNER JOIN entradas e ON pe.id_entrada = e.id_entrada
      WHERE ${whereClause}
    `, params);
    
    const [cobranzasOrdenes] = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN ov.moneda = 'PEN' THEN pov.monto_pagado ELSE 0 END), 0) as total_pen,
        COALESCE(SUM(CASE WHEN ov.moneda = 'USD' THEN pov.monto_pagado ELSE 0 END), 0) as total_usd,
        COUNT(*) as total_cobranzas
      FROM pagos_ordenes_venta pov
      INNER JOIN ordenes_venta ov ON pov.id_orden_venta = ov.id_orden_venta
      WHERE ${whereClause}
    `, params);
    
    res.json({
      success: true,
      data: {
        pagos: {
          pen: parseFloat(pagosEntradas[0].total_pen),
          usd: parseFloat(pagosEntradas[0].total_usd),
          cantidad: pagosEntradas[0].total_pagos
        },
        cobranzas: {
          pen: parseFloat(cobranzasOrdenes[0].total_pen),
          usd: parseFloat(cobranzasOrdenes[0].total_usd),
          cantidad: cobranzasOrdenes[0].total_cobranzas
        },
        flujo_neto: {
          pen: parseFloat(cobranzasOrdenes[0].total_pen) - parseFloat(pagosEntradas[0].total_pen),
          usd: parseFloat(cobranzasOrdenes[0].total_usd) - parseFloat(pagosEntradas[0].total_usd)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPagosCobranzas = async (req, res, next) => {
  try {
    const { tipo, fecha_inicio, fecha_fin, metodo_pago, id_cuenta } = req.query;
    
    let pagos = [];
    let cobranzas = [];
    
    let whereClausePagos = '1=1';
    let whereClauseCobranzas = '1=1';
    const paramsPagos = [];
    const paramsCobranzas = [];
    
    if (fecha_inicio) {
      whereClausePagos += ' AND DATE(pe.fecha_pago) >= ?';
      whereClauseCobranzas += ' AND DATE(pov.fecha_pago) >= ?';
      paramsPagos.push(fecha_inicio);
      paramsCobranzas.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClausePagos += ' AND DATE(pe.fecha_pago) <= ?';
      whereClauseCobranzas += ' AND DATE(pov.fecha_pago) <= ?';
      paramsPagos.push(fecha_fin);
      paramsCobranzas.push(fecha_fin);
    }
    
    if (metodo_pago) {
      whereClausePagos += ' AND pe.metodo_pago = ?';
      whereClauseCobranzas += ' AND pov.metodo_pago = ?';
      paramsPagos.push(metodo_pago);
      paramsCobranzas.push(metodo_pago);
    }
    
    if (id_cuenta) {
      whereClausePagos += ' AND pe.id_cuenta_destino = ?';
      whereClauseCobranzas += ' AND pov.id_cuenta_destino = ?'; 
      paramsPagos.push(id_cuenta);
      paramsCobranzas.push(id_cuenta);
    }
    
    if (!tipo || tipo === 'pago') {
      [pagos] = await pool.query(`
        SELECT 
          pe.id_pago_entrada as id,
          'pago' as tipo,
          pe.numero_pago,
          pe.fecha_pago,
          pe.monto_pagado,
          pe.metodo_pago,
          pe.numero_operacion,
          pe.banco,
          pe.observaciones,
          e.id_entrada,
          e.documento_soporte as documento_referencia,
          e.moneda,
          p.razon_social as tercero,
          emp.nombre_completo as registrado_por,
          c.nombre as cuenta_destino,
          pe.fecha_registro
        FROM pagos_entradas pe
        INNER JOIN entradas e ON pe.id_entrada = e.id_entrada
        LEFT JOIN proveedores p ON e.id_proveedor = p.id_proveedor
        INNER JOIN empleados emp ON pe.id_registrado_por = emp.id_empleado
        LEFT JOIN cuentas_pago c ON pe.id_cuenta_destino = c.id_cuenta
        WHERE ${whereClausePagos}
        ORDER BY pe.fecha_pago DESC
      `, paramsPagos);
    }
    
    if (!tipo || tipo === 'cobranza') {
      // CORRECCIÓN REALIZADA AQUÍ: Se eliminó ov.serie_correlativo
      [cobranzas] = await pool.query(`
        SELECT 
          pov.id_pago_orden as id,
          'cobranza' as tipo,
          pov.numero_pago,
          pov.fecha_pago,
          pov.monto_pagado,
          pov.metodo_pago,
          pov.numero_operacion,
          pov.banco,
          pov.observaciones,
          ov.id_orden_venta as id_orden,
          ov.numero_orden as documento_referencia,
          ov.tipo_comprobante,
          ov.numero_comprobante,
          ov.moneda,
          cl.razon_social as tercero,
          emp.nombre_completo as registrado_por,
          c.nombre as cuenta_destino,
          pov.fecha_registro
        FROM pagos_ordenes_venta pov
        INNER JOIN ordenes_venta ov ON pov.id_orden_venta = ov.id_orden_venta
        LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
        INNER JOIN empleados emp ON pov.id_registrado_por = emp.id_empleado
        LEFT JOIN cuentas_pago c ON pov.id_cuenta_destino = c.id_cuenta
        WHERE ${whereClauseCobranzas}
        ORDER BY pov.fecha_pago DESC
      `, paramsCobranzas);
    }
    
    const todos = [...pagos, ...cobranzas].sort((a, b) => 
      new Date(b.fecha_pago) - new Date(a.fecha_pago)
    );
    
    res.json({
      success: true,
      data: todos
    });
  } catch (error) {
    next(error);
  }
};

export const getCuentasPorCobrar = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND fecha_vencimiento >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND fecha_vencimiento <= ?';
      params.push(fecha_fin);
    }

    // Nota: Asegúrate de que tu vista "vista_cuentas_por_cobrar" esté creada en la BD
    const [rows] = await pool.query(`
      SELECT * FROM vista_cuentas_por_cobrar
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN estado_deuda = 'Vencido' THEN 1
          WHEN estado_deuda = 'Proximo a Vencer' THEN 2
          ELSE 3
        END,
        fecha_vencimiento ASC
    `, params);
    
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};