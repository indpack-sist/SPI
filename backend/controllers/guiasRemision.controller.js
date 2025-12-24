// =====================================================
// backend/controllers/guiasRemision.controller.js
// =====================================================

import { executeQuery, executeTransaction } from '../config/database.js';

// =====================================================
// LISTAR GUÍAS DE REMISIÓN
// =====================================================
export async function getAllGuiasRemision(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin, id_orden_venta, tipo_traslado } = req.query;
    
    let sql = `
      SELECT 
        gr.id_guia_remision,
        gr.numero_guia,
        gr.fecha_emision,
        gr.fecha_inicio_traslado,
        gr.tipo_traslado,
        gr.estado,
        gr.modalidad_transporte,
        gr.peso_bruto_kg,
        gr.numero_bultos,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        ov.numero_orden,
        ov.id_orden_venta,
        gr.direccion_llegada,
        gr.ciudad_llegada,
        (SELECT COUNT(*) FROM guia_remision_detalle WHERE id_guia_remision = gr.id_guia_remision) AS total_items
      FROM guias_remision gr
      INNER JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      INNER JOIN clientes cli ON gr.id_cliente = cli.id_cliente
      WHERE 1=1
    `;
    const params = [];
    
    if (estado) {
      sql += ' AND gr.estado = ?';
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ' AND gr.fecha_emision >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ' AND gr.fecha_emision <= ?';
      params.push(fecha_fin);
    }
    
    if (id_orden_venta) {
      sql += ' AND gr.id_orden_venta = ?';
      params.push(id_orden_venta);
    }
    
    if (tipo_traslado) {
      sql += ' AND gr.tipo_traslado = ?';
      params.push(tipo_traslado);
    }
    
    sql += ' ORDER BY gr.fecha_emision DESC, gr.numero_guia DESC';
    
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
// OBTENER GUÍA DE REMISIÓN POR ID
// =====================================================
export async function getGuiaRemisionById(req, res) {
  try {
    const { id } = req.params;
    
    // Cabecera
    const cabeceraResult = await executeQuery(
      `SELECT 
        gr.*,
        cli.razon_social AS cliente,
        cli.ruc AS ruc_cliente,
        cli.direccion AS direccion_cliente,
        cli.ciudad AS ciudad_cliente,
        ov.numero_orden,
        ov.total AS total_orden,
        ov.moneda
      FROM guias_remision gr
      INNER JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      INNER JOIN clientes cli ON gr.id_cliente = cli.id_cliente
      WHERE gr.id_guia_remision = ?`,
      [id]
    );
    
    if (cabeceraResult.data.length === 0) {
      return res.status(404).json({ error: 'Guía de remisión no encontrada' });
    }
    
    // Detalle
    const detalleResult = await executeQuery(
      `SELECT 
        grd.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto
      FROM guia_remision_detalle grd
      INNER JOIN productos p ON grd.id_producto = p.id_producto
      WHERE grd.id_guia_remision = ?
      ORDER BY grd.orden ASC`,
      [id]
    );
    
    // Guía de transportista (si existe)
    const transportistaResult = await executeQuery(
      `SELECT * FROM guias_transportista WHERE id_guia_remision = ?`,
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...cabeceraResult.data[0],
        detalle: detalleResult.data,
        guia_transportista: transportistaResult.data[0] || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// CREAR GUÍA DE REMISIÓN DESDE ORDEN DE VENTA
// =====================================================
export async function createGuiaRemision(req, res) {
  try {
    const {
      id_orden_venta,
      fecha_emision,
      fecha_inicio_traslado,
      tipo_traslado,
      motivo_traslado,
      modalidad_transporte,
      direccion_partida,
      ubigeo_partida,
      direccion_llegada,
      ubigeo_llegada,
      ciudad_llegada,
      peso_bruto_kg,
      numero_bultos,
      observaciones,
      detalle
    } = req.body;
    
    if (!id_orden_venta || !detalle || detalle.length === 0) {
      return res.status(400).json({ 
        error: 'Orden de venta y detalle son requeridos' 
      });
    }
    
    // Obtener datos de la orden
    const ordenResult = await executeQuery(
      `SELECT id_cliente, numero_orden FROM ordenes_venta WHERE id_orden_venta = ?`,
      [id_orden_venta]
    );
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({ error: 'Orden de venta no encontrada' });
    }
    
    const orden = ordenResult.data[0];
    
    // Generar número de guía (serie + correlativo)
    const year = new Date().getFullYear();
    const lastResult = await executeQuery(
      `SELECT numero_guia FROM guias_remision 
       WHERE numero_guia LIKE ? 
       ORDER BY id_guia_remision DESC LIMIT 1`,
      [`T001-${year}%`]
    );
    
    let correlativo = 1;
    if (lastResult.data.length > 0) {
      const parts = lastResult.data[0].numero_guia.split('-');
      correlativo = parseInt(parts[2]) + 1;
    }
    
    const numero_guia = `T001-${year}-${correlativo.toString().padStart(8, '0')}`;
    
    const queries = [];
    
    // Insertar cabecera
    queries.push({
      sql: `INSERT INTO guias_remision (
        numero_guia, id_orden_venta, id_cliente,
        fecha_emision, fecha_inicio_traslado,
        tipo_traslado, motivo_traslado,
        direccion_partida, ubigeo_partida,
        direccion_llegada, ubigeo_llegada, ciudad_llegada,
        modalidad_transporte, peso_bruto_kg, numero_bultos,
        estado, observaciones, id_creado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        numero_guia,
        id_orden_venta,
        orden.id_cliente,
        fecha_emision || new Date(),
        fecha_inicio_traslado || null,
        tipo_traslado || 'Venta',
        motivo_traslado || 'Venta',
        direccion_partida || null,
        ubigeo_partida || null,
        direccion_llegada || null,
        ubigeo_llegada || null,
        ciudad_llegada || null,
        modalidad_transporte || 'Privado',
        peso_bruto_kg || 0,
        numero_bultos || 0,
        'Pendiente',
        observaciones || null,
        req.user?.id_empleado || null
      ]
    });
    
    // Insertar detalle
    detalle.forEach((item, index) => {
      queries.push({
        sql: `INSERT INTO guia_remision_detalle (
          id_guia_remision, id_producto, cantidad, unidad_medida,
          descripcion, peso_unitario_kg, orden
        ) VALUES (LAST_INSERT_ID(), ?, ?, ?, ?, ?, ?)`,
        params: [
          item.id_producto,
          item.cantidad,
          item.unidad_medida,
          item.descripcion || null,
          item.peso_unitario_kg || 0,
          index + 1
        ]
      });
    });
    
    // Actualizar cantidades despachadas en orden de venta
    detalle.forEach(item => {
      if (item.id_detalle_orden) {
        queries.push({
          sql: `UPDATE orden_venta_detalle 
                SET cantidad_despachada = cantidad_despachada + ?
                WHERE id_detalle = ?`,
          params: [item.cantidad, item.id_detalle_orden]
        });
      }
    });
    
    // Actualizar estado de orden si todo está despachado
    queries.push({
      sql: `UPDATE ordenes_venta SET estado = 'Despachada'
            WHERE id_orden_venta = ?
            AND NOT EXISTS (
              SELECT 1 FROM orden_venta_detalle 
              WHERE id_orden_venta = ?
              AND cantidad_despachada < cantidad
            )`,
      params: [id_orden_venta, id_orden_venta]
    });
    
    const result = await executeTransaction(queries);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      message: 'Guía de remisión creada exitosamente',
      data: {
        numero_guia,
        id_orden_venta
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
    const { estado, fecha_entrega } = req.body;
    
    const estadosValidos = ['Pendiente', 'En Tránsito', 'Entregada', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    
    let sql = 'UPDATE guias_remision SET estado = ?';
    const params = [estado];
    
    // Si el estado es Entregada, registrar fecha
    if (estado === 'Entregada' && fecha_entrega) {
      sql += ', fecha_entrega = ?';
      params.push(fecha_entrega);
    }
    
    sql += ' WHERE id_guia_remision = ?';
    params.push(id);
    
    const result = await executeQuery(sql, params);
    
    // Si la guía está entregada, actualizar estado de la orden
    if (estado === 'Entregada') {
      const guiaResult = await executeQuery(
        'SELECT id_orden_venta FROM guias_remision WHERE id_guia_remision = ?',
        [id]
      );
      
      if (guiaResult.data.length > 0) {
        await executeQuery(
          `UPDATE ordenes_venta SET estado = 'Entregada', fecha_entrega_real = ?
           WHERE id_orden_venta = ?`,
          [fecha_entrega || new Date(), guiaResult.data[0].id_orden_venta]
        );
      }
    }
    
    res.json({
      success: true,
      message: `Guía de remisión actualizada a estado: ${estado}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// =====================================================
// OBTENER PRODUCTOS DISPONIBLES DE UNA ORDEN
// =====================================================
export async function getProductosDisponiblesOrden(req, res) {
  try {
    const { id_orden_venta } = req.params;
    
    // Obtener detalle de la orden con cantidades disponibles para despachar
    const result = await executeQuery(
      `SELECT 
        ovd.id_detalle,
        ovd.id_producto,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        ovd.cantidad AS cantidad_total,
        ovd.cantidad_despachada,
        (ovd.cantidad - ovd.cantidad_despachada) AS cantidad_disponible,
        p.peso_kg AS peso_unitario_kg
      FROM orden_venta_detalle ovd
      INNER JOIN productos p ON ovd.id_producto = p.id_producto
      WHERE ovd.id_orden_venta = ?
      AND ovd.cantidad_despachada < ovd.cantidad
      ORDER BY ovd.orden`,
      [id_orden_venta]
    );
    
    res.json({
      success: true,
      data: result.data
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
      whereClause += ' AND fecha_emision >= ?';
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      whereClause += ' AND fecha_emision <= ?';
      params.push(fecha_fin);
    }
    
    const estadisticas = await executeQuery(
      `SELECT 
        COUNT(*) AS total_guias,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'En Tránsito' THEN 1 ELSE 0 END) AS en_transito,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN estado = 'Cancelada' THEN 1 ELSE 0 END) AS canceladas,
        SUM(peso_bruto_kg) AS peso_total,
        SUM(numero_bultos) AS bultos_total,
        COUNT(DISTINCT id_orden_venta) AS ordenes_relacionadas,
        SUM(CASE WHEN modalidad_transporte = 'Privado' THEN 1 ELSE 0 END) AS transporte_privado,
        SUM(CASE WHEN modalidad_transporte = 'Público' THEN 1 ELSE 0 END) AS transporte_publico
      FROM guias_remision
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