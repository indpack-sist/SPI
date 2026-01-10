import { executeQuery } from '../config/database.js';
import { generarOrdenVentaPDF } from '../utils/pdfGenerators/ordenVentaPDF.js';

export async function getAllOrdenesVenta(req, res) {
  try {
    const { estado, prioridad, fecha_inicio, fecha_fin } = req.query;
    
    let sql = `
      SELECT 
        ov.id_orden_venta,
        ov.numero_orden,
        ov.fecha_emision,
        ov.fecha_entrega_estimada,
        ov.fecha_entrega_real,
        ov.estado,
        ov.prioridad,
        ov.subtotal,
        ov.igv,
        ov.total,
        ov.moneda,
        ov.id_cotizacion,
        c.numero_cotizacion,
        cl.id_cliente,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        e_comercial.nombre_completo AS comercial,
        e_registrado.nombre_completo AS registrado_por,
        ov.id_comercial,
        ov.id_registrado_por,
        (SELECT COUNT(*) FROM detalle_orden_venta WHERE id_orden_venta = ov.id_orden_venta) AS total_items
      FROM ordenes_venta ov
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      WHERE 1=1
    `;
    
    const params = [];
    
    if (estado) {
      sql += ` AND ov.estado = ?`;
      params.push(estado);
    }
    
    if (prioridad) {
      sql += ` AND ov.prioridad = ?`;
      params.push(prioridad);
    }
    
    if (fecha_inicio) {
      sql += ` AND DATE(ov.fecha_emision) >= ?`;
      params.push(fecha_inicio);
    }
    
    if (fecha_fin) {
      sql += ` AND DATE(ov.fecha_emision) <= ?`;
      params.push(fecha_fin);
    }
    
    sql += ` ORDER BY ov.fecha_emision DESC, ov.id_orden_venta DESC`;
    
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
    console.error('Error al obtener órdenes de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getOrdenVentaById(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        e.nombre_completo AS comercial,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e ON ov.id_comercial = e.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success) {
      return res.status(500).json({ 
        success: false,
        error: ordenResult.error 
      });
    }
    
    if (ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        dov.subtotal AS valor_venta,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.requiere_receta,
        p.stock_actual AS stock_disponible,
        ti.nombre AS tipo_inventario_nombre
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      LEFT JOIN tipos_inventario ti ON p.id_tipo_inventario = ti.id_tipo_inventario
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({ 
        success: false,
        error: detalleResult.error 
      });
    }
    
    orden.detalle = detalleResult.data;
    
    res.json({
      success: true,
      data: orden
    });
    
  } catch (error) {
    console.error('Error al obtener orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function createOrdenVenta(req, res) {
  try {
    const {
      id_cliente,
      id_cotizacion,
      fecha_emision,
      fecha_entrega_estimada,
      prioridad,
      moneda,
      tipo_cambio,
      tipo_impuesto,
      porcentaje_impuesto,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial,
      detalle
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_cliente || !detalle || detalle.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cliente y detalle son obligatorios'
      });
    }
    
    if (!id_registrado_por) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    const ultimaResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_venta 
      ORDER BY id_orden_venta DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrden = `OV-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    let subtotal = 0;
    for (const item of detalle) {
      const valorVenta = parseFloat(item.cantidad) * parseFloat(item.precio_unitario);
      const descuentoItem = valorVenta * (parseFloat(item.descuento_porcentaje || 0) / 100);
      subtotal += valorVenta - descuentoItem;
    }
    
    const porcentaje_imp = parseFloat(porcentaje_impuesto || 18);
    const impuesto = subtotal * (porcentaje_imp / 100);
    const total = subtotal + impuesto;
    
    const result = await executeQuery(`
      INSERT INTO ordenes_venta (
        numero_orden,
        id_cliente,
        id_cotizacion,
        fecha_emision,
        fecha_entrega_estimada,
        prioridad,
        moneda,
        tipo_cambio,
        tipo_impuesto,
        porcentaje_impuesto,
        plazo_pago,
        forma_pago,
        orden_compra_cliente,
        direccion_entrega,
        lugar_entrega,
        ciudad_entrega,
        contacto_entrega,
        telefono_entrega,
        observaciones,
        id_comercial,
        id_registrado_por,
        subtotal,
        igv,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [
      numeroOrden,
      id_cliente,
      id_cotizacion || null,
      fecha_emision,
      fecha_entrega_estimada || null,
      prioridad || 'Media',
      moneda,
      parseFloat(tipo_cambio || 1.0000),
      tipo_impuesto || 'IGV',
      porcentaje_imp,
      plazo_pago,
      forma_pago,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega,
      ciudad_entrega,
      contacto_entrega,
      telefono_entrega,
      observaciones,
      id_comercial || null,
      id_registrado_por,
      subtotal,
      impuesto,
      total
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idOrden = result.data.insertId;
    
    for (let i = 0; i < detalle.length; i++) {
      const item = detalle[i];
      
      await executeQuery(`
        INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          descuento_porcentaje
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        idOrden,
        item.id_producto,
        parseFloat(item.cantidad),
        parseFloat(item.precio_unitario),
        parseFloat(item.descuento_porcentaje || 0)
      ]);
    }
    
    if (id_cotizacion) {
      await executeQuery(`
        UPDATE cotizaciones 
        SET estado = 'Convertida',
            id_orden_venta = ?
        WHERE id_cotizacion = ?
      `, [idOrden, id_cotizacion]);
    }
    
    res.status(201).json({
      success: true,
      data: {
        id_orden_venta: idOrden,
        numero_orden: numeroOrden
      },
      message: 'Orden de venta creada exitosamente'
    });
    
  } catch (error) {
    console.error('Error al crear orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function actualizarEstadoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { estado, fecha_entrega_real } = req.body;
    const id_usuario = req.user?.id_empleado || null;
    
    const estadosValidos = ['Pendiente', 'Confirmada', 'En Preparación', 'Despachada', 'Entregada', 'Cancelada'];
    
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: 'Estado no válido'
      });
    }
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const ordenActual = ordenResult.data[0];
    const estadoAnterior = ordenActual.estado;
    
    if (estado === 'Entregada') {
      const detalleResult = await executeQuery(`
        SELECT * FROM detalle_orden_venta WHERE id_orden_venta = ?
      `, [id]);
      
      const pendientes = detalleResult.data.filter(d => 
        parseFloat(d.cantidad_despachada) < parseFloat(d.cantidad)
      );
      
      if (pendientes.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'No se puede marcar como entregada. Hay productos pendientes de despacho.'
        });
      }
    }
    
    if (estado === 'Confirmada' && estadoAnterior === 'Pendiente') {
      const detalleResult = await executeQuery(`
        SELECT 
          dov.id_detalle,
          dov.id_producto,
          dov.cantidad,
          dov.precio_unitario,
          dov.descuento_porcentaje,
          p.codigo AS codigo_producto,
          p.nombre AS producto,
          p.unidad_medida,
          p.stock_actual,
          p.costo_unitario_promedio,
          p.precio_venta,
          p.id_tipo_inventario
        FROM detalle_orden_venta dov
        INNER JOIN productos p ON dov.id_producto = p.id_producto
        WHERE dov.id_orden_venta = ?
      `, [id]);
      
      if (!detalleResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Error al obtener detalle de la orden'
        });
      }
      
      for (const item of detalleResult.data) {
        const stockDisponible = parseFloat(item.stock_actual);
        const cantidadRequerida = parseFloat(item.cantidad);
        
        if (stockDisponible < cantidadRequerida) {
          return res.status(400).json({
            success: false,
            error: `Stock insuficiente para ${item.producto}. Disponible: ${stockDisponible}, Requerido: ${cantidadRequerida}`
          });
        }
      }
      
      const id_tipo_inventario = detalleResult.data[0].id_tipo_inventario || 4;
      
      let totalCosto = 0;
      let totalPrecio = 0;
      
      for (const item of detalleResult.data) {
        const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
        const precioUnitario = parseFloat(item.precio_unitario || 0);
        const cantidad = parseFloat(item.cantidad);
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        
        const precioConDescuento = precioUnitario * (1 - descuento / 100);
        
        totalCosto += cantidad * costoUnitario;
        totalPrecio += cantidad * precioConDescuento;
      }
      
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
        ordenActual.id_cliente,
        totalCosto,
        totalPrecio,
        ordenActual.moneda || 'PEN',
        id_usuario,
        `[RESERVA] Orden de Venta ${ordenActual.numero_orden}`,
        'Activo'
      ]);
      
      if (!salidaResult.success) {
        return res.status(500).json({
          success: false,
          error: `Error al crear salida de reserva: ${salidaResult.error}`
        });
      }
      
      const id_salida = salidaResult.data.insertId;
      
      let productosReservados = 0;
      
      for (const item of detalleResult.data) {
        const costoUnitario = parseFloat(item.costo_unitario_promedio || 0);
        const precioUnitario = parseFloat(item.precio_unitario || 0);
        const cantidad = parseFloat(item.cantidad);
        const descuento = parseFloat(item.descuento_porcentaje || 0);
        
        const precioConDescuento = precioUnitario * (1 - descuento / 100);
        
        const detalleInsertResult = await executeQuery(`
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
          precioConDescuento
        ]);
        
        if (!detalleInsertResult.success) {
          await executeQuery('DELETE FROM salidas WHERE id_salida = ?', [id_salida]);
          
          return res.status(500).json({
            success: false,
            error: `Error al insertar detalle: ${detalleInsertResult.error}`
          });
        }
        
        const stockUpdateResult = await executeQuery(`
          UPDATE productos 
          SET stock_actual = stock_actual - ?
          WHERE id_producto = ?
        `, [cantidad, item.id_producto]);
        
        if (!stockUpdateResult.success) {
          console.error(`Error actualizando stock para ${item.producto}:`, stockUpdateResult.error);
        }
        
        productosReservados++;
      }
      
      await executeQuery(`
        UPDATE ordenes_venta 
        SET estado = ?,
            fecha_entrega_real = ?
        WHERE id_orden_venta = ?
      `, [estado, fecha_entrega_real || null, id]);
      
      return res.json({
        success: true,
        message: `Orden confirmada. Stock reservado exitosamente (Salida ID: ${id_salida})`,
        data: {
          id_salida,
          productos_reservados: productosReservados,
          total_costo: totalCosto,
          total_precio: totalPrecio
        }
      });
    }
    
    if (estado === 'Cancelada' && estadoAnterior === 'Confirmada') {
      const salidaResult = await executeQuery(`
        SELECT id_salida 
        FROM salidas 
        WHERE id_cliente = ?
        AND tipo_movimiento = 'Venta'
        AND estado = 'Activo'
        AND observaciones LIKE ?
        ORDER BY fecha_movimiento DESC
        LIMIT 1
      `, [ordenActual.id_cliente, `%${ordenActual.numero_orden}%`]);
      
      if (salidaResult.success && salidaResult.data.length > 0) {
        const id_salida = salidaResult.data[0].id_salida;
        
        const detalleSalidaResult = await executeQuery(`
          SELECT id_producto, cantidad 
          FROM detalle_salidas 
          WHERE id_salida = ?
        `, [id_salida]);
        
        if (detalleSalidaResult.success) {
          for (const item of detalleSalidaResult.data) {
            await executeQuery(`
              UPDATE productos 
              SET stock_actual = stock_actual + ?
              WHERE id_producto = ?
            `, [item.cantidad, item.id_producto]);
          }
        }
        
        await executeQuery(`
          UPDATE salidas 
          SET estado = 'Anulado',
              observaciones = CONCAT(observaciones, ' - ANULADA: Orden de venta cancelada')
          WHERE id_salida = ?
        `, [id_salida]);
        
        await executeQuery(`
          UPDATE ordenes_venta 
          SET estado = ?,
              fecha_entrega_real = ?
          WHERE id_orden_venta = ?
        `, [estado, fecha_entrega_real || null, id]);
        
        return res.json({
          success: true,
          message: `Orden cancelada. Stock restaurado exitosamente (Salida ID: ${id_salida} anulada)`,
          data: {
            id_salida_anulada: id_salida,
            productos_restaurados: detalleSalidaResult.data.length
          }
        });
      }
    }
    
    const result = await executeQuery(`
      UPDATE ordenes_venta 
      SET estado = ?,
          fecha_entrega_real = ?
      WHERE id_orden_venta = ?
    `, [estado, fecha_entrega_real || null, id]);
    
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

export async function actualizarPrioridadOrdenVenta(req, res) {
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
      UPDATE ordenes_venta 
      SET prioridad = ? 
      WHERE id_orden_venta = ?
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

export async function actualizarProgresoOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    const { detalle } = req.body;
    
    for (const item of detalle) {
      await executeQuery(`
        UPDATE detalle_orden_venta 
        SET cantidad_producida = ?,
            cantidad_despachada = ?
        WHERE id_detalle = ?
      `, [
        item.cantidad_producida || 0,
        item.cantidad_despachada || 0,
        item.id_detalle
      ]);
    }
    
    res.json({
      success: true,
      message: 'Progreso actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al actualizar progreso:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getEstadisticasOrdenesVenta(req, res) {
  try {
    const result = await executeQuery(`
      SELECT 
        COUNT(*) AS total_ordenes,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'Confirmada' THEN 1 ELSE 0 END) AS confirmadas,
        SUM(CASE WHEN estado = 'En Preparación' THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado = 'Despachada' THEN 1 ELSE 0 END) AS despachadas,
        SUM(CASE WHEN estado = 'Entregada' THEN 1 ELSE 0 END) AS entregadas,
        SUM(CASE WHEN prioridad = 'Urgente' THEN 1 ELSE 0 END) AS urgentes,
        SUM(total) AS monto_total,
        COUNT(DISTINCT id_cliente) AS clientes_unicos
      FROM ordenes_venta
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

export async function convertirCotizacionAOrden(req, res) {
  try {
    const { id } = req.params;
    const {
      orden_compra_cliente,
      fecha_entrega_programada,
      direccion_entrega,
      contacto_entrega,
      telefono_entrega,
      lugar_entrega,
      ciudad_entrega,
      observaciones
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_registrado_por) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    if (!orden_compra_cliente || orden_compra_cliente.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'La orden de compra del cliente es obligatoria'
      });
    }
    
    if (!fecha_entrega_programada) {
      return res.status(400).json({
        success: false,
        error: 'La fecha de entrega programada es obligatoria'
      });
    }
    
    if (!direccion_entrega || direccion_entrega.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'La dirección de entrega confirmada es obligatoria'
      });
    }
    
    if (!contacto_entrega || !telefono_entrega) {
      return res.status(400).json({
        success: false,
        error: 'El contacto de recepción (nombre y teléfono) es obligatorio'
      });
    }
    
    const cotizacionResult = await executeQuery(`
      SELECT 
        c.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      WHERE c.id_cotizacion = ?
    `, [id]);
    
    if (!cotizacionResult.success || cotizacionResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cotización no encontrada'
      });
    }
    
    const cotizacion = cotizacionResult.data[0];
    
    if (cotizacion.estado === 'Convertida') {
      return res.status(400).json({
        success: false,
        error: 'Esta cotización ya fue convertida a orden de venta'
      });
    }
    
    if (cotizacion.estado !== 'Aprobada') {
      return res.status(400).json({
        success: false,
        error: 'Solo se pueden convertir cotizaciones aprobadas'
      });
    }
    
    const detalleResult = await executeQuery(`
      SELECT 
        dc.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida,
        p.stock_actual,
        p.requiere_receta
      FROM detalle_cotizacion dc
      INNER JOIN productos p ON dc.id_producto = p.id_producto
      WHERE dc.id_cotizacion = ?
      ORDER BY dc.orden
    `, [id]);
    
    if (!detalleResult.success || detalleResult.data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'La cotización no tiene productos'
      });
    }
    
    const productosInsuficientes = [];
    const productosRequierenProduccion = [];
    
    for (const item of detalleResult.data) {
      const stockDisponible = parseFloat(item.stock_actual || 0);
      const cantidadRequerida = parseFloat(item.cantidad);
      
      if (stockDisponible < cantidadRequerida) {
        productosInsuficientes.push({
          producto: item.producto,
          requerido: cantidadRequerida,
          disponible: stockDisponible,
          faltante: cantidadRequerida - stockDisponible
        });
        
        if (item.requiere_receta) {
          productosRequierenProduccion.push(item.producto);
        }
      }
    }
    
    const ultimaResult = await executeQuery(`
      SELECT numero_orden 
      FROM ordenes_venta 
      ORDER BY id_orden_venta DESC 
      LIMIT 1
    `);
    
    let numeroSecuencia = 1;
    if (ultimaResult.success && ultimaResult.data.length > 0) {
      const match = ultimaResult.data[0].numero_orden.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroOrden = `OV-${new Date().getFullYear()}-${String(numeroSecuencia).padStart(4, '0')}`;
    
    const result = await executeQuery(`
      INSERT INTO ordenes_venta (
        numero_orden,
        id_cliente,
        id_cotizacion,
        id_comercial,
        fecha_emision,
        fecha_entrega_programada,
        prioridad,
        moneda,
        tipo_cambio,
        tipo_impuesto,
        porcentaje_impuesto,
        plazo_pago,
        forma_pago,
        orden_compra_cliente,
        direccion_entrega,
        lugar_entrega,
        ciudad_entrega,
        contacto_entrega,
        telefono_entrega,
        observaciones,
        id_registrado_por,
        subtotal,
        igv,
        total,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `, [
      numeroOrden,
      cotizacion.id_cliente,
      id,
      cotizacion.id_comercial || null,
      new Date().toISOString().split('T')[0],
      fecha_entrega_programada,
      cotizacion.prioridad || 'Media',
      cotizacion.moneda || 'PEN',
      parseFloat(cotizacion.tipo_cambio || 1.0000),
      cotizacion.tipo_impuesto || 'IGV',
      parseFloat(cotizacion.porcentaje_impuesto || 18.00),
      cotizacion.plazo_pago || null,
      cotizacion.forma_pago || null,
      orden_compra_cliente,
      direccion_entrega,
      lugar_entrega || null,
      ciudad_entrega || null,
      contacto_entrega,
      telefono_entrega,
      observaciones || cotizacion.observaciones || null,
      id_registrado_por,
      parseFloat(cotizacion.subtotal || 0),
      parseFloat(cotizacion.igv || 0),
      parseFloat(cotizacion.total || 0)
    ]);
    
    if (!result.success) {
      return res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
    
    const idOrden = result.data.insertId;
    
    for (const item of detalleResult.data) {
      await executeQuery(`
        INSERT INTO detalle_orden_venta (
          id_orden_venta,
          id_producto,
          cantidad,
          precio_unitario,
          descuento_porcentaje
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        idOrden,
        item.id_producto,
        parseFloat(item.cantidad),
        parseFloat(item.precio_unitario),
        parseFloat(item.descuento_porcentaje || 0)
      ]);
    }
    
    await executeQuery(`
      UPDATE cotizaciones 
      SET estado = 'Convertida',
          id_orden_venta = ?
      WHERE id_cotizacion = ?
    `, [idOrden, id]);
    
    const responseData = {
      id_orden_venta: idOrden,
      numero_orden: numeroOrden,
      numero_cotizacion: cotizacion.numero_cotizacion
    };
    
    if (productosInsuficientes.length > 0) {
      responseData.alertas = {
        stock_insuficiente: productosInsuficientes,
        requieren_produccion: productosRequierenProduccion
      };
    }
    
    res.status(201).json({
      success: true,
      data: responseData,
      message: productosInsuficientes.length > 0 
        ? `Orden creada con alertas de stock. ${productosInsuficientes.length} producto(s) requieren atención.`
        : 'Orden de venta creada exitosamente desde cotización'
    });
    
  } catch (error) {
    console.error('Error al convertir cotización:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
export async function descargarPDFOrdenVenta(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        ov.*,
        cl.razon_social AS cliente,
        cl.ruc AS ruc_cliente,
        cl.direccion_despacho AS direccion_cliente,
        cl.telefono AS telefono_cliente,
        e_comercial.nombre_completo AS comercial,
        e_comercial.email AS email_comercial,
        e_registrado.nombre_completo AS registrado_por,
        c.numero_cotizacion
      FROM ordenes_venta ov
      LEFT JOIN clientes cl ON ov.id_cliente = cl.id_cliente
      LEFT JOIN empleados e_comercial ON ov.id_comercial = e_comercial.id_empleado
      LEFT JOIN empleados e_registrado ON ov.id_registrado_por = e_registrado.id_empleado
      LEFT JOIN cotizaciones c ON ov.id_cotizacion = c.id_cotizacion
      WHERE ov.id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    
    const detalleResult = await executeQuery(`
      SELECT 
        dov.*,
        p.codigo AS codigo_producto,
        p.nombre AS producto,
        p.unidad_medida
      FROM detalle_orden_venta dov
      INNER JOIN productos p ON dov.id_producto = p.id_producto
      WHERE dov.id_orden_venta = ?
      ORDER BY dov.id_detalle
    `, [id]);
    
    if (!detalleResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de la orden'
      });
    }
    
    orden.detalle = detalleResult.data;
    
    const pdfBuffer = await generarOrdenVentaPDF(orden);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="OrdenVenta-${orden.numero_orden}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al generar PDF de orden de venta:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
export async function registrarPagoOrden(req, res) {
  try {
    const { id } = req.params;
    const {
      fecha_pago,
      monto_pagado,
      metodo_pago,
      numero_operacion,
      banco,
      observaciones
    } = req.body;
    
    const id_registrado_por = req.user?.id_empleado || null;
    
    if (!id_registrado_por) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    if (!fecha_pago || !monto_pagado || monto_pagado <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Fecha de pago y monto son obligatorios'
      });
    }
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const totalOrden = parseFloat(orden.total);
    const montoPagadoActual = parseFloat(orden.monto_pagado || 0);
    const montoNuevoPago = parseFloat(monto_pagado);
    
    if (montoPagadoActual + montoNuevoPago > totalOrden) {
      return res.status(400).json({
        success: false,
        error: `El monto a pagar (${montoNuevoPago}) excede el saldo pendiente (${totalOrden - montoPagadoActual})`
      });
    }
    
    const ultimoPagoResult = await executeQuery(`
      SELECT numero_pago 
      FROM pagos_ordenes_venta 
      WHERE id_orden_venta = ?
      ORDER BY id_pago_orden DESC 
      LIMIT 1
    `, [id]);
    
    let numeroSecuencia = 1;
    if (ultimoPagoResult.success && ultimoPagoResult.data.length > 0) {
      const match = ultimoPagoResult.data[0].numero_pago.match(/(\d+)$/);
      if (match) {
        numeroSecuencia = parseInt(match[1]) + 1;
      }
    }
    
    const numeroPago = `${orden.numero_orden}-P${String(numeroSecuencia).padStart(2, '0')}`;
    
    const pagoResult = await executeQuery(`
      INSERT INTO pagos_ordenes_venta (
        id_orden_venta,
        numero_pago,
        fecha_pago,
        monto_pagado,
        metodo_pago,
        numero_operacion,
        banco,
        observaciones,
        id_registrado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      numeroPago,
      fecha_pago,
      montoNuevoPago,
      metodo_pago || 'Transferencia',
      numero_operacion || null,
      banco || null,
      observaciones || null,
      id_registrado_por
    ]);
    
    if (!pagoResult.success) {
      return res.status(500).json({
        success: false,
        error: pagoResult.error
      });
    }
    
    const nuevoMontoPagado = montoPagadoActual + montoNuevoPago;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado === 0) {
      estadoPago = 'Pendiente';
    }
    
    await executeQuery(`
      UPDATE ordenes_venta 
      SET monto_pagado = ?,
          estado_pago = ?
      WHERE id_orden_venta = ?
    `, [nuevoMontoPagado, estadoPago, id]);
    
    res.status(201).json({
      success: true,
      data: {
        id_pago_orden: pagoResult.data.insertId,
        numero_pago: numeroPago,
        monto_pagado: montoNuevoPago,
        nuevo_monto_total_pagado: nuevoMontoPagado,
        saldo_pendiente: totalOrden - nuevoMontoPagado,
        estado_pago: estadoPago
      },
      message: 'Pago registrado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenCheck = await executeQuery(`
      SELECT id_orden_venta FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenCheck.success || ordenCheck.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const result = await executeQuery(`
      SELECT 
        p.*,
        e.nombre_completo AS registrado_por
      FROM pagos_ordenes_venta p
      LEFT JOIN empleados e ON p.id_registrado_por = e.id_empleado
      WHERE p.id_orden_venta = ?
      ORDER BY p.fecha_pago DESC, p.id_pago_orden DESC
    `, [id]);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      total: result.data.length
    });
    
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function anularPagoOrden(req, res) {
  try {
    const { id, idPago } = req.params;
    const id_usuario = req.user?.id_empleado || null;
    
    if (!id_usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    const pagoResult = await executeQuery(`
      SELECT * FROM pagos_ordenes_venta 
      WHERE id_pago_orden = ? AND id_orden_venta = ?
    `, [idPago, id]);
    
    if (!pagoResult.success || pagoResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pago no encontrado'
      });
    }
    
    const pago = pagoResult.data[0];
    const montoPago = parseFloat(pago.monto_pagado);
    
    const ordenResult = await executeQuery(`
      SELECT * FROM ordenes_venta WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const montoPagadoActual = parseFloat(orden.monto_pagado || 0);
    const totalOrden = parseFloat(orden.total);
    
    await executeQuery(`
      DELETE FROM pagos_ordenes_venta WHERE id_pago_orden = ?
    `, [idPago]);
    
    const nuevoMontoPagado = montoPagadoActual - montoPago;
    let estadoPago = 'Parcial';
    
    if (nuevoMontoPagado >= totalOrden) {
      estadoPago = 'Pagado';
    } else if (nuevoMontoPagado === 0) {
      estadoPago = 'Pendiente';
    }
    
    await executeQuery(`
      UPDATE ordenes_venta 
      SET monto_pagado = ?,
          estado_pago = ?
      WHERE id_orden_venta = ?
    `, [nuevoMontoPagado, estadoPago, id]);
    
    res.json({
      success: true,
      data: {
        monto_anulado: montoPago,
        nuevo_monto_total_pagado: nuevoMontoPagado,
        saldo_pendiente: totalOrden - nuevoMontoPagado,
        estado_pago: estadoPago
      },
      message: 'Pago anulado exitosamente'
    });
    
  } catch (error) {
    console.error('Error al anular pago:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export async function getResumenPagosOrden(req, res) {
  try {
    const { id } = req.params;
    
    const ordenResult = await executeQuery(`
      SELECT 
        numero_orden,
        total,
        monto_pagado,
        estado_pago,
        moneda
      FROM ordenes_venta 
      WHERE id_orden_venta = ?
    `, [id]);
    
    if (!ordenResult.success || ordenResult.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Orden de venta no encontrada'
      });
    }
    
    const orden = ordenResult.data[0];
    const totalOrden = parseFloat(orden.total);
    const montoPagado = parseFloat(orden.monto_pagado || 0);
    
    const pagosResult = await executeQuery(`
      SELECT COUNT(*) as total_pagos
      FROM pagos_ordenes_venta
      WHERE id_orden_venta = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        numero_orden: orden.numero_orden,
        total_orden: totalOrden,
        monto_pagado: montoPagado,
        saldo_pendiente: totalOrden - montoPagado,
        porcentaje_pagado: totalOrden > 0 ? ((montoPagado / totalOrden) * 100).toFixed(2) : 0,
        estado_pago: orden.estado_pago,
        moneda: orden.moneda,
        total_pagos: pagosResult.data[0].total_pagos
      }
    });
    
  } catch (error) {
    console.error('Error al obtener resumen de pagos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}