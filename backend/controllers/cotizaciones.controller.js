// backend/controllers/cotizaciones.controller.js
import { executeQuery } from '../config/database.js';

// ✅ OBTENER TODAS LAS COTIZACIONES CON FILTROS
export async function getAllCotizaciones(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        c.id_cotizacion,
        c.numero_cotizacion,
        c.fecha_emision,
        c.fecha_vencimiento,
        c.estado,
        c.prioridad,
        c.subtotal,
        c.igv,
        c.total,
        c.moneda,
        c.tipo_impuesto,
        c.porcentaje_impuesto,
        c.tipo_cambio,
        c.observaciones,
        c.fecha_creacion,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e.id_empleado AS id_comercial,
        e.nombre_completo AS comercial,
        (SELECT COUNT(*) FROM detalle_cotizacion WHERE id_cotizacion = c.id_cotizacion) AS total_items
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }
    
    if (prioridad) {
      sql += ` AND c.prioridad = ?`;
      params.push(prioridad);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(c.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(c.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY c.fecha_creacion DESC`;
    
    const result = await executeQuery(sql, params);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ OBTENER COTIZACIÓN POR ID CON DETALLE - CORREGIDO
export async function getCotizacionById(req, res) {
  try {
    const { id } = req.params;
    
    // Cotización principal
    const cotizacionResult = await executeQuery(`
      SELECT 
        c.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        cl.email AS email_cliente,
        e.nombre_completo AS comercial,
        e.email AS email_comercial
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE c.id_cotizacion = ?
    `, [id]);
    
    if (!cotizacionResult.success) {
      return res.status(500).json({ 
        success: false,
        error: cotizacionResult.error 
      });
    }
    
    if (cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    const cotizacion = cotizacionResult.data[0];
    
    // ✅ CORREGIDO: Detalle usando productos.stock_actual directamente
    const detalleResult = await executeQuery(`
      SELECT 
        dc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        ti.nombre AS tipo_inventario_nombre,
        p.requiere_receta,
        p.stock_actual AS stock_disponible
      FROM detalle_cotizacion dc
      INNER JOIN productos p ON dc.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dc.id_cotizacion = ?
      ORDER BY dc.orden
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    cotizacion.detalle = detalleResult.data;
    
    res.json({
      success: true,
      data: cotizacion
    });
    
  } catch (error) {
    console.error('Error al obtener cotización:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ CREAR COTIZACIÓN
export async function createCotizacion(req, res) {
  try {
    const {
      id_cliente,
      fecha_emision,
      fecha_vencimiento,
      prioridad,
      moneda,
      tipo_impuesto,
      porcentaje_impuesto,
      tipo_cambio,
      plazo_pago,
      forma_pago,
      direccion_entrega,
      observaciones,
      id_comercial,
      validez_dias,
      plazo_entrega,
      orden_compra_cliente,
      lugar_entrega,
      detalle
    } = req.body;
    
    // Validaciones
    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cliente y detalle son obligatorios'
      });
    }
    
    // Generar número de cotización
    const ultimaResult = await executeQuery(`
      SELECT numero_cotizacion 
      FROM cotizaciones 
      ORDER BY id_cotizacion DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_cotizacion.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroCotizacion = `COT-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    // Calcular totales
    let subtotal = 0;
    for (const item of detalle) {
      const valorVenta = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
      const descuentoItem = valorVenta * (parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta - descuentoItem;
    }
    
    // ✅ Calcular impuesto con porcentaje dinámico
    const porcentaje = parseFloat(porcentaje_impuesto) || 18.00;
    const igv = subtotal * (porcentaje / 100);
    const total = subtotal + igv;
    
    // Insertar cotización con nuevos campos
    const result = await executeQuery(`
      INSERT INTO cotizaciones (
        numero_cotizacion,
        id_cliente,
        fecha_emision,
        fecha_vencimiento,
        prioridad,
        moneda,
        tipo_impuesto,
        porcentaje_impuesto,
        tipo_cambio,
        plazo_pago,
        forma_pago,
        direccion_entrega,
        observaciones,
        id_comercial,
        validez_dias,
        plazo_entrega,
        orden_compra_cliente,
        lugar_entrega,
        subtotal,
        igv,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [
      numeroCotizacion,
      id_cliente,
      fecha_emision || new Date().toISOString().split('T')[0],
      fecha_vencimiento || null,
      prioridad || 'Media',
      moneda || 'PEN',
      tipo_impuesto || 'IGV',
      porcentaje || 18.00,
      parseFloat(tipo_cambio) || 1.0000,
      plazo_pago || null,
      forma_pago || null,
      direccion_entrega || null,
      observaciones || null,
      id_comercial || null,
      parseInt(validez_dias) || 7,
      plazo_entrega || null,
      orden_compra_cliente || null,
      lugar_entrega || null,
      subtotal,
      igv,
      total
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idCotizacion = result.data.insertId;
    
    // Insertar detalle
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const valorVenta = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
      const descuentoItem = valorVenta * (parseFloat(item.descuento_porcentaje || 0) / 100);
      const valorTotal = valorVenta - descuentoItem;
      
      await executeQuery(`
        INSERT INTO detalle_cotizacion (
          id_cotizacion,
          id_producto,
          cantidad,
          precio_unitario,
          descuento_porcentaje,
          valor_venta,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        idCotizacion,
        item.id_producto,
        item.cantidad,
        item.precio_unitario,
        item.descuento_porcentaje || 0,
        valorTotal,
        i + 1
      ]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_cotizacion: idCotizacion,
        numero_cotizacion: numeroCotizacion
      },
      message: 'Cotización creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear cotización:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ ACTUALIZAR ESTADO
export async function actualizarEstadoCotizacion(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Pendiente', 'Enviada', 'Aprobada', 'Rechazada', 'Convertida', 'Vencida'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const result = await executeQuery(`
      UPDATE cotizaciones 
      SET estado = ? 
      WHERE id_cotizacion = ?
    `, [estado, id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ ACTUALIZAR PRIORIDAD
export async function actualizarPrioridadCotizacion(req, res) {
  try {
    const { id } = req.params;
    const { prioridad } = req.body;
    
    const prioridadesValidas = ['Baja', 'Media', 'Alta', 'Urgente'];
    
    if (!prioridadesValidas.includes(prioridad)) {
      return res.status(400).json({
        success: false,
        error: 'Prioridad no válida'
      });
    }
    
    const result = await executeQuery(`
      UPDATE cotizaciones 
      SET prioridad = ? 
      WHERE id_cotizacion = ?
    `, [prioridad, id]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    res.json({
      success: true,
      message: 'Prioridad actualizada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar prioridad:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ OBTENER ESTADÍSTICAS
export async function getEstadisticasCotizaciones(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_cotizaciones,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'Enviada' THEN 1 ELSE 0 END) AS enviadas,
        SUM(CASE WHEN estado = 'Aprobada' THEN 1 ELSE 0 END) AS aprobadas,
        SUM(CASE WHEN estado = 'Rechazada' THEN 1 ELSE 0 END) AS rechazadas,
        SUM(CASE WHEN estado = 'Convertida' THEN 1 ELSE 0 END) AS convertidas,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_cliente) AS clientes_unicos,
        COUNT(DISTINCT id_comercial) AS comerciales_activos
      FROM cotizaciones
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
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ DESCARGAR PDF
export async function descargarPDFCotizacion(req, res) {
  try {
    const { id } = req.params;
    
    // Obtener datos de la cotización
    const cotizacionResult = await executeQuery(`
      SELECT 
        c.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        e.nombre_completo AS comercial
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON c.id_comercial = e.id_empleado
      WHERE c.id_cotizacion = ?
    `, [id]);
    
    if (!cotizacionResult.success || cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    const cotizacion = cotizacionResult.data[0];
    
    // Obtener detalle
    const detalleResult = await executeQuery(`
      SELECT 
        dc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_cotizacion dc
      INNER JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_cotizacion = ?
      ORDER BY dc.orden
    `, [id]);
    
    cotizacion.detalle = detalleResult.data;
    
    // TODO: Implementar generación de PDF
    res.json({
      success: true,
      data: cotizacion,
      message: 'Generar PDF con estos datos'
    });
    
  } catch (error) {
    console.error('Error al descargar PDF:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}