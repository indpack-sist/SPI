// =====================================================
// backend/controllers/cotizaciones.controller.js
// =====================================================

import { executeQuery, executeTransaction } from '../config/database.js';
import { generarPDFCotizacion } from '../utils/pdfGenerator.js';
// LISTAR COTIZACIONES
export async function getAllCotizaciones(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, id_cliente } = req.query;
    
    let sql = `
      SELECT 
        c.id_cotizacion,
        c.numero_cotizacion,
        c.fecha_emision,
        c.fecha_vencimiento,
        c.estado,
        c.moneda,
        c.subtotal,
        c.igv,
        c.total,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        emp.nombre_completo AS comercial,
        c.convertida_venta,
        c.observaciones,
        c.fecha_creacion
      FROM cotizaciones c
      INNER JOIN clientes cli ON c.id_cliente = cli.id_cliente
      LEFT JOIN empleados emp ON c.id_comercial = emp.id_empleado
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      sql += ' AND c.estado = ?';
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ' AND c.fecha_emision >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND c.fecha_emision <= ?';
      params.push(fecha_fin);
    }
    
    if (id_cliente) {
      sql += ' AND c.id_cliente = ?';
      params.push(id_cliente);
    }
    
    sql += ' ORDER BY c.fecha_emision DESC';
    
    const result = await executeQuery(sql, params);
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// OBTENER COTIZACIÓN POR ID
export async function getCotizacionById(req, res) {
  try {
    const { id } = req.params;
    
    const cabeceraResult = await executeQuery(
      `SELECT 
        c.*,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        cli.direccion AS direccion_cliente,
        cli.ciudad AS ciudad_cliente,
        cli.telefono AS telefono_cliente,
        cli.email AS email_cliente,
        emp.nombre_completo AS comercial,
        emp.email AS email_comercial
      FROM cotizaciones c
      INNER JOIN clientes cli ON c.id_cliente = cli.id_cliente
      LEFT JOIN empleados emp ON c.id_comercial = emp.id_empleado
      WHERE c.id_cotizacion = ?`,
      [id]
    );
    
    if (cabeceraResult.data.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    
    const detalleResult = await executeQuery(
      `SELECT 
        cd.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM cotizacion_detalle cd
      INNER JOIN productos p ON cd.id_producto = p.id_producto
      WHERE cd.id_cotizacion = ?
      ORDER BY cd.orden ASC`,
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...cabeceraResult.data[0],
        detalle: detalleResult.data
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// CREAR COTIZACIÓN
export async function createCotizacion(req, res) {
  try {
    const {
      id_cliente,
      id_comercial,
      fecha_emision,
      fecha_vencimiento,
      moneda,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      lugar_entrega,
      plazo_entrega,
      validez_dias,
      observaciones,
      detalle
    } = req.body;
    
    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({ error: 'Cliente y detalle son requeridos' });
    }
    
    // Generar número
    const year = new Date().getFullYear();
    const lastResult = await executeQuery(
      `SELECT numero_cotizacion FROM cotizaciones 
       WHERE numero_cotizacion LIKE ? 
       ORDER BY id_cotizacion DESC LIMIT 1`,
      [`C-${year}-%`]
    );
    
    let correlativo = 1;
    if (lastResult.data.length > 0) {
      correlativo = parseInt(lastResult.data[0].numero_cotizacion.split('-')[2]) + 1;
    }
    
    const numero_cotizacion = `C-${year}-${correlativo.toString().padStart(4, '0')}`;
    
    // Calcular totales
    let subtotal = 0;
    detalle.forEach(item => {
      subtotal += parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
    });
    
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    
    const queries = [];
    
    queries.push({
      sql: `INSERT INTO cotizaciones (
        numero_cotizacion, id_cliente, id_comercial, fecha_emision, fecha_vencimiento,
        moneda, plazo_pago, forma_pago, orden_compra_cliente, lugar_entrega,
        plazo_entrega, validez_dias, observaciones, subtotal, igv, total, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        numero_cotizacion, id_cliente, id_comercial || null,
        fecha_emision || new Date(), fecha_vencimiento || null,
        moneda || 'PEN', plazo_pago || null, forma_pago || null,
        orden_compra_cliente || null, lugar_entrega || null,
        plazo_entrega || null, validez_dias || 7, observaciones || null,
        subtotal, igv, total, 'Pendiente'
      ]
    });
    
    detalle.forEach((item, index) => {
      queries.push({
        sql: `INSERT INTO cotizacion_detalle (
          id_cotizacion, id_producto, cantidad, precio_unitario,
          descuento, valor_venta, orden
        ) VALUES (LAST_INSERT_ID(), ?, ?, ?, ?, ?, ?)`,
        params: [
          item.id_producto,
          item.cantidad,
          item.precio_unitario,
          item.descuento || 0,
          parseFloat(item.cantidad) * parseFloat(item.precio_unitario),
          index + 1
        ]
      });
    });
    
    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Cotización creada exitosamente',
      data: { numero_cotizacion, subtotal, igv, total }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// CAMBIAR ESTADO
export async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const result = await executeQuery(
      'UPDATE cotizaciones SET estado = ? WHERE id_cotizacion = ?',
      [estado, id]
    );
    
    res.json({
      success: true,
      message: `Estado actualizado a ${estado}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export async function generarPDF(req, res) {
  try {
    const { id } = req.params;
    
    // Obtener cotización completa
    const cabeceraResult = await executeQuery(
      `SELECT 
        c.*,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        cli.direccion AS direccion_cliente,
        cli.ciudad AS ciudad_cliente,
        cli.telefono AS telefono_cliente,
        cli.email AS email_cliente,
        emp.nombre_completo AS comercial,
        emp.email AS email_comercial
      FROM cotizaciones c
      INNER JOIN clientes cli ON c.id_cliente = cli.id_cliente
      LEFT JOIN empleados emp ON c.id_comercial = emp.id_empleado
      WHERE c.id_cotizacion = ?`,
      [id]
    );
    
    if (cabeceraResult.data.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    
    // Obtener detalle
    const detalleResult = await executeQuery(
      `SELECT 
        cd.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM cotizacion_detalle cd
      INNER JOIN productos p ON cd.id_producto = p.id_producto
      WHERE cd.id_cotizacion = ?
      ORDER BY cd.orden ASC`,
      [id]
    );
    
    const cotizacion = {
      ...cabeceraResult.data[0],
      detalle: detalleResult.data
    };
    
    // Configurar headers para PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=cotizacion-${cotizacion.numero_cotizacion}.pdf`);
    
    // Generar PDF
    await generarPDFCotizacion(cotizacion, res);
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ error: error.message });
  }
}