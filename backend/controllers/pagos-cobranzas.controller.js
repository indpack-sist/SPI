import pool from '../config/database.js';
import { generarReporteDeudasPDF } from '../utils/pdfGenerators/reporteDeudasPDF.js';

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
      whereClause += ' AND DATE(fecha_movimiento) >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND DATE(fecha_movimiento) <= ?';
      params.push(fecha_fin);
    }
    
    const [movimientos] = await pool.query(`
      SELECT 
        tipo_movimiento,
        moneda,
        SUM(monto) as total_monto,
        COUNT(*) as cantidad
      FROM movimientos_cuentas
      WHERE ${whereClause}
      GROUP BY tipo_movimiento, moneda
    `, params);
    
    const resumen = {
      pagos: { pen: 0, usd: 0, cantidad: 0 },
      cobranzas: { pen: 0, usd: 0, cantidad: 0 },
      flujo_neto: { pen: 0, usd: 0 }
    };

    movimientos.forEach(m => {
      const tipo = m.tipo_movimiento === 'Egreso' ? 'pagos' : 'cobranzas';
      const moneda = m.moneda.toLowerCase();
      resumen[tipo][moneda] = parseFloat(m.total_monto);
      resumen[tipo].cantidad += m.cantidad;
    });

    resumen.flujo_neto.pen = resumen.cobranzas.pen - resumen.pagos.pen;
    resumen.flujo_neto.usd = resumen.cobranzas.usd - resumen.pagos.usd;
    
    res.json({
      success: true,
      data: resumen
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPagosCobranzas = async (req, res, next) => {
  try {
    const { tipo, fecha_inicio, fecha_fin, metodo_pago, id_cuenta } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (tipo) {
      whereClause += ' AND mc.tipo_movimiento = ?';
      params.push(tipo === 'pago' ? 'Egreso' : 'Ingreso');
    }
    
    if (fecha_inicio) {
      whereClause += ' AND DATE(mc.fecha_movimiento) >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND DATE(mc.fecha_movimiento) <= ?';
      params.push(fecha_fin);
    }
    
    if (metodo_pago) {
      whereClause += ' AND mc.referencia LIKE ?';
      params.push(`%${metodo_pago}%`);
    }
    
    if (id_cuenta) {
      whereClause += ' AND mc.id_cuenta = ?';
      params.push(id_cuenta);
    }
    
    const [movimientos] = await pool.query(`
      SELECT 
        mc.id_movimiento as id,
        CASE WHEN mc.tipo_movimiento = 'Egreso' THEN 'pago' ELSE 'cobranza' END as tipo,
        COALESCE(pov.numero_pago, mc.referencia) as numero_pago,
        mc.fecha_movimiento as fecha_pago,
        mc.monto as monto_pagado,
        COALESCE(pov.metodo_pago, c.nombre) as metodo_pago,
        COALESCE(pov.numero_operacion, mc.referencia) as numero_operacion,
        COALESCE(pov.observaciones, mc.concepto) as observaciones,
        mc.id_orden_compra,
        pov.id_orden_venta as id_orden,
        COALESCE(oc.numero_orden, ov.numero_orden, mc.referencia) as documento_referencia,
        mc.moneda,
        COALESCE(p.razon_social, cl.razon_social, 'General') as tercero,
        emp.nombre_completo as registrado_por,
        c.nombre as cuenta_destino
      FROM movimientos_cuentas mc
      LEFT JOIN ordenes_compra oc ON mc.id_orden_compra = oc.id_orden_compra
      LEFT JOIN proveedores p ON oc.id_proveedor = p.id_proveedor
      LEFT JOIN pagos_ordenes_venta pov ON mc.id_pago_orden_venta = pov.id_pago_orden
      LEFT JOIN ordenes_venta ov ON pov.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados emp ON mc.id_registrado_por = emp.id_empleado
      LEFT JOIN cuentas_pago c ON mc.id_cuenta = c.id_cuenta
      WHERE ${whereClause}
      ORDER BY mc.fecha_movimiento DESC
    `, params);
    
    res.json({
      success: true,
      data: movimientos
    });
  } catch (error) {
    next(error);
  }
};

export const getCuentasPorCobrar = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, id_cliente } = req.query;
    
    let whereClause = `
      ov.estado != 'Cancelada' 
      AND ov.estado_pago != 'Pagado'
      AND (ov.total - COALESCE(ov.monto_pagado, 0)) >= 0.01
    `;
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND ov.fecha_vencimiento >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND ov.fecha_vencimiento <= ?';
      params.push(fecha_fin);
    }
    
    if (id_cliente) {
      whereClause += ' AND ov.id_cliente = ?';
      params.push(id_cliente);
    }

    const sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.tipo_comprobante,
        ov.numero_comprobante,
        ov.fecha_emision,
        ov.fecha_vencimiento,
        ov.moneda,
        ov.tipo_venta,
        ov.estado,
        ov.estado_pago,
        ov.total,
        COALESCE(ov.monto_pagado, 0) as monto_pagado,
        (ov.total - COALESCE(ov.monto_pagado, 0)) as saldo_pendiente,
        cl.razon_social as cliente,
        cl.ruc,
        DATEDIFF(ov.fecha_vencimiento, CURDATE()) as dias_restantes,
        CASE 
          WHEN ov.tipo_venta = 'Contado' THEN 'Pendiente Pago'
          WHEN DATEDIFF(ov.fecha_vencimiento, CURDATE()) < 0 THEN 'Vencido'
          WHEN DATEDIFF(ov.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 5 THEN 'Próximo a Vencer'
          ELSE 'Al Día'
        END as estado_deuda,
        (
          SELECT COUNT(*) 
          FROM pagos_ordenes_venta pov 
          WHERE pov.id_orden_venta = ov.id_orden_venta
        ) as total_pagos_registrados
      FROM ordenes_venta ov
      INNER JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE ${whereClause}
      ORDER BY 
        CASE 
          WHEN ov.tipo_venta = 'Contado' THEN 1
          WHEN DATEDIFF(ov.fecha_vencimiento, CURDATE()) < 0 THEN 2
          WHEN DATEDIFF(ov.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 5 THEN 3
          ELSE 4
        END ASC,
        ov.fecha_vencimiento ASC,
        ov.fecha_emision DESC
    `;

    const [rows] = await pool.query(sql, params);
    
    res.json({ 
      success: true, 
      data: rows,
      summary: {
        total_ordenes: rows.length,
        total_saldo_pen: rows.filter(r => r.moneda === 'PEN').reduce((acc, r) => acc + parseFloat(r.saldo_pendiente), 0),
        total_saldo_usd: rows.filter(r => r.moneda === 'USD').reduce((acc, r) => acc + parseFloat(r.saldo_pendiente), 0),
        vencidas: rows.filter(r => r.estado_deuda === 'Vencido').length,
        proximas_vencer: rows.filter(r => r.estado_deuda === 'Próximo a Vencer').length,
        al_dia: rows.filter(r => r.estado_deuda === 'Al Día').length,
        contado_pendiente: rows.filter(r => r.estado_deuda === 'Pendiente Pago').length
      }
    });
  } catch (error) {
    next(error);
  }
};

export const descargarReporteDeudas = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, id_cliente } = req.query;
    
    let whereClause = `
      ov.estado != 'Cancelada' 
      AND ov.estado_pago != 'Pagado'
      AND (ov.total - COALESCE(ov.monto_pagado, 0)) >= 0.01
    `;
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND ov.fecha_vencimiento >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND ov.fecha_vencimiento <= ?';
      params.push(fecha_fin);
    }
    
    if (id_cliente) {
      whereClause += ' AND ov.id_cliente = ?';
      params.push(id_cliente);
    }

    const sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.tipo_comprobante,
        ov.numero_comprobante,
        ov.fecha_emision,
        ov.fecha_vencimiento,
        ov.moneda,
        ov.tipo_venta,
        ov.estado,
        ov.estado_pago,
        ov.total,
        COALESCE(ov.monto_pagado, 0) as monto_pagado,
        (ov.total - COALESCE(ov.monto_pagado, 0)) as saldo_pendiente,
        cl.razon_social as cliente,
        cl.ruc,
        cl.direccion_despacho as direccion,
        cl.telefono,
        cl.email,
        DATEDIFF(ov.fecha_vencimiento, CURDATE()) as dias_restantes,
        CASE 
          WHEN ov.tipo_venta = 'Contado' THEN 'Pendiente Pago'
          WHEN DATEDIFF(ov.fecha_vencimiento, CURDATE()) < 0 THEN 'Vencido'
          WHEN DATEDIFF(ov.fecha_vencimiento, CURDATE()) BETWEEN 0 AND 5 THEN 'Próximo a Vencer'
          ELSE 'Al Día'
        END as estado_deuda
      FROM ordenes_venta ov
      INNER JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE ${whereClause}
      ORDER BY 
        cl.razon_social ASC,
        ov.fecha_vencimiento ASC
    `;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No hay deudas pendientes para los filtros seleccionados' });
    }

    const pdfBuffer = await generarReporteDeudasPDF(rows, { fecha_inicio, fecha_fin, id_cliente });

    const filename = id_cliente 
      ? `Estado_Cuenta_${rows[0].ruc}.pdf` 
      : `Reporte_General_Deudas_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    next(error);
  }
};