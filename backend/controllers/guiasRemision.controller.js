import { executeQuery } from '../config/database.js';

export async function getAllGuiasRemision(req, res) {
  try {
    const { estado, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        gr.id_guia,
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

export async function getGuiaRemisionById(req, res) {
  try {
    const { id } = req.params;
    
    const guiaResult = await executeQuery(`
      SELECT 
        gr.*,
        ov.numero_orden,
        ov.id_orden_venta,
        ov.estado AS estado_orden,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      WHERE gr.id_guia = ?
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
    
    const detalleResult = await executeQuery(`
      SELECT 
        dgr.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual,
        p.id_tipo_inventario,
        ti.nombre AS tipo_inventario
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dgr.id_guia = ?
      ORDER BY dgr.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    guia.detalle = detalleResult.data;
    
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
      WHERE id_guia = ?
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

export async function createGuiaRemision(req, res) {
  try {
    const {
      id_orden_venta,
      fecha_emision,
      fecha_traslado,
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
    
    if (!id_orden_venta) {
      return res.status(400).json({
        success: false,
        error: 'La orden de venta es obligatoria'
      });
    }
    
    if (!detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debe incluir al menos un producto'
      });
    }
    
    if (!direccion_llegada || direccion_llegada.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'La dirección de llegada es obligatoria'
      });
    }
    
    // Obtener información de la orden
    const ordenResult = await executeQuery(`
      SELECT 
        ov.id_cliente,
        ov.estado,
        ov.direccion_entrega
      FROM ordenes_venta ov
      WHERE ov.id_orden_venta = ?
    `, [id_orden_venta]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    if (orden.estado !== 'Confirmada' && orden.estado !== 'En Preparación') {
      return res.status(400).json({
        success: false,
        error: `Solo se pueden crear guías para órdenes Confirmadas o En Preparación. Estado actual: ${orden.estado}`
      });
    }
    
    // Validar cada producto del detalle
    for (const item of detalle) {
      // Validar detalle de orden
      const detalleOrdenResult = await executeQuery(`
        SELECT 
          dov.cantidad,
          dov.cantidad_despachada,
          p.id_producto,
          p.codigo,
          p.nombre,
          p.stock_actual,
          p.id_tipo_inventario
        FROM detalle_orden_venta dov
        INNER JOIN productos p ON dov.id_producto = p.id_producto
        WHERE dov.id_detalle = ?
      `, [item.id_detalle_orden]);
      
      if (!detalleOrdenResult.success || detalleOrdenResult.data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Detalle de orden inválido'
        });
      }
      
      const detalleOrden = detalleOrdenResult.data[0];
      const cantidadOrden = parseFloat(detalleOrden.cantidad);
      const cantidadDespachada = parseFloat(detalleOrden.cantidad_despachada || 0);
      const cantidadDisponibleOrden = cantidadOrden - cantidadDespachada;
      const cantidadSolicitada = parseFloat(item.cantidad);
      const stockActual = parseFloat(detalleOrden.stock_actual);
      
      // Validar que no exceda lo pendiente de la orden
      if (cantidadSolicitada > cantidadDisponibleOrden) {
        return res.status(400).json({
          success: false,
          error: `${detalleOrden.nombre} (${detalleOrden.codigo}): Cantidad a despachar (${cantidadSolicitada}) excede lo pendiente en la orden (${cantidadDisponibleOrden.toFixed(4)})`
        });
      }
      
      // Validar stock disponible
      if (cantidadSolicitada > stockActual) {
        return res.status(400).json({
          success: false,
          error: `${detalleOrden.nombre} (${detalleOrden.codigo}): Stock insuficiente. Disponible: ${stockActual.toFixed(4)}, Requerido: ${cantidadSolicitada.toFixed(4)}`
        });
      }
      
      // Validar que el id_producto coincida
      if (item.id_producto !== detalleOrden.id_producto) {
        return res.status(400).json({
          success: false,
          error: `El producto del detalle no coincide con el de la orden`
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
    
    const numeroGuia = `T001-${String(numeroSecuencia).padStart(8, '0')}`;
    
    // Crear la guía
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
      orden.id_cliente,
      fecha_emision || new Date().toISOString().split('T')[0],
      fecha_traslado || new Date().toISOString().split('T')[0],
      direccion_partida || 'Almacén Central',
      direccion_llegada,
      tipo_traslado || 'Privado',
      motivo_traslado || 'Venta',
      modalidad_transporte || 'Transporte Privado',
      direccion_partida,
      ubigeo_partida,
      direccion_llegada,
      ubigeo_llegada,
      ciudad_llegada,
      parseFloat(peso_bruto_kg) || 0,
      parseInt(numero_bultos) || 0,
      observaciones
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idGuia = result.data.insertId;
    
    // Insertar detalle de la guía
    for (const item of detalle) {
      const pesoTotal = parseFloat(item.cantidad) * parseFloat(item.peso_unitario_kg || 0);
      
      await executeQuery(`
        INSERT INTO detalle_guia_remision (
          id_guia,
          id_detalle_orden,
          id_producto,
          cantidad,
          unidad_medida,
          descripcion,
          peso_unitario_kg,
          peso_total_kg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        idGuia,
        item.id_detalle_orden,
        item.id_producto,
        parseFloat(item.cantidad),
        item.unidad_medida || 'UND',
        item.descripcion || item.producto || '',
        parseFloat(item.peso_unitario_kg) || 0,
        pesoTotal
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

export async function despacharGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { fecha_despacho } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    // Obtener información de la guía
    const guiaResult = await executeQuery(`
      SELECT 
        gr.*,
        ov.id_cliente,
        ov.estado AS estado_orden
      FROM guias_remision gr
      INNER JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      WHERE gr.id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    
    if (guia.estado !== 'Emitida') {
      return res.status(400).json({
        success: false,
        error: `Solo se pueden despachar guías en estado Emitida. Estado actual: ${guia.estado}`
      });
    }
    
    // Obtener detalle de la guía con información completa del producto
    const detalleResult = await executeQuery(`
      SELECT 
        dgr.*,
        p.id_tipo_inventario,
        p.costo_unitario_promedio,
        p.stock_actual,
        p.codigo,
        p.nombre AS producto,
        p.unidad_medida AS unidad_producto
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia = ?
      ORDER BY dgr.id_detalle
    `, [id]);
    
    if (!detalleResult.success || detalleResult.data.length === 0) {
      return res.status(500).json({ 
        success: false,
        error: 'Error al obtener detalle de la guía' 
      });
    }
    
    const detalle = detalleResult.data;
    
    // Validar stock actual antes de despachar
    for (const item of detalle) {
      const stockActual = parseFloat(item.stock_actual);
      const cantidadDespachar = parseFloat(item.cantidad);
      
      if (stockActual < cantidadDespachar) {
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente para ${item.producto} (${item.codigo}). Disponible: ${stockActual.toFixed(4)}, Requerido: ${cantidadDespachar.toFixed(4)}`
        });
      }
    }
    
    // Usar el tipo de inventario del primer producto (todos deberían ser del mismo tipo en una guía)
    const id_tipo_inventario = detalle[0].id_tipo_inventario;
    
    // Calcular totales
    let totalCosto = 0;
    let totalPrecio = 0;
    
    for (const item of detalle) {
      const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
      const cantidad = parseFloat(item.cantidad);
      
      totalCosto += cantidad * costoUnitario;
      totalPrecio += cantidad * costoUnitario;
    }
    
    // Crear la salida de inventario
    const salidaResult = await executeQuery(`
      INSERT INTO salidas (
        id_tipo_inventario,
        tipo_movimiento,
        id_cliente,
        total_costo,
        total_precio,
        moneda,
        id_registrado_por,
        observaciones,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id_tipo_inventario,
      'Venta',
      guia.id_cliente,
      totalCosto,
      totalPrecio,
      'PEN',
      id_usuario,
      `Despacho Guía ${guia.numero_guia} - Orden ${guia.id_orden_venta}`,
      'Activo'
    ]);
    
    if (!salidaResult.success) {
      return res.status(500).json({
        success: false,
        error: `Error al crear salida: ${salidaResult.error}`
      });
    }
    
    const id_salida = salidaResult.data.insertId;
    
    // Procesar cada producto
    for (const item of detalle) {
      const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
      const cantidad = parseFloat(item.cantidad);
      
      // Insertar detalle de salida
      const detalleSalidaResult = await executeQuery(`
        INSERT INTO detalle_salidas (
          id_salida,
          id_producto,
          cantidad,
          costo_unitario,
          precio_unitario
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        id_salida,
        item.id_producto,
        cantidad,
        costoUnitario,
        costoUnitario
      ]);
      
      if (!detalleSalidaResult.success) {
        return res.status(500).json({
          success: false,
          error: `Error al crear detalle de salida para ${item.producto}: ${detalleSalidaResult.error}`
        });
      }
      
      // Actualizar stock del producto
      const updateStockResult = await executeQuery(`
        UPDATE productos 
        SET stock_actual = stock_actual - ?
        WHERE id_producto = ?
      `, [cantidad, item.id_producto]);
      
      if (!updateStockResult.success) {
        return res.status(500).json({
          success: false,
          error: `Error al actualizar stock de ${item.producto}: ${updateStockResult.error}`
        });
      }
      
      // Actualizar cantidad despachada en la orden
      const updateOrdenResult = await executeQuery(`
        UPDATE detalle_orden_venta
        SET cantidad_despachada = cantidad_despachada + ?
        WHERE id_detalle = ?
      `, [cantidad, item.id_detalle_orden]);
      
      if (!updateOrdenResult.success) {
        return res.status(500).json({
          success: false,
          error: `Error al actualizar orden para ${item.producto}: ${updateOrdenResult.error}`
        });
      }
    }
    
    // Actualizar estado de la guía
    await executeQuery(`
      UPDATE guias_remision
      SET estado = 'En Tránsito'
      WHERE id_guia = ?
    `, [id]);
    
    // Actualizar estado de la orden
    await executeQuery(`
      UPDATE ordenes_venta
      SET estado = 'Despachada'
      WHERE id_orden_venta = ?
    `, [guia.id_orden_venta]);
    
    res.json({
      success: true,
      message: `Guía despachada exitosamente. Salida ID: ${id_salida}`,
      data: {
        id_salida,
        productos_despachados: detalle.length,
        total_costo: totalCosto.toFixed(2)
      }
    });
    
  } catch (error) {
    console.error('Error al despachar guía:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function marcarEntregadaGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { fecha_entrega } = req.body;
    
    const guiaResult = await executeQuery(`
      SELECT estado, id_orden_venta
      FROM guias_remision
      WHERE id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const guia = guiaResult.data[0];
    
    if (guia.estado !== 'En Tránsito') {
      return res.status(400).json({
        success: false,
        error: `Solo se pueden marcar como entregadas las guías En Tránsito. Estado actual: ${guia.estado}`
      });
    }
    
    await executeQuery(`
      UPDATE guias_remision
      SET estado = 'Entregada'
      WHERE id_guia = ?
    `, [id]);
    
    // Verificar si todas las guías de la orden están entregadas
    if (guia.id_orden_venta) {
      const pendientesResult = await executeQuery(`
        SELECT COUNT(*) as pendientes
        FROM guias_remision
        WHERE id_orden_venta = ? AND estado NOT IN ('Entregada', 'Anulada')
      `, [guia.id_orden_venta]);
      
      if (pendientesResult.success && pendientesResult.data[0].pendientes === 0) {
        await executeQuery(`
          UPDATE ordenes_venta
          SET estado = 'Entregada',
              fecha_entrega_real = ?
          WHERE id_orden_venta = ?
        `, [fecha_entrega || new Date().toISOString().split('T')[0], guia.id_orden_venta]);
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

export async function actualizarEstadoGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const estadosValidos = ['Emitida', 'En Tránsito', 'Entregada', 'Anulada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const guiaResult = await executeQuery(`
      SELECT estado FROM guias_remision WHERE id_guia = ?
    `, [id]);
    
    if (!guiaResult.success || guiaResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Guía no encontrada'
      });
    }
    
    const estadoActual = guiaResult.data[0].estado;
    
    if (estado === 'Anulada' && (estadoActual === 'En Tránsito' || estadoActual === 'Entregada')) {
      return res.status(400).json({
        success: false,
        error: 'No se puede anular una guía que ya fue despachada o entregada'
      });
    }
    
    await executeQuery(`
      UPDATE guias_remision
      SET estado = ?
      WHERE id_guia = ?
    `, [estado, id]);
    
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

export async function getEstadisticasGuiasRemision(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_guias,
        SUM(CASE WHEN estado = 'Emitida' THEN 1 ELSE 0 END) AS emitidas,
        SUM(CASE WHEN estado = 'En Tránsito' THEN 1 ELSE 0 END) AS en_transito,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN estado = 'Anulada' THEN 1 ELSE 0 END) AS anuladas,
        SUM(peso_bruto_kg) AS peso_total,
        SUM(numero_bultos) AS bultos_total,
        COUNT(DISTINCT id_orden_venta) AS ordenes_relacionadas
      FROM guias_remision
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

export async function descargarPDFGuiaRemision(req, res) {
  try {
    const { id } = req.params;
    
    const guiaResult = await executeQuery(`
      SELECT 
        gr.*,
        ov.numero_orden,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente
      FROM guias_remision gr
      LEFT JOIN ordenes_venta ov ON gr.id_orden_venta = ov.id_orden_venta
      LEFT JOIN clientes cl ON gr.id_cliente = cl.id_cliente
      WHERE gr.id_guia = ?
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
        p.nombre AS producto
      FROM detalle_guia_remision dgr
      INNER JOIN productos p ON dgr.id_producto = p.id_producto
      WHERE dgr.id_guia = ?
      ORDER BY dgr.id_detalle
    `, [id]);
    
    guia.detalle = detalleResult.data;
    
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