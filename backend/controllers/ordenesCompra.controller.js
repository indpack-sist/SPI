// =====================================================
// backend/controllers/ordenesCompra.controller.js
// =====================================================

import { executeQuery, executeTransaction } from '../config/database.js';

// =====================================================
// LISTAR ÓRDENES DE COMPRA
// =====================================================
export async function getAllOrdenesCompra(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, id_proveedor } = req.query;
    
    let sql = `
      SELECT 
        oc.id_orden_compra,
        oc.numero_orden,
        oc.fecha_pedido,
        oc.fecha_confirmacion,
        oc.entrega_esperada,
        oc.estado,
        oc.moneda,
        oc.subtotal,
        oc.igv,
        oc.total,
        prov.razon_social AS proveedor,
        prov.ruc AS ruc_proveedor,
        emp.nombres AS elaborado_por,
        (SELECT COUNT(*) FROM orden_compra_detalle WHERE id_orden_compra = oc.id_orden_compra) AS total_items
      FROM ordenes_compra oc
      INNER JOIN proveedores prov ON oc.id_proveedor = prov.id_proveedor
      LEFT JOIN empleados emp ON oc.id_elaborado_por = emp.id_empleado
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      sql += ' AND oc.estado = ?';
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ' AND oc.fecha_pedido >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND oc.fecha_pedido <= ?';
      params.push(fecha_fin);
    }
    
    if (id_proveedor) {
      sql += ' AND oc.id_proveedor = ?';
      params.push(id_proveedor);
    }
    
    sql += ' ORDER BY oc.fecha_pedido DESC, oc.numero_orden DESC';
    
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
// OBTENER ORDEN DE COMPRA POR ID
// =====================================================
export async function getOrdenCompraById(req, res) {
  try {
    const { id } = req.params;
    
    // Cabecera
    const cabeceraResult = await executeQuery(
      `SELECT 
        oc.*,
        prov.razon_social AS proveedor,
        prov.ruc AS ruc_proveedor,
        prov.direccion AS direccion_proveedor,
        prov.ciudad AS ciudad_proveedor,
        emp.nombres AS elaborado_por
      FROM ordenes_compra oc
      INNER JOIN proveedores prov ON oc.id_proveedor = prov.id_proveedor
      LEFT JOIN empleados emp ON oc.id_elaborado_por = emp.id_empleado
      WHERE oc.id_orden_compra = ?`,
      [id]
    );
    
    if (cabeceraResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }
    
    // Detalle
    const detalleResult = await executeQuery(
      `SELECT 
        ocd.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.tipo_inventario
      FROM orden_compra_detalle ocd
      INNER JOIN productos p ON ocd.id_producto = p.id_producto
      WHERE ocd.id_orden_compra = ?
      ORDER BY ocd.orden ASC`,
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
// CREAR ORDEN DE COMPRA
// =====================================================
export async function createOrdenCompra(req, res) {
  try {
    const {
      id_proveedor,
      fecha_pedido,
      fecha_confirmacion,
      entrega_esperada,
      condicion_pago,
      forma_pago,
      lugar_entrega,
      moneda,
      observaciones,
      detalle
    } = req.body;
    
    if (!id_proveedor || !detalle || detalle.length === 0) {
      return res.status(400).json({ 
        error: 'Proveedor y detalle son requeridos' 
      });
    }
    
    // Generar número de orden (PO + año + correlativo)
    const year = new Date().getFullYear();
    const lastResult = await executeQuery(
      `SELECT numero_orden FROM ordenes_compra 
       WHERE numero_orden LIKE ? 
       ORDER BY id_orden_compra DESC LIMIT 1`,
      [`PO${year}%`]
    );
    
    let correlativo = 1;
    if (lastResult.data.length > 0) {
      const parts = lastResult.data[0].numero_orden.match(/PO(\d{4})(\d+)/);
      if (parts) {
        correlativo = parseInt(parts[2]) + 1;
      }
    }
    
    const numero_orden = `PO${year}${correlativo.toString().padStart(5, '0')}`;
    
    // Calcular totales
    let subtotal = 0;
    detalle.forEach(item => {
      const cantidad = parseFloat(item.cantidad);
      const valor_unitario = parseFloat(item.valor_unitario);
      const valor_compra = cantidad * valor_unitario;
      subtotal += valor_compra;
    });
    
    const igv = subtotal * 0.18;
    const total = subtotal + igv;
    
    const queries = [];
    
    // Insertar cabecera
    queries.push({
      sql: `INSERT INTO ordenes_compra (
        numero_orden, id_proveedor, fecha_pedido, fecha_confirmacion, entrega_esperada,
        condicion_pago, forma_pago, lugar_entrega,
        moneda, subtotal, igv, total,
        estado, observaciones, id_elaborado_por, fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      params: [
        numero_orden,
        id_proveedor,
        fecha_pedido || new Date(),
        fecha_confirmacion || null,
        entrega_esperada || null,
        condicion_pago || null,
        forma_pago || null,
        lugar_entrega || null,
        moneda || 'PEN',
        subtotal,
        igv,
        total,
        fecha_confirmacion ? 'Confirmada' : 'Pendiente',
        observaciones || null,
        req.user?.id_empleado || null
      ]
    });
    
    // Insertar detalle
    detalle.forEach((item, index) => {
      const cantidad = parseFloat(item.cantidad);
      const valor_unitario = parseFloat(item.valor_unitario);
      const valor_compra = cantidad * valor_unitario;
      
      queries.push({
        sql: `INSERT INTO orden_compra_detalle (
          id_orden_compra, id_producto, cantidad, valor_unitario, valor_compra, orden
        ) VALUES (LAST_INSERT_ID(), ?, ?, ?, ?, ?)`,
        params: [
          item.id_producto,
          cantidad,
          valor_unitario,
          valor_compra,
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
      message: 'Orden de compra creada exitosamente',
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
// ACTUALIZAR ESTADO
// =====================================================
export async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_confirmacion, fecha_recepcion } = req.body;
    
    const estadosValidos = ['Pendiente', 'Confirmada', 'En Tránsito', 'Recibida', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    
    let sql = 'UPDATE ordenes_compra SET estado = ?';
    const params = [estado];
    
    if (estado === 'Confirmada' && fecha_confirmacion) {
      sql += ', fecha_confirmacion = ?';
      params.push(fecha_confirmacion);
    }
    
    if (estado === 'Recibida' && fecha_recepcion) {
      sql += ', fecha_recepcion = ?';
      params.push(fecha_recepcion);
    }
    
    sql += ' WHERE id_orden_compra = ?';
    params.push(id);
    
    await executeQuery(sql, params);
    
    res.json({
      success: true,
      message: `Orden de compra actualizada a estado: ${estado}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// RECIBIR ORDEN (Generar Entrada de Inventario)
// =====================================================
export async function recibirOrden(req, res) {
  try {
    const { id } = req.params;
    const { fecha_recepcion, almacen, observaciones } = req.body;
    
    // Obtener orden completa
    const ordenResult = await executeQuery(
      `SELECT * FROM ordenes_compra WHERE id_orden_compra = ?`,
      [id]
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }
    
    const orden = ordenResult.data[0];
    
    if (orden.estado === 'Recibida') {
      return res.status(400).json({ error: 'La orden ya fue recibida' });
    }
    
    // Obtener detalle
    const detalleResult = await executeQuery(
      `SELECT * FROM orden_compra_detalle WHERE id_orden_compra = ?`,
      [id]
    );
    
    const queries = [];
    
    // Actualizar estado de orden
    queries.push({
      sql: `UPDATE ordenes_compra 
            SET estado = 'Recibida', fecha_recepcion = ?
            WHERE id_orden_compra = ?`,
      params: [fecha_recepcion || new Date(), id]
    });
    
    // Crear entrada de inventario por cada item
    detalleResult.data.forEach(item => {
      queries.push({
        sql: `INSERT INTO entradas (
          id_producto, cantidad, precio_unitario, tipo_movimiento,
          fecha_movimiento, id_proveedor, referencia, observaciones,
          id_empleado_responsable
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          item.id_producto,
          item.cantidad,
          item.valor_unitario,
          'Compra',
          fecha_recepcion || new Date(),
          orden.id_proveedor,
          `OC ${orden.numero_orden}`,
          observaciones || null,
          req.user?.id_empleado || null
        ]
      });
    });
    
    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: 'Orden recibida y stock actualizado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// ESTADÍSTICAS
// =====================================================
export async function getEstadisticas(req, res) {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let whereClause = '1=1';
    const params = [];
    
    if (fecha_inicio) {
      whereClause += ' AND fecha_pedido >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND fecha_pedido <= ?';
      params.push(fecha_fin);
    }
    
    const estadisticas = await executeQuery(
      `SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'Confirmada' THEN 1 ELSE 0 END) AS confirmadas,
        SUM(CASE WHEN estado = 'En Tránsito' THEN 1 ELSE 0 END) AS en_transito,
        SUM(CASE WHEN estado = 'Recibida' THEN 1 ELSE 0 END) AS recibidas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_proveedor) AS proveedores_unicos
      FROM ordenes_compra
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

// =====================================================
// OBTENER PRODUCTOS POR PROVEEDOR
// =====================================================
export async function getProductosPorProveedor(req, res) {
  try {
    const { id_proveedor } = req.params;
    
    // Obtener productos que ha provisto anteriormente
    const result = await executeQuery(
      `SELECT DISTINCT
        p.id_producto,
        p.codigo,
        p.nombre,
        p.unidad_medida,
        p.tipo_inventario,
        AVG(ocd.valor_unitario) AS precio_promedio,
        MAX(oc.fecha_pedido) AS ultima_compra,
        SUM(ocd.cantidad) AS cantidad_total
      FROM orden_compra_detalle ocd
      INNER JOIN ordenes_compra oc ON ocd.id_orden_compra = oc.id_orden_compra
      INNER JOIN productos p ON ocd.id_producto = p.id_producto
      WHERE oc.id_proveedor = ?
      GROUP BY p.id_producto, p.codigo, p.nombre, p.unidad_medida, p.tipo_inventario
      ORDER BY ultima_compra DESC`,
      [id_proveedor]
    );
    
    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}