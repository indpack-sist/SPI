// backend/controllers/guias-remision.controller.js
import { executeQuery } from '../config/database.js';

// ✅ OBTENER TODAS LAS GUÍAS CON FILTROS
export async function getAllGuiasRemision(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        gr.id_guia,           -- ✅ Cambiar de id_guia_remision
        gr.numero_guia,
        gr.fecha_emision,
        gr.fecha_traslado,
        gr.estado,
        gr.punto_partida,
        gr.punto_llegada,
        gr.peso_bruto_kg,
        gr.numero_bultos,
        ov.numero_orden,
        ov.id_orden_venta,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        (SELECT COUNT(*) FROM detalle_guia_remision WHERE id_guia = gr.id_guia) AS total_items
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND gr.estado = ?`;
      params.push(estado);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(gr.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(gr.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY gr.fecha_emision DESC, gr.id_guia DESC`;
    
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
    console.error('Error al obtener guías de remisión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ OBTENER GUÍA POR ID CON DETALLE
export async function getGuiaRemisionById(req, res) {
  try {
    const { id } = req.params;
    
    // Guía principal
    const guiaResult = await executeQuery(`
      SELECT 
        gr.*,
        ov.numero_orden,
        ov.id_orden_venta,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      WHERE gr.id_guia = ?  -- ✅ Cambiar de id_guia_remision
    `, [id]);
    
    if (!guiaResult.success) {
      return res.status(500).json({ 
        success: false,
        error: guiaResult.error 
      });
    }
    
    if (guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía de remisión no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    
    // Detalle de la guía
    const detalleResult = await executeQuery(`
      SELECT 
        dgr.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia = ?  -- ✅ Cambiar de id_guia_remision
      ORDER BY dgr.orden
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    guia.detalle = detalleResult.data;
    
    // Verificar si tiene guía de transportista
    const guiaTransportistaResult = await executeQuery(`
      SELECT 
        id_guia_transportista,
        numero_guia,
        razon_social_transportista,
        ruc_transportista,
        nombre_conductor,
        licencia_conducir,
        placa_vehiculo,
        marca_vehiculo
      FROM guias_transportista
      WHERE id_guia_remision = ?  -- ✅ Este nombre verificar si es correcto
    `, [id]);
    
    if (guiaTransportistaResult.success && guiaTransportistaResult.data.length > 0) {
      guia.guia_transportista = guiaTransportistaResult.data[0];
    }
    
    res.json({
      success: true,
      data: guia
    });
    
  } catch (error) {
    console.error('Error al obtener guía de remisión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ CREAR GUÍA DE REMISIÓN
// ============================================
// guias-remision.controller.js - createGuiaRemision
// CORREGIDO SEGÚN ESTRUCTURA REAL DE BD
// ============================================

export async function createGuiaRemision(req, res) {
  try {
    const {
      id_orden_venta,
      fecha_emision,
      fecha_traslado,  // ✅ NOMBRE CORRECTO
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
    
    // Validaciones
    if (!id_orden_venta || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Orden de venta y detalle son obligatorios'
      });
    }
    
    // ✅ Obtener id_cliente desde la orden
    const ordenResult = await executeQuery(`
      SELECT id_cliente FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id_orden_venta]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const id_cliente = ordenResult.data[0].id_cliente;
    
    // Validar cantidades disponibles
    for (const item of detalle) {
      const detalleOrdenResult = await executeQuery(`
        SELECT cantidad, cantidad_despachada
        FROM detalle_orden_venta
        WHERE id_detalle = ?
      `, [item.id_detalle_orden]);
      
      if (!detalleOrdenResult.success || detalleOrdenResult.data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Detalle de orden inválido'
        });
      }
      
      const disponible = parseFloat(detalleOrdenResult.data[0].cantidad) - 
                        parseFloat(detalleOrdenResult.data[0].cantidad_despachada || 0);
      
      if (parseFloat(item.cantidad) > disponible) {
        return res.status(400).json({
          success: false,
          error: `Cantidad a despachar excede lo disponible en la orden`
        });
      }
    }
    
    // Generar número de guía
    const ultimaResult = await executeQuery(`
      SELECT numero_guia 
      FROM guias_remision 
      ORDER BY id_guia DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_guia.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroGuia = `T001-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(8, '0')}`;
    
    // ✅ INSERT CORREGIDO CON COLUMNAS REALES
    const result = await executeQuery(`
      INSERT INTO guias_remision (
        numero_guia,
        id_orden_venta,
        id_cliente,
        fecha_emision,
        fecha_traslado,
        punto_partida,
        punto_llegada,
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
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Emitida')
    `, [
      numeroGuia,
      id_orden_venta,
      id_cliente,  // ✅ AGREGADO
      fecha_emision || new Date().toISOString().split('T')[0],
      fecha_traslado || new Date().toISOString().split('T')[0],  // ✅ NOMBRE CORRECTO
      direccion_partida || 'Almacén Central',  // ✅ punto_partida
      direccion_llegada || '',  // ✅ punto_llegada
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
      observaciones
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idGuia = result.data.insertId;
    
    // Insertar detalle
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      const pesoTotal = parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0);
      
      await executeQuery(`
        INSERT INTO detalle_guia_remision (
          id_guia,
          id_detalle_orden,
          id_producto,
          cantidad,
          descripcion,
          peso_unitario_kg,
          peso_total_kg,
          orden
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idGuia,
        item.id_detalle_orden,
        item.id_producto,
        item.cantidad,
        item.descripcion || item.producto,
        item.peso_unitario_kg || 0,
        pesoTotal,
        item.orden || (i + 1)
      ]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_guia: idGuia,
        numero_guia: numeroGuia
      },
      message: 'Guía de remisión creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear guía de remisión:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ DESPACHAR GUÍA (GENERA SALIDAS AUTOMÁTICAS)
export async function despacharGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { fecha_despacho } = req.body;
    
    // Obtener guía
    const guiaResult = await executeQuery(`
      SELECT gr.*, ov.id_cliente
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      WHERE gr.id_guia_remision = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    
    if (guia.estado !== 'Pendiente') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden despachar guías en estado Pendiente'
      });
    }
    
    // Obtener detalle
    const detalleResult = await executeQuery(`
      SELECT dgr.*, p.id_tipo_inventario
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia_remision = ?
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    const detalle = detalleResult.data;
    
    // Generar código de salida
    const ultimaSalidaResult = await executeQuery(`
      SELECT codigo FROM salidas 
      ORDER BY id_salida DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaSalidaResult.success && ultimaSalidaResult.data.length > 0) {
      const match = ultimaSalidaResult.data[0].codigo.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const codigoSalida = `SAL-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(6, '0')}`;
    
    // Validar stock y crear salidas
    for (const item of detalle) {
      // Verificar stock
      const stockResult = await executeQuery(`
        SELECT stock_actual, costo_unitario_promedio
        FROM stock_productos
        WHERE id_producto = ?
      `, [item.id_producto]);
      
      if (!stockResult.success || stockResult.data.length === 0 || 
          parseFloat(stockResult.data[0].stock_actual) < parseFloat(item.cantidad)) {
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente para el producto ${item.id_producto}`
        });
      }
      
      const stock = stockResult.data[0];
      
      // Crear salida
      await executeQuery(`
        INSERT INTO salidas (
          codigo,
          id_tipo_inventario,
          tipo_movimiento,
          id_producto,
          cantidad,
          costo_unitario,
          costo_total,
          fecha_movimiento,
          observaciones,
          id_guia_remision
        ) VALUES (?, ?, 'Venta', ?, ?, ?, ?, ?, ?, ?)
      `, [
        codigoSalida,
        item.id_tipo_inventario,
        item.id_producto,
        item.cantidad,
        stock.costo_unitario_promedio,
        parseFloat(item.cantidad) * parseFloat(stock.costo_unitario_promedio),
        fecha_despacho || new Date().toISOString().split('T')[0],
        `Despacho guía ${guia.numero_guia}`,
        id
      ]);
      
      // Descontar stock
      await executeQuery(`
        UPDATE stock_productos
        SET stock_actual = stock_actual - ?,
            fecha_ultimo_movimiento = NOW()
        WHERE id_producto = ?
      `, [item.cantidad, item.id_producto]);
      
      // Actualizar cantidad despachada en orden de venta
      if (item.id_detalle_orden) {
        await executeQuery(`
          UPDATE detalle_orden_venta
          SET cantidad_despachada = cantidad_despachada + ?
          WHERE id_detalle = ?
        `, [item.cantidad, item.id_detalle_orden]);
      }
    }
    
    // Actualizar estado de guía
    await executeQuery(`
      UPDATE guias_remision
      SET estado = 'En Tránsito',
          fecha_inicio_traslado = ?
      WHERE id_guia_remision = ?
    `, [fecha_despacho || new Date().toISOString().split('T')[0], id]);
    
    res.json({
      success: true,
      message: 'Guía despachada exitosamente. Se generaron las salidas de inventario.'
    });
    
  } catch (error) {
    console.error('Error al despachar guía:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ✅ ACTUALIZAR ESTADO
export async function actualizarEstadoGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Emitida', 'En Tránsito', 'Entregada', 'Anulada'];  // ✅ Estados correctos según ENUM
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const result = await executeQuery(`
      UPDATE guias_remision
      SET estado = ?
      WHERE id_guia = ?  -- ✅ Cambiar
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

// ✅ MARCAR COMO ENTREGADA
export async function marcarEntregadaGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { fecha_entrega } = req.body;
    
    await executeQuery(`
      UPDATE guias_remision
      SET estado = 'Entregada'
      WHERE id_guia = ?  -- ✅ Cambiar
    `, [id]);
    
    // Verificar si todas las guías de la orden están entregadas
    const guiaResult = await executeQuery(`
      SELECT id_orden_venta FROM guias_remision WHERE id_guia = ?  -- ✅ Cambiar
    `, [id]);
    
    if (guiaResult.success && guiaResult.data.length > 0 && guiaResult.data[0].id_orden_venta) {
      const pendientesResult = await executeQuery(`
        SELECT COUNT(*) as pendientes
        FROM guias_remision
        WHERE id_orden_venta = ? AND estado NOT IN ('Entregada', 'Anulada')
      `, [guiaResult.data[0].id_orden_venta]);
      
      if (pendientesResult.success && pendientesResult.data[0].pendientes === 0) {
        await executeQuery(`
          UPDATE ordenes_venta
          SET estado = 'Entregada',
              fecha_entrega_real = ?
          WHERE id_orden_venta = ?
        `, [fecha_entrega || new Date().toISOString().split('T')[0], guiaResult.data[0].id_orden_venta]);
      }
    }
    
    res.json({
      success: true,
      message: 'Guía marcada como entregada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al marcar entregada:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
// ✅ OBTENER ESTADÍSTICAS
export async function getEstadisticasGuiasRemision(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_guias,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'En Tránsito' THEN 1 ELSE 0 END) AS en_transito,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(peso_bruto_kg) AS peso_total,
        SUM(numero_bultos) AS bultos_total,
        COUNT(DISTINCT id_orden_venta) AS ordenes_relacionadas
      FROM guias_remision
      WHERE estado != 'Cancelada'
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
export async function descargarPDFGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    
    const guiaResult = await executeQuery(`
      SELECT 
        gr.*,
        ov.numero_orden,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      WHERE gr.id_guia_remision = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dgr.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia_remision = ?
      ORDER BY dgr.orden
    `, [id]);
    
    guia.detalle = detalleResult.data;
    
    // TODO: Implementar generación de PDF
    res.json({
      success: true,
      data: guia,
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