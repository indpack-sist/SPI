// =====================================================
// backend/controllers/ordenesVenta.controller.js
// =====================================================

import { executeQuery, executeTransaction } from '../config/database.js';

// =====================================================
// LISTAR ÓRDENES DE VENTA
// =====================================================
export async function getAllOrdenesVenta(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, id_cliente, prioridad } = req.query;
    
    let sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.fecha_emision,
        ov.fecha_entrega_estimada,
        ov.fecha_entrega_real,
        ov.estado,
        ov.prioridad,
        ov.moneda,
        ov.subtotal,
        ov.igv,
        ov.total,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        emp.nombre_completo AS comercial,
        cot.numero_cotizacion,
        ov.observaciones,
        ov.fecha_creacion,
        (SELECT COUNT(*) FROM orden_venta_detalle WHERE id_orden_venta = ov.id_orden_venta) AS total_items
      FROM ordenes_venta ov
      INNER JOIN clientes cli ON ov.id_cliente = cli.id_cliente
      LEFT JOIN empleados emp ON ov.id_comercial = emp.id_empleado
      LEFT JOIN cotizaciones cot ON ov.id_cotizacion = cot.id_cotizacion
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      sql += ' AND ov.estado = ?';
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ' AND ov.fecha_emision >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND ov.fecha_emision <= ?';
      params.push(fecha_fin);
    }
    
    if (id_cliente) {
      sql += ' AND ov.id_cliente = ?';
      params.push(id_cliente);
    }
    
    if (prioridad) {
      sql += ' AND ov.prioridad = ?';
      params.push(prioridad);
    }
    
    sql += ' ORDER BY ov.fecha_emision DESC, ov.numero_orden DESC';
    
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

// =====================================================
// OBTENER ORDEN DE VENTA POR ID
// =====================================================
export async function getOrdenVentaById(req, res) {
  try {
    const { id } = req.params;
    
    // Cabecera
    const cabeceraResult = await executeQuery(
      `SELECT 
        ov.*,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        cli.direccion AS direccion_cliente,
        cli.ciudad AS ciudad_cliente,
        cli.telefono AS telefono_cliente,
        cli.email AS email_cliente,
        emp.nombre_completo AS comercial,
        emp.email AS email_comercial,
        cot.numero_cotizacion
      FROM ordenes_venta ov
      INNER JOIN clientes cli ON ov.id_cliente = cli.id_cliente
      LEFT JOIN empleados emp ON ov.id_comercial = emp.id_empleado
      LEFT JOIN cotizaciones cot ON ov.id_cotizacion = cot.id_cotizacion
      WHERE ov.id_orden_venta = ?`,
      [id]
    );
    
    if (cabeceraResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de venta no encontrada' });
    }
    
    // Detalle
    const detalleResult = await executeQuery(
      `SELECT 
        ovd.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual
      FROM orden_venta_detalle ovd
      INNER JOIN productos p ON ovd.id_producto = p.id_producto
      WHERE ovd.id_orden_venta = ?
      ORDER BY ovd.orden ASC`,
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

// =====================================================
// CREAR ORDEN DE VENTA
// =====================================================
export async function createOrdenVenta(req, res) {
  try {
    const {
      id_cotizacion,
      id_cliente,
      id_comercial,
      fecha_emision,
      fecha_entrega_estimada,
      moneda,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      prioridad,
      observaciones,
      detalle
    } = req.body;
    
    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({ 
        error: 'Cliente y detalle son requeridos' 
      });
    }
    
    // Generar número de orden
    const year = new Date().getFullYear();
    const lastResult = await executeQuery(
      `SELECT numero_orden FROM ordenes_venta 
       WHERE numero_orden LIKE ? 
       ORDER BY id_orden_venta DESC LIMIT 1`,
      [`OV-${year}-%`]
    );
    
    let correlativo = 1;
    if (lastResult.data.length > 0) {
      correlativo = parseInt(lastResult.data[0].numero_orden.split('-')[2]) + 1;
    }
    
    const numero_orden = `OV-${year}-${correlativo.toString().padStart(4, '0')}`;
    
    // Calcular totales
    let subtotal = 0;
    detalle.forEach(item => {
      const valorItem = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
      const descuento = valorItem * (parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorItem - descuento;
    });
    
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    
    const queries = [];
    
    // Insertar cabecera
    queries.push({
      sql: `INSERT INTO ordenes_venta (
        numero_orden, id_cotizacion, id_cliente, id_comercial, 
        fecha_emision, fecha_entrega_estimada,
        moneda, plazo_pago, forma_pago, orden_compra_cliente,
        direccion_entrega, lugar_entrega, ciudad_entrega,
        contacto_entrega, telefono_entrega,
        subtotal, igv, total, estado, prioridad, observaciones, id_creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        numero_orden, id_cotizacion || null, id_cliente, id_comercial || null,
        fecha_emision || new Date(), fecha_entrega_estimada || null,
        moneda || 'PEN', plazo_pago || null, forma_pago || null, orden_compra_cliente || null,
        direccion_entrega || null, lugar_entrega || null, ciudad_entrega || null,
        contacto_entrega || null, telefono_entrega || null,
        subtotal, igv, total, 'Pendiente', prioridad || 'Media', observaciones || null,
        req.user?.id_empleado || null
      ]
    });
    
    // Insertar detalle
    detalle.forEach((item, index) => {
      queries.push({
        sql: `INSERT INTO orden_venta_detalle (
          id_orden_venta, id_producto, cantidad, precio_unitario,
          descuento_porcentaje, requiere_produccion, orden
        ) VALUES (LAST_INSERT_ID(), ?, ?, ?, ?, ?, ?)`,
        params: [
          item.id_producto,
          item.cantidad,
          item.precio_unitario,
          item.descuento_porcentaje || 0,
          item.requiere_produccion || 0,
          index + 1
        ]
      });
    });
    
    // Si viene de cotización, marcarla como convertida
    if (id_cotizacion) {
      queries.push({
        sql: `UPDATE cotizaciones 
              SET estado = 'Convertida', 
                  convertida_venta = 1, 
                  id_orden_venta = LAST_INSERT_ID()
              WHERE id_cotizacion = ?`,
        params: [id_cotizacion]
      });
    }
    
    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Orden de venta creada exitosamente',
      data: {
        numero_orden,
        subtotal,
        igv,
        total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// CONVERTIR COTIZACIÓN A ORDEN DE VENTA
// =====================================================
export async function convertirDesdeCotizacion(req, res) {
  try {
    const { id_cotizacion } = req.params;
    
    // Obtener cotización completa
    const cotizacionResult = await executeQuery(
      `SELECT c.*, cd.id_producto, cd.cantidad, cd.precio_unitario, cd.descuento_porcentaje
       FROM cotizaciones c
       INNER JOIN cotizacion_detalle cd ON c.id_cotizacion = cd.id_cotizacion
       WHERE c.id_cotizacion = ?
       ORDER BY cd.orden`,
      [id_cotizacion]
    );
    
    if (cotizacionResult.data.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    
    const cotizacion = cotizacionResult.data[0];
    
    // Verificar estado
    if (cotizacion.estado !== 'Aprobada') {
      return res.status(400).json({ 
        error: 'Solo se pueden convertir cotizaciones aprobadas' 
      });
    }
    
    if (cotizacion.convertida_venta) {
      return res.status(400).json({ 
        error: 'Esta cotización ya fue convertida a orden de venta' 
      });
    }
    
    // Construir detalle
    const detalle = cotizacionResult.data.map(row => ({
      id_producto: row.id_producto,
      cantidad: row.cantidad,
      precio_unitario: row.precio_unitario,
      descuento_porcentaje: row.descuento_porcentaje || 0,
      requiere_produccion: 0 // Se puede calcular según lógica de negocio
    }));
    
    // Crear orden de venta
    const ordenData = {
      id_cotizacion: cotizacion.id_cotizacion,
      id_cliente: cotizacion.id_cliente,
      id_comercial: cotizacion.id_comercial,
      fecha_emision: new Date(),
      moneda: cotizacion.moneda,
      plazo_pago: cotizacion.plazo_pago,
      forma_pago: cotizacion.forma_pago,
      orden_compra_cliente: cotizacion.orden_compra_cliente,
      lugar_entrega: cotizacion.lugar_entrega,
      prioridad: 'Media',
      observaciones: cotizacion.observaciones,
      detalle
    };
    
    // Usar el método create
    req.body = ordenData;
    await createOrdenVenta(req, res);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// ACTUALIZAR ESTADO
// =====================================================
export async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega_real } = req.body;
    
    const estadosValidos = ['Pendiente', 'En Proceso', 'Despachada', 'Entregada', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    
    let sql = 'UPDATE ordenes_venta SET estado = ?';
    const params = [estado];
    
    // Si el estado es Entregada, registrar fecha
    if (estado === 'Entregada' && fecha_entrega_real) {
      sql += ', fecha_entrega_real = ?';
      params.push(fecha_entrega_real);
    }
    
    sql += ' WHERE id_orden_venta = ?';
    params.push(id);
    
    const result = await executeQuery(sql, params);
    
    res.json({
      success: true,
      message: `Orden de venta actualizada a estado: ${estado}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// ACTUALIZAR PRIORIDAD
// =====================================================
export async function actualizarPrioridad(req, res) {
  try {
    const { id } = req.params;
    const { prioridad } = req.body;
    
    const prioridadesValidas = ['Baja', 'Media', 'Alta', 'Urgente'];
    
    if (!prioridadesValidas.includes(prioridad)) {
      return res.status(400).json({ error: 'Prioridad no válida' });
    }
    
    const result = await executeQuery(
      'UPDATE ordenes_venta SET prioridad = ? WHERE id_orden_venta = ?',
      [prioridad, id]
    );
    
    res.json({
      success: true,
      message: `Prioridad actualizada a: ${prioridad}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// ACTUALIZAR CANTIDADES PRODUCIDAS/DESPACHADAS
// =====================================================
export async function actualizarProgreso(req, res) {
  try {
    const { id } = req.params;
    const { detalle } = req.body; // [{ id_detalle, cantidad_producida, cantidad_despachada }]
    
    const queries = detalle.map(item => ({
      sql: `UPDATE orden_venta_detalle 
            SET cantidad_producida = ?, cantidad_despachada = ?
            WHERE id_detalle = ? AND id_orden_venta = ?`,
      params: [
        item.cantidad_producida || 0,
        item.cantidad_despachada || 0,
        item.id_detalle,
        id
      ]
    }));
    
    const result = await executeTransaction(queries);
    
    res.json({
      success: true,
      message: 'Progreso actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// ESTADÍSTICAS DEL DASHBOARD
// =====================================================
export async function getEstadisticas(req, res) {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND fecha_emision >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND fecha_emision <= ?';
      params.push(fecha_fin);
    }
    
    const estadisticas = await executeQuery(
      `SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'En Proceso' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'Despachada' THEN 1 ELSE 0 END) AS despachadas,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_cliente) AS clientes_unicos,
        SUM(CASE WHEN prioridad = 'Urgente' THEN 1 ELSE 0 END) AS urgentes
      FROM ordenes_venta
      WHERE ${whereClause}`,
      params
    );
    
    res.json({
      success: true,
      data: estadisticas.data[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}